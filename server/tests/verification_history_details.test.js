const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/services/db');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const { v4: uuidv4 } = require('uuid');

test('Verification History Details, Row Filtering & Label No Persistence Test Suite', async (t) => {
  test.before(async () => {
    await setupTestDb();
  });

  test.after(async () => {
    await teardownTestDb();
  });

  await t.test('1. Seeded verifications load correctly and year filter works', async () => {
    const allRows = await db.getVerificationHistoryItems(null, 'all');
    assert.ok(allRows.length >= 9, `Expected at least 9 seeded rows, got ${allRows.length}`);

    const rows2025 = await db.getVerificationHistoryItems(null, '2025');
    assert.equal(rows2025.length, 3);
    assert.ok(rows2025.every(r => Number(r.year) === 2025));

    const rows2026 = await db.getVerificationHistoryItems(null, '2026');
    assert.equal(rows2026.length, 6);
    assert.ok(rows2026.every(r => Number(r.year) === 2026));

    // Old format rows load with serial numbers
    const r1 = rows2025.find(r => r.item_code === 'TX-100KVA-01');
    assert.ok(r1);
    assert.ok(r1.serial_numbers.length > 0);
    assert.equal(r1.label_no, 'TAG-TX-101');
    assert.ok(r1.verified_by.includes('H.M. Karunaratne'));
  });

  await t.test('2. Untouched rows without entered data are excluded by default, but included when includeNotCounted=true', async () => {
    const testUnitId = '11111111-1111-1111-1111-111111111145';
    const testYear = 2027;

    const newVerif = await db.createVerification({
      unit_id: testUnitId,
      date: '2027-04-10',
      year: testYear,
      verifier_1: 'Alice Perera',
      verifier_2: 'Bob Silva',
      verifier_3: 'Charlie Fernando',
      status: 'confirmed',
      summary: 'Test survey with counted and untouched rows',
      items: [
        // Row 1: Counted with physical_qty
        {
          item_id: uuidv4(),
          item_code: 'TEST-001',
          item_name: 'Transformer Oil Tester',
          category: 'Tools & Equipment',
          system_qty: 5,
          physical_qty: 4,
          condition: 'Fair',
          label_no: 'VL-TEST-001',
          remarks: 'Oil vessel cap slightly loose'
        },
        // Row 2: Batch item with excess (+1)
        {
          item_id: uuidv4(),
          item_code: 'BATCH-002',
          serial_numbers: ['BT-01', 'BT-02', 'BT-03', 'BT-04'],
          is_batch: true,
          item_name: 'Safety Helmets Class E',
          category: 'Safety Gear',
          system_qty: 3,
          physical_qty: 4,
          condition: 'Good',
          label_no: 'VL-BATCH-002',
          remarks: 'Extra helmet discovered in cabinet'
        },
        // Row 3: Issued marked item
        {
          item_id: uuidv4(),
          item_code: 'TEST-003',
          item_name: 'High Voltage Gloves',
          category: 'Safety Gear',
          system_qty: 10,
          physical_qty: null,
          issued_destroyed: 'Issued',
          issued_destroyed_qty: 3,
          label_no: 'VL-GLOVES-03'
        },
        // Row 4: Only label_no entered (physical_qty null)
        {
          item_id: uuidv4(),
          item_code: 'TEST-004',
          item_name: 'Steel Measuring Tape 50m',
          category: 'Tools & Equipment',
          system_qty: 2,
          physical_qty: null,
          condition: '—',
          label_no: 'VL-TAPE-04',
          remarks: ''
        },
        // Row 5: Completely untouched row
        {
          item_id: uuidv4(),
          item_code: 'UNTOUCHED-005',
          item_name: 'Earthing Rod Set',
          category: 'Tools & Equipment',
          system_qty: 8,
          physical_qty: null,
          condition: '—',
          label_no: '',
          remarks: '',
          status: 'Not Counted'
        },
        // Row 6: Completely untouched row with default Good
        {
          item_id: uuidv4(),
          item_code: 'UNTOUCHED-006',
          item_name: 'Warning Cones',
          category: 'Safety Gear',
          system_qty: 20,
          physical_qty: null,
          condition: 'Good',
          label_no: '',
          remarks: '',
          status: 'Not Counted'
        }
      ]
    });

    assert.ok(newVerif.id);

    // Default query: should ONLY return the 4 rows with entered data
    const defaultHistory = await db.getVerificationHistoryItems([testUnitId], testYear, false);
    assert.equal(defaultHistory.length, 4, `Expected 4 rows with entered data, got ${defaultHistory.length}`);
    const codes = defaultHistory.map(r => r.item_code);
    assert.ok(codes.includes('TEST-001'));
    assert.ok(codes.includes('BATCH-002'));
    assert.ok(codes.includes('TEST-003'));
    assert.ok(codes.includes('TEST-004'));
    assert.ok(!codes.includes('UNTOUCHED-005'));
    assert.ok(!codes.includes('UNTOUCHED-006'));

    // Include not counted query: should return ALL 6 rows
    const fullHistory = await db.getVerificationHistoryItems([testUnitId], testYear, true);
    assert.equal(fullHistory.length, 6, `Expected all 6 rows when includeNotCounted=true, got ${fullHistory.length}`);

    const untouched = fullHistory.find(r => r.item_code === 'UNTOUCHED-005');
    assert.ok(untouched);
    assert.equal(untouched.is_counted, false);
    assert.equal(untouched.status, 'Not counted');
    // Physical available MUST be null, never copied from system_qty!
    assert.equal(untouched.physical_available, null);
    assert.equal(untouched.physical_not_available, null);
  });

  await t.test('3. Exact label_no, remarks, condition, and quantities are preserved and calculated accurately', async () => {
    const rows = await db.getVerificationHistoryItems(null, 2027);

    // Row 1: TEST-001
    const r1 = rows.find(r => r.item_code === 'TEST-001');
    assert.ok(r1);
    assert.equal(r1.label_no, 'VL-TEST-001');
    assert.equal(r1.remarks, 'Oil vessel cap slightly loose');
    assert.equal(r1.condition, 'Fair');
    assert.equal(r1.physical_available, 4);
    assert.equal(r1.physical_not_available, 1);
    assert.equal(r1.difference, -1);
    assert.equal(r1.verified_by, 'Alice Perera, Bob Silva, Charlie Fernando');

    // Row 2: BATCH-002 with excess (+1)
    const r2 = rows.find(r => r.item_code === 'BATCH-002');
    assert.ok(r2);
    assert.equal(r2.label_no, 'VL-BATCH-002');
    assert.equal(r2.physical_available, 4);
    assert.equal(r2.system_qty, 3);
    assert.equal(r2.physical_not_available, 0);
    assert.equal(r2.difference, 1); // excess

    // Row 3: TEST-003 with issued
    const r3 = rows.find(r => r.item_code === 'TEST-003');
    assert.ok(r3);
    assert.equal(r3.label_no, 'VL-GLOVES-03');
    assert.equal(r3.disposition, 'Issued');
    assert.equal(r3.issued_destroyed_qty, 3);
    assert.equal(r3.physical_available, null);
    assert.equal(r3.physical_not_available, null);
  });

  await t.test('4. Per-row draft save preserves label_no and appears in history after confirmation', async () => {
    const draftUnitId = '11111111-1111-1111-1111-111111111145';
    const draftItemId = '33333333-3333-3333-3333-333333333301';

    // Save single row to draft
    const draftRes = await db.saveDraftItem({
      unit_id: draftUnitId,
      item_id: draftItemId,
      rowData: {
        physical_qty: 2,
        condition: 'Good',
        label_no: 'VL-DRAFT-PRESERVED',
        remarks: 'Saved individually from row action'
      },
      headerData: {
        date: '2028-01-15',
        year: 2028,
        verifier_1: 'Kamal Perera'
      }
    });

    assert.ok(draftRes.draft);
    const draftId = draftRes.draft.id;

    // Confirm verification
    const confirmed = await db.confirmVerification(draftId, '00000000-0000-0000-0000-000000000001');
    assert.equal(confirmed.status, 'confirmed');

    // Query history items for year 2028
    const history2028 = await db.getVerificationHistoryItems([draftUnitId], 2028);
    assert.ok(history2028.length >= 1);
    const savedRow = history2028.find(r => r.label_no === 'VL-DRAFT-PRESERVED');
    assert.ok(savedRow, 'Row saved via per-row draft save must retain its label_no');
    assert.equal(savedRow.remarks, 'Saved individually from row action');
    assert.equal(savedRow.physical_available, 2);
  });
});
