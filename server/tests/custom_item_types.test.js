const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const db = require('../src/services/db');

let server = null;
let API_BASE = '';

test('Custom Subcategory Item Types API & Serial Generation Test Suite', async (t) => {
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
  let localAdminToken = null;
  let unitHeadToken = null;
  let employeeToken = null;

  await t.test('1. Setup authentication tokens for Super Admin, Local Admin, Unit Head and Employee', async () => {
    // Super Admin
    const saRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'superadmin', password: 'sadmin123' })
    });
    const saJson = await saRes.json();
    superAdminToken = saJson.data?.token || saJson.token;
    assert.ok(superAdminToken, 'Super admin token received');

    // Local Admin
    const laRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'localadmin', password: 'ladmin123' })
    });
    const laJson = await laRes.json();
    localAdminToken = laJson.data?.token || laJson.token;
    assert.ok(localAdminToken, 'Local admin token received');

    // Unit Head
    const uhRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'unithead', password: 'head123' })
    });
    const uhJson = await uhRes.json();
    unitHeadToken = uhJson.data?.token || uhJson.token;
    assert.ok(unitHeadToken, 'Unit head token received');

    // Employee
    const empRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'employeerw', password: 'emprw123' })
    });
    const empJson = await empRes.json();
    employeeToken = empJson.data?.token || empJson.token;
    assert.ok(employeeToken, 'Employee token received');
  });

  let createdTypeId = null;

  await t.test('2. POST /inventory/item-types: Allowed for Super Admin (201)', async () => {
    const res = await fetch(`${API_BASE}/inventory/item-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        subcategory_slug: 'chairs',
        category_slug: 'furniture',
        name: 'Bench'
      })
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.name, 'Bench');
    assert.equal(json.data.subcategory_slug, 'chairs');
    assert.equal(json.data.code, 'BENCH');
    createdTypeId = json.data.id;
    assert.ok(createdTypeId);
  });

  await t.test('3. POST /inventory/item-types: Employee is rejected with 403 Forbidden', async () => {
    const res = await fetch(`${API_BASE}/inventory/item-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${employeeToken}`
      },
      body: JSON.stringify({
        subcategory_slug: 'chairs',
        category_slug: 'furniture',
        name: 'Stool'
      })
    });
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  await t.test('4. POST /inventory/item-types: Unit Head gets 403, Local Admin creates custom type (201)', async () => {
    // Unit Head gets 403
    const uhRes = await fetch(`${API_BASE}/inventory/item-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${unitHeadToken}`
      },
      body: JSON.stringify({
        subcategory_slug: 'chairs',
        category_slug: 'furniture',
        name: 'Mesh Ergonomic Chair Denied'
      })
    });
    assert.equal(uhRes.status, 403);
    const uhJson = await uhRes.json();
    assert.equal(uhJson.message, 'Only Super Admin and Local Admin can manage item categories and types.');

    // Local Admin creates it (201)
    const res = await fetch(`${API_BASE}/inventory/item-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localAdminToken}`
      },
      body: JSON.stringify({
        subcategory_slug: 'chairs',
        category_slug: 'furniture',
        name: 'Mesh Ergonomic Chair'
      })
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.name, 'Mesh Ergonomic Chair');
    assert.ok(json.data.code);
  });

  await t.test('5. Duplicate prevention: Duplicate of custom type returns 409 Conflict', async () => {
    const res = await fetch(`${API_BASE}/inventory/item-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        subcategory_slug: 'chairs',
        category_slug: 'furniture',
        name: '  bench  ' // case-insensitive, trimmed
      })
    });
    assert.equal(res.status, 409);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.message.includes('already exists'));
  });

  await t.test('6. Duplicate prevention: Duplicate of built-in type returns 409 Conflict', async () => {
    const res = await fetch(`${API_BASE}/inventory/item-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        subcategory_slug: 'chairs',
        category_slug: 'furniture',
        name: 'Executive Chair'
      })
    });
    assert.equal(res.status, 409);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.message.includes('already exists'));
  });

  await t.test('7. Validation: Rejects invalid characters and length boundaries', async () => {
    // Too short
    const res1 = await fetch(`${API_BASE}/inventory/item-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        subcategory_slug: 'chairs',
        name: 'A'
      })
    });
    assert.equal(res1.status, 400);

    // Invalid characters (<script>)
    const res2 = await fetch(`${API_BASE}/inventory/item-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        subcategory_slug: 'chairs',
        name: 'Bench <script>'
      })
    });
    assert.equal(res2.status, 400);
  });

  await t.test('8. Serial number generation using custom item type', async () => {
    const serial = await db.getNextSerialNumber({
      unit_id: '11111111-1111-1111-1111-111111111153', // ITO
      category_name: 'Furniture',
      sub_category: 'chairs',
      item_type: 'Bench'
    });

    // Code for Bench under chairs should be BENCH-CHR
    assert.ok(serial.includes('/FUR/CHR/BENCH-CHR-'), `Serial should include /FUR/CHR/BENCH-CHR-, got: ${serial}`);
  });

  await t.test('9. DELETE /inventory/item-types/:id blocked when inventory items use it', async () => {
    // Create an inventory item using this custom type
    await db.createInventoryItem({
      unit_id: '11111111-1111-1111-1111-111111111153',
      category: 'Furniture',
      sub_type: 'chairs',
      sub_classification: 'Bench',
      item_name: 'Bench',
      item_code: 'DGM(WPSII)/CE(COM)/WPS-ITO/FUR/CHR/BENCH-CHR-001',
      quantity: 1
    });

    const delRes = await fetch(`${API_BASE}/inventory/item-types/${createdTypeId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    assert.equal(delRes.status, 400);
    const delJson = await delRes.json();
    assert.equal(delJson.success, false);
    assert.ok(delJson.message.includes('Cannot delete item type'));
    assert.ok(delJson.blockingCount >= 1);
  });

  await t.test('10. PUT /inventory/item-types/:id renames custom type without altering code', async () => {
    // Create another type without items so it can be updated
    const res = await fetch(`${API_BASE}/inventory/item-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        subcategory_slug: 'tables',
        category_slug: 'furniture',
        name: 'Standing Desk'
      })
    });
    assert.equal(res.status, 201);
    const deskType = (await res.json()).data;
    const originalCode = deskType.code;

    const putRes = await fetch(`${API_BASE}/inventory/item-types/${deskType.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({ name: 'Adjustable Standing Desk' })
    });
    assert.equal(putRes.status, 200);
    const putJson = await putRes.json();
    assert.equal(putJson.success, true);
    assert.equal(putJson.data.name, 'Adjustable Standing Desk');
    assert.equal(putJson.data.code, originalCode, 'Code must remain stable after rename');
  });

  await t.test('11. GET /inventory/item-types returns list filtered by subcategory', async () => {
    const res = await fetch(`${API_BASE}/inventory/item-types?subcategory=chairs`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.itemTypes));
    assert.ok(json.itemTypes.some(t => t.name === 'Bench'));
  });
});
