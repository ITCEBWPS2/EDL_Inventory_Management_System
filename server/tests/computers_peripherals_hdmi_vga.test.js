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

test.describe('Computers & Peripherals HDMI to VGA Convertor Device Type Tests', () => {
  test.beforeEach(async () => {
    await setupTestDb();
  });

  test.afterEach(async () => {
    await teardownTestDb();
  });

  test('1. Generates correct serial number for HDMI to VGA Convertor device type under Computers & Peripherals', () => {
    const serial = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'IT & Computing Equipment',
      subCategory: 'computers-peripherals',
      itemType: 'HDMI to VGA Convertor',
      existingItems: []
    });

    assert.equal(
      serial,
      'DGM(WPSII)/CE(COM)/ITO/IT/CMP/HDMIVGA-CMP-001',
      'HDMI to VGA Convertor serial number must match exact expected format'
    );
  });

  test('2. Sequence numbers are counted independently per item type under Computers & Peripherals', async () => {
    // Existing Desktop, Laptop, and Tab items should NOT affect HDMI to VGA Convertor sequence
    const existingItems = [
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/DESKTOP-CMP-001' },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/DESKTOP-CMP-002' },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/LAPTOP-CMP-001' },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/TAB-CMP-001' }
    ];

    const convertorSerial1 = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'IT & Computing Equipment',
      subCategory: 'computers-peripherals',
      itemType: 'HDMI to VGA Convertor',
      existingItems
    });

    assert.equal(convertorSerial1, 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/HDMIVGA-CMP-001');

    // With existing HDMI to VGA Convertor items, sequence increments correctly
    const itemsWithConvertor = [
      ...existingItems,
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/HDMIVGA-CMP-001' },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/HDMIVGA-CMP-002' }
    ];

    const convertorSerial3 = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'IT & Computing Equipment',
      subCategory: 'computers-peripherals',
      itemType: 'HDMI to VGA Convertor',
      existingItems: itemsWithConvertor
    });

    assert.equal(convertorSerial3, 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/HDMIVGA-CMP-003');

    // DB sequence tracking and non-reuse upon deletion
    const item1 = await db.createInventoryItem({
      item_name: 'HDMI to VGA Convertor',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/HDMIVGA-CMP-001',
      category: 'IT & Computing Equipment',
      unit_id: TEST_UNIT.id,
      quantity: 1,
      sub_type: 'computers-peripherals'
    });

    const nextSerialBeforeDel = await db.getNextSerialNumber({
      unit_id: TEST_UNIT.id,
      category: 'IT & Computing Equipment',
      sub_type: 'computers-peripherals',
      item_type: 'HDMI to VGA Convertor'
    });
    assert.equal(nextSerialBeforeDel, 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/HDMIVGA-CMP-002');

    const item2 = await db.createInventoryItem({
      item_name: 'HDMI to VGA Convertor',
      item_code: nextSerialBeforeDel,
      category: 'IT & Computing Equipment',
      unit_id: TEST_UNIT.id,
      quantity: 1,
      sub_type: 'computers-peripherals'
    });

    // Delete item 2
    await db.deleteInventoryItem(item2.id);

    // Sequence must not be reused
    const nextSerialAfterDel = await db.getNextSerialNumber({
      unit_id: TEST_UNIT.id,
      category: 'IT & Computing Equipment',
      sub_type: 'computers-peripherals',
      item_type: 'HDMI to VGA Convertor'
    });
    assert.equal(nextSerialAfterDel, 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/HDMIVGA-CMP-003');
  });

  test('3. Database persists, lists, and filters HDMI to VGA Convertor items under Computers & Peripherals', async () => {
    const categories = await db.getCategories();
    const itCat = categories.find(
      c => c.slug === 'it-computing' || c.name === 'IT & Computing Equipment'
    );
    assert.ok(itCat, 'IT & Computing Equipment category must exist');

    const createdConvertor = await db.createInventoryItem({
      item_name: 'HDMI to VGA Convertor',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/HDMIVGA-CMP-001',
      category: 'IT & Computing Equipment',
      category_id: itCat.id,
      unit_id: TEST_UNIT.id,
      quantity: 1,
      sub_type: 'computers-peripherals',
      sub_classification: 'HDMI to VGA Convertor',
      brand: 'UGREEN',
      status: 'In Stock',
      description: 'Active HDMI to VGA Adapter with Audio'
    });

    assert.ok(createdConvertor);
    assert.equal(createdConvertor.item_name, 'HDMI to VGA Convertor');
    assert.equal(createdConvertor.sub_type, 'computers-peripherals');
    assert.equal(createdConvertor.sub_classification, 'HDMI to VGA Convertor');

    // Query with subType filter for computers-peripherals
    const cmpItems = await db.getInventoryItems(
      [TEST_UNIT.id],
      'IT & Computing Equipment',
      null,
      itCat.id,
      'computers-peripherals'
    );

    const foundConvertor = cmpItems.find(i => i.id === createdConvertor.id);
    assert.ok(foundConvertor, 'Created HDMI to VGA Convertor item should be returned in computers-peripherals filter');

    // Query with search
    const searchedItems = await db.getInventoryItems(
      [TEST_UNIT.id],
      'IT & Computing Equipment',
      'Convertor'
    );
    const foundBySearch = searchedItems.find(i => i.id === createdConvertor.id);
    assert.ok(foundBySearch, 'Should find HDMI to VGA Convertor via search query');
  });

  test('4. buildCategoryItemUnion includes HDMI to VGA Convertor as plain name without serial code', async () => {
    const { buildCategoryItemUnion } = await import('../../client/src/constants/categorySubtypes.js');
    const items = buildCategoryItemUnion('IT & Computing Equipment', []);
    const convertor = items.find(i => i.item_name === 'HDMI to VGA Convertor');

    assert.ok(convertor, 'HDMI to VGA Convertor must appear in configured union items');
    assert.equal(convertor.sub_category_name, 'Computers & Peripherals');
    assert.equal(convertor.item_name, 'HDMI to VGA Convertor');
    assert.ok(!convertor.item_name.includes('HDMIVGA'));
    assert.ok(!convertor.item_name.includes('001'));
  });
});
