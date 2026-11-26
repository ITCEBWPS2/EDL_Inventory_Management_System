import React from 'react';

/**
 * Permissions helper for role-based access control across EDL IMS
 * 
 * Standard Capability Keys:
 * - 'view_inventory': View inventory items, categories, transactions, vouchers
 * - 'add_inventory': Add new items, received/expended transactions, verifications
 * - 'update_inventory': Edit/update items, transaction details
 * - 'delete_inventory': Delete items, vouchers, issued/destroyed records
 * - 'view_reports': View reports tab and export data (CSV)
 * - 'manage_permissions': Access User Management and change role permissions matrix
 */

export const DEFAULT_EMPLOYEE_PERMISSIONS = {
  view_inventory: true,
  add_inventory: true,
  update_inventory: true,
  delete_inventory: false, // RESTRICT by default for Employee role
  view_reports: true,
  manage_permissions: false // RESTRICT by default for Employee role
};

export const DEFAULT_READONLY_PERMISSIONS = {
  view_inventory: true,
  add_inventory: false,
  update_inventory: false,
  delete_inventory: false,
  view_reports: true,
  manage_permissions: false
};

export const DEFAULT_NOPERM_PERMISSIONS = {
  view_inventory: false,
  add_inventory: false,
  update_inventory: false,
  delete_inventory: false,
  view_reports: false,
  manage_permissions: false
};

/**
 * Checks if a user has a specific granular capability.
 * @param {string} permissionKey - e.g. 'delete_inventory', 'add_inventory', etc.
 * @param {object} user - User profile object from AuthContext
 * @returns {boolean}
 */
export const can = (permissionKey, user) => {
  if (!user || !user.role) return false;

  const isCeCom = user.role === 'ce_com' || user.username === 'cecom' || (user.full_name && /CE\s*\(Com\)/i.test(user.full_name));

  // CE (Com) user has manage_verification_teams access but strictly NO User Management access
  if (isCeCom) {
    if (permissionKey === 'manage_permissions') return false;
    if (permissionKey === 'manage_verification_teams') return true;
  }

  // Administrators have full access across all operations
  if (user.role === 'super_admin' || user.role === 'local_admin') {
    return true;
  }

  // Check user's resolved permissions object if explicitly present
  if (user.permissions && typeof user.permissions[permissionKey] !== 'undefined') {
    return Boolean(user.permissions[permissionKey]);
  }

  // Unit Head has full inventory and report operations, but cannot manage users or verification teams unless granted
  if (user.role === 'unit_head') {
    if (permissionKey === 'manage_permissions' || permissionKey === 'manage_verification_teams') {
      return false;
    }
    return true;
  }

  // Employee role
  if (user.role === 'employee') {
    if (user.permission_level === 'no_permission' || user.permission_level === 'disposal_only') {
      return false;
    }

    if (permissionKey === 'manage_verification_teams') {
      return Boolean(user.permissions?.manage_verification_teams);
    }

    // Fallback based on permission_level tier
    if (user.permission_level === 'read_only') {
      return Boolean(DEFAULT_READONLY_PERMISSIONS[permissionKey]);
    }

    // Default read_write employee
    return Boolean(DEFAULT_EMPLOYEE_PERMISSIONS[permissionKey]);
  }

  return false;
};

/**
 * Checks if a user has permission to manage (Add, Edit/Rename, Delete) item category types
 * Allowed roles: super_admin, local_admin
 * Forbidden roles: unit_head, employee (all permission levels), guest/other
 */
export const canManageCategoryTypes = (user) => {
  if (!user || !user.role) return false;
  return ['super_admin', 'local_admin'].includes(user.role);
};

export const canAddItemTypes = (user) => {
  return canManageCategoryTypes(user);
};

export const canManageCategories = (user) => {
  return canManageCategoryTypes(user);
};

/**
 * Optional Declarative Wrapper Component for permission-guarded UI:
 * <Can permission="delete_inventory" user={user}>
 *   <DeleteButton ... />
 * </Can>
 */
export const Can = ({ permission, user, children, fallback = null }) => {
  if (can(permission, user)) {
    return children;
  }
  return fallback;
};

export default {
  can,
  Can,
  canManageCategoryTypes,
  canAddItemTypes,
  canManageCategories,
  DEFAULT_EMPLOYEE_PERMISSIONS,
  DEFAULT_READONLY_PERMISSIONS,
  DEFAULT_NOPERM_PERMISSIONS
};
