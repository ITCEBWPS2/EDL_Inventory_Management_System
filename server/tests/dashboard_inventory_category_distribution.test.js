const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const { InventoryItem, Unit } = require('../src/models');
const { v4: uuidv4 } = require('uuid');

let server = null;
let API_BASE = '';

test('Dashboard Inventory Category Distribution Test Suite', async (t) => {
  await setupTestDb();

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      API_BASE = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });

  t.after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    await teardownTestDb();
  });

  let superAdminToken = null;
  const seededUnitId = '11111111-1111-1111-1111-111111111145'; // Homagama CSC

  await t.test('1. Setup authentication token for Super Admin', async () => {
    const sRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'superadmin', password: 'sadmin123' })
    });
    const sJson = await sRes.json();
    superAdminToken = sJson.data?.token || sJson.token;
    assert.ok(superAdminToken, 'Super admin token should be received');
  });

  await t.test('2. Dashboard category breakdown sums inventory quantities and computes sorted percentages', async () => {
    const dashRes = await fetch(`${API_BASE}/dashboard?unit_id=${seededUnitId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const dashJson = await dashRes.json();
    assert.equal(dashRes.status, 200);
    assert.equal(dashJson.success, true);

    const breakdown = dashJson.data.category_breakdown;
    assert.ok(Array.isArray(breakdown), 'category_breakdown must be an array');
    assert.ok(breakdown.length > 0, 'category_breakdown should not be empty');

    // Verify sum of quantities matches grand_total and category_total
    const sumQuantities = breakdown.reduce((acc, cat) => acc + cat.quantity, 0);
    assert.equal(dashJson.data.grand_total, sumQuantities, 'grand_total must equal sum of category quantities');
    assert.equal(dashJson.data.category_total, sumQuantities, 'category_total must equal sum of category quantities');
    assert.ok(dashJson.data.grand_total > 0, 'grand_total must be greater than 0');

    // Verify sorting descending by quantity
    for (let i = 0; i < breakdown.length - 1; i++) {
      assert.ok(
        breakdown[i].quantity >= breakdown[i + 1].quantity,
        `Categories should be sorted descending: ${breakdown[i].name} (${breakdown[i].quantity}) >= ${breakdown[i + 1].name} (${breakdown[i + 1].quantity})`
      );
    }

    // Verify percentage calculations
    let sumPercentages = 0;
    breakdown.forEach(cat => {
      assert.ok(typeof cat.name === 'string' && cat.name.trim().length > 0);
      assert.ok(typeof cat.quantity === 'number' && cat.quantity > 0);
      assert.ok(typeof cat.percentage === 'number');
      const expectedPct = Math.round((cat.quantity / sumQuantities) * 100);
      assert.equal(cat.percentage, expectedPct, `Percentage for ${cat.name} should match rounded ratio`);
      sumPercentages += cat.percentage;
    });
    assert.ok(sumPercentages >= 98 && sumPercentages <= 102, `Percentages sum (${sumPercentages}) should be ~100%`);
  });

  await t.test('3. ITO unit category distribution equals Current Inventory Report total (432 items)', async () => {
    // Create an isolated unit representing ITO with 432 inventory items across the 5 standard categories
    const itoTestUnitId = uuidv4();
    await Unit.create({
      id: itoTestUnitId,
      unit_name: 'ITO - Information Technology Operations',
      unit_code: 'WPS-ITO-TEST',
      unit_type: 'unit',
      status: 'active'
    });

    const categoryAllocations = [
      { name: 'IT & Computing Equipment', qty: 207, prefix: 'ITO-IT' },
      { name: 'Network & Communication Equipment', qty: 116, prefix: 'ITO-NET' },
      { name: 'Tools & Equipment', qty: 57, prefix: 'ITO-TOOL' },
      { name: 'Furniture', qty: 42, prefix: 'ITO-FURN' },
      { name: 'Audio Visual & Presentation Equipment', qty: 10, prefix: 'ITO-AV' }
    ];

    const itemsToInsert = [];
    categoryAllocations.forEach(cat => {
      const serials = Array.from({ length: cat.qty }, (_, i) => `${cat.prefix}-${String(i + 1).padStart(3, '0')}`);
      itemsToInsert.push({
        id: uuidv4(),
        unit_id: itoTestUnitId,
        item_name: `${cat.name} Item Batch`,
        item_code: `${cat.prefix}-001`,
        category: cat.name,
        quantity: cat.qty,
        serial_numbers: serials,
        status: 'In Stock'
      });
    });

    await InventoryItem.insertMany(itemsToInsert);

    // 1. Fetch dashboard for ITO unit
    const dashRes = await fetch(`${API_BASE}/dashboard?unit_id=${itoTestUnitId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const dashJson = await dashRes.json();
    assert.equal(dashRes.status, 200);

    // 2. Fetch Current Inventory Report for ITO unit
    const repRes = await fetch(`${API_BASE}/reports/inventory?unit_id=${itoTestUnitId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const repJson = await repRes.json();
    assert.equal(repRes.status, 200);

    // Verify grand total equals 432 exactly and matches Current Inventory Report total
    assert.equal(dashJson.data.grand_total, 432, 'ITO grand_total must be 432');
    assert.equal(dashJson.data.category_total, 432, 'ITO category_total must be 432');
    assert.equal(repJson.summary.total_items, 432, 'Report total_items must be 432');
    assert.equal(dashJson.data.grand_total, repJson.summary.total_items, 'Dashboard grand_total must equal Current Inventory Report summary.total_items');

    // Verify each category has the exact count
    const breakdown = dashJson.data.category_breakdown;
    assert.equal(breakdown.length, 5);
    assert.equal(breakdown[0].name, 'IT & Computing Equipment');
    assert.equal(breakdown[0].quantity, 207);
    assert.equal(breakdown[1].name, 'Network & Communication Equipment');
    assert.equal(breakdown[1].quantity, 116);
    assert.equal(breakdown[2].name, 'Tools & Equipment');
    assert.equal(breakdown[2].quantity, 57);
    assert.equal(breakdown[3].name, 'Furniture');
    assert.equal(breakdown[3].quantity, 42);
    assert.equal(breakdown[4].name, 'Audio Visual & Presentation Equipment');
    assert.equal(breakdown[4].quantity, 10);

    // Clean up
    await InventoryItem.deleteMany({ unit_id: itoTestUnitId });
    await Unit.deleteOne({ id: itoTestUnitId });
  });

  await t.test('4. Batch items with serial_numbers count individual units, not single records', async () => {
    const testUnitId = uuidv4();
    const batchItemId = uuidv4();

    await InventoryItem.create({
      id: batchItemId,
      unit_id: testUnitId,
      item_name: 'Test Batch Switch',
      item_code: 'TEST-SW-01',
      category: 'Network & Communication Equipment',
      quantity: 11,
      serial_numbers: Array.from({ length: 11 }, (_, i) => `SN-SW-${i + 1}`),
      status: 'In Stock'
    });

    const dashRes = await fetch(`${API_BASE}/dashboard?unit_id=${testUnitId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const dashJson = await dashRes.json();
    assert.equal(dashRes.status, 200);

    const breakdown = dashJson.data.category_breakdown;
    assert.equal(dashJson.data.grand_total, 11, 'Batch item with 11 serials must count 11, not 1 record');
    assert.equal(breakdown.length, 1);
    assert.equal(breakdown[0].name, 'Network & Communication Equipment');
    assert.equal(breakdown[0].quantity, 11);
    assert.equal(breakdown[0].percentage, 100);

    // Clean up
    await InventoryItem.deleteOne({ id: batchItemId });
  });
});
