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

test.describe('Computers & Peripherals Tab Device Type Tests', () => {
  test.beforeEach(async () => {
    await setupTestDb();
  });

  test.afterEach(async () => {
    await teardownTestDb();
  });

  test('1. Generates correct serial number for Tab device type under Computers & Peripherals', () => {
    const serial = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'IT & Computing Equipment',
      subCategory: 'computers-peripherals',
      itemType: 'Tab',
      existingItems: []
    });

    assert.equal(
      serial,
      'DGM(WPSII)/CE(COM)/ITO/IT/CMP/TAB-CMP-001',
      'Tab serial number must match exact expected format'
    );
  });

  test('2. Sequence numbers are counted independently per item type under Computers & Peripherals', async () => {
    // Existing Desktop Computer items should NOT affect Tab's sequence
    const existingItems = [
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/DESKTOP-CMP-001' },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/DESKTOP-CMP-002' },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/LAPTOP-CMP-001' }
    ];

    const tabSerial1 = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'IT & Computing Equipment',
      subCategory: 'computers-peripherals',
      itemType: 'Tab',
      existingItems
    });

    assert.equal(tabSerial1, 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/TAB-CMP-001');

    // With existing Tab items, sequence increments correctly
    const itemsWithTab = [
      ...existingItems,
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/TAB-CMP-001' },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/TAB-CMP-002' }
    ];

    const tabSerial3 = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'IT & Computing Equipment',
      subCategory: 'computers-peripherals',
      itemType: 'Tab',
      existingItems: itemsWithTab
    });

    assert.equal(tabSerial3, 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/TAB-CMP-003');

    // DB sequence tracking and non-reuse upon deletion
    const item1 = await db.createInventoryItem({
      item_name: 'Tab',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/TAB-CMP-001',
      category: 'IT & Computing Equipment',
      unit_id: TEST_UNIT.id,
      quantity: 1,
      sub_type: 'computers-peripherals'
    });

    const nextSerialBeforeDel = await db.getNextSerialNumber({
      unit_id: TEST_UNIT.id,
      category: 'IT & Computing Equipment',
      sub_type: 'computers-peripherals',
      item_type: 'Tab'
    });
    assert.equal(nextSerialBeforeDel, 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/TAB-CMP-002');

    const item2 = await db.createInventoryItem({
      item_name: 'Tab',
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
      item_type: 'Tab'
    });
    assert.equal(nextSerialAfterDel, 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/TAB-CMP-003');
  });

  test('3. Database persists, lists, and filters Tab items under Computers & Peripherals', async () => {
    const categories = await db.getCategories();
    const itCat = categories.find(
      c => c.slug === 'it-computing' || c.name === 'IT & Computing Equipment'
    );
    assert.ok(itCat, 'IT & Computing Equipment category must exist');

    const createdTab = await db.createInventoryItem({
      item_name: 'Tab',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/IT/CMP/TAB-CMP-001',
      category: 'IT & Computing Equipment',
      category_id: itCat.id,
      unit_id: TEST_UNIT.id,
      quantity: 1,
      sub_type: 'computers-peripherals',
      sub_classification: 'Tab',
      brand: 'Samsung',
      status: 'In Stock',
      description: 'Galaxy Tab Active 4'
    });

    assert.ok(createdTab);
    assert.equal(createdTab.item_name, 'Tab');
    assert.equal(createdTab.sub_type, 'computers-peripherals');
    assert.equal(createdTab.sub_classification, 'Tab');

    // Query with subType filter for computers-peripherals
    const cmpItems = await db.getInventoryItems(
      [TEST_UNIT.id],
      'IT & Computing Equipment',
      '',
      itCat.id,
      'computers-peripherals'
    );
    const foundTab = cmpItems.find(i => i.id === createdTab.id);
    assert.ok(foundTab, 'Created Tab item should be returned in computers-peripherals filter');

    // Must NOT leak into other IT subcategories
    const printerItems = await db.getInventoryItems(
      [TEST_UNIT.id],
      'IT & Computing Equipment',
      '',
      itCat.id,
      'printers-printing-equipment'
    );
    assert.ok(!printerItems.some(i => i.id === createdTab.id), 'Tab must NOT leak into printers-printing-equipment');

    const storageItems = await db.getInventoryItems(
      [TEST_UNIT.id],
      'IT & Computing Equipment',
      '',
      itCat.id,
      'storage-devices'
    );
    assert.ok(!storageItems.some(i => i.id === createdTab.id), 'Tab must NOT leak into storage-devices');

    // Must NOT leak into other categories
    const ogeItems = await db.getInventoryItems(
      [TEST_UNIT.id],
      'Tools & Equipment',
      '',
      '',
      'office-general-equipment'
    );
    assert.ok(!ogeItems.some(i => i.id === createdTab.id), 'Tab must NOT leak into office-general-equipment');
  });
});
