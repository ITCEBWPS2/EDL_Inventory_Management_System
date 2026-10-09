const assert = require('assert');
const {
  generateSerialNumber,
  resolveUnitCode,
  resolveCategoryCode,
  resolveSubCategoryCode,
  deriveItemTypeCode
} = require('../src/utils/serialNumberGenerator');
const db = require('../src/services/db');
const { setupTestDb, teardownTestDb } = require('./testHelper');

async function testSerialNumberGenerator() {
  await setupTestDb();
  console.log('Testing Serial Number Generation Logic...');

  // Test 1: Exact User Example from Prompt
  // "Clerical Chair" added under Category = Furniture, Chair Type = Clerical Chair, in Unit = ITO
  const serial1 = generateSerialNumber({
    unit: 'ITO',
    category: 'Furniture',
    subCategory: 'chairs',
    itemType: 'Clerical Chair',
    existingItems: []
  });
  console.log('Test 1 Generated Serial:', serial1);
  assert.strictEqual(
    serial1,
    'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-001',
    'Test 1 failed: did not match expected prompt example'
  );
  console.log('✔ Test 1 Passed: Exact user prompt example matched perfectly');

  // Test 2: Sequence Incrementing
  const existingItems = [
    { item_code: 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-001' },
    { item_code: 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-002' }
  ];
  const serial3 = generateSerialNumber({
    unit: 'ITO',
    category: 'Furniture',
    subCategory: 'chairs',
    itemType: 'Clerical Chair',
    existingItems
  });
  console.log('Test 2 Generated Serial:', serial3);
  assert.strictEqual(
    serial3,
    'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-003',
    'Test 2 failed: sequence should increment to 003'
  );
  console.log('✔ Test 2 Passed: Sequence increments accurately');

  // Test 3: Other Categories & Subtypes
  const tableSerial = generateSerialNumber({
    unit: 'CSC_HOMAGAMA',
    category: 'Furniture',
    subCategory: 'tables',
    itemType: 'Executive Table',
    existingItems: []
  });
  console.log('Test 3a Table Serial:', tableSerial);
  assert.strictEqual(
    tableSerial,
    'DGM(WPSII)/CE(COM)/CSC_HOMAGAMA/FUR/TBL/EXEC-TBL-001'
  );

  const pcSerial = generateSerialNumber({
    unit: { unit_name: 'ITO', unit_code: 'HOR-ITO' },
    category: 'IT & Computing Equipment',
    subCategory: 'computers-peripherals',
    itemType: 'Desktop Computer',
    existingItems: []
  });
  console.log('Test 3b Desktop PC Serial:', pcSerial);
  assert.strictEqual(
    pcSerial,
    'DGM(WPSII)/CE(COM)/ITO/IT/CMP/DESKTOP-CMP-001'
  );
  console.log('✔ Test 3 Passed: Multi-category mappings work as specified');

  // Test 4: Database Sequence Preservation on Deletion
  const testUnitId = '11111111-1111-1111-1111-111111111153'; // ITO
  const item1 = await db.createInventoryItem({
    item_name: 'Clerical Chair',
    item_code: 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-001',
    category: 'Furniture',
    unit_id: testUnitId,
    quantity: 1
  });

  const nextSerialBeforeDel = await db.getNextSerialNumber({
    unit_id: testUnitId,
    category: 'Furniture',
    sub_type: 'chairs',
    item_type: 'Clerical Chair'
  });
  console.log('Next serial before deletion:', nextSerialBeforeDel);
  assert.strictEqual(nextSerialBeforeDel, 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-002');

  const item2 = await db.createInventoryItem({
    item_name: 'Clerical Chair',
    item_code: nextSerialBeforeDel,
    category: 'Furniture',
    unit_id: testUnitId,
    quantity: 1
  });

  // Delete item 2
  await db.deleteInventoryItem(item2.id);

  // Next serial after item 2 deletion must be 003 (NOT 002)
  const nextSerialAfterDel = await db.getNextSerialNumber({
    unit_id: testUnitId,
    category: 'Furniture',
    sub_type: 'chairs',
    item_type: 'Clerical Chair'
  });
  console.log('Next serial after deletion:', nextSerialAfterDel);
  assert.strictEqual(
    nextSerialAfterDel,
    'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-003',
    'Test 4 failed: deleted sequence was reused!'
  );
  console.log('✔ Test 4 Passed: Deleted item sequence numbers are never reused');

  // Clean up item1
  await db.deleteInventoryItem(item1.id);

  console.log('All tests passed successfully!');
  await teardownTestDb();
}

testSerialNumberGenerator().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
