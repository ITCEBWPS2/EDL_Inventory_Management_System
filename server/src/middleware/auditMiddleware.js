const { v4: uuidv4 } = require('uuid');
const auditLogger = require('../services/auditLogger');

/**
 * Express middleware that:
 * 1. Attaches a unique request_id to each incoming request (and sets X-Request-Id header)
 * 2. Provides generic fallback audit logging for mutating requests (POST/PUT/PATCH/DELETE)
 *    if the controller did not log an explicit, rich entry (flagged via res.locals.auditLogged).
 */
const auditMiddleware = (req, res, next) => {
  // 1. Assign Request ID
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Initialize locals
  res.locals = res.locals || {};
  res.locals.auditLogged = false;

  // 2. Fallback logger on response finish for mutating requests
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (mutatingMethods.includes(req.method)) {
    res.on('finish', () => {
      // If already explicitly logged by a controller, skip fallback
      if (res.locals.auditLogged) return;

      const path = req.originalUrl || req.url;

      // Skip internal routes that shouldn't have generic mutation fallback
      if (
        path.startsWith('/api/audit-logs') ||
        path.startsWith('/api/auth/login') ||
        path.startsWith('/api/auth/logout') ||
        path.startsWith('/api/health')
      ) {
        return;
      }

      // Infer module from URL
      let mod = 'Settings';
      if (path.includes('/inventory')) mod = 'Inventory';
      else if (path.includes('/transactions/received')) mod = 'Received Items';
      else if (path.includes('/transactions/expended')) mod = 'Expended Items';
      else if (path.includes('/transactions')) mod = 'Received Items';
      else if (path.includes('/verifications') || path.includes('/verification')) mod = 'Verification';
      else if (path.includes('/users')) mod = 'Users';
      else if (path.includes('/units')) mod = 'Units';
      else if (path.includes('/reports')) mod = 'Reports';

      // Infer action
      let action = 'UPDATE';
      if (req.method === 'POST') action = 'CREATE';
      else if (req.method === 'DELETE') action = 'DELETE';

      const actorName = req.user?.full_name || req.user?.username || 'User';
      const status = res.statusCode < 400 ? 'success' : 'failed';
      const description = `${actorName} performed ${req.method} on ${path.split('?')[0]}`;

      auditLogger.log({
        action,
        module: mod,
        description,
        status,
        req,
        changes: req.body ? auditLogger.snapshot(req.body) : null
      });
    });
  }

  next();
};

module.exports = auditMiddleware;

