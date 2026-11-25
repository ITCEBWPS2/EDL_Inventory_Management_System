import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTestToolsAllowed,
  isRowEmpty,
  hasTestGeneratedData,
  countTestGeneratedRows,
  generateVerificationTestData,
  clearTestGeneratedData,
  CONDITION_OPTIONS_LIST
} from '../src/utils/verificationTestHelper.js';

test('Verification Testing Helper Test Suite', async (t) => {
  await t.test('1. Production & Role Guard (isTestToolsAllowed)', () => {
    const superAdmin = { role: 'super_admin' };
    const localAdmin = { role: 'local_admin' };
    const unitHead = { role: 'unit_head' };
    const employee = { role: 'employee' };

    const devEnv = { DEV: true, MODE: 'development' };
    const prodEnv = { DEV: false, MODE: 'production', PROD: true, VITE_ENABLE_TEST_TOOLS: 'false' };
    const prodExplicitEnv = { DEV: false, MODE: 'production', PROD: true, VITE_ENABLE_TEST_TOOLS: 'true' };

    // Allowed in Dev for Super Admin & Local Admin
    assert.equal(isTestToolsAllowed(superAdmin, devEnv), true);
    assert.equal(isTestToolsAllowed(localAdmin, devEnv), true);

    // Forbidden for other roles even in Dev
    assert.equal(isTestToolsAllowed(unitHead, devEnv), false);
    assert.equal(isTestToolsAllowed(employee, devEnv), false);
    assert.equal(isTestToolsAllowed(null, devEnv), false);

    // Strictly forbidden in Production by default
    assert.equal(isTestToolsAllowed(superAdmin, prodEnv), false);
    assert.equal(isTestToolsAllowed(localAdmin, prodEnv), false);
    assert.equal(isTestToolsAllowed(unitHead, prodEnv), false);
    assert.equal(isTestToolsAllowed(employee, prodEnv), false);

    // Allowed in Production ONLY if explicit flag is set
    assert.equal(isTestToolsAllowed(superAdmin, prodExplicitEnv), true);
    assert.equal(isTestToolsAllowed(localAdmin, prodExplicitEnv), true);
    assert.equal(isTestToolsAllowed(unitHead, prodExplicitEnv), false);
  });

  await t.test('2. isRowEmpty accurately detects empty and filled rows', () => {
    assert.equal(isRowEmpty({ physical_qty: '' }), true);
    assert.equal(isRowEmpty({ physical_qty: null }), true);
    assert.equal(isRowEmpty({ physical_qty: undefined }), true);
    assert.equal(isRowEmpty({ physical_qty: 0 }), false);
    assert.equal(isRowEmpty({ physical_qty: 5 }), false);
    assert.equal(isRowEmpty({ physical_qty: '3' }), false);
  });

  await t.test('3. generateVerificationTestData generates valid sequential TEST labels and never negative qty', () => {
    const items = [
      { id: '1', item_name: 'Chair Ergonomic', system_qty: 10, physical_qty: '' },
      { id: '2', item_name: 'Desk Office', system_qty: 5, physical_qty: '' },
      { id: '3', item_name: 'Cabinet Metal', system_qty: 1, physical_qty: '' },
      { id: '4', item_name: 'Monitor Dell', system_qty: 0, physical_qty: '' }
    ];

    const targetIndices = [0, 1, 2, 3];
    const { updatedItems, modifiedIndices, labelCounter } = generateVerificationTestData({
      items,
      targetIndices,
      pattern: 'realistic',
      onlyEmpty: true,
      percentage: 100
    });

    assert.equal(modifiedIndices.size, 4);
    assert.equal(labelCounter, 5);

    const labels = updatedItems.map(it => it.label_no);
    assert.deepEqual(labels, ['TEST-0001', 'TEST-0002', 'TEST-0003', 'TEST-0004']);

    for (const item of updatedItems) {
      assert.ok(item.physical_qty >= 0, `Physical qty must be >= 0, got ${item.physical_qty}`);
      assert.equal(item.difference, item.physical_qty - item.system_qty);
      assert.ok(CONDITION_OPTIONS_LIST.includes(item.condition), `Condition ${item.condition} must be valid`);
      assert.ok(item.__isTestGenerated, 'Should mark row as test generated');

      if (item.issued_destroyed === 'Issued' || item.issued_destroyed === 'Destroyed') {
        const q = Number(item.issued_destroyed_qty);
        assert.ok(q >= 1, `Issued/Destroyed qty must be >= 1, got ${q}`);
        assert.ok(q <= item.system_qty, `Issued/Destroyed qty must be <= system_qty, got ${q}`);
        assert.ok(q <= item.physical_qty, `Issued/Destroyed qty must be <= physical_qty, got ${q}`);
      }
    }
  });

  await t.test('4. "all_matched" pattern generates 100% matched system quantities with Good condition', () => {
    const items = [
      { id: '1', system_qty: 15, physical_qty: '' },
      { id: '2', system_qty: 3, physical_qty: '' },
      { id: '3', system_qty: 1, physical_qty: '' }
    ];

    const { updatedItems } = generateVerificationTestData({
      items,
      targetIndices: [0, 1, 2],
      pattern: 'all_matched',
      onlyEmpty: true
    });

    for (const item of updatedItems) {
      assert.equal(item.physical_qty, item.system_qty);
      assert.equal(item.difference, 0);
      assert.equal(item.status, 'Matched');
      assert.equal(item.condition, 'Good');
      assert.equal(item.issued_destroyed, '—');
    }
  });

  await t.test('5. Respects "onlyEmpty" flag and preserves pre-filled manual entries', () => {
    const items = [
      { id: '1', system_qty: 10, physical_qty: 8, condition: 'Fair', label_no: 'MANUAL-99' }, // pre-filled
      { id: '2', system_qty: 5, physical_qty: '', condition: '—', label_no: '' }              // empty
    ];

    const { updatedItems, modifiedIndices } = generateVerificationTestData({
      items,
      targetIndices: [0, 1],
      pattern: 'realistic',
      onlyEmpty: true
    });

    // Row 0 was pre-filled, so it must NOT be touched
    assert.equal(modifiedIndices.has(0), false);
    assert.equal(updatedItems[0].physical_qty, 8);
    assert.equal(updatedItems[0].condition, 'Fair');
    assert.equal(updatedItems[0].label_no, 'MANUAL-99');

    // Row 1 was empty, so it must be filled
    assert.equal(modifiedIndices.has(1), true);
    assert.equal(updatedItems[1].label_no, 'TEST-0001');
    assert.notEqual(updatedItems[1].physical_qty, '');
  });

  await t.test('6. Respects percentage option (e.g. 50%)', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      system_qty: 5,
      physical_qty: ''
    }));

    const { modifiedIndices } = generateVerificationTestData({
      items,
      targetIndices: items.map((_, i) => i),
      percentage: 50
    });

    assert.equal(modifiedIndices.size, 5);
  });

  await t.test('7. hasTestGeneratedData and countTestGeneratedRows detect test data', () => {
    const items = [
      { label_no: 'VL-0001' },
      { label_no: 'TEST-0001' },
      { label_no: 'TEST-0002' },
      { label_no: 'VL-0002' }
    ];

    assert.equal(hasTestGeneratedData(items), true);
    assert.equal(countTestGeneratedRows(items), 2);

    const normalItems = [
      { label_no: 'VL-0001' },
      { label_no: 'VL-0002' }
    ];
    assert.equal(hasTestGeneratedData(normalItems), false);
    assert.equal(countTestGeneratedRows(normalItems), 0);
  });

  await t.test('8. clearTestGeneratedData restores pristine backup rows and keeps manual edits', () => {
    const backupItems = [
      { id: '1', system_qty: 10, physical_qty: '', condition: '—', label_no: '' },
      { id: '2', system_qty: 5, physical_qty: 4, condition: 'Good', label_no: 'USER-1' } // user manual edit
    ];

    // Simulate test data generated on row 0
    const currentItems = [
      { id: '1', system_qty: 10, physical_qty: 10, condition: 'Good', label_no: 'TEST-0001', __isTestGenerated: true },
      { id: '2', system_qty: 5, physical_qty: 4, condition: 'Good', label_no: 'USER-1' }
    ];

    const modifiedIndices = new Set([0]);
    const restored = clearTestGeneratedData(currentItems, backupItems, modifiedIndices);

    // Row 0 is restored to empty
    assert.equal(restored[0].physical_qty, '');
    assert.equal(restored[0].label_no, '');
    assert.equal(restored[0].__isTestGenerated, undefined);

    // Row 1 keeps user manual edit
    assert.equal(restored[1].physical_qty, 4);
    assert.equal(restored[1].label_no, 'USER-1');
  });

  await t.test('9. clearTestGeneratedData clears test items when backup is null (page reload / draft restore)', () => {
    const draftLoadedItems = [
      { id: '1', system_qty: 10, physical_qty: 10, condition: 'Good', label_no: 'TEST-0001' },
      { id: '2', system_qty: 5, physical_qty: 5, condition: 'Good', label_no: 'TEST-0002' },
      { id: '3', system_qty: 2, physical_qty: 2, condition: 'Fair', label_no: 'MANUAL-REAL' }
    ];

    const restored = clearTestGeneratedData(draftLoadedItems, null, new Set());

    assert.equal(restored[0].physical_qty, '');
    assert.equal(restored[0].label_no, '');
    assert.equal(restored[0].status, 'Not Counted');

    assert.equal(restored[1].physical_qty, '');
    assert.equal(restored[1].label_no, '');
    assert.equal(restored[1].status, 'Not Counted');

    // Manual item is untouched
    assert.equal(restored[2].physical_qty, 2);
    assert.equal(restored[2].label_no, 'MANUAL-REAL');
  });

  await t.test('10. clearTestGeneratedData clears test items even if backup itself was polluted', () => {
    // If backup itself held TEST- items (e.g. from repeated fill)
    const pollutedBackup = [
      { id: '1', system_qty: 10, physical_qty: 10, label_no: 'TEST-0001' }
    ];
    const current = [
      { id: '1', system_qty: 10, physical_qty: 10, label_no: 'TEST-0001', __isTestGenerated: true }
    ];

    const restored = clearTestGeneratedData(current, pollutedBackup, new Set([0]));
    assert.equal(restored[0].physical_qty, '');
    assert.equal(restored[0].label_no, '');
    assert.equal(restored[0].status, 'Not Counted');
  });
});

