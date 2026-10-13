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

test.describe('Network Equipment Managed Access Point Tests', () => {
  test.beforeEach(async () => {
    await setupTestDb();
  });

  test.afterEach(async () => {
    await teardownTestDb();
  });

  test('1. Generates correct serial number for Managed Access Point under Network Equipment', () => {
    const serial = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Network & Communication Equipment',
      subCategory: 'network-equipment',
      itemType: 'Managed Access Point',
      existingItems: []
    });

    assert.equal(
      serial,
      'DGM(WPSII)/CE(COM)/ITO/NET/NET/MAP-NET-001',
      'Managed Access Point serial number must match exact expected format'
    );
  });

  test('2. Managed Access Point (MAP-NET) and Wireless Access Point (WAP-NET) are distinct and maintain independent counters', async () => {
    // Generate initial serials
    const mapSerial1 = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Network & Communication Equipment',
      subCategory: 'network-equipment',
      itemType: 'Managed Access Point',
      existingItems: []
    });

    const wapSerial1 = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Network & Communication Equipment',
      subCategory: 'network-equipment',
      itemType: 'Wireless Access Point',
      existingItems: []
    });

    assert.equal(mapSerial1, 'DGM(WPSII)/CE(COM)/ITO/NET/NET/MAP-NET-001');
    assert.equal(wapSerial1, 'DGM(WPSII)/CE(COM)/ITO/NET/NET/WAP-NET-001');
    assert.notEqual(mapSerial1, wapSerial1, 'MAP and WAP serials must be distinct');

    // Simulate existing WAP items: MAP counter must stay at 001
    const existingWapItems = [
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/NET/NET/WAP-NET-001' },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/NET/NET/WAP-NET-002' },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/NET/NET/WAP-NET-003' }
    ];

    const nextMap = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Network & Communication Equipment',
      subCategory: 'network-equipment',
      itemType: 'Managed Access Point',
      existingItems: existingWapItems
    });
    assert.equal(nextMap, 'DGM(WPSII)/CE(COM)/ITO/NET/NET/MAP-NET-001');

    // With existing MAP items, sequence increments correctly
    const existingMapItems = [
      ...existingWapItems,
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/NET/NET/MAP-NET-001' },
      { item_code: 'DGM(WPSII)/CE(COM)/ITO/NET/NET/MAP-NET-002' }
    ];

    const nextMapSeq = generateSerialNumber({
      unit: TEST_UNIT,
      category: 'Network & Communication Equipment',
      subCategory: 'network-equipment',
      itemType: 'Managed Access Point',
      existingItems: existingMapItems
    });
    assert.equal(nextMapSeq, 'DGM(WPSII)/CE(COM)/ITO/NET/NET/MAP-NET-003');

    // DB sequence tracking and non-reuse upon deletion
    const item1 = await db.createInventoryItem({
      item_name: 'Managed Access Point',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/NET/NET/MAP-NET-001',
      category: 'Network & Communication Equipment',
      unit_id: TEST_UNIT.id,
      quantity: 1,
      sub_type: 'network-equipment'
    });

    const nextSerialBeforeDel = await db.getNextSerialNumber({
      unit_id: TEST_UNIT.id,
      category: 'Network & Communication Equipment',
      sub_type: 'network-equipment',
      item_type: 'Managed Access Point'
    });
    assert.equal(nextSerialBeforeDel, 'DGM(WPSII)/CE(COM)/ITO/NET/NET/MAP-NET-002');

    const item2 = await db.createInventoryItem({
      item_name: 'Managed Access Point',
      item_code: nextSerialBeforeDel,
      category: 'Network & Communication Equipment',
      unit_id: TEST_UNIT.id,
      quantity: 1,
      sub_type: 'network-equipment'
    });

    // Delete item 2
    await db.deleteInventoryItem(item2.id);

    // Sequence must not be reused
    const nextSerialAfterDel = await db.getNextSerialNumber({
      unit_id: TEST_UNIT.id,
      category: 'Network & Communication Equipment',
      sub_type: 'network-equipment',
      item_type: 'Managed Access Point'
    });
    assert.equal(nextSerialAfterDel, 'DGM(WPSII)/CE(COM)/ITO/NET/NET/MAP-NET-003');
  });

  test('3. Database persists, lists, and filters Managed Access Point items under Network Equipment', async () => {
    const categories = await db.getCategories();
    const netCat = categories.find(
      c => c.slug === 'network-communication' || c.name === 'Network & Communication Equipment'
    );
    assert.ok(netCat, 'Network & Communication Equipment category must exist');

    const created = await db.createInventoryItem({
      item_name: 'Managed Access Point',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/NET/NET/MAP-NET-001',
      category: 'Network & Communication Equipment',
      category_id: netCat.id,
      unit_id: TEST_UNIT.id,
      quantity: 1,
      sub_type: 'network-equipment',
      sub_classification: 'Managed Access Point',
      brand: 'Cisco',
      status: 'In Stock',
      description: 'Catalyst 9100 Series Access Point'
    });

    assert.ok(created);
    assert.equal(created.item_name, 'Managed Access Point');
    assert.equal(created.sub_type, 'network-equipment');
    assert.equal(created.sub_classification, 'Managed Access Point');

    // Query with subType filter for network-equipment
    const netItems = await db.getInventoryItems(
      [TEST_UNIT.id],
      'Network & Communication Equipment',
      '',
      netCat.id,
      'network-equipment'
    );
    const foundMap = netItems.find(i => i.id === created.id);
    assert.ok(foundMap, 'Created Managed Access Point item should be returned in network-equipment filter');

    // Must NOT leak into other network subcategories
    const srvItems = await db.getInventoryItems(
      [TEST_UNIT.id],
      'Network & Communication Equipment',
      '',
      netCat.id,
      'servers-storage'
    );
    assert.ok(!srvItems.some(i => i.id === created.id), 'Managed Access Point must NOT leak into servers-storage');

    const telItems = await db.getInventoryItems(
      [TEST_UNIT.id],
      'Network & Communication Equipment',
      '',
      netCat.id,
      'telephones-phones'
    );
    assert.ok(!telItems.some(i => i.id === created.id), 'Managed Access Point must NOT leak into telephones-phones');

    // Must NOT leak into other categories (e.g. computers-peripherals)
    const cmpItems = await db.getInventoryItems(
      [TEST_UNIT.id],
      'IT & Computing Equipment',
      '',
      '',
      'computers-peripherals'
    );
    assert.ok(!cmpItems.some(i => i.id === created.id), 'Managed Access Point must NOT leak into computers-peripherals');
  });
});
