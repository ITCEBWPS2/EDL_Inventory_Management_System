/**
 * Disposal Requests Permission Matrix & Capabilities
 * Single Source of Truth for Disposal Workflow Permissions on Client
 */

export const DISPOSAL_OVERVIEW_PUBLIC_TO_ALL_USERS = true;
export const NOTIFY_REQUESTER_ON_PROGRESS = false;

/**
 * Check if current user can create or submit a new disposal request.
 * - Allowed ONLY for Unit Head and Employee with 'read_write' permission
 * - ONLY for their own assigned unit
 * - Super Admin, Local Admin, read_only, no_permission, and disposal_only cannot create requests
 *
 * @param {Object} user - User profile object
 * @param {string} [unitId] - Optional target unit ID
 * @returns {boolean}
 */
export function canCreateDisposalRequest(user, unitId = null) {
  if (!user || !user.role) return false;

  // Block Super Admin, Local Admin, disposal_only, read_only, no_permission
  if (user.role === 'super_admin' || user.role === 'local_admin') return false;
  if (user.permission_level === 'disposal_only') return false;
  if (user.permission_level === 'read_only' || user.permission_level === 'no_permission') return false;

  const isEligibleRole =
    user.role === 'unit_head' ||
    (user.role === 'employee' && user.permission_level === 'read_write');

  if (!isEligibleRole) return false;

  if (unitId) {
    const userUnitIds = [
      user.unit_id,
      ...(Array.isArray(user.unitIds) ? user.unitIds : []),
      ...(Array.isArray(user.units) ? user.units.map(u => u.id) : [])
    ].filter(Boolean);

    return userUnitIds.includes(unitId);
  }

  const hasUnit = Boolean(
    user.unit_id ||
    (user.unitIds && user.unitIds.length > 0) ||
    (user.units && user.units.length > 0)
  );
  return hasUnit;
}

/**
 * Check if a user can edit an existing draft request.
 */
export function canEditDraft(user, request) {
  if (!request || request.status !== 'draft') return false;
  return canCreateDisposalRequest(user, request.unit_id);
}

/**
 * Check if a user can delete an existing draft request.
 */
export function canDeleteDraft(user, request) {
  if (!request || request.status !== 'draft') return false;
  return canCreateDisposalRequest(user, request.unit_id);
}

/**
 * Check if a user can submit an existing draft request.
 */
export function canSubmitRequest(user, request) {
  if (!request || request.status !== 'draft') return false;
  return canCreateDisposalRequest(user, request.unit_id);
}

/**
 * Check if current user can handle disposal workflow steps 2 to 5:
 * - Step 2: Record Board Appointment
 * - Step 3: Record Committee Decision
 * - Step 4: Record Destruction / Tender Sale
 * - Step 5: Completing Request
 * - Revert last step
 *
 * ONLY Super Admin, Local Admin (in scope), and Disposal-only employee (in scope).
 * Unit Heads and read_write employees CANNOT handle these steps.
 *
 * @param {Object} user - User profile object
 * @param {Object} request - Disposal request object (needs unit_id)
 * @returns {boolean}
 */
export function canHandleDisposalSteps(user, request) {
  if (!user || !user.role) return false;

  // Unit Heads and standard Employees cannot handle steps 2-5
  if (user.role === 'unit_head') return false;
  if (user.role === 'employee' && user.permission_level !== 'disposal_only') return false;

  const targetUnitId = typeof request === 'string' ? request : request?.unit_id;

  // Super Admin: system-wide
  if (user.role === 'super_admin') return true;

  const rawUnitIds = [
    user.unit_id,
    ...(Array.isArray(user.unitIds) ? user.unitIds : []),
    ...(Array.isArray(user.units) ? user.units.map(u => u.id) : [])
  ].filter(Boolean);

  const userUnitIds = Array.from(new Set(rawUnitIds));

  // Local Admin: scoped to allowed units
  if (user.role === 'local_admin') {
    if (!targetUnitId) return true;
    return userUnitIds.includes(targetUnitId);
  }

  // Disposal-only employee: all units if unassigned, or assigned units if assigned
  if (user.role === 'employee' && user.permission_level === 'disposal_only') {
    if (userUnitIds.length === 0) return true; // all units
    if (!targetUnitId) return true;
    return userUnitIds.includes(targetUnitId);
  }

  return false;
}

/**
 * Check if a user can view full request details (Items, Committee, Disposal, Timeline tabs, attachments).
 * Allowed for:
 * - Handling roles in scope (Super Admin, Local Admin in scope, disposal_only in scope)
 * - Requesting unit's Unit Head and read_write employees for their own unit's requests
 *
 * @param {Object} user - User profile object
 * @param {Object} request - Disposal request object
 * @returns {boolean}
 */
export function canViewDisposalDetails(user, request) {
  if (!user || !request) return false;

  if (canHandleDisposalSteps(user, request)) return true;

  if (
    user.role === 'unit_head' ||
    (user.role === 'employee' && user.permission_level === 'read_write')
  ) {
    const userUnitIds = [
      user.unit_id,
      ...(Array.isArray(user.unitIds) ? user.unitIds : []),
      ...(Array.isArray(user.units) ? user.units.map(u => u.id) : [])
    ].filter(Boolean);
    return userUnitIds.includes(request.unit_id);
  }

  return false;
}

/**
 * Check if user can view the basic Overview tab.
 */
export function canViewDisposalOverview(user) {
  if (!user) return false;
  if (DISPOSAL_OVERVIEW_PUBLIC_TO_ALL_USERS) return true;
  return Boolean(user.role);
}

/**
 * Check if user can print reports.
 */
export function canPrintDisposal(user, request) {
  return canViewDisposalDetails(user, request);
}

/**
 * Check if user is a disposal recipient role eligible for bell/notifications
 */
export function isDisposalRecipientRole(user) {
  if (!user) return false;
  return (
    user.role === 'super_admin' ||
    user.role === 'local_admin' ||
    (user.role === 'employee' && user.permission_level === 'disposal_only')
  );
}

/**
 * Helper to compute parent hierarchy chain for a unit (e.g., "Western Province South II > Colombo Area")
 */
export function getUnitParentChain(unitId, unitsList = []) {
  if (!unitId || !Array.isArray(unitsList) || unitsList.length === 0) return '';
  const unitMap = new Map(unitsList.map(u => [u.id, u]));
  const chain = [];
  let current = unitMap.get(unitId);
  const visited = new Set();
  while (current && current.parent_unit_id) {
    if (visited.has(current.parent_unit_id)) break;
    visited.add(current.parent_unit_id);
    const parent = unitMap.get(current.parent_unit_id);
    if (!parent) break;
    chain.push(parent.unit_name || parent.unit_code);
    current = parent;
  }
  return chain.reverse().join(' > ');
}

/**
 * Resolves the unit scope filter for disposal requests list.
 * - super_admin: null (all units)
 * - local_admin: allowed units
 * - disposal_only: unassigned = null (all units); assigned = assigned units
 * - unit_head / employee: own assigned units
 *
 * @param {Object} user
 * @returns {Array<string>|null} Array of allowed unitIds, or null for all units
 */
export function getDisposalUnitScope(user) {
  if (!user || !user.role) return [];

  if (user.role === 'super_admin') {
    return null;
  }

  const rawUnitIds = [
    user.unit_id,
    ...(Array.isArray(user.unitIds) ? user.unitIds : []),
    ...(Array.isArray(user.units) ? user.units.map(u => u.id) : [])
  ].filter(Boolean);

  const userUnitIds = Array.from(new Set(rawUnitIds));

  if (user.role === 'local_admin') {
    return userUnitIds;
  }

  if (user.role === 'employee' && user.permission_level === 'disposal_only') {
    return userUnitIds.length > 0 ? userUnitIds : null;
  }

  return userUnitIds;
}


