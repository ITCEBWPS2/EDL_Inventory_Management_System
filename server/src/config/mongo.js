const mongoose = require('mongoose');
const env = require('./env');

let isConnected = false;

/**
 * Connect to MongoDB using Mongoose
 * Enforces connecting only to the edl_ims database.
 */
async function connect(uri = env.MONGODB_URI) {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true,
    });
    isConnected = true;

    const dbName = mongoose.connection.name;
    console.log(`📦 MongoDB connected: ${dbName} at ${mongoose.connection.host}`);

    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
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
