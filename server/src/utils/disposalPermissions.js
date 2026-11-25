/**
 * Disposal Requests Permission Matrix & Capabilities
 * Single Source of Truth for Disposal Workflow Permissions on Server
 */

const DISPOSAL_OVERVIEW_PUBLIC_TO_ALL_USERS = true;
const NOTIFY_REQUESTER_ON_PROGRESS = false;

/**
 * Check if a user can create or submit a new disposal request.
 * - Allowed ONLY for Unit Head and Employee with 'read_write' permission
 * - ONLY for their own assigned unit (request cannot be created for other units)
 * - Super Admin, Local Admin, read_only, no_permission, and disposal_only cannot create requests
 *
 * @param {Object} user - User profile object
 * @param {string} [unitId] - Optional target unit ID
 * @returns {boolean}
 */
function canCreateDisposalRequest(user, unitId = null) {
  if (!user || !user.role) return false;

  // Block Super Admin, Local Admin, disposal_only, read_only, no_permission
  if (user.role === 'super_admin' || user.role === 'local_admin') return false;
  if (user.permission_level === 'disposal_only') return false;
  if (user.permission_level === 'read_only' || user.permission_level === 'no_permission') return false;

  const isEligibleRole =
    user.role === 'unit_head' ||
    (user.role === 'employee' && user.permission_level === 'read_write');

  if (!isEligibleRole) return false;

  // If unitId is provided, verify it matches user's assigned unit
  if (unitId) {
    const userUnitIds = [
      user.unit_id,
      ...(Array.isArray(user.unitIds) ? user.unitIds : [])
    ].filter(Boolean);

    return userUnitIds.includes(unitId);
  }

  // If no unitId provided, user must have at least one assigned unit
  const hasUnit = Boolean(user.unit_id || (user.unitIds && user.unitIds.length > 0));
  return hasUnit;
}

/**
 * Check if a user can edit an existing draft request.
 * Allowed only for Unit Head or read_write Employee of the request's unit.
 */
function canEditDraft(user, request) {
  if (!request || request.status !== 'draft') return false;
  return canCreateDisposalRequest(user, request.unit_id);
}

/**
 * Check if a user can delete an existing draft request.
 * Allowed only for Unit Head or read_write Employee of the request's unit.
 */
function canDeleteDraft(user, request) {
  if (!request || request.status !== 'draft') return false;
  return canCreateDisposalRequest(user, request.unit_id);
}

/**
 * Check if a user can submit an existing draft request.
 * Allowed only for Unit Head or read_write Employee of the request's unit.
 */
function canSubmitRequest(user, request) {
  if (!request || request.status !== 'draft') return false;
  return canCreateDisposalRequest(user, request.unit_id);
}

/**
 * Check if a user can handle disposal workflow steps 2 to 5:
 * - Step 2: Record Board Appointment
 * - Step 3: Record Committee Decision
 * - Step 4: Record Destruction / Tender Sale (Disposal)
 * - Step 5: Completing Request
 * - Revert last step
 *
 * ONLY Super Admin, Local Admin (within allowed units),
 * and Disposal-only employee (all units or assigned units).
 * Unit Heads and read_write employees CANNOT handle these steps.
 *
 * @param {Object} user - User profile object
 * @param {Object} request - Disposal request object (needs unit_id)
 * @returns {boolean}
 */
function canHandleDisposalSteps(user, request) {
  if (!user || !user.role) return false;

  // Unit Heads and standard Employees cannot handle steps 2-5
  if (user.role === 'unit_head') return false;
  if (user.role === 'employee' && user.permission_level !== 'disposal_only') return false;

  const targetUnitId = typeof request === 'string' ? request : request?.unit_id;

  // Super Admin has system-wide handling rights
  if (user.role === 'super_admin') return true;

  // Local Admin: scoped to allowed units
  if (user.role === 'local_admin') {
    if (!targetUnitId) return true;
    const allowedUnits = [
      user.unit_id,
      ...(Array.isArray(user.unitIds) ? user.unitIds : [])
    ].filter(Boolean);
    return allowedUnits.includes(targetUnitId);
  }

  // Disposal-only employee: all units if unassigned, or assigned units if assigned
  if (user.role === 'employee' && user.permission_level === 'disposal_only') {
    const assignedUnits = [
      user.unit_id,
      ...(Array.isArray(user.unitIds) ? user.unitIds : [])
    ].filter(Boolean);

    // If unassigned (no unit assigned), handles all units
    if (assignedUnits.length === 0) return true;

    // If assigned units exist, must include target unit
    if (!targetUnitId) return true;
    return assignedUnits.includes(targetUnitId);
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
function canViewDisposalDetails(user, request) {
  if (!user || !request) return false;

  // If user can handle steps, they can view details
  if (canHandleDisposalSteps(user, request)) return true;

  // Requesting unit's Unit Head or read_write employee
  if (
    user.role === 'unit_head' ||
    (user.role === 'employee' && user.permission_level === 'read_write')
  ) {
    const userUnitIds = [
      user.unit_id,
      ...(Array.isArray(user.unitIds) ? user.unitIds : [])
    ].filter(Boolean);
    return userUnitIds.includes(request.unit_id);
  }

  return false;
}

/**
 * Check if a user can view the basic Overview tab.
 * When DISPOSAL_OVERVIEW_PUBLIC_TO_ALL_USERS is true, all authenticated users can view Overview.
 *
 * @param {Object} user - User profile object
 * @returns {boolean}
 */
function canViewDisposalOverview(user) {
  if (!user) return false;
  if (DISPOSAL_OVERVIEW_PUBLIC_TO_ALL_USERS) return true;
  return Boolean(user.role);
}

/**
 * Check if a user can print reports (Board of Survey, Destruction Certificate, Way Bill).
 * Matches canViewDisposalDetails.
 */
function canPrintDisposal(user, request) {
  return canViewDisposalDetails(user, request);
}

/**
 * Resolve the query filter / scope for listing disposal requests for a user.
 * - super_admin: null (all units)
 * - local_admin: user's allowed units array
 * - disposal_only: all units (null) if unassigned, or assigned units array
 * - unit_head / employee: user's assigned units array
 *
 * @param {Object} user
 * @returns {Array<string>|null} null = all units, Array = allowed unit IDs
 */
function getDisposalUnitScope(user) {
  if (!user) return [];
  if (user.role === 'super_admin') return null;

  const assignedUnits = Array.from(new Set([
    user.unit_id,
    ...(Array.isArray(user.unitIds) ? user.unitIds : []),
    ...(Array.isArray(user.units) ? user.units.map(u => u.id) : [])
  ].filter(Boolean)));

  if (user.role === 'employee' && user.permission_level === 'disposal_only') {
    // Unassigned means all units
    return assignedUnits.length === 0 ? null : assignedUnits;
  }

  if (user.role === 'local_admin') {
    return assignedUnits;
  }

  // unit_head or regular employee
  return assignedUnits;
}

module.exports = {
  DISPOSAL_OVERVIEW_PUBLIC_TO_ALL_USERS,
  NOTIFY_REQUESTER_ON_PROGRESS,
  canCreateDisposalRequest,
  canEditDraft,
  canDeleteDraft,
  canSubmitRequest,
  canHandleDisposalSteps,
  canViewDisposalDetails,
  canViewDisposalOverview,
  canPrintDisposal,
  getDisposalUnitScope
};
