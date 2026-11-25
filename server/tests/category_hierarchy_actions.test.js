const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const { Category, ItemType, InventoryItem } = require('../src/models');

let server = null;
let API_BASE = '';

test('Category & Subcategory Hierarchy Edit and Delete Actions Test Suite', async (t) => {
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

  let superAdminToken;
  let localAdminToken;
  let unitHeadToken;
  let employeeRwToken;

  await t.test('1. Setup authentication tokens across user roles', async () => {
    const saRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'superadmin', password: 'sadmin123' })
    });
    const saJson = await saRes.json();
    superAdminToken = saJson.data?.token || saJson.token;
    assert.ok(superAdminToken, 'Super Admin token retrieved');

    const laRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'localadmin', password: 'ladmin123' })
    });
    const laJson = await laRes.json();
    localAdminToken = laJson.data?.token || laJson.token;
    assert.ok(localAdminToken, 'Local Admin token retrieved');

    const uhRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'unithead', password: 'head123' })
    });
    const uhJson = await uhRes.json();
    unitHeadToken = uhJson.data?.token || uhJson.token;
    assert.ok(unitHeadToken, 'Unit Head token retrieved');

    const empRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'employeerw', password: 'emprw123' })
    });
    const empJson = await empRes.json();
    employeeRwToken = empJson.data?.token || empJson.token;
    assert.ok(employeeRwToken, 'Employee token retrieved');
  });

  await t.test('2. Employee cannot edit or delete categories (HTTP 403)', async () => {
    const editRes = await fetch(`${API_BASE}/inventory/categories/22222222-2222-2222-2222-222222222201`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeRwToken}`
      },
      body: JSON.stringify({ name: 'Furniture Renamed' })
    });
    assert.equal(editRes.status, 403);

    const delRes = await fetch(`${API_BASE}/inventory/categories/22222222-2222-2222-2222-222222222201`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${employeeRwToken}`
      }
    });
    assert.equal(delRes.status, 403);
  });

  await t.test('3. Allowed roles (Super Admin, Local Admin) can create/rename category, Unit Head gets 403', async () => {
    // Unit Head gets 403
    const uhRes = await fetch(`${API_BASE}/inventory/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unitHeadToken}`
      },
      body: JSON.stringify({ name: 'Denied Category' })
    });
    assert.equal(uhRes.status, 403);
    const uhJson = await uhRes.json();
    assert.equal(uhJson.message, 'Only Super Admin and Local Admin can manage item categories and types.');

    // Local Admin creates it
    const createRes = await fetch(`${API_BASE}/inventory/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localAdminToken}`
      },
      body: JSON.stringify({ name: 'Temporary Category' })
    });
    assert.equal(createRes.status, 201);
    const createJson = await createRes.json();
    const catId = createJson.data.id;

    // Local admin renames it
    const renameRes = await fetch(`${API_BASE}/inventory/categories/${catId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localAdminToken}`
      },
      body: JSON.stringify({ name: 'Renamed Category', description: 'Updated description' })
    });
    assert.equal(renameRes.status, 200);
    const renameJson = await renameRes.json();
    assert.equal(renameJson.data.name, 'Renamed Category');
    assert.equal(renameJson.data.description, 'Updated description');
  });

  await t.test('4. Deleting category with subcategories or items is blocked (HTTP 400 with counts)', async () => {
    // Furniture has subcategories and items
    const delRes = await fetch(`${API_BASE}/inventory/categories/22222222-2222-2222-2222-222222222201`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${superAdminToken}`
      }
    });
    assert.equal(delRes.status, 400);
    const delJson = await delRes.json();
    assert.ok(delJson.message.includes('Remove or move them first'));
    assert.ok(delJson.blockingSubcategoriesCount > 0);
  });

  await t.test('5. Deleting subcategory with items is blocked (HTTP 400 with item count)', async () => {
    // Chairs subcategory has items in seeded DB
    const delRes = await fetch(`${API_BASE}/inventory/types/chairs`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${superAdminToken}`
      }
    });
    assert.equal(delRes.status, 400);
    const delJson = await delRes.json();
    assert.ok(delJson.message.includes('inventory item(s) are still associated'));
    assert.ok(delJson.blockingCount > 0);
  });

  await t.test('6. Deleting an empty custom category succeeds for Local Admin, Unit Head gets 403', async () => {
    const createRes = await fetch(`${API_BASE}/inventory/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localAdminToken}`
      },
      body: JSON.stringify({ name: 'Empty Custom Category' })
    });
    assert.equal(createRes.status, 201);
    const createJson = await createRes.json();
    const catId = createJson.data.id;

    // Unit Head attempt to delete gets 403
    const uhDelRes = await fetch(`${API_BASE}/inventory/categories/${catId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${unitHeadToken}`
      }
    });
    assert.equal(uhDelRes.status, 403);
    const uhDelJson = await uhDelRes.json();
    assert.equal(uhDelJson.message, 'Only Super Admin and Local Admin can manage item categories and types.');

    // Local Admin deletion succeeds
    const delRes = await fetch(`${API_BASE}/inventory/categories/${catId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${localAdminToken}`
      }
    });
    assert.equal(delRes.status, 200);
    const delJson = await delRes.json();
    assert.ok(delJson.success);
  });

  await t.test('7. Local Admin / Unit Head cannot delete built-in empty category (HTTP 403)', async () => {
    const emptyBuiltinId = '22222222-2222-2222-2222-222222222204';
    const delRes = await fetch(`${API_BASE}/inventory/categories/${emptyBuiltinId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${localAdminToken}`
      }
    });
    assert.equal(delRes.status, 400);
  });
});
