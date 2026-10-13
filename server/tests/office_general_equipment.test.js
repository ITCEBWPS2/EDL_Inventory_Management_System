const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const { generateSerialNumber, generateBatchSerialNumbers } = require('../src/utils/serialNumberGenerator');
const db = require('../src/services/db');
const { InventoryItem, Unit } = require('../src/models');

const TEST_UNIT = {
  unit_name: 'ITO',
  unit_code: 'WPS-ITO',
  id: '11111111-1111-1111-1111-111111111153'
};

test.describe('Office & General Equipment Sub-Category Tests', () => {
  test.beforeEach(async () => {
    await setupTestDb();
  });

  test.afterEach(async () => {
    await teardownTestDb();
  });

  test('1. Generates correct serial numbers for all 10 item types under Office & General Equipment', () => {
    const itemTypesExpected = [
      { type: 'Briefcase', expectedCode: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/BRIEFCASE-OGE-001' },
      { type: 'Calculator', expectedCode: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/CALCULATOR-OGE-001' },
      { type: 'Stapler', expectedCode: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/STAPLER-OGE-001' },
      { type: 'Cello Tape Machine', expectedCode: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/CELLO-TAPE-OGE-001' },
      { type: 'Cash Box', expectedCode: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/CASH-BOX-OGE-001' },
      { type: 'Wall Clock', expectedCode: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/WALL-CLOCK-OGE-001' },
      { type: 'Wireless Door Bell', expectedCode: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/DOOR-BELL-OGE-001' },
      { type: 'Ladder', expectedCode: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/LADDER-OGE-001' },
      { type: 'Puncher (L)', expectedCode: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/PUNCHER-L-OGE-001' },
      { type: 'Puncher (S)', expectedCode: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/PUNCHER-S-OGE-001' }
    ];

    for (const { type, expectedCode } of itemTypesExpected) {
      const serial = generateSerialNumber({
        unit: TEST_UNIT,
        category: 'Tools & Equipment',
        subCategory: 'office-general-equipment',
        itemType: type,
        existingItems: []
      });
      assert.equal(serial, expectedCode, `Serial for ${type} should match ${expectedCode}`);
    }
  });

  test('2. Independent sequence counters are preserved per item type under OGE', () => {
    const existingStaplers = [
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/STAPLER-OGE-001' },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/STAPLER-OGE-002' }
    ];

    const nextStapler = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Tools & Equipment',
      subCategory: 'office-general-equipment',
      itemType: 'Stapler',
      existingItems: existingStaplers
    });
    assert.equal(nextStapler, 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/STAPLER-OGE-003');

    // Calculator remains independent at 001
    const nextCalc = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Tools & Equipment',
      subCategory: 'office-general-equipment',
      itemType: 'Calculator',
      existingItems: existingStaplers
    });
    assert.equal(nextCalc, 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/CALCULATOR-OGE-001');
  });

  test('3. Batch serial generation works for Office & General Equipment multi-unit batches', () => {
    const batch = generateBatchSerialNumbers({
      unit: TEST_UNIT,
      category: 'Tools & Equipment',
      subCategory: 'office-general-equipment',
      itemType: 'Stapler',
      quantity: 3,
      existingItems: []
    });

    assert.equal(batch.count, 3);
    assert.equal(batch.firstSerial, 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/STAPLER-OGE-001');
    assert.equal(batch.lastSerial, 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/STAPLER-OGE-003');
    assert.deepEqual(batch.serialNumbers, [
      'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/STAPLER-OGE-001',
      'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/STAPLER-OGE-002',
      'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/STAPLER-OGE-003'
    ]);
  });

  test('4. Database persists and filters Office & General Equipment items cleanly', async () => {
    const category = await db.getCategories();
    const toolsCat = category.find(c => c.slug === 'tools-equipment' || c.name === 'Tools & Equipment');
    assert.ok(toolsCat, 'Tools & Equipment category must exist');

    const created = await db.createInventoryItem({
      item_name: 'Cash Box',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/CASH-BOX-OGE-001',
      category: 'Tools & Equipment',
      category_id: toolsCat.id,
      unit_id: TEST_UNIT.id,
      quantity: 2,
      sub_type: 'office-general-equipment',
      status: 'In Stock',
      description: 'Heavy duty steel cash box'
    });

    assert.ok(created);
    assert.equal(created.sub_type, 'office-general-equipment');
    assert.equal(created.item_name, 'Cash Box');

    // Query with subType filter for office-general-equipment
    const ogeItems = await db.getInventoryItems([TEST_UNIT.id], 'Tools & Equipment', '', toolsCat.id, 'office-general-equipment');
    const foundOge = ogeItems.find(i => i.id === created.id);
    assert.ok(foundOge, 'Created item should be returned in office-general-equipment filter');

    // Query other subcategories: item must NOT leak into them
    const handToolsItems = await db.getInventoryItems([TEST_UNIT.id], 'Tools & Equipment', '', toolsCat.id, 'hand-tools');
    const leakedInHandTools = handToolsItems.find(i => i.id === created.id);
    assert.equal(leakedInHandTools, undefined, 'Item must NOT appear in hand-tools filter');

    const ktcItems = await db.getInventoryItems([TEST_UNIT.id], 'Tools & Equipment', '', toolsCat.id, 'kitchen-refreshment-equipment');
    const leakedInKtc = ktcItems.find(i => i.id === created.id);
    assert.equal(leakedInKtc, undefined, 'Item must NOT appear in kitchen-refreshment-equipment filter');
  });

  test('5. Puncher (L) and Puncher (S) serials are distinct, valid without brackets/spaces, and have independent counters', () => {
    // Generate single serial for each
    const puncherL_1 = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Tools & Equipment',
      subCategory: 'office-general-equipment',
      itemType: 'Puncher (L)',
      existingItems: []
    });
    const puncherS_1 = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Tools & Equipment',
      subCategory: 'office-general-equipment',
      itemType: 'Puncher (S)',
      existingItems: []
    });

    assert.equal(puncherL_1, 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/PUNCHER-L-OGE-001');
    assert.equal(puncherS_1, 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/PUNCHER-S-OGE-001');
    assert.notEqual(puncherL_1, puncherS_1, 'Puncher (L) and Puncher (S) serials must be distinct');

    // Verify serial numbers do not contain invalid characters (brackets or spaces in item type code portion)
    const itemTypeCodePartL = puncherL_1.split('/').pop();
    const itemTypeCodePartS = puncherS_1.split('/').pop();
    assert.match(itemTypeCodePartL, /^PUNCHER-L-OGE-\d{3}$/, 'Puncher (L) serial must have no brackets or spaces');
    assert.match(itemTypeCodePartS, /^PUNCHER-S-OGE-\d{3}$/, 'Puncher (S) serial must have no brackets or spaces');

    // Independent sequencing: simulate existing Puncher (L) items
    const existingPuncherL = [
      { item_code: puncherL_1 },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/PUNCHER-L-OGE-002' }
    ];

    const nextPuncherL = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Tools & Equipment',
      subCategory: 'office-general-equipment',
      itemType: 'Puncher (L)',
      existingItems: existingPuncherL
    });
    assert.equal(nextPuncherL, 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/PUNCHER-L-OGE-003');

    // Puncher (S) must remain at 001 despite existing Puncher (L) items
    const nextPuncherS = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Tools & Equipment',
      subCategory: 'office-general-equipment',
      itemType: 'Puncher (S)',
      existingItems: existingPuncherL
    });
    assert.equal(nextPuncherS, 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/PUNCHER-S-OGE-001');
  });

  test('6. Database persists and filters Puncher (L) and Puncher (S) items with exact brackets preserved', async () => {
    const category = await db.getCategories();
    const toolsCat = category.find(c => c.slug === 'tools-equipment' || c.name === 'Tools & Equipment');
    assert.ok(toolsCat, 'Tools & Equipment category must exist');

    const createdL = await db.createInventoryItem({
      item_name: 'Puncher (L)',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/PUNCHER-L-OGE-001',
      category: 'Tools & Equipment',
      category_id: toolsCat.id,
      unit_id: TEST_UNIT.id,
      quantity: 1,
      sub_type: 'office-general-equipment',
      sub_classification: 'Puncher (L)',
      status: 'In Stock'
    });

    const createdS = await db.createInventoryItem({
      item_name: 'Puncher (S)',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/OGE/PUNCHER-S-OGE-001',
      category: 'Tools & Equipment',
      category_id: toolsCat.id,
      unit_id: TEST_UNIT.id,
      quantity: 1,
      sub_type: 'office-general-equipment',
      sub_classification: 'Puncher (S)',
      status: 'In Stock'
    });

    assert.equal(createdL.item_name, 'Puncher (L)');
    assert.equal(createdS.item_name, 'Puncher (S)');
    assert.equal(createdL.sub_classification, 'Puncher (L)');
    assert.equal(createdS.sub_classification, 'Puncher (S)');

    // Filter under office-general-equipment
    const ogeItems = await db.getInventoryItems([TEST_UNIT.id], 'Tools & Equipment', '', toolsCat.id, 'office-general-equipment');
    const foundL = ogeItems.find(i => i.id === createdL.id);
    const foundS = ogeItems.find(i => i.id === createdS.id);
    assert.ok(foundL, 'Puncher (L) must be returned in office-general-equipment filter');
    assert.ok(foundS, 'Puncher (S) must be returned in office-general-equipment filter');

    // Must NOT leak to other subcategories
    const handToolsItems = await db.getInventoryItems([TEST_UNIT.id], 'Tools & Equipment', '', toolsCat.id, 'hand-tools');
    assert.ok(!handToolsItems.some(i => i.id === createdL.id || i.id === createdS.id), 'Items must not leak into hand-tools');

    const electricalItems = await db.getInventoryItems([TEST_UNIT.id], 'Tools & Equipment', '', toolsCat.id, 'electrical-tools-testing-equipment');
    assert.ok(!electricalItems.some(i => i.id === createdL.id || i.id === createdS.id), 'Items must not leak into electrical-tools-testing-equipment');
  });
});
