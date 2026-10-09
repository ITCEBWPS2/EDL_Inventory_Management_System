const fs = require('fs');
const path = require('path');
const { connect, disconnect, mongoose } = require('../config/mongo');
const {
  Unit,
  InventoryItem,
  ReceivedTransaction,
  ExpendedTransaction,
  Verification,
  SerialCounter
} = require('../models');

async function importBackup() {
  await connect();

  const dbName = mongoose.connection.name;
  if (dbName !== 'edl_ims') {
    console.error(`❌ ABORT: Connected database is "${dbName}", expected "edl_ims". Only edl_ims may be modified!`);
    process.exit(1);
  }

  const backupPath = path.join(__dirname, '../../server_memory_backup.json');
  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Backup file not found at ${backupPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(backupPath, 'utf8');
  const backup = JSON.parse(rawData);

  console.log(`📦 Importing backup from ${backupPath} into "${dbName}"...`);

  const summary = {
    units: { imported: 0, skipped: 0 },
    inventory: { imported: 0, skipped: 0 },
    received: { imported: 0, skipped: 0 },
    expended: { imported: 0, skipped: 0 },
    verifications: { imported: 0, skipped: 0 }
  };

  // 1. Units
  if (Array.isArray(backup.units)) {
    for (const u of backup.units) {
      const exists = await Unit.findOne({ id: u.id });
      if (exists) {
        summary.units.skipped++;
      } else {
        await Unit.create(u);
        summary.units.imported++;
      }
    }
  }

  // 2. Inventory Items
  if (Array.isArray(backup.inventory)) {
    for (const item of backup.inventory) {
      const exists = await InventoryItem.findOne({ id: item.id });
      if (exists) {
        summary.inventory.skipped++;
      } else {
        await InventoryItem.create(item);
        summary.inventory.imported++;
      }
    }
  }

  // 3. Received Transactions
  if (Array.isArray(backup.received)) {
    for (const rec of backup.received) {
      const exists = await ReceivedTransaction.findOne({ id: rec.id });
      if (exists) {
        summary.received.skipped++;
      } else {
        await ReceivedTransaction.create(rec);
        summary.received.imported++;
      }
    }
  }

  // 4. Expended Transactions
  if (Array.isArray(backup.expended)) {
    for (const exp of backup.expended) {
      const exists = await ExpendedTransaction.findOne({ id: exp.id });
      if (exists) {
        summary.expended.skipped++;
      } else {
        await ExpendedTransaction.create(exp);
        summary.expended.imported++;
      }
    }
  }

  // 5. Verifications
  if (Array.isArray(backup.verifications)) {
    for (const ver of backup.verifications) {
      const exists = await Verification.findOne({ id: ver.id });
      if (exists) {
        summary.verifications.skipped++;
      } else {
        await Verification.create(ver);
        summary.verifications.imported++;
      }
    }
  }

  // 6. Update SerialCounters based on current inventory items
  const allItems = await InventoryItem.find({});
  const prefixCounters = {};
  allItems.forEach((item) => {
    const codes = [];
    if (item.item_code) codes.push(item.item_code);
    if (Array.isArray(item.serial_numbers)) {
      item.serial_numbers.forEach((s) => {
        if (s) codes.push(s);
      });
    }
    codes.forEach((code) => {
      if (typeof code === 'string' && code.startsWith('DGM(WPSII)/CE(COM)/')) {
        const match = code.match(/^(.*-)(\d+)$/);
        if (match) {
          const prefix = match[1];
          const seq = parseInt(match[2], 10);
          if (!isNaN(seq)) {
            prefixCounters[prefix] = Math.max(prefixCounters[prefix] || 0, seq);
          }
        }
      }
    });
  });

  for (const [prefix, maxSeq] of Object.entries(prefixCounters)) {
    await SerialCounter.findOneAndUpdate(
      { prefix },
      { $max: { last_sequence: maxSeq } },
      { upsert: true }
    );
  }

  console.log('\n=========================================');
  console.log('       IMPORT SUMMARY REPORT            ');
  console.log('=========================================');
  console.log(`Units:                  Imported: ${summary.units.imported}, Skipped: ${summary.units.skipped}`);
  console.log(`Inventory Items:        Imported: ${summary.inventory.imported}, Skipped: ${summary.inventory.skipped}`);
  console.log(`Received Transactions:  Imported: ${summary.received.imported}, Skipped: ${summary.received.skipped}`);
  console.log(`Expended Transactions:  Imported: ${summary.expended.imported}, Skipped: ${summary.expended.skipped}`);
  console.log(`Verifications:          Imported: ${summary.verifications.imported}, Skipped: ${summary.verifications.skipped}`);
  console.log(`Serial Prefixes Synced: ${Object.keys(prefixCounters).length}`);
  console.log('=========================================\n');

  await disconnect();
}

if (require.main === module) {
  importBackup().catch((err) => {
    console.error('❌ Import failed:', err);
    process.exit(1);
  });
}

module.exports = importBackup;
