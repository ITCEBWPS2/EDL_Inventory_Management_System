const auditLogger = require('../services/auditLogger');

/**
 * Role-Based Access Control Middleware
 * @param {Array<string>} allowedRoles
 * @param {string|null} customMessage
 */
const requireRole = (allowedRoles = [], customMessage = null) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. User session not established.'
      });
    }

    // Centrally block disposal_only employees from role-based administrative routes
    if (req.user.permission_level === 'disposal_only') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Disposal-only staff cannot access administrative endpoints.'
      });
    }

    // Super Admin has system-wide access
    if (req.user.role === 'super_admin') {
      return next();
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      const message = customMessage || `Forbidden. Your role (${req.user.role}) is not authorized to perform this action.`;

      // If category / item type management was denied, log audit entry
      if (customMessage && (customMessage.toLowerCase().includes('item category') || customMessage.toLowerCase().includes('item categories'))) {
        try {
          const action = req.method === 'POST' ? 'CREATE' : (req.method === 'DELETE' ? 'DELETE' : 'UPDATE');
          const typeName = req.body?.name || req.query?.name || req.params?.id || 'ItemType';
          const activeUnit = req.user?.unit_id || req.user?.units?.[0]?.id || null;

          await auditLogger.log({
            action,
            module: 'Inventory',
            status: 'failed',
            error_message: 'permission denied',
            entity_type: 'ItemType',
            entity_reference: String(typeName),
            description: `${req.user?.full_name || req.user?.username || 'User'} (${req.user?.role || 'user'}) denied permission to manage item category types: permission denied`,
            unit_id: activeUnit,
            req,
            res
          });
        } catch (auditErr) {
          console.warn('Audit error on forbidden role attempt:', auditErr.message);
        }
      }

      return res.status(403).json({
        success: false,
        message
      });
    }

    next();
  };
};

module.exports = requireRole;
