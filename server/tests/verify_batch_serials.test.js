const assert = require('assert');
const { generateBatchSerialNumbers, generateSerialNumber } = require('../src/utils/serialNumberGenerator');
const db = require('../src/services/db');
const { setupTestDb, teardownTestDb } = require('./testHelper');

async function runTests() {
  await setupTestDb();
  console.log('--- Starting Multi-Serial Batch Tests ---');

  // Test 1: Generate batch serials for Visitor Chair with Quantity = 4 in Unit ITO
  const batch1 = generateBatchSerialNumbers({
    unit: 'ITO',
    category: 'Furniture',
    subCategory: 'chairs',
    itemType: 'Visitor Chair',
    quantity: 4,
    existingItems: [],
    serverCounters: {}
  });

  console.log('Generated Batch 1:', batch1);
  assert.strictEqual(batch1.serialNumbers.length, 4, 'Should generate 4 serial numbers');
  assert.strictEqual(batch1.serialNumbers[0], 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/VISITOR-CHR-001');
  assert.strictEqual(batch1.serialNumbers[1], 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/VISITOR-CHR-002');
  assert.strictEqual(batch1.serialNumbers[2], 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/VISITOR-CHR-003');
  assert.strictEqual(batch1.serialNumbers[3], 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/VISITOR-CHR-004');
  assert.strictEqual(batch1.batchLabel, 'Visitor Chair Batch (Multi-Serial)');
  console.log('✓ Test 1 passed: Batch serials generated correctly.');

  // Test 2: Next single item generation after batch exists in existingItems
  const mockBatchItem = {
    id: 'mock-batch-1',
    item_name: 'Visitor Chair',
    item_code: batch1.firstSerial,
    serial_numbers: batch1.serialNumbers,
    is_batch: true,
    quantity: 4
  };

  const nextSingle = generateSerialNumber({
    unit: 'ITO',
    category: 'Furniture',
    subCategory: 'chairs',
    itemType: 'Visitor Chair',
    existingItems: [mockBatchItem]
  });

  console.log('Next single item serial:', nextSingle);
  assert.strictEqual(nextSingle, 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/VISITOR-CHR-005', 'Should increment to 005 after batch of 4');
  console.log('✓ Test 2 passed: Next single item increments sequence correctly.');

  // Test 3: Executive chair has its own independent sequence starting at 001
  const execChair = generateSerialNumber({
    unit: 'ITO',
    category: 'Furniture',
    subCategory: 'chairs',
    itemType: 'Executive Chair',
    existingItems: [mockBatchItem]
  });

  console.log('Executive chair serial:', execChair);
  assert.strictEqual(execChair, 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/EXEC-CHR-001', 'Executive Chair sequence starts at 001');
  console.log('✓ Test 3 passed: Independent item types maintain their own sequences.');

  // Test 4: Database creation & counter advancement
  const testUnitId = '11111111-1111-1111-1111-111111111153'; // ITO unit
  const createdBatchItem = await db.createInventoryItem({
    item_name: 'Visitor Chair',
    item_code: batch1.firstSerial,
    category: 'Furniture',
    unit_id: testUnitId,
    quantity: 4,
    sub_type: 'chairs',
    sub_classification: 'Visitor Chair',
    serial_numbers: batch1.serialNumbers,
    is_batch: true,
    batch_label: 'Visitor Chair Batch (Multi-Serial)'
  });

  assert.strictEqual(createdBatchItem.is_batch, true);
  assert.strictEqual(createdBatchItem.quantity, 4);
  assert.strictEqual(createdBatchItem.serial_numbers.length, 4);

  // Subsequent generation from DB
  const nextFromDb = await db.getNextSerialNumber({
    unit_id: testUnitId,
    category: 'Furniture',
    sub_type: 'chairs',
    item_type: 'Visitor Chair'
  });

  console.log('Next from DB:', nextFromDb);
  assert.strictEqual(nextFromDb, 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/VISITOR-CHR-005', 'DB sequence should advance past batch');
  console.log('✓ Test 4 passed: DB advances counters and generates next sequence properly.');

  // Test 5: Search matches batch label and individual serials in batch
  const searchResults = await db.getInventoryItems([testUnitId], 'Furniture', 'VISITOR-CHR-003', null, 'chairs');
  assert.strictEqual(searchResults.length, 1, 'Should find batch item by inner serial number');
  assert.strictEqual(searchResults[0].id, createdBatchItem.id);
  console.log('✓ Test 5 passed: Search finds batch row by individual serial number.');

  // Clean up
  await db.deleteInventoryItem(createdBatchItem.id);

  // Test 6: Per-unit Manufacturer S/N independence (Unit 1 blank, Unit 2 'unkn45')
  const mixedBatchItem = await db.createInventoryItem({
    item_name: 'Clerical Chair',
    item_code: 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-004',
    category: 'Furniture',
    unit_id: testUnitId,
    quantity: 2,
    sub_type: 'chairs',
    sub_classification: 'Clerical Chair',
    serial_numbers: [
      'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-004',
      'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-005'
    ],
    is_batch: true,
    batch_label: 'Clerical Chair Batch (Multi-Serial)',
    manufacturer_serial_numbers: ['', 'unkn45']
  });

  assert.strictEqual(mixedBatchItem.serial_number, null, 'Batch row serial_number must be null, not shared');
  assert.strictEqual(mixedBatchItem.manufacturer_serial_numbers.length, 2, 'Must have 2 entries in manufacturer_serial_numbers');
  assert.strictEqual(mixedBatchItem.manufacturer_serial_numbers[0], '', 'Unit 1 must be blank');
  assert.strictEqual(mixedBatchItem.manufacturer_serial_numbers[1], 'unkn45', 'Unit 2 must be unkn45');

  // Verify fetch resolves identical values
  const fetched = await db.getInventoryItemById(mixedBatchItem.id);
  assert.strictEqual(fetched.serial_number, null);
  assert.strictEqual(fetched.manufacturer_serial_numbers[0], '');
  assert.strictEqual(fetched.manufacturer_serial_numbers[1], 'unkn45');
  console.log('✓ Test 6 passed: Per-unit Manufacturer S/N is completely independent by index.');

  await db.deleteInventoryItem(mixedBatchItem.id);
  console.log('--- All Multi-Serial Batch Tests Passed! ---');
  await teardownTestDb();
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
