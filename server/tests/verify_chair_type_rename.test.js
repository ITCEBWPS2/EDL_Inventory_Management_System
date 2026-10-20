const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  generateSerialNumber,
  deriveItemTypeCode
} = require('../src/utils/serialNumberGenerator');
const {
  InventoryItem,
  ReceivedTransaction,
  ExpendedTransaction,
  VerificationItem,
  IssuedDestroyedItem
} = require('../src/models');
const { migrateChairTypes, CHAIR_RENAME_MAP } = require('../src/scripts/migrate-chair-type-names');
const { setupTestDb, teardownTestDb } = require('./testHelper');

test('Chair Type Rename & Migration Test Suite', async (t) => {

  await t.test('1. Serial Number Generator generates identical codes for renamed chair types and legacy aliases', () => {
    // New names
    assert.strictEqual(deriveItemTypeCode('Computer Executive Chair', 'CHR'), 'COMP-EXEC-CHR');
    assert.strictEqual(deriveItemTypeCode('Computer Typist Chair', 'CHR'), 'COMP-TYPIST-CHR');
    assert.strictEqual(deriveItemTypeCode('Computer Assistant Chair', 'CHR'), 'COMP-ASST-CHR');

    // Legacy aliases
    assert.strictEqual(deriveItemTypeCode('Computer Executive', 'CHR'), 'COMP-EXEC-CHR');
    assert.strictEqual(deriveItemTypeCode('Computer Typist', 'CHR'), 'COMP-TYPIST-CHR');
    assert.strictEqual(deriveItemTypeCode('Computer Assistant', 'CHR'), 'COMP-ASST-CHR');

    // Other chair types remain unchanged
    assert.strictEqual(deriveItemTypeCode('Clerical Chair', 'CHR'), 'CLERICL-CHR');
    assert.strictEqual(deriveItemTypeCode('Visitor Chair', 'CHR'), 'VISITOR-CHR');
    assert.strictEqual(deriveItemTypeCode('Executive Chair', 'CHR'), 'EXEC-CHR');
    assert.strictEqual(deriveItemTypeCode('Front Chair', 'CHR'), 'FRONT-CHR');
  });

  await t.test('2. Full serial number generation produces consistent format and sequence continuity', () => {
    // Generate serial with new name
    const serialNew = generateSerialNumber({
      unit: 'ITO',
      category: 'Furniture',
      subCategory: 'chairs',
      itemType: 'Computer Executive Chair',
      existingItems: []
    });
    assert.strictEqual(serialNew, 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/COMP-EXEC-CHR-001');

    // Generate serial with legacy alias
    const serialOld = generateSerialNumber({
      unit: 'ITO',
      category: 'Furniture',
      subCategory: 'chairs',
      itemType: 'Computer Executive',
      existingItems: []
    });
    assert.strictEqual(serialOld, 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/COMP-EXEC-CHR-001');

    // Sequence continues when existing items have earlier numbers
    const serialNext = generateSerialNumber({
      unit: 'ITO',
      category: 'Furniture',
      subCategory: 'chairs',
      itemType: 'Computer Typist Chair',
      existingItems: [
        { item_code: 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/COMP-TYPIST-CHR-001' }
      ]
    });
    assert.strictEqual(serialNext, 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/COMP-TYPIST-CHR-002');
  });

  await t.test('3. Migration script updates all collections and is idempotent', async () => {
    await setupTestDb();
    try {
      // Create fixture data with legacy chair names
      const item1 = await InventoryItem.create({
        id: 'test-chair-001',
        item_name: 'Computer Executive',
        item_code: 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/COMP-EXEC-CHR-001',
        category: 'Furniture',
        unit_id: '11111111-1111-1111-1111-111111111145',
        quantity: 5,
        status: 'In Stock',
        sub_type: 'chairs',
        sub_classification: 'Computer Executive'
      });

      const item2 = await InventoryItem.create({
        id: 'test-chair-002',
        item_name: 'Computer Typist',
        item_code: 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/COMP-TYPIST-CHR-001',
        category: 'Furniture',
        unit_id: '11111111-1111-1111-1111-111111111145',
        quantity: 3,
        status: 'In Stock',
        sub_type: 'chairs',
        sub_classification: 'Computer Typist',
        batch_label: 'Computer Typist Batch (Multi-Serial)'
      });

      const item3 = await InventoryItem.create({
        id: 'test-chair-003',
        item_name: 'Computer Assistant',
        item_code: 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/COMP-ASST-CHR-001',
        category: 'Furniture',
        unit_id: '11111111-1111-1111-1111-111111111145',
        quantity: 2,
        status: 'In Stock',
        sub_type: 'Computer Assistant',
        sub_classification: 'Computer Assistant'
      });

      // Control item that should NOT be modified
      const controlItem = await InventoryItem.create({
        id: 'test-control-table',
        item_name: 'Executive Table',
        item_code: 'DGM(WPSII)/CE(COM)/ITO/FUR/TBL/EXEC-TBL-001',
        category: 'Furniture',
        unit_id: '11111111-1111-1111-1111-111111111145',
        quantity: 1,
        status: 'In Stock',
        sub_type: 'tables'
      });

      // Transactions and verifications with denormalized legacy names
      await ReceivedTransaction.create({
        id: 'test-rec-001',
        item_id: item1.id,
        item_name: 'Computer Executive',
        item_code: item1.item_code,
        category: 'Furniture',
        quantity: 5,
        date: '2026-01-15',
        unit_id: '11111111-1111-1111-1111-111111111145',
        voucher_no: 'VR-CHAIR-001'
      });

      await ExpendedTransaction.create({
        id: 'test-exp-001',
        item_id: item2.id,
        item_name: 'Computer Typist',
        item_code: item2.item_code,
        category: 'Furniture',
        quantity: 1,
        date: '2026-02-10',
        unit_id: '11111111-1111-1111-1111-111111111145',
        voucher_no: 'EX-CHAIR-001'
      });

      await VerificationItem.create({
        id: 'test-ver-001',
        verification_id: 'v-001',
        item_name: 'Computer Assistant',
        item_code: item3.item_code,
        category: 'Furniture',
        system_qty: 2,
        physical_qty: 2
      });

      await mongoose.connection.db.collection('issued_destroyed_items').insertOne({
        id: 'test-iss-001',
        item_id: item1.id,
        item_name: 'Computer Executive',
        quantity: 1,
        disposition: 'issued',
        date: '2026-03-01'
      });

      // First run: execute migration
      const run1 = await migrateChairTypes({ dbNameCheck: false });
      assert.strictEqual(run1.inventory_items, 3, 'Should update 3 inventory items');
      assert.strictEqual(run1.received_transactions, 1, 'Should update 1 received transaction');
      assert.strictEqual(run1.expended_transactions, 1, 'Should update 1 expended transaction');
      assert.strictEqual(run1.verification_items, 1, 'Should update 1 verification item');
      assert.strictEqual(run1.issued_destroyed_items, 1, 'Should update 1 issued/destroyed item');

      // Verify fields in DB
      const updatedItem1 = await InventoryItem.findOne({ id: item1.id });
      assert.strictEqual(updatedItem1.item_name, 'Computer Executive Chair');
      assert.strictEqual(updatedItem1.sub_classification, 'Computer Executive Chair');
      assert.strictEqual(updatedItem1.quantity, 5, 'Quantity must not change');
      assert.strictEqual(updatedItem1.item_code, item1.item_code, 'Item code must not change');

      const updatedItem2 = await InventoryItem.findOne({ id: item2.id });
      assert.strictEqual(updatedItem2.item_name, 'Computer Typist Chair');
      assert.strictEqual(updatedItem2.sub_classification, 'Computer Typist Chair');
      assert.strictEqual(updatedItem2.batch_label, 'Computer Typist Chair Batch (Multi-Serial)');

      const updatedItem3 = await InventoryItem.findOne({ id: item3.id });
      assert.strictEqual(updatedItem3.item_name, 'Computer Assistant Chair');
      assert.strictEqual(updatedItem3.sub_classification, 'Computer Assistant Chair');
      assert.strictEqual(updatedItem3.sub_type, 'Computer Assistant Chair');

      // Control item must be unchanged
      const updatedControl = await InventoryItem.findOne({ id: controlItem.id });
      assert.strictEqual(updatedControl.item_name, 'Executive Table');

      // Transactions
      const updatedRec = await ReceivedTransaction.findOne({ id: 'test-rec-001' });
      assert.strictEqual(updatedRec.item_name, 'Computer Executive Chair');

      const updatedExp = await ExpendedTransaction.findOne({ id: 'test-exp-001' });
      assert.strictEqual(updatedExp.item_name, 'Computer Typist Chair');

      const updatedVer = await VerificationItem.findOne({ id: 'test-ver-001' });
      assert.strictEqual(updatedVer.item_name, 'Computer Assistant Chair');

      const updatedIss = await mongoose.connection.db.collection('issued_destroyed_items').findOne({ id: 'test-iss-001' });
      assert.strictEqual(updatedIss.item_name, 'Computer Executive Chair');

      // Second run: IDEMPOTENCY CHECK
      const run2 = await migrateChairTypes({ dbNameCheck: false });
      assert.strictEqual(run2.inventory_items, 0, 'Second run must update 0 inventory items');
      assert.strictEqual(run2.received_transactions, 0, 'Second run must update 0 received transactions');
      assert.strictEqual(run2.expended_transactions, 0, 'Second run must update 0 expended transactions');
      assert.strictEqual(run2.verification_items, 0, 'Second run must update 0 verification items');
      assert.strictEqual(run2.issued_destroyed_items, 0, 'Second run must update 0 issued/destroyed items');
    } finally {
      await teardownTestDb();
    }
  });

  await t.test('4. Safety guard prevents migration on non-edl_ims database', async () => {
    await setupTestDb();
    try {
      const origName = mongoose.connection.name;
      Object.defineProperty(mongoose.connection, 'name', { value: 'bus-booking', configurable: true });

      await assert.rejects(
        async () => {
          await migrateChairTypes({ dbNameCheck: true });
        },
        /SAFETY ABORT/
      );

      Object.defineProperty(mongoose.connection, 'name', { value: origName, configurable: true });
    } finally {
      await teardownTestDb();
    }
  });
});
