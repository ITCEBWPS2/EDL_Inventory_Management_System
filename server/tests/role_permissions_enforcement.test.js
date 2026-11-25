const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');

let server = null;
let API_BASE = '';

test('Role Permissions Enforcement Backend Test Suite', async (t) => {
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
  let employeeRwToken = null;
  let unitHeadToken = null;
  let sampleItemId = null;

  let employeeUnitId = null;

  await t.test('1. Authenticate users and verify returned permissions', async () => {
    // Super Admin login
    const saRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'superadmin', password: 'sadmin123' })
    });
    const saJson = await saRes.json();
    assert.equal(saRes.status, 200);
    superAdminToken = saJson.data?.token || saJson.token;
    assert.ok(superAdminToken);
    assert.equal(saJson.data?.user?.permissions?.delete_inventory, true);
    assert.equal(saJson.data?.user?.permissions?.manage_permissions, true);

    // Employee (read_write: Kavinda Silva) login
    const empRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'employeerw', password: 'emprw123' })
    });
    const empJson = await empRes.json();
    assert.equal(empRes.status, 200);
    employeeRwToken = empJson.data?.token || empJson.token;
    employeeUnitId = empJson.data?.user?.units?.[0]?.id;
    assert.ok(employeeRwToken);
    assert.ok(employeeUnitId, 'Employee unit retrieved');
    assert.equal(empJson.data?.user?.permissions?.view_inventory, true);
    assert.equal(empJson.data?.user?.permissions?.add_inventory, true);
    assert.equal(empJson.data?.user?.permissions?.update_inventory, true);
    assert.equal(empJson.data?.user?.permissions?.delete_inventory, false, 'Employee delete_inventory must be false');
    assert.equal(empJson.data?.user?.permissions?.view_reports, true);
    assert.equal(empJson.data?.user?.permissions?.manage_permissions, false);

    // Unit Head login
    const uhRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'unithead', password: 'head123' })
    });
    const uhJson = await uhRes.json();
    assert.equal(uhRes.status, 200);
    unitHeadToken = uhJson.data?.token || uhJson.token;
    assert.ok(unitHeadToken);
    assert.equal(uhJson.data?.user?.permissions?.delete_inventory, true);
    assert.equal(uhJson.data?.user?.permissions?.manage_permissions, false);
  });

  await t.test('2. Super Admin creates a test inventory item in employee unit', async () => {
    const res = await fetch(`${API_BASE}/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        item_name: 'Permission Test Office Chair',
        item_code: 'TEST-PERM-CHAIR-01',
        category: 'Furniture',
        sub_type: 'chairs',
        quantity: 1,
        unit_id: employeeUnitId,
        serial_number: 'TEST-PERM-CHAIR-01',
        status: 'In Stock'
      })
    });
    const json = await res.json();
    assert.equal(res.status, 201);
    sampleItemId = json.data?.id;
    assert.ok(sampleItemId, 'Item created successfully');
  });

  await t.test('3. Employee (Kavinda Silva) CAN view inventory items', async () => {
    const res = await fetch(`${API_BASE}/inventory`, {
      headers: { 'Authorization': `Bearer ${employeeRwToken}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.data));
  });

  await t.test('4. Employee (Kavinda Silva) CAN update inventory details', async () => {
    const res = await fetch(`${API_BASE}/inventory/${sampleItemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${employeeRwToken}`
      },
      body: JSON.stringify({
        item_name: 'Permission Test Office Chair (Updated by Employee)'
      })
    });
    assert.equal(res.status, 200);
  });

  await t.test('5. Employee (Kavinda Silva) CANNOT delete inventory items (returns 403)', async () => {
    const res = await fetch(`${API_BASE}/inventory/${sampleItemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${employeeRwToken}` }
    });
    assert.equal(res.status, 403, 'Should return 403 Forbidden for employee');
    const json = await res.json();
    assert.match(json.message, /permission/i);
  });

  await t.test('6. Employee (Kavinda Silva) CANNOT delete transactions (returns 403)', async () => {
    const resReceived = await fetch(`${API_BASE}/transactions/received/non-existent-id`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${employeeRwToken}` }
    });
    assert.equal(resReceived.status, 403);

    const resExpended = await fetch(`${API_BASE}/transactions/expended/non-existent-id`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${employeeRwToken}` }
    });
    assert.equal(resExpended.status, 403);
  });

  await t.test('7. Employee (Kavinda Silva) CANNOT manage users or update permission matrix (returns 403)', async () => {
    const usersRes = await fetch(`${API_BASE}/users`, {
      headers: { 'Authorization': `Bearer ${employeeRwToken}` }
    });
    assert.equal(usersRes.status, 403);

    const matrixRes = await fetch(`${API_BASE}/auth/permissions/matrix`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${employeeRwToken}`
      },
      body: JSON.stringify({ employee: { delete_inventory: true } })
    });
    assert.equal(matrixRes.status, 403);
  });

  await t.test('8. Employee (Kavinda Silva) CAN view reports', async () => {
    const res = await fetch(`${API_BASE}/reports/inventory`, {
      headers: { 'Authorization': `Bearer ${employeeRwToken}` }
    });
    assert.equal(res.status, 200);
  });

  await t.test('9. Super Admin CAN retrieve and update permissions matrix', async () => {
    const getRes = await fetch(`${API_BASE}/auth/permissions/matrix`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    assert.equal(getRes.status, 200);
    const getJson = await getRes.json();
    assert.ok(getJson.matrix?.employee);

    const putRes = await fetch(`${API_BASE}/auth/permissions/matrix`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        employee: {
          ...getJson.matrix.employee,
          delete_inventory: false
        }
      })
    });
    assert.equal(putRes.status, 200);
  });

  await t.test('10. Super Admin CAN delete inventory item', async () => {
    const res = await fetch(`${API_BASE}/inventory/${sampleItemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    assert.equal(res.status, 200);
  });
});
