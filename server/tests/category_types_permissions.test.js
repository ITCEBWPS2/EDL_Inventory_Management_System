const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const { AuditLog, ItemType, InventoryItem } = require('../src/models');

let server = null;
let API_BASE = '';

test('Item Category Types Permission & Governance Test Suite', async (t) => {
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
  let employeeRwToken = null;
  let employeeRoToken = null;
  let employeeNoneToken = null;

  await t.test('1. Setup authentication tokens across all user roles', async () => {
    // Super Admin
    const saRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'superadmin', password: 'sadmin123' })
    });
    const saJson = await saRes.json();
    superAdminToken = saJson.data?.token || saJson.token;
    assert.ok(superAdminToken, 'Super Admin token retrieved');

    // Local Admin
    const laRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'localadmin', password: 'ladmin123' })
    });
    const laJson = await laRes.json();
    localAdminToken = laJson.data?.token || laJson.token;
    assert.ok(localAdminToken, 'Local Admin token retrieved');

    // Unit Head
    const uhRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'unithead', password: 'head123' })
    });
    const uhJson = await uhRes.json();
    unitHeadToken = uhJson.data?.token || uhJson.token;
    assert.ok(unitHeadToken, 'Unit Head token retrieved');

    // Employee RW
    const rwRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'employeerw', password: 'emprw123' })
    });
    const rwJson = await rwRes.json();
    employeeRwToken = rwJson.data?.token || rwJson.token;
    assert.ok(employeeRwToken, 'Employee RW token retrieved');

    // Employee RO
    const roRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'employeero', password: 'empro123' })
    });
    const roJson = await roRes.json();
    employeeRoToken = roJson.data?.token || roJson.token;
    assert.ok(employeeRoToken, 'Employee RO token retrieved');

    // Employee None
    const noneRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'employeenone', password: 'empnone123' })
    });
    const noneJson = await noneRes.json();
    employeeNoneToken = noneJson.data?.token || noneJson.token;
    assert.ok(employeeNoneToken, 'Employee None token retrieved');
  });

  await t.test('2. Unauthenticated requests get HTTP 401', async () => {
    const postRes = await fetch(`${API_BASE}/inventory/types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Guest Type', category: 'Furniture' })
    });
    assert.equal(postRes.status, 401);

    const putRes = await fetch(`${API_BASE}/inventory/types/some-id`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Guest Type' })
    });
    assert.equal(putRes.status, 401);

    const delRes = await fetch(`${API_BASE}/inventory/types/some-id`, {
      method: 'DELETE'
    });
    assert.equal(delRes.status, 401);
  });

  await t.test('3. Employee and Unit Head roles get HTTP 403 with clear message on all write endpoints', async () => {
    const nonAdminTokens = [
      { name: 'Unit Head', token: unitHeadToken },
      { name: 'Employee (read_write)', token: employeeRwToken },
      { name: 'Employee (read_only)', token: employeeRoToken },
      { name: 'Employee (no_permission)', token: employeeNoneToken }
    ];

    for (const { name, token } of nonAdminTokens) {
      // POST /types
      const postRes = await fetch(`${API_BASE}/inventory/types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: 'Unauthorized Sofa', category: 'Furniture' })
      });
      assert.equal(postRes.status, 403, `${name} must get 403 on POST /types`);
      const postJson = await postRes.json();
      assert.equal(postJson.message, 'Only Super Admin and Local Admin can manage item categories and types.');

      // PUT /types/:id
      const putRes = await fetch(`${API_BASE}/inventory/types/test-type-id`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: 'Updated Sofa' })
      });
      assert.equal(putRes.status, 403, `${name} must get 403 on PUT /types/:id`);
      const putJson = await putRes.json();
      assert.equal(putJson.message, 'Only Super Admin and Local Admin can manage item categories and types.');

      // DELETE /types/:id
      const delRes = await fetch(`${API_BASE}/inventory/types/test-type-id`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      assert.equal(delRes.status, 403, `${name} must get 403 on DELETE /types/:id`);
      const delJson = await delRes.json();
      assert.equal(delJson.message, 'Only Super Admin and Local Admin can manage item categories and types.');

      // POST /categories
      const catRes = await fetch(`${API_BASE}/inventory/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: 'Unauthorized Category' })
      });
      assert.equal(catRes.status, 403, `${name} must get 403 on POST /categories`);
      const catJson = await catRes.json();
      assert.equal(catJson.message, 'Only Super Admin and Local Admin can manage item categories and types.');
    }
  });

  await t.test('3b. Unit Head CAN still create inventory items (POST /inventory)', async () => {
    const itemRes = await fetch(`${API_BASE}/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${unitHeadToken}`
      },
      body: JSON.stringify({
        item_name: 'Unit Head Test Chair',
        item_code: 'TEST-UH-CHR-001',
        category: 'Furniture',
        sub_type: 'chairs',
        quantity: 1,
        unit_id: '11111111-1111-1111-1111-111111111145'
      })
    });
    assert.equal(itemRes.status, 201, 'Unit Head should still be able to create inventory items');
    const itemJson = await itemRes.json();
    assert.ok(itemJson.data?.id || itemJson.data?.item_code);
  });

  await t.test('4. Denied attempts generate audit log entries with status failed and permission denied', async () => {
    const deniedLogs = await AuditLog.find({
      entity_type: 'ItemType',
      status: 'failed',
      error_message: 'permission denied'
    }).lean();
    assert.ok(deniedLogs.length > 0, 'Denied attempts must be recorded in AuditLog');
    const sample = deniedLogs[0];
    assert.equal(sample.status, 'failed');
    assert.equal(sample.error_message, 'permission denied');
    assert.ok(sample.description.includes('denied permission'));
  });

  let createdTypeId = null;

  await t.test('5. Local Admin can add a new item type with automatic code generation', async () => {
    const res = await fetch(`${API_BASE}/inventory/types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localAdminToken}`
      },
      body: JSON.stringify({
        name: 'Executive Sofas',
        category: 'Furniture',
        description: 'Premium reception sofas'
      })
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.name, 'Executive Sofas');
    assert.equal(json.data.slug, 'executive-sofas');
    assert.equal(json.data.category, 'Furniture');
    assert.ok(json.data.sub_category_code);
    assert.ok(json.data.item_type_code);
    assert.equal(json.data.description, 'Premium reception sofas');
    createdTypeId = json.data.id;
  });

  await t.test('6. Input validation rejects invalid names (empty, short, long, HTML, duplicate)', async () => {
    // Empty
    const r1 = await fetch(`${API_BASE}/inventory/types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localAdminToken}` },
      body: JSON.stringify({ name: '   ', category: 'Furniture' })
    });
    assert.equal(r1.status, 400);

    // Too short (< 2)
    const r2 = await fetch(`${API_BASE}/inventory/types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localAdminToken}` },
      body: JSON.stringify({ name: 'X', category: 'Furniture' })
    });
    assert.equal(r2.status, 400);

    // Too long (> 60)
    const r3 = await fetch(`${API_BASE}/inventory/types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localAdminToken}` },
      body: JSON.stringify({ name: 'A'.repeat(65), category: 'Furniture' })
    });
    assert.equal(r3.status, 400);

    // HTML tags
    const r4 = await fetch(`${API_BASE}/inventory/types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localAdminToken}` },
      body: JSON.stringify({ name: '<script>alert("hack")</script>', category: 'Furniture' })
    });
    assert.equal(r4.status, 400);
    const json4 = await r4.json();
    assert.ok(json4.message.includes('HTML'));

    // Duplicate case-insensitive
    const r5 = await fetch(`${API_BASE}/inventory/types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localAdminToken}` },
      body: JSON.stringify({ name: 'executive sofas', category: 'Furniture' })
    });
    assert.equal(r5.status, 400);
    const json5 = await r5.json();
    assert.ok(json5.message.includes('already exists in Furniture'));
  });

  await t.test('7. Local Admin can rename / edit an existing item type', async () => {
    const res = await fetch(`${API_BASE}/inventory/types/${createdTypeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localAdminToken}`
      },
      body: JSON.stringify({
        name: 'Executive Lounge Sofas',
        description: 'Updated reception couches'
      })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.name, 'Executive Lounge Sofas');
    assert.equal(json.data.slug, 'executive-lounge-sofas');
    assert.equal(json.data.description, 'Updated reception couches');
  });

  await t.test('8. Refuses to delete a type that still has inventory items', async () => {
    // Insert an inventory item assigned to this type
    const testItem = await InventoryItem.create({
      item_name: 'Executive Lounge Sofas',
      item_code: 'TEST-FUR-SOF-001',
      category: 'Furniture',
      unit_id: '11111111-1111-1111-1111-111111111145',
      sub_type: 'executive-lounge-sofas',
      sub_classification: 'Executive Lounge Sofas',
      quantity: 2
    });

    // Try deleting with Super Admin
    const delRes = await fetch(`${API_BASE}/inventory/types/${createdTypeId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    assert.equal(delRes.status, 400);
    const delJson = await delRes.json();
    assert.equal(delJson.success, false);
    assert.ok(delJson.message.includes('Cannot delete item type'));
    assert.ok(delJson.message.includes('inventory item(s) are still associated with it'));

    // Remove the blocking inventory item
    await InventoryItem.deleteOne({ id: testItem.id });
  });

  await t.test('9. Super Admin can delete an unassociated item type', async () => {
    const delRes = await fetch(`${API_BASE}/inventory/types/${createdTypeId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    assert.equal(delRes.status, 200);
    const delJson = await delRes.json();
    assert.equal(delJson.success, true);
    assert.ok(delJson.message.includes('removed'));
  });

  await t.test('10. Audit log records successful CREATE, UPDATE, and DELETE actions', async () => {
    const successLogs = await AuditLog.find({
      entity_type: 'ItemType',
      status: 'success'
    }).lean();
    assert.ok(successLogs.some(l => l.action === 'CREATE'));
    assert.ok(successLogs.some(l => l.action === 'UPDATE'));
    assert.ok(successLogs.some(l => l.action === 'DELETE'));
  });

  await t.test('11. Read endpoints stay accessible to every role with inventory access', async () => {
    const readTokens = [superAdminToken, localAdminToken, unitHeadToken, employeeRwToken, employeeRoToken];
    for (const token of readTokens) {
      const typesRes = await fetch(`${API_BASE}/inventory/types`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      assert.equal(typesRes.status, 200);

      const catsRes = await fetch(`${API_BASE}/inventory/categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      assert.equal(catsRes.status, 200);
    }
  });
});
