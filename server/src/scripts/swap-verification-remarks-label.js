const mongoose = require('mongoose');
const { connect, disconnect } = require('../config/mongo');
const { Unit, Verification, VerificationItem } = require('../models');

const TARGET_UNIT_CODE = 'WPS-ITO';
const TARGET_UNIT_NAME = 'ITO';
const TARGET_YEAR = 2026;
const TARGET_ITEM_NAME = 'Tab';
const TARGET_REMARKS_EXPECTED = 'IT/Tab/01-IT/Tab/03';
const TARGET_LABEL_PREFIX = 'WB No.57699';

/**
 * Check if a label looks like a remark (long or contains spaces/commas)
 */
function isRemarkLikeLabel(label) {
  if (!label || typeof label !== 'string') return false;
  const str = label.trim();
  if (str === '—' || str === 'N/A' || str === '') return false;
  return str.length > 40 || str.includes(',') || str.includes('WB No');
}

/**
 * Check if a remark looks like a label (e.g. IT/.../NN or code/code)
 */
function isLabelLikeRemark(remark) {
  if (!remark || typeof remark !== 'string') return false;
  const str = remark.trim();
  if (str === '—' || str === 'N/A' || str === '') return false;
  return /^IT\//i.test(str) || /^[A-Z0-9/_-]+\s*[-/]\s*[A-Z0-9/_-]+$/i.test(str);
}

/**
 * Script to swap incorrectly entered remarks and label_no for target verification record.
 * Default mode is DRY-RUN. Run with --confirm to apply changes.
 */
async function swapVerificationRemarksLabel(options = {}) {
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
  console.log(' EDL IMS — Swap Verification Remarks & Label No Script');
  console.log(` Target Unit:      ${TARGET_UNIT_NAME} (${TARGET_UNIT_CODE})`);
  console.log(` Target Year:      ${TARGET_YEAR}`);
  console.log(` Target Item:      ${TARGET_ITEM_NAME}`);
  console.log(` Target Remarks:   "${TARGET_REMARKS_EXPECTED}" (to become Label No)`);
  console.log(` Target Label No:  Starts with "${TARGET_LABEL_PREFIX}" (to become Remarks)`);
  if (explicitId) {
    console.log(` Explicit ID:      ${explicitId}`);
  }
  console.log(` Mode:             ${isConfirmed ? '🚨 CONFIRMED (APPLYING SWAP)' : '🔍 DRY-RUN (NO CHANGES)'}`);
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

  // 1. Find ITO Unit
  const itoUnits = await Unit.find({
    $or: [
      { unit_code: TARGET_UNIT_CODE },
      { unit_name: TARGET_UNIT_NAME }
    ]
  }).lean();

  if (itoUnits.length === 0) {
    console.log(`✔ No unit found matching ${TARGET_UNIT_CODE} / ${TARGET_UNIT_NAME}. Nothing to swap.\n`);
    if (!options.keepConnection) await disconnect();
    return { swappedCount: 0 };
  }

  const itoUnitIds = itoUnits.map(u => u.id);

  // 2. Find confirmed verifications for ITO in 2026
  const itoVerifs = await Verification.find({
    unit_id: { $in: itoUnitIds },
    year: TARGET_YEAR,
    status: 'confirmed'
  }).lean();

  const itoVerifIds = itoVerifs.map(v => v.id);

  // 3. Find target item
  let candidateItems = [];

  if (explicitId) {
    candidateItems = await VerificationItem.find({
      id: explicitId,
      verification_id: { $in: itoVerifIds }
    }).lean();
  } else {
    // Match target item with current (wrong) values
    candidateItems = await VerificationItem.find({
      verification_id: { $in: itoVerifIds },
      item_name: TARGET_ITEM_NAME,
      remarks: TARGET_REMARKS_EXPECTED,
      label_no: { $regex: new RegExp(`^${TARGET_LABEL_PREFIX.replace('.', '\\.')}`) }
    }).lean();
  }

  // If 0 matches, check if the record is already swapped
  if (candidateItems.length === 0) {
    const alreadySwapped = await VerificationItem.findOne({
      verification_id: { $in: itoVerifIds },
      item_name: TARGET_ITEM_NAME,
      label_no: TARGET_REMARKS_EXPECTED,
      remarks: { $regex: new RegExp(`^${TARGET_LABEL_PREFIX.replace('.', '\\.')}`) }
    }).lean();

    if (alreadySwapped) {
      console.log('✔ The target record is ALREADY in the correct state (already swapped):');
      console.log(`   • Line Item ID: ${alreadySwapped.id}`);
      console.log(`   • Item:         ${alreadySwapped.item_name}`);
      console.log(`   • Label No:     "${alreadySwapped.label_no}"`);
      console.log(`   • Remarks:      "${alreadySwapped.remarks}"`);
      console.log('\nNo action needed. Database is clean and correct.\n');
      if (!options.keepConnection) await disconnect();
      return { swappedCount: 0, alreadyCorrect: true };
    }

    console.log('✔ No line item found matching the unswapped target criteria.');
    if (explicitId) console.log(`   • Specified ID: ${explicitId}`);
    console.log('\nNothing to swap.\n');
    if (!options.keepConnection) await disconnect();
    return { swappedCount: 0 };
  }

  // Guard: require exactly one match
  if (candidateItems.length > 1) {
    console.error(`❌ ABORT: Expected exactly 1 matching record, but found ${candidateItems.length}:`);
    candidateItems.forEach((it, i) => {
      console.error(`   [#${i + 1}] ID: ${it.id} | Name: "${it.item_name}" | Label: "${it.label_no}" | Remarks: "${it.remarks}"`);
    });
    console.error('\nPlease re-run specifying the exact item id using: --id <verification_item_id>\n');
    if (!options.keepConnection) await disconnect();
    if (require.main === module) process.exit(1);
    throw new Error(`Ambiguous match: found ${candidateItems.length} records matching criteria`);
  }

  const target = candidateItems[0];
  const parentVerif = itoVerifs.find(v => v.id === target.verification_id) || {};

  const oldRemarks = target.remarks || '';
  const oldLabelNo = target.label_no || '';

  const newLabelNo = oldRemarks;
  const newRemarks = oldLabelNo;

  console.log('📋 MATCHED RECORD DETAILS:');
  console.log('------------------------------------------------------------------------');
  console.log(`   • Line Item ID:       ${target.id}`);
  console.log(`   • Item Name:          ${target.item_name}`);
  console.log(`   • Category:           ${target.category || '—'}`);
  console.log(`   • System Qty:         ${target.system_qty}`);
  console.log(`   • Physical Qty:       ${target.physical_qty ?? '—'}`);
  console.log(`   • Disposition:        ${target.issued_destroyed || target.disposition || '—'}`);
  console.log(`   • Issued/Destr Qty:   ${target.issued_destroyed_qty ?? '—'}`);
  console.log(`   • Serials Count:      ${(target.serial_numbers || []).length}`);
  console.log(`   • Verification ID:    ${parentVerif.id}`);
  console.log(`   • Verification Date:  ${parentVerif.date} (Year: ${parentVerif.year})`);
  console.log(`   • Verified By:        ${[parentVerif.verifier_1, parentVerif.verifier_2, parentVerif.verifier_3].filter(Boolean).join(', ') || parentVerif.verified_by}`);
  console.log('\n   [CURRENT (WRONG) VALUES]:');
  console.log(`   • label_no:           "${oldLabelNo}"`);
  console.log(`   • remarks:            "${oldRemarks}"`);
  console.log('\n   [NEW (SWAPPED) VALUES TO WRITE]:');
  console.log(`   • label_no:           "${newLabelNo}"`);
  console.log(`   • remarks:            "${newRemarks}"`);
  console.log('------------------------------------------------------------------------\n');

  // 4. Audit review: check other confirmed ITO 2026 line items for similar mistakes (READ-ONLY)
  console.log('🔍 AUDIT REVIEW OF OTHER ITO 2026 RECORDS (READ-ONLY, UNTOUCHED):');
  console.log('------------------------------------------------------------------------');
  const allItoItems = await VerificationItem.find({
    verification_id: { $in: itoVerifIds },
    id: { $ne: target.id }
  }).lean();

  const auditCandidates = allItoItems.filter(it => {
    return isRemarkLikeLabel(it.label_no) || isLabelLikeRemark(it.remarks || it.special_remarks);
  });

  if (auditCandidates.length === 0) {
    console.log('   (No other suspicious label_no or remarks patterns found)');
  } else {
    console.log(`   Found ${auditCandidates.length} other record(s) with long/complex label_no or label-like remarks:`);
    auditCandidates.forEach((it, idx) => {
      console.log(`   [#${idx + 1}] ID: ${it.id} | Item: "${it.item_name}"`);
      console.log(`        label_no: "${it.label_no || '—'}"`);
      console.log(`        remarks:  "${it.remarks || it.special_remarks || '—'}"`);
      console.log(`        flag:     ${isRemarkLikeLabel(it.label_no) ? 'label_no is long/complex (>40 chars or commas)' : 'remarks matches label pattern'}`);
    });
  }
  console.log('   (Note: The above audit list is for user review only; NONE of these records will be modified)');
  console.log('------------------------------------------------------------------------\n');

  // 5. Execution or Dry-run Notice
  if (!isConfirmed) {
    console.log('========================================================================');
    console.log('🔍 [DRY-RUN COMPLETE] No database modifications were made.');
    console.log('To permanently execute this swap on the target record:');
    console.log('Run the direct Node command in your terminal:');
    console.log('  node src/scripts/swap-verification-remarks-label.js --confirm\n');
    console.log('Note: In Windows PowerShell, "npm run ... -- --confirm" may not pass flags.');
    console.log('Using the direct "node src/scripts/swap-verification-remarks-label.js --confirm" is recommended.');
    console.log('========================================================================\n');
    if (!options.keepConnection) await disconnect();
    return {
      dryRun: true,
      targetId: target.id,
      oldLabelNo,
      oldRemarks,
      newLabelNo,
      newRemarks
    };
  }

  // 6. Confirmed Execution
  console.log('🚨 EXECUTING SWAP ON "edl_ims" DATABASE...');

  const nowIso = new Date().toISOString();
  const updateResult = await VerificationItem.updateOne(
    { id: target.id },
    {
      $set: {
        label_no: newLabelNo,
        remarks: newRemarks,
        updated_at: nowIso
      }
    }
  );

  const updatedDoc = await VerificationItem.findOne({ id: target.id }).lean();

  console.log('\n✅ SWAP COMPLETE:');
  console.log(`   • Documents modified: 1 (matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount})`);
  console.log(`   • Line Item ID:       ${updatedDoc.id}`);
  console.log(`   • Item Name:          ${updatedDoc.item_name}`);
  console.log(`   • Updated label_no:   "${updatedDoc.label_no}"`);
  console.log(`   • Updated remarks:    "${updatedDoc.remarks}"`);
  console.log(`   • Updated At:         ${updatedDoc.updated_at}`);
  console.log('========================================================================\n');

  if (!options.keepConnection) await disconnect();
  return {
    swappedCount: 1,
    targetId: target.id,
    updatedDoc
  };
}

if (require.main === module) {
  swapVerificationRemarksLabel().catch(err => {
    console.error('❌ Error executing swap script:', err);
    process.exit(1);
  });
}

module.exports = swapVerificationRemarksLabel;
