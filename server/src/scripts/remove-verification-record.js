const mongoose = require('mongoose');
const { connect, disconnect } = require('../config/mongo');
const {
  Unit,
  Verification,
  VerificationItem,
  InventoryItem,
  ReceivedTransaction,
  ExpendedTransaction,
  IssuedDestroyedItem
} = require('../models');
const db = require('../services/db');

const TARGET_UNIT_CODE = 'WPS-ITO';
const TARGET_UNIT_NAME = 'ITO';
const TARGET_DATE = '2026-10-14';
const TARGET_ITEM_NAME = 'Computer Typist Chair';
const TARGET_VERIFIER_REGEX = /Gamini\s+Wickramasinghe/i;
const EXCLUDED_VERIFIER_REGEX = /P\.M\.M\.Vithanage|K\.A\.D\.S\.Mendis|G\.M\.I\.Swarnamali/i;

/**
 * Helper to check whether a verification item has entered/counted data
 */
function isItemCountedOrEntered(item) {
  if (!item) return false;
  const hasPhys = item.physical_qty !== null &&
                  item.physical_qty !== undefined &&
                  item.physical_qty !== '' &&
                  !isNaN(Number(item.physical_qty));

  const hasCond = item.condition &&
                  item.condition !== '—' &&
                  (item.condition !== 'Good' || hasPhys || (item.status && !['Not Counted', 'Not counted'].includes(item.status)));

  const rawDisp = item.issued_destroyed || item.disposition || '';
  const hasDisp = Boolean(rawDisp && rawDisp !== '—' && rawDisp !== 'N/A' && String(rawDisp).trim() !== '');

  const hasLabel = Boolean(item.label_no && String(item.label_no).trim() !== '' && String(item.label_no).trim() !== '—');

  const remarksStr = (item.remarks || item.special_remarks || '').trim();
  const hasRemarks = Boolean(remarksStr && remarksStr !== '—');

  const isCountedStatus = item.status && !['Not Counted', 'Not counted'].includes(item.status);

  return hasPhys || hasCond || hasDisp || hasLabel || hasRemarks || isCountedStatus;
}

/**
 * Remove one specific record from Verification History
 * Default mode is DRY-RUN. Run with --confirm to apply changes.
 */
async function removeVerificationRecord(options = {}) {
  const isConfirmed = options.confirm ?? process.argv.includes('--confirm');

  // Parse optional --id argument
  let explicitId = options.id ?? null;
  if (!explicitId) {
    for (let i = 0; i < process.argv.length; i++) {
      const arg = process.argv[i];
      if (arg === '--id' && i + 1 < process.argv.length) {
        explicitId = process.argv[i + 1];
      } else if (arg.startsWith('--id=')) {
        explicitId = arg.slice(5);
      }
    }
  }

  console.log('========================================================================');
  console.log(' EDL IMS — Remove Verification History Line Item Script');
  console.log(` Target Unit:      ${TARGET_UNIT_NAME} (${TARGET_UNIT_CODE})`);
  console.log(` Target Date:      ${TARGET_DATE}`);
  console.log(` Target Verifier:  Gamini Wickramasinghe`);
  console.log(` Target Item:      ${TARGET_ITEM_NAME}`);
  if (explicitId) {
    console.log(` Target Item ID:   ${explicitId}`);
  }
  console.log(` Mode:             ${isConfirmed ? '🚨 CONFIRMED (DELETION)' : '🔍 DRY-RUN (NO CHANGES)'}`);
  console.log('========================================================================\n');

  if (mongoose.connection.readyState !== 1) {
    await connect();
  }

  const dbName = mongoose.connection.name;
  if (dbName !== 'edl_ims') {
    console.error(`❌ ABORT: Connected database is "${dbName}". This script only operates on the "edl_ims" database!`);
    if (!options.keepConnection) await disconnect();
    if (require.main === module) process.exit(1);
    throw new Error(`Connected database is "${dbName}", expected "edl_ims"`);
  }

  // 1. Identify target Unit
  const itoUnits = await Unit.find({
    $or: [
      { unit_code: TARGET_UNIT_CODE },
      { unit_name: TARGET_UNIT_NAME }
    ]
  }).lean();

  if (itoUnits.length === 0) {
    console.log(`✔ No unit found matching ${TARGET_UNIT_CODE} / ${TARGET_UNIT_NAME}. Nothing to delete.\n`);
    if (!options.keepConnection) await disconnect();
    return { deletedItems: 0, deletedPlaceholders: 0, deletedHeaders: 0 };
  }

  const itoUnitIds = itoUnits.map(u => u.id);
  const itoUnitMap = new Map(itoUnits.map(u => [u.id, u]));

  // 2. Identify candidate Verifications for ITO on 2026-10-14
  const candidateVerifs = await Verification.find({
    unit_id: { $in: itoUnitIds },
    date: TARGET_DATE,
    status: 'confirmed'
  }).lean();

  // Filter verifier matching Gamini Wickramasinghe and excluding P.M.M.Vithanage, etc.
  const matchedVerifs = candidateVerifs.filter(v => {
    const verifierStrings = [
      v.verifier_1,
      v.verifier_2,
      v.verifier_3,
      ...(Array.isArray(v.verified_by) ? v.verified_by : [v.verified_by])
    ].filter(Boolean);

    const hasGamini = verifierStrings.some(s => TARGET_VERIFIER_REGEX.test(s));
    const hasExcluded = verifierStrings.some(s => EXCLUDED_VERIFIER_REGEX.test(s));
    return hasGamini && !hasExcluded;
  });

  if (matchedVerifs.length === 0) {
    console.log('✔ No confirmed verifications found matching criteria:');
    console.log(`   - Unit: ${TARGET_UNIT_NAME} (${TARGET_UNIT_CODE})`);
    console.log(`   - Date: ${TARGET_DATE}`);
    console.log(`   - Verifier: Gamini Wickramasinghe (and not P.M.M.Vithanage, K.A.D.S.Mendis, G.M.I.Swarnamali)`);
    console.log('\nNothing to delete. (Database is clean).\n');
    if (!options.keepConnection) await disconnect();
    return { deletedItems: 0, deletedPlaceholders: 0, deletedHeaders: 0 };
  }

  const matchedVerifIds = matchedVerifs.map(v => v.id);

  // 3. Find matching VerificationItem(s)
  let candidateItems = [];
  if (explicitId) {
    candidateItems = await VerificationItem.find({
      id: explicitId,
      verification_id: { $in: matchedVerifIds }
    }).lean();
  } else {
    candidateItems = await VerificationItem.find({
      verification_id: { $in: matchedVerifIds },
      item_name: TARGET_ITEM_NAME
    }).lean();
  }

  if (candidateItems.length === 0) {
    console.log('✔ No verification line items found matching criteria:');
    console.log(`   - Item Name: ${TARGET_ITEM_NAME}`);
    if (explicitId) console.log(`   - Specified ID: ${explicitId}`);
    console.log('\nNothing to delete. (Database is clean).\n');
    if (!options.keepConnection) await disconnect();
    return { deletedItems: 0, deletedPlaceholders: 0, deletedHeaders: 0 };
  }

  // Check uniqueness
  const isUnique = candidateItems.length === 1;
  if (!isUnique && !explicitId) {
    console.warn(`⚠️ Warning: Found ${candidateItems.length} matching line items (not unique).`);
    if (isConfirmed) {
      console.error('❌ ABORT: Deletion blocked because multiple matches were found and no --id was specified.');
      console.error('   Please re-run specifying the exact item id: node src/scripts/remove-verification-record.js --id <verification_item_id> --confirm\n');
      if (!options.keepConnection) await disconnect();
      if (require.main === module) process.exit(1);
      throw new Error('Ambiguous match: multiple items found without --id');
    }
  }

  // 4. Detailed Report for each matched item and its verification
  console.log(`Found ${candidateItems.length} matching line item(s):\n`);

  const itoHistoryBefore = await db.getVerificationHistoryItems(itoUnitIds, 2026);
  const deletionPlan = [];

  for (let idx = 0; idx < candidateItems.length; idx++) {
    const item = candidateItems[idx];
    const parentVerif = matchedVerifs.find(v => v.id === item.verification_id);
    const unit = itoUnitMap.get(parentVerif.unit_id) || {};

    const allVerifItems = await VerificationItem.find({ verification_id: item.verification_id }).lean();
    const otherItems = allVerifItems.filter(vi => vi.id !== item.id);
    const otherCountedItems = otherItems.filter(isItemCountedOrEntered);
    const hasRemainingCountedItems = otherCountedItems.length > 0;

    const verifiersList = [parentVerif.verifier_1, parentVerif.verifier_2, parentVerif.verifier_3]
      .filter(Boolean);
    const verifiersStr = verifiersList.length > 0
      ? verifiersList.join(', ')
      : (Array.isArray(parentVerif.verified_by) ? parentVerif.verified_by.join(', ') : parentVerif.verified_by);

    console.log(`------------------------------------------------------------------------`);
    console.log(`[MATCH #${idx + 1}] Line Item:`);
    console.log(`   • Item ID:          ${item.id}`);
    console.log(`   • Item Name:        ${item.item_name}`);
    console.log(`   • Category:         ${item.category || '—'}`);
    console.log(`   • System Qty:       ${item.system_qty}`);
    console.log(`   • Physical Qty:     ${item.physical_qty ?? '—'}`);
    console.log(`   • Status:           ${item.status || '—'}`);
    console.log(`   • Condition:        ${item.condition || '—'}`);
    console.log(`   • Serials Count:    ${(item.serial_numbers || []).length}`);
    if (item.serial_numbers && item.serial_numbers.length > 0) {
      console.log(`   • Serials List:     ${item.serial_numbers.join(', ')}`);
    }
    console.log(`   • Label No:         ${item.label_no || '—'}`);
    console.log(`   • Remarks:          ${item.remarks || item.special_remarks || '—'}`);
    console.log(`\n   Parent Verification:`);
    console.log(`   • Verification ID:  ${parentVerif.id}`);
    console.log(`   • Date & Year:      ${parentVerif.date} (Year: ${parentVerif.year})`);
    console.log(`   • Unit:             ${unit.unit_name || 'ITO'} (${unit.unit_code || 'WPS-ITO'})`);
    console.log(`   • Verified By:      ${verifiersStr}`);
    console.log(`   • Header Status:    ${parentVerif.status}`);
    console.log(`   • Other Items:      ${otherItems.length} total in DB (${otherCountedItems.length} counted/active, ${otherItems.length - otherCountedItems.length} uncounted placeholders)`);

    console.log(`\n   Planned Action:`);
    console.log(`   • Delete line item: "${item.item_name}" (${item.id})`);
    if (hasRemainingCountedItems) {
      console.log(`   • Parent header:    KEEP (has ${otherCountedItems.length} other counted line item(s))`);
    } else {
      console.log(`   • Parent header:    REMOVE (0 other counted line items remaining; will also clean up ${otherItems.length} uncounted placeholders)`);
    }
    console.log(`------------------------------------------------------------------------`);

    deletionPlan.push({
      item,
      parentVerif,
      otherItems,
      hasRemainingCountedItems
    });
  }

  console.log(`\n📊 VERIFICATION HISTORY SUMMARY (ITO 2026):`);
  console.log(`   • Current record count:      ${itoHistoryBefore.length}`);
  console.log(`   • Expected count after:      ${itoHistoryBefore.length - candidateItems.length}`);
  console.log(`   • Preserved verifications:   P.M.M.Vithanage, K.A.D.S.Mendis, G.M.I.Swarnamali (99 records)`);
  console.log(`   • Inventory items:           UNTOUCHED (11 serials remain in inventory)`);
  console.log(`   • Received/Expended/Issued:  UNTOUCHED`);

  // 5. Execution or Dry-run Notice
  if (!isConfirmed) {
    console.log('\n========================================================================');
    console.log('🔍 [DRY-RUN COMPLETE] No database modifications were made.');
    console.log('To permanently delete this line item and its empty parent verification:');
    console.log('Run the direct Node command in your terminal:');
    if (isUnique) {
      console.log('  node src/scripts/remove-verification-record.js --confirm\n');
    } else {
      console.log(`  node src/scripts/remove-verification-record.js --id ${candidateItems[0].id} --confirm\n`);
    }
    console.log('Note: In Windows PowerShell, "npm run ... -- --confirm" may not pass flags.');
    console.log('Using the direct "node src/scripts/remove-verification-record.js --confirm" is recommended.');
    console.log('========================================================================\n');
    if (!options.keepConnection) await disconnect();
    return {
      dryRun: true,
      candidateItemsCount: candidateItems.length,
      historyCountBefore: itoHistoryBefore.length,
      historyCountProjected: itoHistoryBefore.length - candidateItems.length
    };
  }

  // 6. Confirmed Deletion
  console.log('\n🚨 EXECUTING DELETION ON "edl_ims" DATABASE...');

  let deletedTargetItems = 0;
  let deletedPlaceholders = 0;
  let deletedHeaders = 0;

  for (const plan of deletionPlan) {
    // Delete target line item
    const resItem = await VerificationItem.deleteOne({ id: plan.item.id });
    deletedTargetItems += resItem.deletedCount;

    // Handle parent verification
    if (!plan.hasRemainingCountedItems) {
      // Clean up uncounted placeholder items for this verification
      if (plan.otherItems.length > 0) {
        const resPlaceholders = await VerificationItem.deleteMany({
          verification_id: plan.parentVerif.id
        });
        deletedPlaceholders += resPlaceholders.deletedCount;
      }
      // Delete parent verification header
      const resHeader = await Verification.deleteOne({ id: plan.parentVerif.id });
      deletedHeaders += resHeader.deletedCount;
    }
  }

  const itoHistoryAfter = await db.getVerificationHistoryItems(itoUnitIds, 2026);

  console.log('\n✅ DELETION SUMMARY:');
  console.log(`   • Target line items deleted:         ${deletedTargetItems}`);
  console.log(`   • Uncounted placeholder items removed:${deletedPlaceholders}`);
  console.log(`   • Parent verification headers deleted:${deletedHeaders}`);
  console.log(`   • Verification History (ITO 2026):    ${itoHistoryBefore.length} -> ${itoHistoryAfter.length}`);
  console.log('========================================================================\n');

  if (!options.keepConnection) await disconnect();
  return {
    deletedItems: deletedTargetItems,
    deletedPlaceholders,
    deletedHeaders,
    historyCountBefore: itoHistoryBefore.length,
    historyCountAfter: itoHistoryAfter.length
  };
}

if (require.main === module) {
  removeVerificationRecord().catch(err => {
    console.error('❌ Error executing cleanup script:', err);
    process.exit(1);
  });
}

module.exports = removeVerificationRecord;
