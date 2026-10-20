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

  test('1. Generates correct serial numbers for equipment types under ETE', () => {
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
      },
      {
        type: 'Digital Multimeter',
        expectedCode: 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/MULTIMETER-ETE-001'
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

  test('2. Digital Multimeter serial is distinct from Digital Clamp Meter', () => {
    const multimeterSerial = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Tools & Equipment',
      subCategory: 'electrical-tools-testing-equipment',
      itemType: 'Digital Multimeter',
      existingItems: []
    });

    const clampMeterSerial = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Tools & Equipment',
      subCategory: 'electrical-tools-testing-equipment',
      itemType: 'Digital Clamp Meter',
      existingItems: []
    });

    assert.equal(multimeterSerial, 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/MULTIMETER-ETE-001');
    assert.notEqual(multimeterSerial, clampMeterSerial);
    assert.ok(clampMeterSerial.includes('DIGITAL-CLAM'));
    assert.ok(multimeterSerial.includes('MULTIMETER-ETE'));

    // Sequence for Digital Multimeter is independent of existing Digital Clamp Meter items
    const existingClampMeters = [
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/DIGITAL-CLAM-ETE-001' },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/DIGITAL-CLAM-ETE-002' }
    ];

    const nextMultimeter = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Tools & Equipment',
      subCategory: 'electrical-tools-testing-equipment',
      itemType: 'Digital Multimeter',
      existingItems: existingClampMeters
    });
    assert.equal(nextMultimeter, 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/MULTIMETER-ETE-001');
  });

  test('3. Sequence counters are independent per item type under ETE', () => {
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

    // Digital Multimeter remains independent at 001
    const nextMultimeter = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Tools & Equipment',
      subCategory: 'electrical-tools-testing-equipment',
      itemType: 'Digital Multimeter',
      existingItems: existingGps
    });
    assert.equal(nextMultimeter, 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/MULTIMETER-ETE-001');
  });

  test('4. Database persists and filters equipment types including Digital Multimeter under ETE', async () => {
    const categories = await db.getCategories();
    const toolsCat = categories.find(c => c.slug === 'tools-equipment' || c.name === 'Tools & Equipment');
    assert.ok(toolsCat, 'Tools & Equipment category must exist');

    // Create 1 item of each type including Digital Multimeter
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

    const item4 = await db.createInventoryItem({
      item_name: 'Digital Multimeter',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/MULTIMETER-ETE-001',
      category: 'Tools & Equipment',
      category_id: toolsCat.id,
      unit_id: TEST_UNIT.id,
      quantity: 5,
      sub_type: 'electrical-tools-testing-equipment',
      sub_classification: 'Digital Multimeter',
      brand: 'Fluke',
      status: 'In Stock'
    });

    assert.ok(item1 && item2 && item3 && item4);
    assert.equal(item4.sub_type, 'electrical-tools-testing-equipment');
    assert.equal(item4.item_name, 'Digital Multimeter');

    // Query ETE subcategory: all 4 must be present
    const eteItems = await db.getInventoryItems([TEST_UNIT.id], 'Tools & Equipment', '', toolsCat.id, 'electrical-tools-testing-equipment');
    const eteIds = eteItems.map(i => i.id);
    assert.ok(eteIds.includes(item1.id), 'Trimble GPS must be in ETE filter');
    assert.ok(eteIds.includes(item2.id), 'Bluebird Data Collector must be in ETE filter');
    assert.ok(eteIds.includes(item3.id), 'Binocular must be in ETE filter');
    assert.ok(eteIds.includes(item4.id), 'Digital Multimeter must be in ETE filter');

    // Query other subcategories: items must NOT leak
    const ogeItems = await db.getInventoryItems([TEST_UNIT.id], 'Tools & Equipment', '', toolsCat.id, 'office-general-equipment');
    const ogeIds = ogeItems.map(i => i.id);
    assert.equal(ogeIds.includes(item4.id), false, 'Digital Multimeter must not leak into OGE');

    const handTools = await db.getInventoryItems([TEST_UNIT.id], 'Tools & Equipment', '', toolsCat.id, 'hand-tools');
    const handToolIds = handTools.map(i => i.id);
    assert.equal(handToolIds.includes(item4.id), false, 'Digital Multimeter must not leak into Hand Tools');
  });

  test('5. buildCategoryItemUnion includes Digital Multimeter as plain name without serial code', async () => {
    const { buildCategoryItemUnion } = await import('../../client/src/constants/categorySubtypes.js');
    const items = buildCategoryItemUnion('Tools & Equipment', []);
    const multimeter = items.find(i => i.item_name === 'Digital Multimeter');

    assert.ok(multimeter, 'Digital Multimeter must appear in Tools & Equipment union items');
    assert.equal(multimeter.sub_category_name, 'Electrical Tools & Testing Equipment');
    assert.equal(multimeter.item_name, 'Digital Multimeter');
    assert.ok(!multimeter.item_name.includes('MULTIMETER-ETE'));
    assert.ok(!multimeter.item_name.includes('001'));
  });
});
