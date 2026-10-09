/**
 * Role-Based Access Control Middleware
 * @param {Array<string>} allowedRoles
 */
const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. User session not established.'
      });
    }

    // Super Admin has system-wide access
    if (req.user.role === 'super_admin') {
      return next();
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Your role (${req.user.role}) is not authorized to perform this action.`
      });
    }

    next();
  };
};

module.exports = requireRole;
