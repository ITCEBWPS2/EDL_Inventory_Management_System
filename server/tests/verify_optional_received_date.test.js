const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const express = require('express');
const db = require('../src/services/db');
const { ReceivedTransaction, ExpendedTransaction, Unit, Profile } = require('../src/models');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const transactionRoutes = require('../src/routes/transactions.routes');

test('Optional Received Date & Dateless Records Handling Test Suite', async (t) => {
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
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await teardownTestDb();
  });

  await t.test('1. DB service: createReceivedTransaction without date succeeds and saves empty string', async () => {
    const record = await db.createReceivedTransaction({
      item_name: 'Dateless Swivel Chair',
      quantity: 5,
      unit_id: testUnitId,
      from_whom: 'Acme Supplies'
      // date omitted
    });

    assert.ok(record.id);
    assert.strictEqual(record.date, '', 'date must be saved as an empty string, not auto-filled with today');

    // Confirm in DB
    const saved = await ReceivedTransaction.findOne({ id: record.id }).lean();
    assert.strictEqual(saved.date, '');
  });

  await t.test('2. DB service: createReceivedTransaction with explicit date preserves it', async () => {
    const record = await db.createReceivedTransaction({
      item_name: 'Dated Office Desk',
      quantity: 2,
      unit_id: testUnitId,
      date: '2026-03-15',
      from_whom: 'Office Depot'
    });

    assert.strictEqual(record.date, '2026-03-15');

    const saved = await ReceivedTransaction.findOne({ id: record.id }).lean();
    assert.strictEqual(saved.date, '2026-03-15');
  });

  await t.test('3. API POST /api/transactions/received: creates record without date (stays dateless)', async () => {
    const res = await fetch(`${baseUrl}/api/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        item_name: 'Dateless Legacy Monitor',
        quantity: 3,
        unit_id: testUnitId,
        voucher_no: '',
        from_whom: '',
        date: '' // empty date
      })
    });

    const json = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.date, '', 'API response must have empty date');

    const saved = await ReceivedTransaction.findOne({ id: json.data.id }).lean();
    assert.strictEqual(saved.date, '');
  });

  await t.test('4. API POST /api/transactions/received: creates record with explicit date', async () => {
    const res = await fetch(`${baseUrl}/api/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        item_name: 'Dated Legacy Server',
        quantity: 1,
        unit_id: testUnitId,
        date: '2025-11-20'
      })
    });

    const json = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.date, '2025-11-20');
  });

  await t.test('5. API PUT /api/transactions/received/:id: update can clear the date to empty string', async () => {
    // Create record with date
    const createRes = await fetch(`${baseUrl}/api/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        item_name: 'To Be Cleared Date Record',
        quantity: 1,
        unit_id: testUnitId,
        date: '2026-01-01'
      })
    });
    const created = await createRes.json();
    assert.strictEqual(created.data.date, '2026-01-01');

    // Update with empty date
    const updateRes = await fetch(`${baseUrl}/api/transactions/received/${created.data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        date: ''
      })
    });
    const updated = await updateRes.json();
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updated.data.date, '', 'Updated record date should be cleared to empty string');
  });

  await t.test('6. Listing & searching records work seamlessly with dateless records', async () => {
    const listRes = await fetch(`${baseUrl}/api/transactions/received?unit_id=${testUnitId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const listJson = await listRes.json();
    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listJson.data));

    const datelessFound = listJson.data.some(r => r.item_name === 'Dateless Legacy Monitor' && r.date === '');
    assert.ok(datelessFound, 'Dateless record should be present in listing');

    // Search query for Dateless
    const searchRes = await fetch(`${baseUrl}/api/transactions/received?unit_id=${testUnitId}&search=Dateless`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const searchJson = await searchRes.json();
    assert.strictEqual(searchRes.status, 200);
    assert.ok(searchJson.data.length >= 1);
    assert.ok(searchJson.data.some(r => r.item_name.includes('Dateless')));
  });

  await t.test('7. Expended transaction date defaulting is completely unchanged', async () => {
    const expended = await db.createExpendedTransaction({
      item_name: 'Expended Item Without Date',
      quantity: 1,
      unit_id: testUnitId,
      voucher_no: 'EV-TEST-01',
      disposition: 'Office Use'
      // date omitted
    });

    const today = new Date().toISOString().split('T')[0];
    assert.strictEqual(expended.date, today, 'Expended transactions must still default to today');

    const saved = await ExpendedTransaction.findOne({ id: expended.id }).lean();
    assert.strictEqual(saved.date, today);
  });
});
