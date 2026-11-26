const permissionService = require('../services/permissionService');

/**
 * Permission Level Access Control Middleware
 * Supports both granular capability keys ('delete_inventory', 'add_inventory', 'update_inventory', etc.)
 * and legacy permission level arrays (['read_write'], ['read_only', 'read_write'])
 * @param {string|Array<string>} requiredPermissions - e.g. 'delete_inventory' or ['read_write']
 */
const requirePermission = (requiredPermissions = 'add_inventory') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. User session not established.'
      });
    }

    // Centrally block disposal_only employees from any general permission
    if (req.user.permission_level === 'disposal_only') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Disposal-only staff can access disposal requests only.'
      });
    }

    // Granular string permission check
    if (typeof requiredPermissions === 'string') {
      const permKey = requiredPermissions;

      // Super Admin and Local Admin have full administrative rights
      if (req.user.role === 'super_admin' || req.user.role === 'local_admin') {
        return next();
      }

      // Unit Head has all operational permissions except manage_permissions and manage_verification_teams
      if (req.user.role === 'unit_head') {
        if (permKey === 'manage_permissions') {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to do this.'
          });
        }
        if (permKey === 'manage_verification_teams') {
          const userPerms = await permissionService.getPermissionsForUser(req.user);
          if (userPerms[permKey]) {
            return next();
          }
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to do this.'
          });
        }
        return next();
      }

      // Employee role: resolve from permission service based on matrix and tier
      if (req.user.role === 'employee') {
        if (req.user.permission_level === 'no_permission' || !req.user.permission_level) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to do this.'
          });
        }

        const userPerms = await permissionService.getPermissionsForUser(req.user);
        if (userPerms[permKey]) {
          return next();
        }

        return res.status(403).json({
          success: false,
          message: 'You do not have permission to do this.'
        });
      }

      return res.status(403).json({
        success: false,
        message: 'You do not have permission to do this.'
      });
    }

    // Legacy array check (['read_write'], ['read_only', 'read_write'])
    // Super Admin, Local Admin, and Unit Head have administrative or full unit CRUD rights
    if (['super_admin', 'local_admin', 'unit_head'].includes(req.user.role)) {
      return next();
    }

    // For employees:
    if (req.user.role === 'employee') {
      const perm = req.user.permission_level;

      // No permission employees cannot access any inventory endpoints
      if (perm === 'no_permission' || !perm) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You have no active inventory permissions assigned. Please contact your Local Administrator.'
        });
      }

      // If user has required permission, allow
      if (requiredPermissions.includes(perm)) {
        return next();
      }

      // If action requires write permissions and user has read_only:
      if (perm === 'read_only') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Read-Only access. You are not permitted to add, edit, or delete records.'
        });
      }
    }

    return res.status(403).json({
      success: false,
      message: 'Forbidden. Insufficient permission level for this operation.'
    });
  };
};

module.exports = requirePermission;
