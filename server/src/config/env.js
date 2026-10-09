require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET || process.env.JWT_DEV_FALLBACK_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'edl_ims_secure_jwt_secret_dev_key_2026'),
  JWT_DEV_FALLBACK_SECRET: process.env.JWT_DEV_FALLBACK_SECRET || 'edl_ims_secure_jwt_secret_dev_key_2026',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/edl_ims',
};
