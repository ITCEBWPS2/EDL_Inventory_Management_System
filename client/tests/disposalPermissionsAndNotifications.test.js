import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canCreateDisposalRequest,
  canEditDraft,
  canDeleteDraft,
  canSubmitRequest,
  canHandleDisposalSteps,
  canViewDisposalDetails,
  canViewDisposalOverview,
  canPrintDisposal,
  isDisposalRecipientRole,
  getUnitParentChain,
  getDisposalUnitScope,
  DISPOSAL_OVERVIEW_PUBLIC_TO_ALL_USERS
} from '../src/utils/disposalPermissions.js';

test('Disposal Client Permissions & Notifications Matrix Test Suite', async (t) => {
  const superAdmin = { id: 'sa-1', role: 'super_admin' };
  const localAdmin = {
    id: 'la-1',
    role: 'local_admin',
    units: [{ id: 'unit-1' }, { id: 'unit-2' }],
    unitIds: ['unit-1', 'unit-2']
  };
  const unitHeadUnit1 = {
    id: 'uh-1',
    role: 'unit_head',
    unit_id: 'unit-1',
    units: [{ id: 'unit-1' }]
  };
  const employeeRwUnit1 = {
    id: 'emp-rw-1',
    role: 'employee',
    permission_level: 'read_write',
    unit_id: 'unit-1',
    units: [{ id: 'unit-1' }]
  };
  const employeeRoUnit1 = {
    id: 'emp-ro-1',
    role: 'employee',
    permission_level: 'read_only',
    unit_id: 'unit-1',
    units: [{ id: 'unit-1' }]
  };
  const employeeNone = {
    id: 'emp-none-1',
    role: 'employee',
    permission_level: 'no_permission',
    unit_id: 'unit-1',
    units: [{ id: 'unit-1' }]
  };
  const disposalOnlyUnassigned = {
    id: 'disp-all',
    role: 'employee',
    permission_level: 'disposal_only',
    unit_id: null,
    units: []
  };
  const disposalOnlyScoped = {
    id: 'disp-scoped',
    role: 'employee',
    permission_level: 'disposal_only',
    unit_id: 'unit-1',
    units: [{ id: 'unit-1' }],
    unitIds: ['unit-1']
  };

  const reqUnit1 = {
    id: 'req-1',
    unit_id: 'unit-1',
    status: 'draft'
  };
  const reqUnit2 = {
    id: 'req-2',
    unit_id: 'unit-2',
    status: 'submitted'
  };
  const reqUnit3 = {
    id: 'req-3',
    unit_id: 'unit-3',
    status: 'submitted'
  };

  await t.test('1. Step 1 (Create, Edit Draft, Delete Draft, Submit Draft)', () => {
    // Only Unit Head and read_write employee for their own unit
    assert.equal(canCreateDisposalRequest(unitHeadUnit1, 'unit-1'), true);
    assert.equal(canCreateDisposalRequest(unitHeadUnit1, 'unit-2'), false);

    assert.equal(canCreateDisposalRequest(employeeRwUnit1, 'unit-1'), true);
    assert.equal(canCreateDisposalRequest(employeeRwUnit1, 'unit-2'), false);

    // Super Admin and Local Admin CANNOT create requests
    assert.equal(canCreateDisposalRequest(superAdmin, 'unit-1'), false);
    assert.equal(canCreateDisposalRequest(localAdmin, 'unit-1'), false);

    // read_only, no_permission, disposal_only CANNOT create requests
    assert.equal(canCreateDisposalRequest(employeeRoUnit1, 'unit-1'), false);
    assert.equal(canCreateDisposalRequest(employeeNone, 'unit-1'), false);
    assert.equal(canCreateDisposalRequest(disposalOnlyUnassigned, 'unit-1'), false);
    assert.equal(canCreateDisposalRequest(disposalOnlyScoped, 'unit-1'), false);

    // canEditDraft, canDeleteDraft, canSubmitRequest
    assert.equal(canEditDraft(unitHeadUnit1, reqUnit1), true);
    assert.equal(canDeleteDraft(unitHeadUnit1, reqUnit1), true);
    assert.equal(canSubmitRequest(unitHeadUnit1, reqUnit1), true);

    assert.equal(canEditDraft(superAdmin, reqUnit1), false);
    assert.equal(canDeleteDraft(superAdmin, reqUnit1), false);
    assert.equal(canSubmitRequest(superAdmin, reqUnit1), false);
  });

  await t.test('2. Steps 2 to 5 (Board Appointment, Committee, Disposal, Revert)', () => {
    // Super Admin: always allowed for all units
    assert.equal(canHandleDisposalSteps(superAdmin, reqUnit1), true);
    assert.equal(canHandleDisposalSteps(superAdmin, reqUnit3), true);

    // Local Admin: allowed within their allowed units
    assert.equal(canHandleDisposalSteps(localAdmin, reqUnit1), true); // unit-1 in scope
    assert.equal(canHandleDisposalSteps(localAdmin, reqUnit2), true); // unit-2 in scope
    assert.equal(canHandleDisposalSteps(localAdmin, reqUnit3), false); // unit-3 outside scope

    // Disposal-only employee: unassigned = all units; scoped = assigned units
    assert.equal(canHandleDisposalSteps(disposalOnlyUnassigned, reqUnit1), true);
    assert.equal(canHandleDisposalSteps(disposalOnlyUnassigned, reqUnit3), true);
    assert.equal(canHandleDisposalSteps(disposalOnlyScoped, reqUnit1), true);
    assert.equal(canHandleDisposalSteps(disposalOnlyScoped, reqUnit3), false);

    // Unit Head and read_write employee CANNOT perform steps 2 to 5
    assert.equal(canHandleDisposalSteps(unitHeadUnit1, reqUnit1), false);
    assert.equal(canHandleDisposalSteps(employeeRwUnit1, reqUnit1), false);
  });

  await t.test('3. View Details and Print Permissions', () => {
    // Handlers can view details in their scope
    assert.equal(canViewDisposalDetails(superAdmin, reqUnit1), true);
    assert.equal(canViewDisposalDetails(localAdmin, reqUnit1), true);
    assert.equal(canViewDisposalDetails(localAdmin, reqUnit3), false);
    assert.equal(canViewDisposalDetails(disposalOnlyUnassigned, reqUnit3), true);

    // Unit Head and read_write employee can view details for their unit
    assert.equal(canViewDisposalDetails(unitHeadUnit1, reqUnit1), true);
    assert.equal(canViewDisposalDetails(unitHeadUnit1, reqUnit2), false);
    assert.equal(canViewDisposalDetails(employeeRwUnit1, reqUnit1), true);
    assert.equal(canViewDisposalDetails(employeeRwUnit1, reqUnit2), false);

    // Read only and no permission employees cannot view details
    assert.equal(canViewDisposalDetails(employeeRoUnit1, reqUnit1), false);
    assert.equal(canViewDisposalDetails(employeeNone, reqUnit1), false);

    // Printing follows canViewDisposalDetails
    assert.equal(canPrintDisposal(unitHeadUnit1, reqUnit1), true);
    assert.equal(canPrintDisposal(unitHeadUnit1, reqUnit2), false);
    assert.equal(canPrintDisposal(superAdmin, reqUnit1), true);
  });

  await t.test('4. Overview Visibility to All Users', () => {
    assert.equal(DISPOSAL_OVERVIEW_PUBLIC_TO_ALL_USERS, true);
    assert.equal(canViewDisposalOverview(employeeNone), true);
    assert.equal(canViewDisposalOverview(employeeRoUnit1), true);
    assert.equal(canViewDisposalOverview(unitHeadUnit1), true);
  });

  await t.test('5. Recipient Roles for Notifications / Bell', () => {
    assert.equal(isDisposalRecipientRole(superAdmin), true);
    assert.equal(isDisposalRecipientRole(localAdmin), true);
    assert.equal(isDisposalRecipientRole(disposalOnlyUnassigned), true);
    assert.equal(isDisposalRecipientRole(disposalOnlyScoped), true);

    assert.equal(isDisposalRecipientRole(unitHeadUnit1), false);
    assert.equal(isDisposalRecipientRole(employeeRwUnit1), false);
    assert.equal(isDisposalRecipientRole(employeeRoUnit1), false);
    assert.equal(isDisposalRecipientRole(employeeNone), false);
  });

  await t.test('6. Unit Scope & Parent Hierarchy Chain', () => {
    // Scope resolution
    assert.equal(getDisposalUnitScope(superAdmin), null); // all
    assert.deepEqual(getDisposalUnitScope(localAdmin), ['unit-1', 'unit-2']);
    assert.equal(getDisposalUnitScope(disposalOnlyUnassigned), null); // all
    assert.deepEqual(getDisposalUnitScope(disposalOnlyScoped), ['unit-1']);
    assert.deepEqual(getDisposalUnitScope(unitHeadUnit1), ['unit-1']);

    // Parent hierarchy chain computation
    const unitsList = [
      { id: 'prov-1', unit_name: 'Western Province South II', parent_unit_id: null },
      { id: 'area-1', unit_name: 'Colombo Area', parent_unit_id: 'prov-1' },
      { id: 'csc-1', unit_name: 'ITO Office', parent_unit_id: 'area-1' }
    ];

    const chain = getUnitParentChain('csc-1', unitsList);
    assert.equal(chain, 'Western Province South II > Colombo Area');
  });
});

