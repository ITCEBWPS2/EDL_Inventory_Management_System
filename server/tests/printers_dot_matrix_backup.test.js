const test = require('node:test');
const assert = require('node:assert/strict');
const { generateSerialNumber: serverGen } = require('../src/utils/serialNumberGenerator');
const db = require('../src/services/db');
const { Unit, Category, InventoryItem } = require('../src/models');
const { setupTestDb, teardownTestDb } = require('./testHelper');

const TEST_UNIT = {
  unit_name: 'ITO',
  unit_code: 'WPS-ITO'
};

test('Printers & Printing Equipment: Dot Matrix Printer Backup Test Suite', async (t) => {
  // Dynamically import client generator for parity test
  const { generateSerialNumber: clientGen } = await import('../../client/src/utils/serialNumberGenerator.js');

  let testUnit;
  let itCategory;

  await t.before(async () => {
    await setupTestDb();
    testUnit = await Unit.findOne({});
    itCategory = await Category.findOne({ name: 'IT & Computing Equipment' });
  });

  await t.after(async () => {
    await teardownTestDb();
  });

  await t.test('1. Generates correct serial number format for Dot Matrix Printer Backup', () => {
    const serial = serverGen({
      unit: TEST_UNIT,
      category: 'IT & Computing Equipment',
      subCategory: 'printers-printing-equipment',
      itemType: 'Dot Matrix Printer Backup',
      existingItems: []
    });

    assert.strictEqual(
      serial,
      'DGM(WPSII)/CE(COM)/ITO/IT/PRN/BCKDOTMTX-PRN-001',
      `Expected serial to be DGM(WPSII)/CE(COM)/ITO/IT/PRN/BCKDOTMTX-PRN-001, got ${serial}`
    );
  });

  await t.test('2. Client and server generators produce identical serials (parity)', () => {
    const existing = [
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/PRN/BCKDOTMTX-PRN-001' },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/PRN/BCKDOTMTX-PRN-002' }
    ];

    const serverSerial = serverGen({
      unit: TEST_UNIT,
      category: 'IT & Computing Equipment',
      subCategory: 'printers-printing-equipment',
      itemType: 'Dot Matrix Printer Backup',
      existingItems: existing
    });

    const clientSerial = clientGen({
      unit: TEST_UNIT,
      category: 'IT & Computing Equipment',
      subCategory: 'printers-printing-equipment',
      itemType: 'Dot Matrix Printer Backup',
      existingItems: existing
    });

    assert.strictEqual(serverSerial, 'DGM(WPSII)/CE(COM)/ITO/IT/PRN/BCKDOTMTX-PRN-003');
    assert.strictEqual(clientSerial, serverSerial, 'Client and Server generator must be in sync');
  });

  await t.test('3. Dot Matrix Printer Backup is distinct from Dot Matrix Printer (no prefix collision)', () => {
    const regularSerial = serverGen({
      unit: TEST_UNIT,
      category: 'IT & Computing Equipment',
      subCategory: 'printers-printing-equipment',
      itemType: 'Dot Matrix Printer',
      existingItems: []
    });

    const backupSerial = serverGen({
      unit: TEST_UNIT,
      category: 'IT & Computing Equipment',
      subCategory: 'printers-printing-equipment',
      itemType: 'Dot Matrix Printer Backup',
      existingItems: []
    });

    assert.strictEqual(regularSerial, 'DGM(WPSII)/CE(COM)/ITO/IT/PRN/DOTMTX-PRN-001');
    assert.strictEqual(backupSerial, 'DGM(WPSII)/CE(COM)/ITO/IT/PRN/BCKDOTMTX-PRN-001');
    assert.notStrictEqual(regularSerial, backupSerial, 'Serials must never collide');
    assert.ok(regularSerial.includes('DOTMTX-PRN-001'));
    assert.ok(backupSerial.includes('BCKDOTMTX-PRN-001'));
  });

  await t.test('4. Independent sequence counting across item types in database', async () => {
    // Insert 2 Dot Matrix Printer items
    const p1 = await db.createInventoryItem({
      item_name: 'Dot Matrix Printer',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/PRN/DOTMTX-PRN-001',
      category: 'IT & Computing Equipment',
      unit_id: testUnit.id,
      sub_type: 'printers-printing-equipment',
      quantity: 1
    });

    const p2 = await db.createInventoryItem({
      item_name: 'Dot Matrix Printer',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/PRN/DOTMTX-PRN-002',
      category: 'IT & Computing Equipment',
      unit_id: testUnit.id,
      sub_type: 'printers-printing-equipment',
      quantity: 1
    });

    // Insert 1 Dot Matrix Printer Backup item - should start at 001
    const pb1 = await db.createInventoryItem({
      item_name: 'Dot Matrix Printer Backup',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/PRN/BCKDOTMTX-PRN-001',
      category: 'IT & Computing Equipment',
      unit_id: testUnit.id,
      sub_type: 'printers-printing-equipment',
      quantity: 1
    });

    assert.ok(p1.id && p2.id && pb1.id);
    assert.strictEqual(p1.item_code, 'DGM(WPSII)/CE(COM)/ITO/IT/PRN/DOTMTX-PRN-001');
    assert.strictEqual(p2.item_code, 'DGM(WPSII)/CE(COM)/ITO/IT/PRN/DOTMTX-PRN-002');
    assert.strictEqual(pb1.item_code, 'DGM(WPSII)/CE(COM)/ITO/IT/PRN/BCKDOTMTX-PRN-001');
  });

  await t.test('5. Database subcategory filtering isolates printers-printing-equipment', async () => {
    const printerItems = await db.getInventoryItems([testUnit.id], null, '', null, 'printers-printing-equipment');
    const printerNames = printerItems.map(i => i.item_name);

    assert.ok(printerNames.includes('Dot Matrix Printer'));
    assert.ok(printerNames.includes('Dot Matrix Printer Backup'));

    // Check that neither appears in computers-peripherals
    const compItems = await db.getInventoryItems([testUnit.id], null, '', null, 'computers-peripherals');
    const compNames = compItems.map(i => i.item_name);
    assert.strictEqual(compNames.includes('Dot Matrix Printer Backup'), false);
    assert.strictEqual(compNames.includes('Dot Matrix Printer'), false);
  });
});
