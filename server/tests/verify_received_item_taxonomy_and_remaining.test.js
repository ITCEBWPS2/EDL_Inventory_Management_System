const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const express = require('express');
const db = require('../src/services/db');
const { ReceivedTransaction, ExpendedTransaction, InventoryItem, Unit, Profile } = require('../src/models');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const transactionRoutes = require('../src/routes/transactions.routes');

test('Configured Item Types (e.g. Battery), Remaining Reconciliation & Expended Flow Test Suite', async (t) => {
  let app;
  let server;
  let baseUrl;
  let adminToken;
  let testUnitId;

  await t.before(async () => {
    await setupTestDb();

    const unit = await Unit.findOne({});
    testUnitId = unit.id;

    const adminUser = await Profile.findOne({ role: 'super_admin' });

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

  await t.test('1. Record received item for a configured type without existing inventory item (Battery)', async () => {
    // Verify no inventory item named "Battery" exists yet
    const existing = await InventoryItem.findOne({ item_name: { $regex: /^battery$/i } });
    assert.strictEqual(existing, null, 'Battery should not exist in inventory beforehand');

    const res = await fetch(`${baseUrl}/api/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        item_name: 'Battery',
        category: 'Tools & Equipment',
        quantity: 10,
        unit_id: testUnitId,
        voucher_no: 'RV-BATT-01',
        from_whom: 'Exide Industrial'
      })
    });

    const json = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.item_name, 'Battery');

    // Confirm stored in DB
    const saved = await ReceivedTransaction.findOne({ id: json.data.id }).lean();
    assert.strictEqual(saved.item_name, 'Battery');
    assert.strictEqual(saved.quantity, 10);
  });

  await t.test('2. Received Battery appears in Remaining inventory balance view', async () => {
    const remainingList = await db.getRemainingInventory([testUnitId], 'Tools & Equipment');
    const batteryRemaining = remainingList.find(r => r.item_name.toLowerCase() === 'battery');

    assert.ok(batteryRemaining, 'Battery must appear in remaining inventory view');
    assert.strictEqual(batteryRemaining.total_received, 10);
    assert.strictEqual(batteryRemaining.total_expended, 0);
    assert.strictEqual(batteryRemaining.remaining_qty, 10);
    assert.strictEqual(batteryRemaining.stock_status, 'In Stock');
  });

  await t.test('3. Expending Battery deducts from remaining balance', async () => {
    const expRes = await fetch(`${baseUrl}/api/transactions/expended`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        item_name: 'Battery',
        category: 'Tools & Equipment',
        quantity: 3,
        unit_id: testUnitId,
        voucher_no: 'EV-BATT-01',
        disposition: 'Substation Installation'
      })
    });

    const expJson = await expRes.json();
    assert.strictEqual(expRes.status, 201);
    assert.strictEqual(expJson.success, true);
    assert.strictEqual(expJson.data.item_name, 'Battery');

    // Check remaining inventory balance after expending
    const remainingList = await db.getRemainingInventory([testUnitId], 'Tools & Equipment');
    const batteryRemaining = remainingList.find(r => r.item_name.toLowerCase() === 'battery');

    assert.ok(batteryRemaining);
    assert.strictEqual(batteryRemaining.total_received, 10);
    assert.strictEqual(batteryRemaining.total_expended, 3);
    assert.strictEqual(batteryRemaining.remaining_qty, 7);
  });

  await t.test('4. Creating inventory item later reconciles under same name without duplicates', async () => {
    // Add inventory item named "Battery"
    const inv = await db.createInventoryItem({
      item_name: 'Battery',
      item_code: 'PUE-BATT-001',
      category: 'Tools & Equipment',
      sub_type: 'power-utility-equipment',
      unit_id: testUnitId,
      quantity: 0
    });
    assert.ok(inv.id);

    // Remaining inventory check
    const remainingList = await db.getRemainingInventory([testUnitId], 'Tools & Equipment');
    const batteries = remainingList.filter(r => r.item_name.toLowerCase() === 'battery');

    assert.strictEqual(batteries.length, 1, 'Must have exactly 1 Battery entry in remaining inventory (no duplicate)');
    assert.strictEqual(batteries[0].remaining_qty, 7);
  });
});
