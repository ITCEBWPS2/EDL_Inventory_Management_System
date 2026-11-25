const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');

let server = null;
let API_BASE = '';

test('Item Types API Test Suite', async (t) => {
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

  let adminToken = null;
  let unitHeadToken = null;
  let readOnlyToken = null;

  await t.test('1. Setup authentication tokens', async () => {
    // Local Admin
    const laRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'localadmin', password: 'ladmin123' })
    });
    const laJson = await laRes.json();
    adminToken = laJson.data?.token || laJson.token;
    assert.ok(adminToken);

    // Unit Head
    const uRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'unithead', password: 'head123' })
    });
    const uJson = await uRes.json();
    unitHeadToken = uJson.data?.token || uJson.token;
    assert.ok(unitHeadToken);

    // Auditor / Read-Only (employeero)
    const aRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'employeero', password: 'empro123' })
    });
    const aJson = await aRes.json();
    readOnlyToken = aJson.data?.token || aJson.token;
    assert.ok(readOnlyToken);
  });

  await t.test('2. GET /inventory/types initially returns empty array for Furniture', async () => {
    const res = await fetch(`${API_BASE}/inventory/types?category=Furniture`, {
      headers: { 'Authorization': `Bearer ${readOnlyToken}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.equal(json.data.length, 0);
  });

  await t.test('3. POST /inventory/types validation: rejects empty name for admin', async () => {
    const res = await fetch(`${API_BASE}/inventory/types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: '   ', category: 'Furniture' })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.message.includes('required'));
  });

  await t.test('4. POST /inventory/types: read_only and unit_head users are denied (403)', async () => {
    const roRes = await fetch(`${API_BASE}/inventory/types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${readOnlyToken}`
      },
      body: JSON.stringify({ name: 'Office Sofas', category: 'Furniture' })
    });
    assert.equal(roRes.status, 403);

    const uhRes = await fetch(`${API_BASE}/inventory/types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${unitHeadToken}`
      },
      body: JSON.stringify({ name: 'Office Sofas', category: 'Furniture' })
    });
    assert.equal(uhRes.status, 403);
    const uhJson = await uhRes.json();
    assert.equal(uhJson.message, 'Only Super Admin and Local Admin can manage item categories and types.');
  });

  await t.test('5. POST /inventory/types: creates a new type successfully for admin (201)', async () => {
    const res = await fetch(`${API_BASE}/inventory/types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'Office Sofas', category: 'Furniture' })
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.name, 'Office Sofas');
    assert.equal(json.data.slug, 'office-sofas');
    assert.equal(json.data.category, 'Furniture');
  });

  await t.test('6. POST /inventory/types: rejects duplicate name (case-insensitive) in same category', async () => {
    const res = await fetch(`${API_BASE}/inventory/types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'office sofas', category: 'Furniture' })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.message.includes('already exists in Furniture'));
  });

  await t.test('7. GET /inventory/types returns newly created type for category', async () => {
    const res = await fetch(`${API_BASE}/inventory/types?category=furniture`, {
      headers: { 'Authorization': `Bearer ${readOnlyToken}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.length, 1);
    assert.equal(json.data[0].name, 'Office Sofas');
    assert.equal(json.data[0].slug, 'office-sofas');
  });
});
