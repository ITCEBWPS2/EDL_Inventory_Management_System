import test from 'node:test';
import assert from 'node:assert/strict';
import { can, DEFAULT_EMPLOYEE_PERMISSIONS, DEFAULT_READONLY_PERMISSIONS, DEFAULT_NOPERM_PERMISSIONS } from '../src/utils/permissions.js';

test('Role Permissions Enforcement Test Suite', async (t) => {
  await t.test('1. Super Admin has all 6 permissions allowed', () => {
    const admin = { role: 'super_admin' };
    assert.equal(can('view_inventory', admin), true);
    assert.equal(can('add_inventory', admin), true);
    assert.equal(can('update_inventory', admin), true);
    assert.equal(can('delete_inventory', admin), true);
    assert.equal(can('view_reports', admin), true);
    assert.equal(can('manage_permissions', admin), true);
  });

  await t.test('2. Local Admin has all 6 permissions allowed', () => {
    const localAdmin = { role: 'local_admin' };
    assert.equal(can('view_inventory', localAdmin), true);
    assert.equal(can('add_inventory', localAdmin), true);
    assert.equal(can('update_inventory', localAdmin), true);
    assert.equal(can('delete_inventory', localAdmin), true);
    assert.equal(can('view_reports', localAdmin), true);
    assert.equal(can('manage_permissions', localAdmin), true);
  });

  await t.test('3. Unit Head can manage inventory and view reports, but cannot manage permissions', () => {
    const unitHead = { role: 'unit_head' };
    assert.equal(can('view_inventory', unitHead), true);
    assert.equal(can('add_inventory', unitHead), true);
    assert.equal(can('update_inventory', unitHead), true);
    assert.equal(can('delete_inventory', unitHead), true);
    assert.equal(can('view_reports', unitHead), true);
    assert.equal(can('manage_permissions', unitHead), false);
  });

  await t.test('4. Employee (Kavinda Silva, read_write) matrix: delete and manage_permissions are RESTRICTED', () => {
    const employeeRw = {
      username: 'employeerw',
      full_name: 'Kavinda Silva',
      role: 'employee',
      permission_level: 'read_write'
    };

    assert.equal(can('view_inventory', employeeRw), true, 'View inventory should be ALLOWED');
    assert.equal(can('add_inventory', employeeRw), true, 'Add inventory should be ALLOWED');
    assert.equal(can('update_inventory', employeeRw), true, 'Update inventory should be ALLOWED');
    assert.equal(can('delete_inventory', employeeRw), false, 'Delete inventory should be RESTRICTED');
    assert.equal(can('view_reports', employeeRw), true, 'View reports should be ALLOWED');
    assert.equal(can('manage_permissions', employeeRw), false, 'Manage permissions should be RESTRICTED');
  });

  await t.test('5. Employee (read_only) matrix: can view inventory & reports, cannot add/edit/delete/manage', () => {
    const employeeRo = {
      role: 'employee',
      permission_level: 'read_only'
    };

    assert.equal(can('view_inventory', employeeRo), true);
    assert.equal(can('add_inventory', employeeRo), false);
    assert.equal(can('update_inventory', employeeRo), false);
    assert.equal(can('delete_inventory', employeeRo), false);
    assert.equal(can('view_reports', employeeRo), true);
    assert.equal(can('manage_permissions', employeeRo), false);
  });

  await t.test('6. Employee (no_permission): all permissions are restricted', () => {
    const employeeNone = {
      role: 'employee',
      permission_level: 'no_permission'
    };

    assert.equal(can('view_inventory', employeeNone), false);
    assert.equal(can('add_inventory', employeeNone), false);
    assert.equal(can('update_inventory', employeeNone), false);
    assert.equal(can('delete_inventory', employeeNone), false);
    assert.equal(can('view_reports', employeeNone), false);
    assert.equal(can('manage_permissions', employeeNone), false);
  });

  await t.test('7. Explicit user.permissions object takes precedence when present', () => {
    const customUser = {
      role: 'employee',
      permissions: {
        view_inventory: true,
        add_inventory: false,
        update_inventory: false,
        delete_inventory: false,
        view_reports: false,
        manage_permissions: false
      }
    };

    assert.equal(can('view_inventory', customUser), true);
    assert.equal(can('add_inventory', customUser), false);
    assert.equal(can('update_inventory', customUser), false);
    assert.equal(can('delete_inventory', customUser), false);
    assert.equal(can('view_reports', customUser), false);
  });

  await t.test('8. Null or unknown user returns false', () => {
    assert.equal(can('view_inventory', null), false);
    assert.equal(can('view_inventory', undefined), false);
    assert.equal(can('view_inventory', {}), false);
  });
});

