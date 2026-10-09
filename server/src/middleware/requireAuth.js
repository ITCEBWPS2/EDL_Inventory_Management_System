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
