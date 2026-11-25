import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageCategoryTypes } from '../src/utils/permissions.js';
import {
  getSubTypeOptions,
  registerCustomItemTypes,
  syncCustomItemTypes,
  unregisterCustomItemType
} from '../src/constants/categorySubtypes.js';
import {
  generateItemTypeCodeCandidate,
  deriveItemTypeCode,
  registerCustomItemTypeCode,
  generateSerialNumber
} from '../src/utils/serialNumberGenerator.js';

test('Custom Subcategory Item Types Client Form & Permissions Test Suite', async (t) => {
  await t.test('1. Role permission: Only super_admin and local_admin can manage item types', () => {
    assert.equal(canManageCategoryTypes({ role: 'super_admin' }), true);
    assert.equal(canManageCategoryTypes({ role: 'local_admin' }), true);
    assert.equal(canManageCategoryTypes({ role: 'unit_head' }), false);

    assert.equal(canManageCategoryTypes({ role: 'employee', permission: 'read_write' }), false);
    assert.equal(canManageCategoryTypes({ role: 'employee', permission: 'read_only' }), false);
    assert.equal(canManageCategoryTypes({ role: 'employee', permission: 'no_permission' }), false);
    assert.equal(canManageCategoryTypes(null), false);
    assert.equal(canManageCategoryTypes({}), false);
  });

  await t.test('2. Dropdown options ordering: Built-in options first, custom types in alphabetical order', () => {
    // Sync custom types for chairs: "Visitor Bench" and "Armchair"
    syncCustomItemTypes('chairs', [
      { name: 'Visitor Bench', code: 'V-BENCH' },
      { name: 'Armchair', code: 'ARMCHR' }
    ]);

    const options = getSubTypeOptions('chairs');
    assert.ok(options.length > 2);

    // First options should be built-in types in original order
    assert.equal(options[0], 'Clerical Chair');
    assert.equal(options[1], 'Visitor Chair');

    // Custom types must appear at the end, alphabetically sorted ("Armchair" before "Visitor Bench")
    const lastTwo = options.slice(-2);
    assert.equal(lastTwo[0], 'Armchair');
    assert.equal(lastTwo[1], 'Visitor Bench');

    // Clean up
    unregisterCustomItemType('chairs', 'Visitor Bench');
    unregisterCustomItemType('chairs', 'Armchair');
  });

  await t.test('3. Duplicate prevention: Case-insensitive match against built-in and custom types', () => {
    syncCustomItemTypes('chairs', [{ name: 'Bench', code: 'BENCH' }]);

    const options = getSubTypeOptions('chairs');
    const isDuplicateBuiltin = options.some(o => o.toLowerCase() === 'clerical chair'.toLowerCase());
    const isDuplicateCustom = options.some(o => o.toLowerCase() === 'bench'.toLowerCase());
    const isNewType = !options.some(o => o.toLowerCase() === 'ergonomic stool'.toLowerCase());

    assert.equal(isDuplicateBuiltin, true);
    assert.equal(isDuplicateCustom, true);
    assert.equal(isNewType, true);

    unregisterCustomItemType('chairs', 'Bench');
  });

  await t.test('4. Code generation & Custom item type code registration', () => {
    const candidate = generateItemTypeCodeCandidate('Bench');
    assert.equal(candidate, 'BENCH');

    const multiWordCandidate = generateItemTypeCodeCandidate('Executive Ergonomic Mesh Chair');
    assert.ok(multiWordCandidate.length >= 2);

    // Register custom item type code
    registerCustomItemTypeCode('chairs', 'Custom Bench', 'BENCH');
    const derived = deriveItemTypeCode('Custom Bench', 'CHR');
    assert.equal(derived, 'BENCH-CHR');
  });

  await t.test('5. Serial number format using custom item type', () => {
    registerCustomItemTypeCode('chairs', 'Bench', 'BENCH');
    const serial = generateSerialNumber({
      unit: 'EDL-HQ',
      category: 'Furniture',
      subCategory: 'chairs',
      itemType: 'Bench',
      existingItems: []
    });

    assert.ok(serial.includes('/FUR/CHR/BENCH-CHR-001'), `Serial should contain /FUR/CHR/BENCH-CHR-001, got: ${serial}`);
  });
});

