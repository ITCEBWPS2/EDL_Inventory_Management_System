const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const seed = require('../src/scripts/seed');

let mongod = null;

async function setupTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  mongod = await MongoMemoryServer.create({
    instance: { dbName: 'edl_ims' }
  });
  const uri = `${mongod.getUri()}edl_ims`;
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'edl_ims_secure_jwt_secret_dev_key_2026';
  process.env.JWT_DEV_FALLBACK_SECRET = 'edl_ims_secure_jwt_secret_dev_key_2026';

  await mongoose.connect(uri);
  await seed({ disconnect: false });
}

async function teardownTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

module.exports = {
  setupTestDb,
  teardownTestDb
};
