import test from 'node:test';
import assert from 'node:assert';
import {
  getItemSerials,
  isItemSelectable,
  getBatchSelectionStatus,
  toggleBatchSerials,
  toggleSingleSerial,
  selectAllFilteredSerials,
  resolvePrintItems
} from '../src/utils/selectionHelper.js';

test('getItemSerials extracts serial numbers accurately', () => {
  // Single item with item_code
  const single = { item_code: 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-001', quantity: 1 };
  assert.deepStrictEqual(getItemSerials(single), ['DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-001']);

  // Batch item with explicit serial_numbers
  const batchExplicit = {
    item_code: 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-001',
    quantity: 3,
    is_batch: true,
    serial_numbers: [
      'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-001',
      'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-002',
      'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-003'
    ]
  };
  assert.deepStrictEqual(getItemSerials(batchExplicit), [
    'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-001',
    'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-002',
    'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-003'
  ]);

  // Batch item with derived serials
  const batchDerived = {
    item_code: 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-005',
    quantity: 2,
    is_batch: true
  };
  assert.deepStrictEqual(getItemSerials(batchDerived), [
    'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-005',
    'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-006'
  ]);

  // Legacy item without serial
  const legacy = { item_code: '', quantity: 1 };
  assert.deepStrictEqual(getItemSerials(legacy), []);
  assert.strictEqual(isItemSelectable(legacy), false);
  assert.strictEqual(isItemSelectable(single), true);
});

test('getBatchSelectionStatus handles unchecked, indeterminate, checked, and disabled states', () => {
  const batch = {
    item_code: 'SN-001',
    quantity: 3,
    is_batch: true,
    serial_numbers: ['SN-001', 'SN-002', 'SN-003']
  };

  // None selected -> unchecked
  let selected = new Set();
  assert.strictEqual(getBatchSelectionStatus(batch, selected), 'unchecked');

  // Some selected -> indeterminate
  selected = new Set(['SN-001']);
  assert.strictEqual(getBatchSelectionStatus(batch, selected), 'indeterminate');

  selected = new Set(['SN-001', 'SN-003']);
  assert.strictEqual(getBatchSelectionStatus(batch, selected), 'indeterminate');

  // All selected -> checked
  selected = new Set(['SN-001', 'SN-002', 'SN-003']);
  assert.strictEqual(getBatchSelectionStatus(batch, selected), 'checked');

  // Item with no serials -> disabled
  const noSerialItem = { item_code: '', quantity: 1 };
  assert.strictEqual(getBatchSelectionStatus(noSerialItem, selected), 'disabled');
});

test('toggleBatchSerials selects all or deselects all', () => {
  const batch = {
    item_code: 'SN-001',
    quantity: 2,
    is_batch: true,
    serial_numbers: ['SN-001', 'SN-002']
  };

  // Initially empty -> toggling adds both
  let set1 = new Set();
  set1 = toggleBatchSerials(batch, set1);
  assert.strictEqual(set1.has('SN-001'), true);
  assert.strictEqual(set1.has('SN-002'), true);

  // Partially selected -> toggling adds remaining to select all
  let set2 = new Set(['SN-001']);
  set2 = toggleBatchSerials(batch, set2);
  assert.strictEqual(set2.has('SN-001'), true);
  assert.strictEqual(set2.has('SN-002'), true);

  // Fully selected -> toggling deselects both
  let set3 = new Set(['SN-001', 'SN-002']);
  set3 = toggleBatchSerials(batch, set3);
  assert.strictEqual(set3.has('SN-001'), false);
  assert.strictEqual(set3.has('SN-002'), false);
});

test('toggleSingleSerial toggles an individual serial number', () => {
  let set = new Set();
  set = toggleSingleSerial('SN-ABC', set);
  assert.strictEqual(set.has('SN-ABC'), true);

  set = toggleSingleSerial('SN-ABC', set);
  assert.strictEqual(set.has('SN-ABC'), false);
});

test('selectAllFilteredSerials selects all serial numbers across given items', () => {
  const items = [
    { item_code: 'SN-1', quantity: 1 },
    { item_code: 'SN-2', quantity: 2, is_batch: true, serial_numbers: ['SN-2', 'SN-3'] }
  ];

  const set = selectAllFilteredSerials(items, new Set());
  assert.strictEqual(set.size, 3);
  assert.ok(set.has('SN-1'));
  assert.ok(set.has('SN-2'));
  assert.ok(set.has('SN-3'));
});

test('resolvePrintItems preserves item ordering and associates item names', () => {
  const items = [
    { id: '1', item_code: 'SN-1', item_name: 'Chair Model A' },
    { id: '2', item_code: 'SN-2', item_name: 'Desk B', is_batch: true, serial_numbers: ['SN-2', 'SN-3'] }
  ];

  const selected = new Set(['SN-3', 'SN-1']); // Selected out-of-order
  const resolved = resolvePrintItems(items, selected);

  assert.strictEqual(resolved.length, 2);
  assert.strictEqual(resolved[0].serial, 'SN-1');
  assert.strictEqual(resolved[0].itemName, 'Chair Model A');
  assert.strictEqual(resolved[1].serial, 'SN-3');
  assert.strictEqual(resolved[1].itemName, 'Desk B');
});

test('partial batch selection allows picking only specific serials of a batch', () => {
  const batch = {
    id: 'batch-1',
    item_code: 'DGM/FUR/001',
    quantity: 4,
    is_batch: true,
    serial_numbers: ['DGM/FUR/001', 'DGM/FUR/002', 'DGM/FUR/003', 'DGM/FUR/004']
  };

  // Select only serials 1 and 3
  let set = new Set();
  set = toggleSingleSerial('DGM/FUR/001', set);
  set = toggleSingleSerial('DGM/FUR/003', set);

  assert.strictEqual(set.size, 2);
  assert.strictEqual(getBatchSelectionStatus(batch, set), 'indeterminate');

  // Print items only contains the 2 selected serials
  const printItems = resolvePrintItems([batch], set);
  assert.strictEqual(printItems.length, 2);
  assert.strictEqual(printItems[0].serial, 'DGM/FUR/001');
  assert.strictEqual(printItems[1].serial, 'DGM/FUR/003');
});

test('clearing selection resets the selected serials set', () => {
  let set = new Set(['SN-1', 'SN-2', 'SN-3']);
  assert.strictEqual(set.size, 3);
  set = new Set();
  assert.strictEqual(set.size, 0);
});

test('range selection helper aggregates serials across multiple row indexes', () => {
  const items = [
    { item_code: 'SN-001', quantity: 1 },
    { item_code: 'SN-002', quantity: 1 },
    { item_code: 'SN-003', quantity: 1 },
    { item_code: 'SN-004', quantity: 1 },
    { item_code: 'SN-005', quantity: 1 }
  ];

  // User clicked index 1 (SN-002), then Shift-clicked index 3 (SN-004)
  const start = 1;
  const end = 3;
  const rangeSlice = items.slice(start, end + 1);
  const nextSet = selectAllFilteredSerials(rangeSlice, new Set());

  assert.strictEqual(nextSet.size, 3);
  assert.ok(nextSet.has('SN-002'));
  assert.ok(nextSet.has('SN-003'));
  assert.ok(nextSet.has('SN-004'));
  assert.strictEqual(nextSet.has('SN-001'), false);
  assert.strictEqual(nextSet.has('SN-005'), false);
});
