/**
 * Unit Access Control Middleware
 * Ensures the requesting user belongs to the specified unit
 * @param {string} [unitParamName] - Optional custom param name
 */
const requireUnitAccess = (unitParamName = 'unitId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. User session not established.'
      });
    }

    // Super Admin and Local Admin have global unrestricted unit access
    if (req.user.role === 'super_admin' || req.user.role === 'local_admin') {
      return next();
    }

    // Extract target unit ID from params, body, or query
    const targetUnitId = 
      req.params[unitParamName] || 
      req.params.unitId || 
      req.params.unit_id ||
      req.body.unit_id || 
      req.body.unitId || 
      req.query.unit_id || 
      req.query.unitId;

    // If no specific unit is requested in a query (e.g. GET /inventory),
    // the controller automatically filters by req.user.unitIds.
    if (!targetUnitId) {
      return next();
    }

    const authorizedUnitIds = req.user.unitIds || [];
    if (!authorizedUnitIds.includes(targetUnitId)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You are not authorized to view or manage records for this unit.'
      });
    }

    next();
  };
};

module.exports = requireUnitAccess;
