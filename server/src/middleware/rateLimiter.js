const rateLimit = require('express-rate-limit');
const { getClientIp } = require('../utils/clientIp');

// Rate limiter for login and sensitive auth operations to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again after 15 minutes.'
  }
});

// Rate limiter for forgot and update password attempts:
// Max 5 attempts per 15 minutes per IP and per username.
// After that returns 429: "Too many attempts. Please try again later."
const attemptHistory = new Map();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

function cleanOldAttempts(timestamps, now) {
  return timestamps.filter(ts => (now - ts) < WINDOW_MS);
}

const passwordResetLimiter = (req, res, next) => {
  const now = Date.now();
  const ip = getClientIp(req) || 'unknown';
  const rawUsername = (req.body?.username || req.body?.user || '').trim().toLowerCase();

  const ipKey = `ip:${ip}`;
  const userKey = rawUsername ? `user:${rawUsername}` : null;

  // Clean and check IP
  let ipHistory = cleanOldAttempts(attemptHistory.get(ipKey) || [], now);
  attemptHistory.set(ipKey, ipHistory);

  if (ipHistory.length >= MAX_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      message: 'Too many attempts. Please try again later.'
    });
  }

  // Clean and check Username if provided
  if (userKey) {
    let userHistory = cleanOldAttempts(attemptHistory.get(userKey) || [], now);
    attemptHistory.set(userKey, userHistory);

    if (userHistory.length >= MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Please try again later.'
      });
    }
  }

  // Record this attempt
  ipHistory.push(now);
  attemptHistory.set(ipKey, ipHistory);

  if (userKey) {
    const userHistory = attemptHistory.get(userKey) || [];
    userHistory.push(now);
    attemptHistory.set(userKey, userHistory);
  }

  next();
};

function resetPasswordLimiterStore() {
  attemptHistory.clear();
}

module.exports = {
  authLimiter,
  passwordResetLimiter,
  resetPasswordLimiterStore
};
