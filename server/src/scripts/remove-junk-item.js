const mongoose = require('mongoose');
const { connect, disconnect } = require('../config/mongo');
const {
  InventoryItem,
  ReceivedTransaction,
  ExpendedTransaction,
  VerificationItem,
  IssuedDestroyedItem
} = require('../models');

const TARGET_ITEM_ID = '33333333-3333-3333-3333-333333333301';

async function cleanupJunkItem() {
  const isConfirmed = process.argv.includes('--confirm');

  console.log('======================================================');
  console.log(' EDL IMS — Cleanup Junk Inventory Item & References');
  console.log(` Target Item ID: ${TARGET_ITEM_ID}`);
  console.log(` Mode: ${isConfirmed ? 'CONFIRMED (DELETION)' : 'DRY-RUN (NO CHANGES)'}`);
  console.log('======================================================\n');

  if (mongoose.connection.readyState !== 1) {
    await connect();
  }

  const dbName = mongoose.connection.name;
  if (dbName !== 'edl_ims') {
    console.error(`❌ ABORT: Connected database is "${dbName}". This script only operates on the "edl_ims" database!`);
    await disconnect();
    process.exit(1);
  }

  // 1. Identify Target Inventory Item(s)
  // Match either id === TARGET_ITEM_ID or item_name === TARGET_ITEM_ID (e.g. raw id stored as item_name)
  const inventoryItems = await InventoryItem.find({
    $or: [
      { id: TARGET_ITEM_ID },
      { item_name: TARGET_ITEM_ID }
    ]
  }).lean();

  const targetItemIds = new Set([TARGET_ITEM_ID]);
  inventoryItems.forEach(i => {
    if (i.id) targetItemIds.add(i.id);
  });
  const targetItemIdsArray = Array.from(targetItemIds);

  // 2. Identify Referencing Records
  const receivedTransactions = await ReceivedTransaction.find({
    $or: [
      { item_id: { $in: targetItemIdsArray } },
      { item_name: TARGET_ITEM_ID }
    ]
  }).lean();

  const expendedTransactions = await ExpendedTransaction.find({
    $or: [
      { item_id: { $in: targetItemIdsArray } },
      { item_name: TARGET_ITEM_ID }
    ]
  }).lean();

  const verificationItems = await VerificationItem.find({
    $or: [
      { item_id: { $in: targetItemIdsArray } },
      { item_name: TARGET_ITEM_ID }
    ]
  }).lean();

  const issuedDestroyedItems = await IssuedDestroyedItem.find({
    item_id: { $in: targetItemIdsArray }
  }).lean();

  // 3. Print Report
  console.log('📋 MATCHED RECORDS SUMMARY:');
  console.log('------------------------------------------------------');
  console.log(`1. Inventory Items: ${inventoryItems.length}`);
  if (inventoryItems.length > 0) {
    inventoryItems.forEach((item, idx) => {
      console.log(`   [${idx + 1}] ID: ${item.id} | Name: "${item.item_name}" | Code: ${item.item_code} | Cat: ${item.category} | Qty: ${item.quantity}`);
    });
  } else {
    console.log('   (None found)');
  }

  console.log(`\n2. Received Transactions: ${receivedTransactions.length}`);
  if (receivedTransactions.length > 0) {
    receivedTransactions.forEach((r, idx) => {
      console.log(`   [${idx + 1}] Voucher: ${r.voucher_no || 'N/A'} | Date: ${r.date || 'N/A'} | Qty: ${r.quantity} | Sender: ${r.from_whom || 'N/A'} | Item: ${r.item_name}`);
    });
  } else {
    console.log('   (None found)');
  }

  console.log(`\n3. Expended Transactions: ${expendedTransactions.length}`);
  if (expendedTransactions.length > 0) {
    expendedTransactions.forEach((e, idx) => {
      console.log(`   [${idx + 1}] Voucher: ${e.voucher_no || 'N/A'} | Date: ${e.date || 'N/A'} | Qty: ${e.quantity} | Disp: ${e.disposition || 'N/A'} | Item: ${e.item_name}`);
    });
  } else {
    console.log('   (None found)');
  }

  console.log(`\n4. Verification Items: ${verificationItems.length}`);
  if (verificationItems.length > 0) {
    verificationItems.forEach((v, idx) => {
      console.log(`   [${idx + 1}] ID: ${v.id} | Code: ${v.item_code || 'N/A'} | System Qty: ${v.system_qty} | Physical Qty: ${v.physical_qty} | Status: ${v.status || 'N/A'}`);
    });
  } else {
    console.log('   (None found)');
  }

  console.log(`\n5. Issued / Destroyed Items: ${issuedDestroyedItems.length}`);
  if (issuedDestroyedItems.length > 0) {
    issuedDestroyedItems.forEach((idi, idx) => {
      console.log(`   [${idx + 1}] ID: ${idi.id} | Disp: ${idi.disposition} | Date: ${idi.date} | Qty: ${idi.quantity} | Reason: "${idi.reason || 'N/A'}" | S/N: ${idi.serial_number || 'N/A'}`);
    });
  } else {
    console.log('   (None found)');
  }
  console.log('------------------------------------------------------\n');

  // 4. Execution or Dry-run Notice
  if (!isConfirmed) {
    console.log('ℹ️  DRY-RUN COMPLETE: No records were modified or deleted.');
    console.log('👉 To permanently delete these records, run with the --confirm flag:');
    console.log('   npm run cleanup:junk-item -- --confirm\n');
  } else {
    console.log('🚨 EXECUTING DELETION ON EDL_IMS DATABASE...');

    let deletedInv = 0;
    let deletedRx = 0;
    let deletedExp = 0;
    let deletedVer = 0;
    let deletedIdi = 0;

    if (inventoryItems.length > 0) {
      const res = await InventoryItem.deleteMany({
        _id: { $in: inventoryItems.map(i => i._id) }
      });
      deletedInv = res.deletedCount;
    }

    if (receivedTransactions.length > 0) {
      const res = await ReceivedTransaction.deleteMany({
        _id: { $in: receivedTransactions.map(r => r._id) }
      });
      deletedRx = res.deletedCount;
    }

    if (expendedTransactions.length > 0) {
      const res = await ExpendedTransaction.deleteMany({
        _id: { $in: expendedTransactions.map(e => e._id) }
      });
      deletedExp = res.deletedCount;
    }

    if (verificationItems.length > 0) {
      const res = await VerificationItem.deleteMany({
        _id: { $in: verificationItems.map(v => v._id) }
      });
      deletedVer = res.deletedCount;
    }

    if (issuedDestroyedItems.length > 0) {
      const res = await IssuedDestroyedItem.deleteMany({
        _id: { $in: issuedDestroyedItems.map(i => i._id) }
      });
      deletedIdi = res.deletedCount;
    }

    console.log('✅ DELETION SUMMARY:');
    console.log(`   - Inventory Items deleted:          ${deletedInv}`);
    console.log(`   - Received Transactions deleted:     ${deletedRx}`);
    console.log(`   - Expended Transactions deleted:     ${deletedExp}`);
    console.log(`   - Verification Items deleted:        ${deletedVer}`);
    console.log(`   - Issued/Destroyed Items deleted:    ${deletedIdi}`);
    console.log('======================================================\n');
  }

  await disconnect();
}

if (require.main === module) {
  cleanupJunkItem().catch(err => {
    console.error('❌ Error executing cleanup:', err);
    process.exit(1);
  });
}

module.exports = cleanupJunkItem;
