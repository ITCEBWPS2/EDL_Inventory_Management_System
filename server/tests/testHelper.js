const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const seed = require('../src/scripts/seed');

let mongod = null;

async function setupTestDb() {
  process.env.NODE_ENV = 'test';
  process.env.TEST_DB_ACTIVE = 'true';

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  mongod = await MongoMemoryServer.create({
    instance: { dbName: 'edl_ims' },
    spawn: { timeout: 30000 }
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
  delete process.env.TEST_DB_ACTIVE;
}

module.exports = {
  setupTestDb,
  teardownTestDb
};
