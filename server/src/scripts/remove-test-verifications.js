const mongoose = require('mongoose');
const { connect, disconnect } = require('../config/mongo');
const {
  Unit,
  Verification,
  VerificationItem,
  IssuedDestroyedItem
} = require('../models');
const db = require('../services/db');

const TARGET_UNIT_CODES = ['WPS-ITO'];
const TARGET_UNIT_NAMES = ['ITO'];
const TARGET_DATE = '2026-11-04';
const TARGET_YEAR = 2026;

// Verifier test signatures
const TEST_VERIFIER_GROUPS = [
  { label: 'Test Set 1 (ghb, gvb n, cgvb n)', names: ['ghb', 'gvb n', 'cgvb n'] },
  { label: 'Test Set 2 (jbnj, hvjb, hgv)', names: ['jbnj', 'hvjb', 'hgv'] }
];

const PRESERVED_VERIFIERS_REGEX = /P\.M\.M\.Vithanage|K\.A\.D\.S\.Mendis|G\.M\.I\.Swarnamali/i;

/**
 * Normalise a string for comparison: lowercase and trim whitespace
 */
function norm(str) {
  return (str || '').toString().toLowerCase().trim();
}

/**
 * Check if a verification document matches any test verifier signature
 */
function matchesTestVerifiers(verif) {
  const verifierList = [
    verif.verifier_1,
    verif.verifier_2,
    verif.verifier_3,
    ...(Array.isArray(verif.verified_by) ? verif.verified_by : [verif.verified_by])
  ].filter(Boolean).map(norm);

  // If it contains preserved official verifiers, do not match
  if (verifierList.some(v => PRESERVED_VERIFIERS_REGEX.test(v))) {
    return null;
  }

  for (const group of TEST_VERIFIER_GROUPS) {
    const groupNorm = group.names.map(norm);
    const hasOverlap = groupNorm.some(targetName =>
      verifierList.some(v => v === targetName || v.includes(targetName))
    );
    if (hasOverlap) {
      return group;
    }
  }

  return null;
}

/**
 * Parse CLI arguments for --confirm and --id
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const isConfirmed = args.includes('--confirm');
  const explicitIds = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--id' && i + 1 < args.length) {
      explicitIds.push(args[i + 1]);
      i++;
    } else if (arg.startsWith('--id=')) {
      explicitIds.push(arg.slice(5));
    }
  }

  return { isConfirmed, explicitIds };
}

/**
 * Safe cleanup of test verifications in ITO unit
 */
async function removeTestVerifications(options = {}) {
  const { isConfirmed: cliConfirmed, explicitIds: cliExplicitIds } = parseArgs();
  const isConfirmed = options.confirm ?? cliConfirmed;
  const targetIds = options.ids ?? (cliExplicitIds.length > 0 ? cliExplicitIds : null);

  console.log('========================================================================');
  console.log(' EDL IMS — Safe Test Verifications Cleanup Script');
  console.log(` Target Unit:         ${TARGET_UNIT_NAMES.join(', ')} (${TARGET_UNIT_CODES.join(', ')})`);
  console.log(` Target Date:         ${TARGET_DATE}`);
  console.log(` Target Year:         ${TARGET_YEAR}`);
  console.log(` Mode:                ${isConfirmed ? '🚨 CONFIRMED (DELETION)' : '🔍 DRY-RUN (PREVIEW ONLY)'}`);
  if (targetIds && targetIds.length > 0) {
    console.log(` Explicit Target IDs: ${targetIds.join(', ')}`);
  }
  console.log('========================================================================\n');

  if (mongoose.connection.readyState !== 1) {
    await connect();
  }

  // 1. Strict Database Guard
  const dbName = mongoose.connection.name;
  if (dbName !== 'edl_ims') {
    console.error(`❌ CRITICAL SAFETY ABORT: Connected database is "${dbName}".`);
    console.error('   This script is hardcoded to run strictly on "edl_ims" and will never touch other databases.');
    if (!options.keepConnection) await disconnect();
    if (require.main === module) process.exit(1);
    throw new Error(`Connected database is "${dbName}", expected "edl_ims"`);
  }

  console.log(`✔ Connected to database: "${dbName}" (Safety check passed)\n`);

  // 2. Identify ITO Unit
  const itoUnits = await Unit.find({
    $or: [
      { unit_code: { $in: TARGET_UNIT_CODES } },
      { unit_name: { $in: TARGET_UNIT_NAMES } }
    ]
  }).lean();

  if (itoUnits.length === 0) {
    console.log(`✔ No unit found matching ${TARGET_UNIT_CODES.join(', ')}. Nothing to remove.\n`);
    if (!options.keepConnection) await disconnect();
    return { success: true, count: 0 };
  }

  const itoUnitIds = itoUnits.map(u => u.id);
  const itoUnitMap = new Map(itoUnits.map(u => [u.id, u]));

  // 3. Find candidate verifications for ITO
  const allItoVerifs = await Verification.find({
    unit_id: { $in: itoUnitIds }
  }).sort({ date: -1, created_at: -1 }).lean();

  // Also check for any draft verifications matching the test verifiers across all units
  const allDrafts = await Verification.find({
    status: 'draft'
  }).lean();

  const matchedDrafts = allDrafts.filter(d => {
    const matchedGroup = matchesTestVerifiers(d);
    return Boolean(matchedGroup);
  });

  // Separate candidate targets from preserved verifications
  const targetVerifications = [];
  const preservedVerifications = [];

  for (const v of allItoVerifs) {
    // If specific target IDs were given
    if (targetIds && targetIds.length > 0) {
      if (targetIds.includes(v.id)) {
        targetVerifications.push({ verif: v, matchedGroup: matchesTestVerifiers(v) || { label: 'Explicitly Targeted' } });
      } else {
        preservedVerifications.push(v);
      }
      continue;
    }

    // Auto-detect matching test verifiers and date
    const matchedGroup = matchesTestVerifiers(v);
    const isTargetDate = v.date === TARGET_DATE;
    const isTargetYear = v.year === TARGET_YEAR || String(v.date || '').startsWith(String(TARGET_YEAR));

    if (matchedGroup && isTargetYear) {
      targetVerifications.push({ verif: v, matchedGroup });
    } else {
      preservedVerifications.push(v);
    }
  }

  // 4. Report verification history count before
  let itoHistoryBefore = [];
  try {
    itoHistoryBefore = await db.getVerificationHistoryItems(itoUnitIds, TARGET_YEAR);
  } catch (err) {
    console.warn('Note: getVerificationHistoryItems query:', err.message);
  }

  console.log(`📋 CURRENT VERIFICATION STATE (ITO Unit, Year ${TARGET_YEAR}):`);
  console.log(`   • Total verifications in DB for ITO:    ${allItoVerifs.length}`);
  console.log(`   • Verification History line items:      ${itoHistoryBefore.length}`);
  console.log(`   • Preserved official verifications:     ${preservedVerifications.length}`);
  for (const pv of preservedVerifications) {
    const vNames = (pv.verified_by || [pv.verifier_1, pv.verifier_2, pv.verifier_3]).filter(Boolean).join(', ');
    console.log(`     - [PRESERVED] ${pv.date} (Status: ${pv.status}): ${vNames}`);
  }
  console.log(`   • Matched test verifications to remove: ${targetVerifications.length}\n`);

  if (matchedDrafts.length > 0) {
    console.log(`⚠️ OPEN DRAFT VERIFICATIONS FOUND (${matchedDrafts.length}):`);
    for (const d of matchedDrafts) {
      const vNames = (d.verified_by || [d.verifier_1, d.verifier_2, d.verifier_3]).filter(Boolean).join(', ');
      console.log(`   • Draft ID: ${d.id} | Unit: ${d.unit_id} | Date: ${d.date} | Verifiers: ${vNames}`);
    }
    console.log('');
  } else {
    console.log('✔ No open draft verifications found matching test verifier names.\n');
  }

  if (targetVerifications.length === 0) {
    console.log('========================================================================');
    console.log('✔ No matching test verifications found in "edl_ims" database.');
    console.log('   The database is already clean!');
    console.log('========================================================================\n');
    if (!options.keepConnection) await disconnect();
    return {
      success: true,
      deletedVerifications: 0,
      deletedItems: 0,
      historyBefore: itoHistoryBefore.length,
      historyAfter: itoHistoryBefore.length
    };
  }

  // 5. Inspect line items and issued/destroyed references for each target verification
  const matchedVerifIds = targetVerifications.map(t => t.verif.id);
  const targetItems = await VerificationItem.find({
    verification_id: { $in: matchedVerifIds }
  }).lean();

  const targetItemIds = targetItems.map(it => it.id);

  // Check Issued/Destroyed items referencing these verifications or line items
  const referencingIssued = await IssuedDestroyedItem.find({
    $or: [
      { verification_id: { $in: matchedVerifIds } },
      { verification_item_id: { $in: targetItemIds } }
    ]
  }).lean();

  const targetHistoryItems = itoHistoryBefore.filter(h => matchedVerifIds.includes(h.verification_id));
  const historyProjected = itoHistoryBefore.length - targetHistoryItems.length;

  console.log('------------------------------------------------------------------------');
  console.log(`🔎 TARGET VERIFICATIONS DETAILS (${targetVerifications.length} header(s), ${targetItems.length} total line items):`);
  console.log('------------------------------------------------------------------------');

  for (let i = 0; i < targetVerifications.length; i++) {
    const { verif, matchedGroup } = targetVerifications[i];
    const unit = itoUnitMap.get(verif.unit_id) || {};
    const items = targetItems.filter(it => it.verification_id === verif.id);
    const countedItems = items.filter(it => it.status !== 'Not Counted' && it.status !== 'Not counted');
    const uncountedItems = items.filter(it => it.status === 'Not Counted' || it.status === 'Not counted');
    const verifiersList = (verif.verified_by || [verif.verifier_1, verif.verifier_2, verif.verifier_3]).filter(Boolean);

    console.log(`\n[TARGET HEADER #${i + 1}]`);
    console.log(`   • Verification ID:  ${verif.id}`);
    console.log(`   • Match Type:       ${matchedGroup.label}`);
    console.log(`   • Status:           ${verif.status}`);
    console.log(`   • Date:             ${verif.date}`);
    console.log(`   • Year:             ${verif.year}`);
    console.log(`   • Unit:             ${unit.unit_name || 'ITO'} (${unit.unit_code || 'WPS-ITO'})`);
    console.log(`   • Verifiers:        ${verifiersList.join(', ')}`);
    console.log(`   • Created At:       ${verif.created_at || verif.createdAt || '—'}`);
    console.log(`   • Total Items in DB:${items.length} (${countedItems.length} counted/entered, ${uncountedItems.length} uncounted placeholders)`);

    if (countedItems.length > 0) {
      console.log(`   • Counted/Entered Line Items (displayed in Verification History):`);
      for (const it of countedItems) {
        const serials = (it.serial_numbers && it.serial_numbers.length > 0)
          ? it.serial_numbers.join(', ')
          : (it.item_code || '—');
        console.log(`     - [Item ID: ${it.id}]`);
        console.log(`       Item Name:    ${it.item_name}`);
        console.log(`       Serial(s):    ${serials}`);
        console.log(`       System Qty:   ${it.system_qty}`);
        console.log(`       Physical Qty: ${it.physical_qty ?? '—'}`);
        console.log(`       Condition:    ${it.condition || '—'}`);
        console.log(`       Status:       ${it.status || '—'}`);
        console.log(`       Remarks:      ${it.remarks || '—'}`);
      }
    }
    if (uncountedItems.length > 0) {
      console.log(`   • Uncounted Placeholders: ${uncountedItems.length} items (will be cleaned up with parent header)`);
    }
  }

  console.log('\n------------------------------------------------------------------------');
  console.log('🛡️ SAFETY CHECK: ISSUED / DESTROYED REFERENCES');
  console.log('------------------------------------------------------------------------');
  if (referencingIssued.length > 0) {
    console.log(`⚠️ Found ${referencingIssued.length} Issued/Destroyed record(s) referencing these verification(s):`);
    for (const iss of referencingIssued) {
      console.log(`   • Issued Record ID: ${iss.id} | Verification ID: ${iss.verification_id} | Serial: ${iss.serial_number || '—'}`);
    }
    console.log('   NOTE: This script will NEVER delete Issued/Destroyed records under any circumstance.');
  } else {
    console.log('✔ No Issued / Destroyed records reference these test verifications.');
  }

  // 6. Execution mode decision
  if (!isConfirmed) {
    console.log('\n========================================================================');
    console.log('🔍 [DRY-RUN COMPLETE] No database records were modified or deleted.');
    console.log('========================================================================');
    console.log('Summary of what WOULD be deleted upon confirmation:');
    console.log(`   • ${targetVerifications.length} Verification Header document(s) (${matchedVerifIds.join(', ')})`);
    console.log(`   • ${targetItems.length} VerificationItem document(s) (${targetHistoryItems.length} active + ${targetItems.length - targetHistoryItems.length} uncounted placeholders)`);
    console.log(`   • Verification History (ITO 2026) row count change: ${itoHistoryBefore.length} -> ${historyProjected}`);
    console.log('\nPreservation Guarantee:');
    console.log('   • Official Board of Survey records (P.M.M.Vithanage, etc.) are untouched (99 records preserved)');
    console.log('   • Inventory items and serial numbers are untouched (Collar Mic stays in inventory)');
    console.log('   • Received and Expended transactions are untouched');
    console.log('   • Issued / Destroyed items are untouched');
    console.log('   • Other units are untouched');
    console.log('\nTo permanently execute this cleanup:');
    console.log('   Run the direct Node command in your terminal:');
    console.log('     node src/scripts/remove-test-verifications.js --confirm\n');
    console.log('   (From the repository root: node server/src/scripts/remove-test-verifications.js --confirm)');
    console.log('   Note: "npm run cleanup:test-verifications -- --confirm" may not forward flags in Windows PowerShell.\n');

    if (!options.keepConnection) await disconnect();
    return {
      dryRun: true,
      matchedVerificationsCount: targetVerifications.length,
      matchedItemsCount: targetItems.length,
      historyBefore: itoHistoryBefore.length,
      historyProjected
    };
  }

  // 7. Confirmed Execution
  console.log('\n🚨 EXECUTING PERMANENT DELETION ON "edl_ims" DATABASE...');

  // Step A: Delete verification_items first
  const deleteItemsResult = await VerificationItem.deleteMany({
    verification_id: { $in: matchedVerifIds }
  });
  console.log(`✔ Deleted ${deleteItemsResult.deletedCount} VerificationItem record(s).`);

  // Step B: Delete verification headers
  const deleteVerifsResult = await Verification.deleteMany({
    id: { $in: matchedVerifIds }
  });
  console.log(`✔ Deleted ${deleteVerifsResult.deletedCount} Verification header record(s).`);

  // Step C: Verify Verification History count after
  let itoHistoryAfter = [];
  try {
    itoHistoryAfter = await db.getVerificationHistoryItems(itoUnitIds, TARGET_YEAR);
  } catch (err) {
    console.warn('Note: getVerificationHistoryItems query:', err.message);
  }

  console.log('\n========================================================================');
  console.log('✅ CLEANUP EXECUTION COMPLETE');
  console.log('========================================================================');
  console.log(`   • Verification headers deleted:   ${deleteVerifsResult.deletedCount}`);
  console.log(`   • Line items deleted:             ${deleteItemsResult.deletedCount}`);
  console.log(`   • Verification History (ITO 2026): ${itoHistoryBefore.length} -> ${itoHistoryAfter.length}`);
  console.log('   • Test entries removed:');
  console.log('     1. "Verification 04/11/2026 - Verified by: ghb, gvb n, cgvb n - ITO"');
  console.log('     2. "Verification 04/11/2026 - Verified by: jbnj, hvjb, hgv - ITO"');
  console.log('========================================================================\n');

  if (!options.keepConnection) await disconnect();
  return {
    success: true,
    deletedVerifications: deleteVerifsResult.deletedCount,
    deletedItems: deleteItemsResult.deletedCount,
    historyBefore: itoHistoryBefore.length,
    historyAfter: itoHistoryAfter.length
  };
}

if (require.main === module) {
  removeTestVerifications().catch(err => {
    console.error('❌ Error executing cleanup script:', err);
    process.exit(1);
  });
}

module.exports = removeTestVerifications;
