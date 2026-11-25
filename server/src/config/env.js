require('dotenv').config();

function parseTrustProxy(val) {
  if (val === undefined || val === null || val === '') return false;
  const str = String(val).trim();
  if (str.toLowerCase() === 'true') return true;
  if (str.toLowerCase() === 'false') return false;
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  if (str.includes(',')) {
    return str.split(',').map(s => s.trim()).filter(Boolean);
  }
  return str;
}

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),
  JWT_SECRET: process.env.JWT_SECRET || process.env.JWT_DEV_FALLBACK_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'edl_ims_secure_jwt_secret_dev_key_2026'),
  JWT_DEV_FALLBACK_SECRET: process.env.JWT_DEV_FALLBACK_SECRET || 'edl_ims_secure_jwt_secret_dev_key_2026',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/edl_ims',
  REQUIRE_RECEIVED_SENDER: process.env.REQUIRE_RECEIVED_SENDER === 'true',
  ATTACHMENT_MAX_KB: parseInt(process.env.ATTACHMENT_MAX_KB, 10) || 800,
  MAX_ATTACHMENT_BYTES: (parseInt(process.env.ATTACHMENT_MAX_KB, 10) || 800) * 1024,
};
