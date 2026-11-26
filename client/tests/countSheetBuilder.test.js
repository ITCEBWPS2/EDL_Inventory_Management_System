import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COUNT_SHEET_OPTIONS,
  isItemUncounted,
  isItemPendingCondemnation,
  isItemDestroyedOrSold,
  resolveItemSerialList,
  sortCountSheetItems,
  filterCountSheetItems,
  buildCountSheetData
} from '../src/utils/countSheetBuilder.js';

describe('Count Sheet Builder Test Suite', () => {
  const sampleItems = [
    {
      id: 'item-3',
      item_code: 'SN-DESK-01',
      item_name: 'Office Desk 4ft',
      category: 'Furniture',
      sub_type: 'Desks',
      system_qty: 1,
      physical_qty: '1',
      status: 'In Stock'
    },
    {
      id: 'item-1',
      item_code: 'SN-LAP-02',
      serial_numbers: ['SN-LAP-01', 'SN-LAP-02', 'SN-LAP-03'],
      item_name: 'Dell Latitude 5420',
      category: 'IT & Computing Equipment',
      sub_type: 'Laptops',
      system_qty: 3,
      physical_qty: '',
      status: 'In Stock'
    },
    {
      id: 'item-2',
      item_code: 'SN-CHAIR-99',
      item_name: 'Executive Mesh Chair',
      category: 'Furniture',
      sub_type: 'Chairs',
      system_qty: 1,
      physical_qty: null,
      status: 'Pending Condemnation',
      is_pending_condemnation: true
    },
    {
      id: 'item-4',
      item_code: 'SN-PRINTER-01',
      item_name: 'HP LaserJet Pro',
      category: 'IT & Computing Equipment',
      sub_type: 'Printers',
      system_qty: 1,
      physical_qty: '',
      status: 'Destroyed' // should be excluded
    },
    {
      id: 'item-5',
      item_code: 'SN-OLD-CHAIR',
      item_name: 'Broken Plastic Chair',
      category: 'Furniture',
      sub_type: 'Chairs',
      system_qty: 1,
      physical_qty: '',
      status: 'Sold' // should be excluded
    }
  ];

  test('1. Ordering: sorts stably by category, then sub_category, then item name, then serial', () => {
    const active = sampleItems.filter(it => !isItemDestroyedOrSold(it));
    const sorted = sortCountSheetItems(active);

    assert.equal(sorted.length, 3);
    // Category 1: Furniture
    assert.equal(sorted[0].category, 'Furniture');
    assert.equal(sorted[0].sub_type, 'Chairs'); // 'Chairs' before 'Desks'
    assert.equal(sorted[1].category, 'Furniture');
    assert.equal(sorted[1].sub_type, 'Desks');
    // Category 2: IT & Computing Equipment
    assert.equal(sorted[2].category, 'IT & Computing Equipment');
  });

  test('2. One row per item with stacked serials: resolves all serial numbers cleanly', () => {
    const batchItem = sampleItems[1];
    const serials = resolveItemSerialList(batchItem);
    assert.equal(serials.length, 3);
    assert.deepEqual(serials, ['SN-LAP-01', 'SN-LAP-02', 'SN-LAP-03']);

    const singleItem = sampleItems[0];
    const singleSerials = resolveItemSerialList(singleItem);
    assert.equal(singleSerials.length, 1);
    assert.equal(singleSerials[0], 'SN-DESK-01');
  });

  test('3. Exclusion: destroyed and sold items are excluded from count sheet', () => {
    const filtered = filterCountSheetItems(sampleItems, sampleItems, { scope: 'all' });
    assert.equal(filtered.some(it => it.status === 'Destroyed'), false);
    assert.equal(filtered.some(it => it.status === 'Sold'), false);
    assert.equal(filtered.length, 3);
  });

  test('4. Scope options: "all", "filtered", and fallback for legacy scope', () => {
    const filteredVisible = [sampleItems[0]]; // Only Office Desk

    // Scope: all
    const dataAll = buildCountSheetData(sampleItems, filteredVisible, { scope: 'all' });
    assert.equal(dataAll.totalItems, 3);

    // Scope: filtered
    const dataFiltered = buildCountSheetData(sampleItems, filteredVisible, { scope: 'filtered' });
    assert.equal(dataFiltered.totalItems, 1);
    assert.equal(dataFiltered.items[0].id, 'item-3');

    // Legacy uncounted falls back to all items
    const dataLegacy = buildCountSheetData(sampleItems, filteredVisible, { scope: 'uncounted' });
    assert.equal(dataLegacy.totalItems, 3);
  });

  test('5. System Qty on/off: totals calculation reflects quantities accurately', () => {
    const data = buildCountSheetData(sampleItems, sampleItems, { scope: 'all', showSystemQty: true });
    // item-1 (3) + item-2 (1) + item-3 (1) = 5
    assert.equal(data.totalItems, 3);
    assert.equal(data.totalSystemQty, 5);

    const dataNoSys = buildCountSheetData(sampleItems, sampleItems, { scope: 'all', showSystemQty: false });
    assert.equal(dataNoSys.options.showSystemQty, false);
    assert.equal(dataNoSys.totalItems, 3);
  });

  test('6. Grouping by category: organizes items into category groups with metadata', () => {
    const data = buildCountSheetData(sampleItems, sampleItems, { scope: 'all', groupByCategory: true });
    assert.equal(data.groups.length, 2);
    const furnitureGroup = data.groups.find(g => g.category === 'Furniture');
    assert.ok(furnitureGroup);
    assert.equal(furnitureGroup.items.length, 2);

    const itGroup = data.groups.find(g => g.category === 'IT & Computing Equipment');
    assert.ok(itGroup);
    assert.equal(itGroup.items.length, 1);
  });

  test('7. Pending Condemnation Note: accurately flags items under disposal', () => {
    assert.equal(isItemPendingCondemnation(sampleItems[2]), true);
    assert.equal(isItemPendingCondemnation(sampleItems[0]), false);

    const data = buildCountSheetData(sampleItems, sampleItems, { scope: 'all' });
    const chairItem = data.items.find(it => it.id === 'item-2');
    assert.ok(chairItem);
    assert.equal(chairItem.is_pending_condemnation, true);
  });
});
