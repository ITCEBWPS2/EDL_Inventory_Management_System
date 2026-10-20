const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');
const db = require('../src/services/db');
const { ReceivedTransaction, Unit, Profile } = require('../src/models');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const transactionRoutes = require('../src/routes/transactions.routes');

test('Optional Received Voucher No. Test Suite', async (t) => {
  let app;
  let server;
  let baseUrl;
  let adminToken;
  let testUnitId;

  await t.before(async () => {
    await setupTestDb();

    // Find or seed a unit
    const unit = await Unit.findOne({});
    testUnitId = unit.id;

    // Get seeded super_admin user
    const adminUser = await Profile.findOne({ role: 'super_admin' });

    // Create a super_admin token
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

  await t.test('1. DB service: createReceivedTransaction without voucher_no succeeds and saves empty string', async () => {
    // A: Omitted voucher_no
    const tx1 = await db.createReceivedTransaction({
      item_name: 'Test LED Light 50W',
      category: 'Tools & Equipment',
      quantity: 10,
      unit_id: testUnitId,
      from_whom: 'National Electricals'
    });
    assert.ok(tx1.id, 'Transaction ID should exist');
    assert.strictEqual(tx1.voucher_no, '', 'Omitted voucher_no should default to empty string');
    assert.strictEqual(tx1.quantity, 10);

    // B: Explicit null voucher_no
    const tx2 = await db.createReceivedTransaction({
      item_name: 'Test Copper Wire 100m',
      category: 'Tools & Equipment',
      quantity: 5,
      unit_id: testUnitId,
      voucher_no: null,
      from_whom: 'Kelani Cables'
    });
    assert.strictEqual(tx2.voucher_no, '', 'Null voucher_no should normalize to empty string');

    // C: Whitespace-only voucher_no
    const tx3 = await db.createReceivedTransaction({
      item_name: 'Test Circuit Breaker 30A',
      category: 'Tools & Equipment',
      quantity: 2,
      unit_id: testUnitId,
      voucher_no: '   ',
      from_whom: 'Schneider Electric'
    });
    assert.strictEqual(tx3.voucher_no, '', 'Whitespace voucher_no should trim to empty string');

    // D: Explicit valid voucher_no
    const tx4 = await db.createReceivedTransaction({
      item_name: 'Test Digital Multimeter',
      category: 'Tools & Equipment',
      quantity: 3,
      unit_id: testUnitId,
      voucher_no: 'VR-TEST-9988',
      from_whom: 'Fluke Lanka'
    });
    assert.strictEqual(tx4.voucher_no, 'VR-TEST-9988', 'Explicit voucher_no should be preserved');
  });

  await t.test('2. Multiple records with empty voucher_no do not collide or violate compound index', async () => {
    const listBefore = await ReceivedTransaction.find({ voucher_no: '' });
    assert.ok(listBefore.length >= 3, 'Multiple records with empty voucher_no must coexist peacefully');
  });

  await t.test('3. API POST /api/transactions/received: creates record without voucher_no', async () => {
    const res = await fetch(`${baseUrl}/api/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        item_name: 'Office Swivel Chair',
        quantity: 4,
        unit_id: testUnitId,
        from_whom: 'Damro Furniture'
        // voucher_no omitted!
      })
    });

    const json = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(json)}`);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.voucher_no, '');
    assert.strictEqual(json.data.item_name, 'Office Swivel Chair');
  });

  await t.test('4. API POST /api/transactions/received: error message does not mention voucher number', async () => {
    // Missing required field (quantity)
    const res = await fetch(`${baseUrl}/api/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        item_name: 'Office Desk',
        unit_id: testUnitId
        // quantity missing
      })
    });

    const json = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.success, false);
    assert.ok(!json.message.toLowerCase().includes('voucher'), 'Error message must NOT mention voucher number');
  });

  await t.test('5. API PUT /api/transactions/received/:id: update without voucher_no works', async () => {
    // Create record with voucher
    const createRes = await fetch(`${baseUrl}/api/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        item_name: 'High Back Ergonomic Chair',
        quantity: 2,
        unit_id: testUnitId,
        voucher_no: 'VR-TEMP-1234',
        from_whom: 'Singer Sri Lanka'
      })
    });
    const createJson = await createRes.json();
    const createdId = createJson.data.id;
    assert.strictEqual(createJson.data.voucher_no, 'VR-TEMP-1234');

    // Update clearing voucher_no to empty string
    const updateRes = await fetch(`${baseUrl}/api/transactions/received/${createdId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        voucher_no: '',
        quantity: 3
      })
    });
    const updateJson = await updateRes.json();
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateJson.data.voucher_no, '', 'Voucher should be updated to empty string');
    assert.strictEqual(updateJson.data.quantity, 3);
  });

  await t.test('6. getReceivedTransactions & search work seamlessly with blank voucher records', async () => {
    const list = await db.getReceivedTransactions([testUnitId]);
    assert.ok(list.length > 0);

    const blankVouchers = list.filter(r => !r.voucher_no);
    assert.ok(blankVouchers.length > 0, 'Should find records with blank vouchers');

    // Search by item name of a blank voucher record
    const searchRes = await db.getReceivedTransactions([testUnitId], 'Swivel Chair');
    assert.ok(searchRes.length > 0);
    assert.strictEqual(searchRes[0].item_name, 'Office Swivel Chair');
    assert.strictEqual(searchRes[0].voucher_no, '');
  });

  await t.test('7. Remaining inventory calculation accounts for blank voucher received transactions', async () => {
    const remaining = await db.getRemainingInventory([testUnitId]);
    assert.ok(Array.isArray(remaining));
    const swivel = remaining.find(r => r.item_name.toLowerCase().includes('swivel chair'));
    assert.ok(swivel, 'Swivel chair should be in remaining inventory');
    assert.strictEqual(swivel.total_received, 4);
    assert.strictEqual(swivel.remaining_qty, 4);
  });
});
