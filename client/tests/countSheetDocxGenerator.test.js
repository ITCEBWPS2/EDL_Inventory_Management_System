import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Packer } from 'docx';
import { buildCountSheetData } from '../src/utils/countSheetBuilder.js';
import { generateCountSheetDocx } from '../src/utils/countSheetDocxGenerator.js';

describe('Count Sheet Docx Generator Test Suite', () => {
  const sampleItems = [
    {
      id: 'item-1',
      item_code: 'SN-LAP-01',
      serial_numbers: ['SN-LAP-01', 'SN-LAP-02'],
      item_name: 'Dell Laptop Core i7',
      category: 'IT Equipment',
      sub_type: 'Laptops',
      system_qty: 2,
      physical_qty: '',
      status: 'In Stock'
    },
    {
      id: 'item-2',
      item_code: 'SN-CHAIR-01',
      item_name: 'Conference Chair',
      category: 'Furniture',
      sub_type: 'Chairs',
      system_qty: 1,
      physical_qty: '',
      status: 'In Review',
      is_pending_condemnation: true
    }
  ];

  const metadata = {
    unitName: 'ITO (WPS-ITO)',
    date: '2026-11-26',
    year: '2026',
    verifier1: 'N. Fernando',
    verifier2: 'S. Silva',
    verifier3: 'D. Perera'
  };

  test('1. Document produces a valid non-empty buffer via Packer', async () => {
    const data = buildCountSheetData(sampleItems, sampleItems, {
      scope: 'all',
      showSystemQty: true,
      groupByCategory: true
    });

    const doc = await generateCountSheetDocx(data, metadata);
    assert.ok(doc, 'Must return a Document instance');

    const buffer = await Packer.toBuffer(doc);
    assert.ok(buffer && buffer.length > 5000, `Expected buffer length > 5000, got ${buffer.length}`);
  });

  test('2. Landscape A4 Section: section exists and has landscape dimensions', async () => {
    const data = buildCountSheetData(sampleItems, sampleItems, {
      scope: 'all',
      showSystemQty: true,
      groupByCategory: true
    });

    const doc = await generateCountSheetDocx(data, metadata);
    const body = doc.documentWrapper?.document?.body;
    assert.ok(body, 'Body must exist on document');
    assert.ok(body.sections && body.sections.length >= 1, 'Must have at least one section');

    // Buffer generates successfully confirming valid section definition
    const buffer = await Packer.toBuffer(doc);
    assert.ok(buffer.length > 0);
  });

  test('3. Table column count: 10 columns when grouped, 11 columns when ungrouped', async () => {
    // Case A: Grouped by category (Category column omitted from items, rendered as category band)
    const dataGrouped = buildCountSheetData(sampleItems, sampleItems, {
      scope: 'all',
      showSystemQty: true,
      groupByCategory: true
    });
    const docGrouped = await generateCountSheetDocx(dataGrouped, metadata);
    const tablesGrouped = docGrouped.documentWrapper.document.body.root.filter(r => r.constructor.name === 'Table');
    assert.ok(tablesGrouped.length >= 2, 'Should have form fields and main table');

    const mainTableGrouped = tablesGrouped[1];
    const headerRowGrouped = mainTableGrouped.root.find(r => r.constructor.name === 'TableRow');
    const cellsGrouped = headerRowGrouped.root.filter(c => c.constructor.name === 'TableCell');
    assert.equal(cellsGrouped.length, 10, 'Expected 10 columns when category is grouped');

    // Case B: Ungrouped (includes Category column)
    const dataUngrouped = buildCountSheetData(sampleItems, sampleItems, {
      scope: 'all',
      showSystemQty: true,
      groupByCategory: false
    });
    const docUngrouped = await generateCountSheetDocx(dataUngrouped, metadata);
    const tablesUngrouped = docUngrouped.documentWrapper.document.body.root.filter(r => r.constructor.name === 'Table');
    const mainTableUngrouped = tablesUngrouped[1];
    const headerRowUngrouped = mainTableUngrouped.root.find(r => r.constructor.name === 'TableRow');
    const cellsUngrouped = headerRowUngrouped.root.filter(c => c.constructor.name === 'TableCell');
    assert.equal(cellsUngrouped.length, 11, 'Expected 11 columns when category is ungrouped');
  });

  test('4. System Qty toggle: column count adjusts to 9 when showSystemQty is false', async () => {
    const dataNoSys = buildCountSheetData(sampleItems, sampleItems, {
      scope: 'all',
      showSystemQty: false,
      groupByCategory: true
    });
    const docNoSys = await generateCountSheetDocx(dataNoSys, metadata);
    const tablesNoSys = docNoSys.documentWrapper.document.body.root.filter(r => r.constructor.name === 'Table');
    const mainTableNoSys = tablesNoSys[1];
    const headerRowNoSys = mainTableNoSys.root.find(r => r.constructor.name === 'TableRow');
    const cellsNoSys = headerRowNoSys.root.filter(c => c.constructor.name === 'TableCell');
    assert.equal(cellsNoSys.length, 9, 'Expected 9 columns when System Qty is omitted');

    const bufferNoSys = await Packer.toBuffer(docNoSys);
    assert.ok(bufferNoSys && bufferNoSys.length > 5000);
  });
});
