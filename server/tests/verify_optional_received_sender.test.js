const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const express = require('express');
const db = require('../src/services/db');
const env = require('../src/config/env');
const { ReceivedTransaction, Unit, Profile } = require('../src/models');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const transactionRoutes = require('../src/routes/transactions.routes');

test('Optional Received Sender (From Whom) & Single Config Switch Test Suite', async (t) => {
  let app;
  let server;
  let baseUrl;
  let adminToken;
  let testUnitId;

  await t.before(async () => {
    await setupTestDb();

    // Get seeded unit
    const unit = await Unit.findOne({});
    testUnitId = unit.id;

    // Get seeded super_admin user
    const adminUser = await Profile.findOne({ role: 'super_admin' });

    // Create super_admin token
    adminToken = jwt.sign(
      {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        unitIds: [testUnitId]
      },
      process.env.JWT_SECRET || 'edl_ims_secure_jwt_secret_dev_key_2026',
      { expiresIn: '1h' }
    );

    app = express();
    app.use(express.json());
    app.use('/api/transactions', transactionRoutes);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  await t.after(async () => {
    // Reset config switch
    env.REQUIRE_RECEIVED_SENDER = false;
    delete process.env.REQUIRE_RECEIVED_SENDER;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await teardownTestDb();
  });

  await t.test('1. GET /api/transactions/config exposes require_received_sender state', async () => {
    env.REQUIRE_RECEIVED_SENDER = false;
    const res = await fetch(`${baseUrl}/api/transactions/config`);
    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.require_received_sender, false);
  });

  await t.test('2. When switch is FALSE: creating received record without from_whom succeeds (201)', async () => {
    env.REQUIRE_RECEIVED_SENDER = false;

    const res = await fetch(`${baseUrl}/api/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        item_name: 'Industrial Distribution Fuse 100A',
        quantity: 25,
        unit_id: testUnitId
        // from_whom is omitted!
      })
    });

    const json = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(json)}`);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.from_whom, '', 'Empty sender should be saved as empty string');
    assert.strictEqual(json.data.quantity, 25);
  });

  await t.test('3. When switch is FALSE: validation error for missing fields does NOT mention sender', async () => {
    env.REQUIRE_RECEIVED_SENDER = false;

    // Missing item_name
    const res = await fetch(`${baseUrl}/api/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        quantity: 5,
        unit_id: testUnitId
      })
    });

    const json = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.message, 'Item name, quantity, and unit are required.');
    assert.ok(!json.message.toLowerCase().includes('sender'), 'Must not mention sender when switch is false');
  });

  await t.test('4. When switch is TRUE: creating received record without from_whom returns 400', async () => {
    env.REQUIRE_RECEIVED_SENDER = true;

    // Attempt create without sender
    const resWithout = await fetch(`${baseUrl}/api/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        item_name: 'Substation Battery Bank 48V',
        quantity: 2,
        unit_id: testUnitId
        // from_whom missing
      })
    });

    const jsonWithout = await resWithout.json();
    assert.strictEqual(resWithout.status, 400);
    assert.strictEqual(jsonWithout.success, false);
    assert.ok(jsonWithout.message.includes('sender (from whom) are required'));

    // Attempt create WITH sender succeeds
    const resWith = await fetch(`${baseUrl}/api/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        item_name: 'Substation Battery Bank 48V',
        quantity: 2,
        unit_id: testUnitId,
        from_whom: 'Exide Industrial Solutions'
      })
    });

    const jsonWith = await resWith.json();
    assert.strictEqual(resWith.status, 201);
    assert.strictEqual(jsonWith.success, true);
    assert.strictEqual(jsonWith.data.from_whom, 'Exide Industrial Solutions');
  });

  await t.test('5. PUT /api/transactions/received/:id: update works with blank sender when switch is false', async () => {
    env.REQUIRE_RECEIVED_SENDER = false;

    // Create record with sender
    const createTx = await db.createReceivedTransaction({
      item_name: 'Surge Arrester 33kV',
      quantity: 6,
      unit_id: testUnitId,
      from_whom: 'ABB Power Grids'
    });
    assert.strictEqual(createTx.from_whom, 'ABB Power Grids');

    // Update to blank sender
    const updateRes = await fetch(`${baseUrl}/api/transactions/received/${createTx.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        from_whom: '',
        quantity: 8
      })
    });

    const updateJson = await updateRes.json();
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateJson.data.from_whom, '', 'from_whom should be cleared to empty string');
    assert.strictEqual(updateJson.data.quantity, 8);
  });

  await t.test('6. PUT /api/transactions/received/:id: update rejects blank sender when switch is true', async () => {
    env.REQUIRE_RECEIVED_SENDER = true;

    const createTx = await db.createReceivedTransaction({
      item_name: 'Lightning Arrester Base',
      quantity: 4,
      unit_id: testUnitId,
      from_whom: 'Siemens Energy'
    });

    // Attempt to clear sender when required
    const updateRes = await fetch(`${baseUrl}/api/transactions/received/${createTx.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        from_whom: '   '
      })
    });

    const updateJson = await updateRes.json();
    assert.strictEqual(updateRes.status, 400);
    assert.strictEqual(updateJson.success, false);
    assert.strictEqual(updateJson.message, 'Sender (from whom) is required.');
  });

  await t.test('7. Listing & searching records with blank senders works properly', async () => {
    env.REQUIRE_RECEIVED_SENDER = false;

    // Insert directly with blank sender
    const blankTx = await db.createReceivedTransaction({
      item_name: 'Relay Protection Terminal',
      quantity: 3,
      unit_id: testUnitId,
      from_whom: ''
    });

    const allReceived = await db.getReceivedTransactions([testUnitId]);
    const foundBlank = allReceived.find(r => r.id === blankTx.id);
    assert.ok(foundBlank, 'Blank sender record should be in listing');
    assert.strictEqual(foundBlank.from_whom, '');

    // Search by item name of blank sender item
    const searchRes = await db.getReceivedTransactions([testUnitId], 'Relay Protection');
    assert.ok(searchRes.length > 0);
    assert.strictEqual(searchRes[0].id, blankTx.id);
  });
});
