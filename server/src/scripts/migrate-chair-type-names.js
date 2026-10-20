/**
 * Migration Script: Migrate Legacy Chair Type Names in "edl_ims" Database
 *
 * Renames 3 chair types:
 *   - "Computer Executive" -> "Computer Executive Chair"
 *   - "Computer Typist"    -> "Computer Typist Chair"
 *   - "Computer Assistant" -> "Computer Assistant Chair"
 *
 * Updates:
 *   - inventory_items (item_name, sub_classification, sub_type, batch_label)
 *   - received_transactions (item_name)
 *   - expended_transactions (item_name)
 *   - verification_items (item_name)
 *   - issued_destroyed_items (item_name, if present)
 *
 * Safety Guards:
 *   - ABORTS immediately if connected database is not "edl_ims".
 *   - Idempotent: Can be run multiple times safely without duplicate or incorrect changes.
 */

const { mongoose, connect } = require('../config/mongo');
const {
  InventoryItem,
  ReceivedTransaction,
  ExpendedTransaction,
  VerificationItem,
  IssuedDestroyedItem
} = require('../models');

const CHAIR_RENAME_MAP = {
  'Computer Executive': 'Computer Executive Chair',
  'Computer Typist': 'Computer Typist Chair',
  'Computer Assistant': 'Computer Assistant Chair'
};

const OLD_CHAIR_NAMES = Object.keys(CHAIR_RENAME_MAP);

async function migrateChairTypes({ dbNameCheck = true } = {}) {
  const dbName = mongoose.connection.name;

  if (!dbName || (dbNameCheck && dbName !== 'edl_ims')) {
    throw new Error(
      `[SAFETY ABORT] Connected to database "${dbName || 'none'}". Migration is strictly restricted to "edl_ims" only!`
    );
  }

  console.log(`\n============================================================`);
  console.log(`Starting Chair Types Migration on database: "${dbName}"`);
  console.log(`Renaming:`);
  for (const [oldName, newName] of Object.entries(CHAIR_RENAME_MAP)) {
    console.log(`  - "${oldName}" -> "${newName}"`);
  }
  console.log(`============================================================\n`);

  const results = {
    inventory_items: 0,
    received_transactions: 0,
    expended_transactions: 0,
    verification_items: 0,
    issued_destroyed_items: 0
  };

  // 1. inventory_items
  const invItems = await InventoryItem.find({
    $or: [
      { item_name: { $in: OLD_CHAIR_NAMES } },
      { sub_classification: { $in: OLD_CHAIR_NAMES } },
      { sub_type: { $in: OLD_CHAIR_NAMES } },
      { batch_label: { $regex: /Computer (Executive|Typist|Assistant) Batch/i } }
    ]
  });

  console.log(`Found ${invItems.length} inventory_items matching legacy chair names.`);
  for (const item of invItems) {
    let updated = false;
    const oldItemName = item.item_name;

    if (CHAIR_RENAME_MAP[item.item_name]) {
      item.item_name = CHAIR_RENAME_MAP[item.item_name];
      updated = true;
    }
    if (CHAIR_RENAME_MAP[item.sub_classification]) {
      item.sub_classification = CHAIR_RENAME_MAP[item.sub_classification];
      updated = true;
    }
    if (CHAIR_RENAME_MAP[item.sub_type]) {
      item.sub_type = CHAIR_RENAME_MAP[item.sub_type];
      updated = true;
    }
    if (item.batch_label) {
      for (const [oldName, newName] of Object.entries(CHAIR_RENAME_MAP)) {
        if (item.batch_label.includes(oldName)) {
          item.batch_label = item.batch_label.replace(oldName, newName);
          updated = true;
        }
      }
    }

    if (updated) {
      await item.save();
      results.inventory_items++;
      console.log(`  ✓ Updated inventory_item [${item.id}] code: "${item.item_code}" name: "${oldItemName}" -> "${item.item_name}"`);
    }
  }

  // 2. received_transactions
  const recTx = await ReceivedTransaction.find({
    item_name: { $in: OLD_CHAIR_NAMES }
  });

  console.log(`Found ${recTx.length} received_transactions matching legacy chair names.`);
  for (const tx of recTx) {
    const oldName = tx.item_name;
    if (CHAIR_RENAME_MAP[tx.item_name]) {
      tx.item_name = CHAIR_RENAME_MAP[tx.item_name];
      await tx.save();
      results.received_transactions++;
      console.log(`  ✓ Updated received_transaction [${tx.id}] voucher: "${tx.voucher_no}" name: "${oldName}" -> "${tx.item_name}"`);
    }
  }

  // 3. expended_transactions
  const expTx = await ExpendedTransaction.find({
    item_name: { $in: OLD_CHAIR_NAMES }
  });

  console.log(`Found ${expTx.length} expended_transactions matching legacy chair names.`);
  for (const tx of expTx) {
    const oldName = tx.item_name;
    if (CHAIR_RENAME_MAP[tx.item_name]) {
      tx.item_name = CHAIR_RENAME_MAP[tx.item_name];
      await tx.save();
      results.expended_transactions++;
      console.log(`  ✓ Updated expended_transaction [${tx.id}] voucher: "${tx.voucher_no}" name: "${oldName}" -> "${tx.item_name}"`);
    }
  }

  // 4. verification_items
  const verItems = await VerificationItem.find({
    item_name: { $in: OLD_CHAIR_NAMES }
  });

  console.log(`Found ${verItems.length} verification_items matching legacy chair names.`);
  for (const vItem of verItems) {
    const oldName = vItem.item_name;
    if (CHAIR_RENAME_MAP[vItem.item_name]) {
      vItem.item_name = CHAIR_RENAME_MAP[vItem.item_name];
      await vItem.save();
      results.verification_items++;
      console.log(`  ✓ Updated verification_item [${vItem.id}] code: "${vItem.item_code}" name: "${oldName}" -> "${vItem.item_name}"`);
    }
  }

  // 5. issued_destroyed_items (if item_name field is present in collection)
  const issuedColl = mongoose.connection.db.collection('issued_destroyed_items');
  const issuedItems = await issuedColl.find({
    item_name: { $in: OLD_CHAIR_NAMES }
  }).toArray();

  console.log(`Found ${issuedItems.length} issued_destroyed_items matching legacy chair names.`);
  for (const item of issuedItems) {
    const oldName = item.item_name;
    if (CHAIR_RENAME_MAP[oldName]) {
      const newName = CHAIR_RENAME_MAP[oldName];
      await issuedColl.updateOne(
        { _id: item._id },
        { $set: { item_name: newName } }
      );
      results.issued_destroyed_items++;
      console.log(`  ✓ Updated issued_destroyed_item [${item.id || item._id}] name: "${oldName}" -> "${newName}"`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`MIGRATION SUMMARY (TOTAL DOCUMENTS UPDATED)`);
  console.log(`============================================================`);
  console.log(`inventory_items updated:          ${results.inventory_items}`);
  console.log(`received_transactions updated:    ${results.received_transactions}`);
  console.log(`expended_transactions updated:    ${results.expended_transactions}`);
  console.log(`verification_items updated:       ${results.verification_items}`);
  console.log(`issued_destroyed_items updated:   ${results.issued_destroyed_items}`);
  console.log(`============================================================\n`);

  return results;
}

if (require.main === module) {
  (async () => {
    try {
      await connect();
      await migrateChairTypes({ dbNameCheck: true });
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error('[ERROR] Chair migration failed:', err);
      process.exit(1);
    }
  })();
}

module.exports = {
  migrateChairTypes,
  CHAIR_RENAME_MAP,
  OLD_CHAIR_NAMES
};
