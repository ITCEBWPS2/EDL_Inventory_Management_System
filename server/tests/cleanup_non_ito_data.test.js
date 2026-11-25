const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const {
  cleanupNonItoData,
  EXPECTED_DATABASE,
  ITO_KNOWN_ID
} = require('../src/scripts/cleanup-non-ito-data');
const {
  Unit,
  InventoryItem,
  ReceivedTransaction,
  ExpendedTransaction,
  Verification,
  VerificationItem,
  IssuedDestroyedItem,
  AuditLog,
  Profile
} = require('../src/models');

test('Non-ITO Data Cleanup Script Test Suite', async (t) => {
  await setupTestDb();

  const tempBackupDir = path.join(os.tmpdir(), `edl-test-backups-${Date.now()}`);

  t.after(async () => {
    if (fs.existsSync(tempBackupDir)) {
      fs.rmSync(tempBackupDir, { recursive: true, force: true });
    }
    await teardownTestDb();
  });

  // Setup test fixtures: ITO unit and Other unit (CSC_HOMAGAMA)
  const itoUnit = await Unit.findOne({ unit_code: 'WPS-ITO' }).lean();
  assert.ok(itoUnit, 'ITO unit must exist in seeded test database');
  const itoId = itoUnit.id;

  const otherUnit = await Unit.findOne({ unit_code: 'CSC-HOMAGAMA' }).lean();
  assert.ok(otherUnit, 'CSC_HOMAGAMA unit must exist in seeded test database');
  const otherId = otherUnit.id;

  // Clear existing items in test db to have exact predictable counts
  await Promise.all([
    InventoryItem.deleteMany({}),
    ReceivedTransaction.deleteMany({}),
    ExpendedTransaction.deleteMany({}),
    Verification.deleteMany({}),
    VerificationItem.deleteMany({}),
    IssuedDestroyedItem.deleteMany({})
  ]);

  // Seed Controlled Data
  // 1. Inventory Items: 3 for ITO, 2 for other, 1 orphan (null unit_id via raw collection)
  await InventoryItem.insertMany([
    { id: uuidv4(), item_name: 'ITO Laptop Dell', item_code: 'ITO-IT-001', category: 'IT', unit_id: itoId, quantity: 5 },
    { id: uuidv4(), item_name: 'ITO Office Desk', item_code: 'ITO-FUR-001', category: 'Furniture', unit_id: itoId, quantity: 2 },
    { id: uuidv4(), item_name: 'ITO Cisco Switch', item_code: 'ITO-NET-001', category: 'Network', unit_id: itoId, quantity: 1 },
    { id: uuidv4(), item_name: 'Other Transformer 100kVA', item_code: 'HOM-TX-001', category: 'Tools & Equipment', unit_id: otherId, quantity: 15 },
    { id: uuidv4(), item_name: 'Other Energy Meter 3P', item_code: 'HOM-MTR-001', category: 'Tools & Equipment', unit_id: otherId, quantity: 100 }
  ]);
  // Insert orphan without unit_id directly into raw collection (simulating legacy data)
  await mongoose.connection.db.collection('inventory_items').insertOne({
    id: uuidv4(),
    item_name: 'Orphan Legacy Item',
    item_code: 'LEG-001',
    category: 'Furniture',
    unit_id: null,
    quantity: 1
  });

  // 2. Received Transactions: 2 for ITO, 2 for other, 1 orphan ("" unit_id via raw collection)
  await ReceivedTransaction.insertMany([
    { id: uuidv4(), item_name: 'ITO Laptop Dell', voucher_no: 'VR-ITO-01', date: '2026-01-10', quantity: 5, unit_id: itoId },
    { id: uuidv4(), item_name: 'ITO Cisco Switch', voucher_no: 'VR-ITO-02', date: '2026-02-15', quantity: 1, unit_id: itoId },
    { id: uuidv4(), item_name: 'Other Transformer 100kVA', voucher_no: 'VR-HOM-01', date: '2026-08-10', quantity: 15, unit_id: otherId },
    { id: uuidv4(), item_name: 'Other Energy Meter 3P', voucher_no: 'VR-HOM-02', date: '2026-08-14', quantity: 100, unit_id: otherId }
  ]);
  await mongoose.connection.db.collection('received_transactions').insertOne({
    id: uuidv4(),
    item_name: 'Orphan Received Item',
    voucher_no: 'VR-ORPH-01',
    date: '2025-10-10',
    quantity: 1,
    unit_id: ''
  });

  // 3. Expended Transactions: 2 for ITO, 1 for other
  await ExpendedTransaction.insertMany([
    { id: uuidv4(), item_name: 'ITO Laptop Dell', voucher_no: 'EV-ITO-01', date: '2026-03-01', quantity: 1, unit_id: itoId },
    { id: uuidv4(), item_name: 'ITO Cisco Switch', voucher_no: 'EV-ITO-02', date: '2026-03-05', quantity: 1, unit_id: itoId },
    { id: uuidv4(), item_name: 'Other Transformer 100kVA', voucher_no: 'EV-HOM-01', date: '2026-08-25', quantity: 3, unit_id: otherId }
  ]);

  // 4. Verifications & Verification Items:
  const itoVerifId = uuidv4();
  const otherVerifId = uuidv4();
  await Verification.insertMany([
    { id: itoVerifId, unit_id: itoId, date: '2026-10-01', year: 2026, status: 'confirmed' },
    { id: otherVerifId, unit_id: otherId, date: '2026-10-05', year: 2026, status: 'draft' }
  ]);

  const orphanVItemId = uuidv4();
  await VerificationItem.insertMany([
    { id: uuidv4(), verification_id: itoVerifId, item_name: 'ITO Laptop', item_code: 'ITO-IT-001' },
    { id: uuidv4(), verification_id: itoVerifId, item_name: 'ITO Desk', item_code: 'ITO-FUR-001' },
    { id: uuidv4(), verification_id: otherVerifId, item_name: 'Other Transformer', item_code: 'HOM-TX-001' },
    { id: uuidv4(), verification_id: otherVerifId, item_name: 'Other Energy Meter', item_code: 'HOM-MTR-001' },
    { id: uuidv4(), verification_id: otherVerifId, item_name: 'Other Circuit Breaker', item_code: 'HOM-CB-001' },
    { id: orphanVItemId, verification_id: 'non-existent-verif-id-999', item_name: 'Orphan Verification Item', item_code: 'ORPH-V-001' }
  ]);

  // 5. Issued / Destroyed Items: 1 for ITO, 1 for other, 1 orphan (null unit_id)
  await IssuedDestroyedItem.insertMany([
    { id: uuidv4(), item_id: uuidv4(), unit_id: itoId, quantity: 1, disposition: 'Issued', date: '2026-09-01' },
    { id: uuidv4(), item_id: uuidv4(), unit_id: otherId, quantity: 1, disposition: 'Destroyed', date: '2026-09-05' },
    { id: uuidv4(), item_id: uuidv4(), unit_id: null, quantity: 1, disposition: 'Scrapped', date: '2025-12-29' }
  ]);

  // Snapshot audit log & profile counts to ensure they are untouched
  const initialAuditLogCount = await AuditLog.countDocuments();
  const initialProfileCount = await Profile.countDocuments();
  const initialUnitCount = await Unit.countDocuments();

  await t.test('1. DRY-RUN mode previews targets accurately and modifies zero data', async () => {
    const report = await cleanupNonItoData({
      confirm: false,
      keepConnection: true,
      silent: true
    });

    assert.equal(report.success, true);
    assert.equal(report.mode, 'dry-run');
    assert.equal(report.itoUnit.id, itoId);

    // Check predicted deletion counts
    assert.equal(report.deletedCounts.inventory_items, 2);
    assert.equal(report.deletedCounts.received_transactions, 2);
    assert.equal(report.deletedCounts.expended_transactions, 1);
    assert.equal(report.deletedCounts.verifications, 1);
    assert.equal(report.deletedCounts.verification_items, 3);
    assert.equal(report.deletedCounts.issued_destroyed_items, 1);
    assert.equal(report.deletedCounts.grandTotal, 10);

    // Check preserved ITO counts
    assert.equal(report.preservedItoCounts.inventory_items, 3);
    assert.equal(report.preservedItoCounts.received_transactions, 2);
    assert.equal(report.preservedItoCounts.expended_transactions, 2);
    assert.equal(report.preservedItoCounts.verifications, 1);
    assert.equal(report.preservedItoCounts.verification_items, 2);
    assert.equal(report.preservedItoCounts.issued_destroyed_items, 1);

    // Check orphans identified (1 inv, 1 rx, 1 vItem, 1 id)
    assert.equal(report.orphanCounts.total, 4);

    // Verify database was NOT touched
    const [invTotal, rxTotal, exTotal, verifTotal, vItemTotal, idTotal] = await Promise.all([
      InventoryItem.countDocuments(),
      ReceivedTransaction.countDocuments(),
      ExpendedTransaction.countDocuments(),
      Verification.countDocuments(),
      VerificationItem.countDocuments(),
      IssuedDestroyedItem.countDocuments()
    ]);

    assert.equal(invTotal, 6, 'Total inventory items must remain 6');
    assert.equal(rxTotal, 5, 'Total received transactions must remain 5');
    assert.equal(exTotal, 3, 'Total expended transactions must remain 3');
    assert.equal(verifTotal, 2, 'Total verifications must remain 2');
    assert.equal(vItemTotal, 6, 'Total verification items must remain 6');
    assert.equal(idTotal, 3, 'Total issued/destroyed items must remain 3');
  });

  await t.test('2. CONFIRM mode writes full JSON backup and deletes ONLY non-ITO data', async () => {
    const report = await cleanupNonItoData({
      confirm: true,
      keepConnection: true,
      backupDir: tempBackupDir,
      silent: true
    });

    assert.equal(report.success, true);
    assert.equal(report.mode, 'confirm');
    assert.equal(report.deletedCounts.grandTotal, 10);

    // Verify backup folder and files were written
    assert.ok(report.backupFolder, 'Backup folder must be defined');
    assert.ok(fs.existsSync(report.backupFolder), 'Backup folder must exist on disk');

    const expectedBackupFiles = [
      'metadata.json',
      'inventory_items.json',
      'received_transactions.json',
      'expended_transactions.json',
      'verifications.json',
      'verification_items.json',
      'issued_destroyed_items.json'
    ];

    for (const file of expectedBackupFiles) {
      const filePath = path.join(report.backupFolder, file);
      assert.ok(fs.existsSync(filePath), `Backup file ${file} must exist`);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert.ok(content, `Backup file ${file} must have valid JSON content`);
    }

    // Verify non-ITO data is completely deleted
    const otherInv = await InventoryItem.find({ unit_id: otherId });
    const otherRx = await ReceivedTransaction.find({ unit_id: otherId });
    const otherEx = await ExpendedTransaction.find({ unit_id: otherId });
    const otherVerif = await Verification.find({ unit_id: otherId });
    const otherVItem = await VerificationItem.find({ verification_id: otherVerifId });
    const otherIdDoc = await IssuedDestroyedItem.find({ unit_id: otherId });

    assert.equal(otherInv.length, 0, 'Other unit inventory items must be deleted');
    assert.equal(otherRx.length, 0, 'Other unit received transactions must be deleted');
    assert.equal(otherEx.length, 0, 'Other unit expended transactions must be deleted');
    assert.equal(otherVerif.length, 0, 'Other unit verifications must be deleted');
    assert.equal(otherVItem.length, 0, 'Other unit verification items must be deleted');
    assert.equal(otherIdDoc.length, 0, 'Other unit issued/destroyed items must be deleted');

    // Verify ITO data is 100% intact
    const [itoInv, itoRx, itoEx, itoVerif, itoVItem, itoIdDoc] = await Promise.all([
      InventoryItem.find({ unit_id: itoId }),
      ReceivedTransaction.find({ unit_id: itoId }),
      ExpendedTransaction.find({ unit_id: itoId }),
      Verification.find({ unit_id: itoId }),
      VerificationItem.find({ verification_id: itoVerifId }),
      IssuedDestroyedItem.find({ unit_id: itoId })
    ]);

    assert.equal(itoInv.length, 3, 'ITO inventory items must remain 3');
    assert.equal(itoRx.length, 2, 'ITO received transactions must remain 2');
    assert.equal(itoEx.length, 2, 'ITO expended transactions must remain 2');
    assert.equal(itoVerif.length, 1, 'ITO verifications must remain 1');
    assert.equal(itoVItem.length, 2, 'ITO verification items must remain 2');
    assert.equal(itoIdDoc.length, 1, 'ITO issued/destroyed items must remain 1');

    // Verify Orphans are KEPT
    const orphanInv = await InventoryItem.find({ $or: [{ unit_id: null }, { unit_id: '' }] });
    const orphanRx = await ReceivedTransaction.find({ $or: [{ unit_id: null }, { unit_id: '' }] });
    const orphanVItem = await VerificationItem.find({ id: orphanVItemId });
    const orphanIdDoc = await IssuedDestroyedItem.find({ $or: [{ unit_id: null }, { unit_id: '' }] });

    assert.equal(orphanInv.length, 1, 'Orphan inventory item must be preserved');
    assert.equal(orphanRx.length, 1, 'Orphan received transaction must be preserved');
    assert.equal(orphanVItem.length, 1, 'Orphan verification item must be preserved');
    assert.equal(orphanIdDoc.length, 1, 'Orphan issued/destroyed item must be preserved');

    // Verify structural data (Units, Profiles, Audit Logs) is completely untouched
    const finalAuditLogCount = await AuditLog.countDocuments();
    const finalProfileCount = await Profile.countDocuments();
    const finalUnitCount = await Unit.countDocuments();

    assert.equal(finalAuditLogCount, initialAuditLogCount, 'Audit logs must never be deleted');
    assert.equal(finalProfileCount, initialProfileCount, 'Profiles must never be deleted');
    assert.equal(finalUnitCount, initialUnitCount, 'Units must never be deleted');
  });

  await t.test('3. Idempotency: Running cleanup again finds zero documents to delete and succeeds', async () => {
    const report2 = await cleanupNonItoData({
      confirm: true,
      keepConnection: true,
      backupDir: tempBackupDir,
      silent: true
    });

    assert.equal(report2.success, true);
    assert.equal(report2.deletedCounts.grandTotal, 0, 'Second run must find 0 records to delete');

    // Verify ITO data still remains intact
    const [itoInv2, itoRx2] = await Promise.all([
      InventoryItem.countDocuments({ unit_id: itoId }),
      ReceivedTransaction.countDocuments({ unit_id: itoId })
    ]);
    assert.equal(itoInv2, 3);
    assert.equal(itoRx2, 2);
  });

  await t.test('4. Safety Guard: Aborts if connected to database other than edl_ims', async () => {
    // Temporarily mock mongoose.connection.name
    const originalName = mongoose.connection.name;
    Object.defineProperty(mongoose.connection, 'name', {
      value: 'bus-booking',
      configurable: true
    });

    try {
      await assert.rejects(
        async () => {
          await cleanupNonItoData({ confirm: false, keepConnection: true, silent: true });
        },
        /CRITICAL SAFETY GUARD/
      );
    } finally {
      Object.defineProperty(mongoose.connection, 'name', {
        value: originalName,
        configurable: true
      });
    }
  });
});
