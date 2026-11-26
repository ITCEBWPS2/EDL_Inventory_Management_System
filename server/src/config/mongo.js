const mongoose = require('mongoose');
const env = require('./env');

let isConnected = false;

/**
 * Connect to MongoDB using Mongoose
 * Enforces connecting only to the edl_ims database.
 */
async function connect(uri) {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const isTestRunner = process.env.NODE_ENV === 'test' ||
                       process.env.TEST_DB_ACTIVE === 'true' ||
                       process.argv.some(a => typeof a === 'string' && (a.includes('--test') || a.includes('.test.js')));

  const targetUri = uri || process.env.MONGODB_URI || env.MONGODB_URI;

  if (isTestRunner && !process.env.TEST_DB_ACTIVE && (!targetUri || targetUri === env.MONGODB_URI)) {
    throw new Error('❌ Safety Guard: Tests must connect via MongoMemoryServer (setupTestDb), never the real edl_ims database!');
  }

  try {
    const conn = await mongoose.connect(targetUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;

    const dbName = mongoose.connection.name;
    console.log(`📦 MongoDB connected: ${dbName} at ${mongoose.connection.host}`);

    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    // In development: if remote cluster (Atlas) fails to connect, fallback to local MongoDB
    if (process.env.NODE_ENV !== 'production' && targetUri.includes('mongodb+srv://') && targetUri !== 'mongodb://127.0.0.1:27017/edl_ims') {
      console.warn('⚠️ Atlas connection failed. Attempting local MongoDB fallback at mongodb://127.0.0.1:27017/edl_ims...');
      try {
        const localConn = await mongoose.connect('mongodb://127.0.0.1:27017/edl_ims', {
          autoIndex: true,
          serverSelectionTimeoutMS: 3000,
        });
        isConnected = true;
        console.log(`📦 MongoDB connected via fallback: ${mongoose.connection.name} at ${mongoose.connection.host}`);
        return localConn;
      } catch (fallbackErr) {
        console.error('❌ Local fallback connection also failed:', fallbackErr.message);
      }
    }
    throw error;
  }
}

async function disconnect() {
  if (isConnected || mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
  }
}

module.exports = {
  connect,
  disconnect,
  mongoose
};
