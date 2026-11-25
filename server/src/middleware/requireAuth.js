const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../services/db');

/**
 * Authentication Middleware:
 * Verifies app JWT, resolves profile and assigned units
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Missing or malformed authorization token.'
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded = null;

    try {
      const secret = env.JWT_SECRET || env.JWT_DEV_FALLBACK_SECRET;
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session token. Please log in again.'
      });
    }

    const userId = decoded.sub || decoded.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token claims.'
      });
    }

    // Resolve profile and user units
    const profile = await db.getProfileById(userId);
    if (!profile) {
      return res.status(401).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    if (profile.account_status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Account is ${profile.account_status}. Please contact system administrator.`
      });
    }

    // Attach units
    const unitIds = await db.getUserUnits(userId);
    req.user = {
      ...profile,
      unitIds: unitIds || []
    };

    // Central restriction for disposal_only permission level
    if (req.user.permission_level === 'disposal_only') {
      const pathUrl = req.originalUrl || req.url || '';
      const allowedPrefixes = [
        '/api/auth',
        '/api/notifications',
        '/api/disposal-requests',
        '/api/disposal'
      ];
      const isAllowedPrefix = allowedPrefixes.some(p => pathUrl.startsWith(p));
      const isReadUnits = pathUrl.startsWith('/api/units') && req.method === 'GET';

      if (!isAllowedPrefix && !isReadUnits) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Disposal-only staff are restricted to disposal requests.'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal error verifying authentication.'
    });
  }
};

module.exports = requireAuth;
