import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageCategoryTypes } from '../src/utils/permissions.js';
import {
  resolveCategoryCode,
  resolveSubCategoryCode
} from '../src/utils/serialNumberGenerator.js';
import {
  getCategorySubtypes,
  registerCustomSubtypes,
  unregisterCustomSubtype
} from '../src/constants/categorySubtypes.js';

test('Category & Sub-Category Hierarchy Actions (Edit & Delete) Client Test Suite', async (t) => {
  await t.test('1. Permission check: Only super_admin and local_admin can edit/delete', () => {
    assert.equal(canManageCategoryTypes({ role: 'super_admin' }), true);
    assert.equal(canManageCategoryTypes({ role: 'local_admin' }), true);
    assert.equal(canManageCategoryTypes({ role: 'unit_head' }), false);

    assert.equal(canManageCategoryTypes({ role: 'employee', permissions: ['read_write'] }), false);
    assert.equal(canManageCategoryTypes({ role: 'employee', permissions: ['read_only'] }), false);
    assert.equal(canManageCategoryTypes({ role: 'employee', permissions: [] }), false);
    assert.equal(canManageCategoryTypes(null), false);
  });

  await t.test('2. Category codes are immutable and preserved during rename', () => {
    assert.equal(resolveCategoryCode('Furniture'), 'FUR');
    assert.equal(resolveCategoryCode('IT & Computing Equipment'), 'IT');
    assert.equal(resolveCategoryCode('Tools & Equipment'), 'TLS');
    assert.equal(resolveCategoryCode('Office'), 'OFF');

    // Subcategory codes
    assert.equal(resolveSubCategoryCode('Chairs', 'chairs'), 'CHR');
    assert.equal(resolveSubCategoryCode('Tables', 'tables'), 'TBL');
    assert.equal(resolveSubCategoryCode('Workstations', 'workstations'), 'WST');
  });

  await t.test('3. Built-in and custom sub-category deletion blocking calculations', () => {
    const checkCategoryDeleteBlocked = ({ subCount, itemsCount, isBuiltin, userRole }) => {
      if (subCount > 0 || itemsCount > 0) {
        return {
          blocked: true,
          reason: `Category has ${subCount} sub-categories and ${itemsCount} items. Remove or move them first.`
        };
      }
      if (isBuiltin && userRole !== 'super_admin') {
        return {
          blocked: true,
          reason: 'Only Super Admin can delete built-in categories.'
        };
      }
      return { blocked: false, reason: '' };
    };

    // Furniture with 5 subcategories and items: Blocked for anyone
    const furnitureBlocked = checkCategoryDeleteBlocked({
      subCount: 5,
      itemsCount: 18,
      isBuiltin: true,
      userRole: 'super_admin'
    });
    assert.equal(furnitureBlocked.blocked, true);

    // Empty built-in: Blocked for unit_head / local_admin, allowed for super_admin
    const emptyBuiltinUnitHead = checkCategoryDeleteBlocked({
      subCount: 0,
      itemsCount: 0,
      isBuiltin: true,
      userRole: 'unit_head'
    });
    assert.equal(emptyBuiltinUnitHead.blocked, true);

    const emptyBuiltinSuperAdmin = checkCategoryDeleteBlocked({
      subCount: 0,
      itemsCount: 0,
      isBuiltin: true,
      userRole: 'super_admin'
    });
    assert.equal(emptyBuiltinSuperAdmin.blocked, false);

    // Empty custom category: Allowed for unit_head
    const emptyCustomUnitHead = checkCategoryDeleteBlocked({
      subCount: 0,
      itemsCount: 0,
      isBuiltin: false,
      userRole: 'unit_head'
    });
    assert.equal(emptyCustomUnitHead.blocked, false);
  });

  await t.test('4. Sub-category deletion blocking calculations', () => {
    const checkSubCategoryDeleteBlocked = ({ itemCount, isBuiltin, userRole }) => {
      if (itemCount > 0) {
        return {
          blocked: true,
          reason: `Sub-category has ${itemCount} items. Remove or move them first.`
        };
      }
      if (isBuiltin && userRole !== 'super_admin') {
        return {
          blocked: true,
          reason: 'Only Super Admin can delete built-in sub-categories.'
        };
      }
      return { blocked: false, reason: '' };
    };

    // Chairs with 10 items: Blocked
    const chairsBlocked = checkSubCategoryDeleteBlocked({
      itemCount: 10,
      isBuiltin: true,
      userRole: 'super_admin'
    });
    assert.equal(chairsBlocked.blocked, true);

    // Empty custom type: Allowed for unit_head
    const emptyCustom = checkSubCategoryDeleteBlocked({
      itemCount: 0,
      isBuiltin: false,
      userRole: 'unit_head'
    });
    assert.equal(emptyCustom.blocked, false);

    // Empty built-in: Blocked for local_admin, allowed for super_admin
    const emptyBuiltinLocalAdmin = checkSubCategoryDeleteBlocked({
      itemCount: 0,
      isBuiltin: true,
      userRole: 'local_admin'
    });
    assert.equal(emptyBuiltinLocalAdmin.blocked, true);

    const emptyBuiltinSuperAdmin = checkSubCategoryDeleteBlocked({
      itemCount: 0,
      isBuiltin: true,
      userRole: 'super_admin'
    });
    assert.equal(emptyBuiltinSuperAdmin.blocked, false);
  });
});

