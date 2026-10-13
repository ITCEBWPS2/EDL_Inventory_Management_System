const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const { generateSerialNumber, generateBatchSerialNumbers } = require('../src/utils/serialNumberGenerator');
const db = require('../src/services/db');

const TEST_UNIT = {
  unit_name: 'ITO',
  unit_code: 'WPS-ITO',
  id: '11111111-1111-1111-1111-111111111153'
};

test.describe('Electrical Tools & Testing Equipment New Types Tests', () => {
  test.beforeEach(async () => {
    await setupTestDb();
  });

  test.afterEach(async () => {
    await teardownTestDb();
  });

  test('1. Generates correct serial numbers for the 3 new equipment types under ETE', () => {
    const newTypes = [
      {
        type: 'Trimble GPS Receiver',
        expectedCode: 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/TRIMBLE-GPS-RECEIVER-ETE-001'
      },
      {
        type: 'Bluebird Data Collector',
        expectedCode: 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/BLUEBIRD-DATA-COLLECTOR-ETE-001'
      },
      {
        type: 'Binocular',
        expectedCode: 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/BINOCULAR-ETE-001'
      }
    ];

    for (const { type, expectedCode } of newTypes) {
      const serial = generateSerialNumber({
        unit: TEST_UNIT,
        category: 'Tools & Equipment',
        subCategory: 'electrical-tools-testing-equipment',
        itemType: type,
        existingItems: []
      });
      assert.equal(serial, expectedCode, `Serial for ${type} should match ${expectedCode}`);
    }
  });

  test('2. Sequence counters are independent per item type under ETE', () => {
    const existingGps = [
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/TRIMBLE-GPS-RECEIVER-ETE-001' },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/TRIMBLE-GPS-RECEIVER-ETE-002' }
    ];

    const nextGps = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Tools & Equipment',
      subCategory: 'electrical-tools-testing-equipment',
      itemType: 'Trimble GPS Receiver',
      existingItems: existingGps
    });
    assert.equal(nextGps, 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/TRIMBLE-GPS-RECEIVER-ETE-003');

    // Bluebird Data Collector remains independent at 001
    const nextBluebird = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Tools & Equipment',
      subCategory: 'electrical-tools-testing-equipment',
      itemType: 'Bluebird Data Collector',
      existingItems: existingGps
    });
    assert.equal(nextBluebird, 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/BLUEBIRD-DATA-COLLECTOR-ETE-001');

    // Binocular remains independent at 001
    const nextBinocular = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Tools & Equipment',
      subCategory: 'electrical-tools-testing-equipment',
      itemType: 'Binocular',
      existingItems: existingGps
    });
    assert.equal(nextBinocular, 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/BINOCULAR-ETE-001');
  });

  test('3. Database persists and filters the 3 new equipment types under ETE', async () => {
    const categories = await db.getCategories();
    const toolsCat = categories.find(c => c.slug === 'tools-equipment' || c.name === 'Tools & Equipment');
    assert.ok(toolsCat, 'Tools & Equipment category must exist');

    // Create 1 item of each of the 3 new types
    const item1 = await db.createInventoryItem({
      item_name: 'Trimble GPS Receiver',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/TRIMBLE-GPS-RECEIVER-ETE-001',
      category: 'Tools & Equipment',
      category_id: toolsCat.id,
      unit_id: TEST_UNIT.id,
      quantity: 1,
      sub_type: 'electrical-tools-testing-equipment',
      status: 'In Stock'
    });

    const item2 = await db.createInventoryItem({
      item_name: 'Bluebird Data Collector',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/BLUEBIRD-DATA-COLLECTOR-ETE-001',
      category: 'Tools & Equipment',
      category_id: toolsCat.id,
      unit_id: TEST_UNIT.id,
      quantity: 1,
      sub_type: 'electrical-tools-testing-equipment',
      status: 'In Stock'
    });

    const item3 = await db.createInventoryItem({
      item_name: 'Binocular',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/BINOCULAR-ETE-001',
      category: 'Tools & Equipment',
      category_id: toolsCat.id,
      unit_id: TEST_UNIT.id,
      quantity: 2,
      sub_type: 'electrical-tools-testing-equipment',
      status: 'In Stock'
    });

    assert.ok(item1 && item2 && item3);
    assert.equal(item1.sub_type, 'electrical-tools-testing-equipment');
    assert.equal(item2.sub_type, 'electrical-tools-testing-equipment');
    assert.equal(item3.sub_type, 'electrical-tools-testing-equipment');

    // Query ETE subcategory: all 3 must be present
    const eteItems = await db.getInventoryItems([TEST_UNIT.id], 'Tools & Equipment', '', toolsCat.id, 'electrical-tools-testing-equipment');
    const eteIds = eteItems.map(i => i.id);
    assert.ok(eteIds.includes(item1.id), 'Trimble GPS must be in ETE filter');
    assert.ok(eteIds.includes(item2.id), 'Bluebird Data Collector must be in ETE filter');
    assert.ok(eteIds.includes(item3.id), 'Binocular must be in ETE filter');

    // Query other subcategories: items must NOT leak
    const ogeItems = await db.getInventoryItems([TEST_UNIT.id], 'Tools & Equipment', '', toolsCat.id, 'office-general-equipment');
    const ogeIds = ogeItems.map(i => i.id);
    assert.equal(ogeIds.includes(item1.id), false);
    assert.equal(ogeIds.includes(item2.id), false);
    assert.equal(ogeIds.includes(item3.id), false);

    const handTools = await db.getInventoryItems([TEST_UNIT.id], 'Tools & Equipment', '', toolsCat.id, 'hand-tools');
    const handToolIds = handTools.map(i => i.id);
    assert.equal(handToolIds.includes(item1.id), false);
    assert.equal(handToolIds.includes(item2.id), false);
    assert.equal(handToolIds.includes(item3.id), false);
  });
});
