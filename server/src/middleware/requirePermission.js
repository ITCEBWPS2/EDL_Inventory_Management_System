/**
 * Permission Level Access Control Middleware
 * Applies specifically to 'employee' roles while letting Admins & Unit Heads pass
 * @param {Array<string>} requiredPermissions - e.g. ['read_write']
 */
const requirePermission = (requiredPermissions = ['read_write']) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. User session not established.'
      });
    }

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
