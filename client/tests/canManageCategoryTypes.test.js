import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageCategoryTypes, canAddItemTypes, canManageCategories } from '../src/utils/permissions.js';

test('canManageCategoryTypes Permission Test Suite', async (t) => {
  await t.test('1. Allows super_admin role', () => {
    assert.equal(canManageCategoryTypes({ role: 'super_admin' }), true);
    assert.equal(canAddItemTypes({ role: 'super_admin' }), true);
    assert.equal(canManageCategories({ role: 'super_admin' }), true);
  });

  await t.test('2. Allows local_admin role', () => {
    assert.equal(canManageCategoryTypes({ role: 'local_admin' }), true);
    assert.equal(canAddItemTypes({ role: 'local_admin' }), true);
    assert.equal(canManageCategories({ role: 'local_admin' }), true);
  });

  await t.test('3. Forbids unit_head role', () => {
    assert.equal(canManageCategoryTypes({ role: 'unit_head' }), false);
    assert.equal(canAddItemTypes({ role: 'unit_head' }), false);
    assert.equal(canManageCategories({ role: 'unit_head' }), false);
  });

  await t.test('4. Forbids employee with read_write permission', () => {
    assert.equal(canManageCategoryTypes({ role: 'employee', permission_level: 'read_write' }), false);
    assert.equal(canAddItemTypes({ role: 'employee', permission_level: 'read_write' }), false);
    assert.equal(canManageCategories({ role: 'employee', permission_level: 'read_write' }), false);
  });

  await t.test('5. Forbids employee with read_only permission', () => {
    assert.equal(canManageCategoryTypes({ role: 'employee', permission_level: 'read_only' }), false);
    assert.equal(canAddItemTypes({ role: 'employee', permission_level: 'read_only' }), false);
    assert.equal(canManageCategories({ role: 'employee', permission_level: 'read_only' }), false);
  });

  await t.test('6. Forbids employee with no_permission', () => {
    assert.equal(canManageCategoryTypes({ role: 'employee', permission_level: 'no_permission' }), false);
    assert.equal(canAddItemTypes({ role: 'employee', permission_level: 'no_permission' }), false);
    assert.equal(canManageCategories({ role: 'employee', permission_level: 'no_permission' }), false);
  });

  await t.test('7. Forbids null, undefined, or empty user object', () => {
    assert.equal(canManageCategoryTypes(null), false);
    assert.equal(canManageCategoryTypes(undefined), false);
    assert.equal(canManageCategoryTypes({}), false);
  });
});

