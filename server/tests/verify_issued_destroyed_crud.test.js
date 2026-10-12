const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const app = require('../src/server');
const db = require('../src/services/db');

let server;
let baseUrl;

function request(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const req = http.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

test('Issued / Destroyed Endpoints Full CRUD and Scoping Verification', async (t) => {
  await setupTestDb();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      resolve();
    });
  });

  t.after(async () => {
    if (server) server.close();
    await teardownTestDb();
  });

  // Login as Super Admin, Unit Head (Homagama), and Read-Only Employee
  const sadminLogin = await request('/auth/login', 'POST', { username: 'sadmin@edl.lk', password: 'sadmin123' });
  const sadminToken = sadminLogin.body.data.token;

  const headLogin = await request('/auth/login', 'POST', { username: 'headit@edl.lk', password: 'head123' });
  const headToken = headLogin.body.data.token;

  const roLogin = await request('/auth/login', 'POST', { username: 'emp.ro@edl.lk', password: 'empro123' });
  const roToken = roLogin.body.data.token;

  const homagamaUnit = '11111111-1111-1111-1111-111111111145';
  const callCenterUnit = '11111111-1111-1111-1111-111111111161';

  // 1. Get initial inventory item to write off
  const itemsRes = await request(`/inventory?unit_id=${homagamaUnit}`, 'GET', null, sadminToken);
  assert.equal(itemsRes.status, 200);
  const testItem = itemsRes.body.data[0];
  assert.ok(testItem, 'Found inventory item in Homagama');
  const initialQty = Number(testItem.quantity);

  // 2. List GET /api/verifications/issued-destroyed
  const listRes = await request('/verifications/issued-destroyed', 'GET', null, sadminToken);
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body.data));

  // 3. Create POST /api/verifications/issued-destroyed
  const createPayload = {
    item_id: testItem.id,
    serial_number: testItem.item_code,
    quantity: 1,
    disposition: 'Destroyed',
    reason: 'Damaged by lightning strike',
    date: '2026-10-09'
  };
  const createRes = await request('/verifications/issued-destroyed', 'POST', createPayload, sadminToken);
  assert.equal(createRes.status, 201);
  const createdRecord = createRes.body.data;
  assert.ok(createdRecord.id);
  assert.equal(createdRecord.disposition, 'Destroyed');
  assert.equal(createdRecord.serial_number, testItem.item_code);
  assert.equal(createdRecord.item_name, testItem.item_name);

  // Verify item quantity deducted
  const itemAfterCreate = await db.getInventoryItemById(testItem.id);
  assert.equal(itemAfterCreate.quantity, initialQty - 1);

  // 4. Get by ID GET /api/verifications/issued-destroyed/:id
  const getByIdRes = await request(`/verifications/issued-destroyed/${createdRecord.id}`, 'GET', null, sadminToken);
  assert.equal(getByIdRes.status, 200);
  assert.equal(getByIdRes.body.data.id, createdRecord.id);
  assert.equal(getByIdRes.body.data.serial_number, testItem.item_code);

  // 5. Update PUT /api/verifications/issued-destroyed/:id
  const updatePayload = {
    quantity: 2,
    disposition: 'Issued',
    reason: 'Reassigned as spare unit'
  };
  const updateRes = await request(`/verifications/issued-destroyed/${createdRecord.id}`, 'PUT', updatePayload, sadminToken);
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.quantity, 2);
  assert.equal(updateRes.body.data.disposition, 'Issued');

  // Verify item quantity adjusted for 2 units
  const itemAfterUpdate = await db.getInventoryItemById(testItem.id);
  assert.equal(itemAfterUpdate.quantity, initialQty - 2);

  // 6. Unit-based access check: Unit Head can access Homagama record, but blocked on unassigned Call Center record
  const uhAccessOwn = await request(`/verifications/issued-destroyed/${createdRecord.id}`, 'GET', null, headToken);
  assert.equal(uhAccessOwn.status, 200);

  // Create an item in call center
  const callCenterItem = await db.createInventoryItem({
    item_name: 'Call Center Router',
    item_code: 'CALL-RTR-001',
    category: 'Network & Communication Equipment',
    unit_id: callCenterUnit,
    quantity: 5
  });
  const callCenterRecord = await db.createIssuedDestroyedItem({
    item_id: callCenterItem.id,
    quantity: 1,
    disposition: 'Destroyed',
    date: '2026-10-09'
  });

  // Unit Head attempting to GET / PUT / DELETE Call Center record -> 403
  const uhGetBlocked = await request(`/verifications/issued-destroyed/${callCenterRecord.id}`, 'GET', null, headToken);
  assert.equal(uhGetBlocked.status, 403);
  const uhPutBlocked = await request(`/verifications/issued-destroyed/${callCenterRecord.id}`, 'PUT', { quantity: 1 }, headToken);
  assert.equal(uhPutBlocked.status, 403);
  const uhDelBlocked = await request(`/verifications/issued-destroyed/${callCenterRecord.id}`, 'DELETE', null, headToken);
  assert.equal(uhDelBlocked.status, 403);

  // 7. Permission check: Read-only employee cannot POST, PUT, DELETE
  const roPostBlocked = await request('/verifications/issued-destroyed', 'POST', createPayload, roToken);
  assert.equal(roPostBlocked.status, 403);
  const roPutBlocked = await request(`/verifications/issued-destroyed/${createdRecord.id}`, 'PUT', updatePayload, roToken);
  assert.equal(roPutBlocked.status, 403);
  const roDelBlocked = await request(`/verifications/issued-destroyed/${createdRecord.id}`, 'DELETE', null, roToken);
  assert.equal(roDelBlocked.status, 403);

  // 8. Delete DELETE /api/verifications/issued-destroyed/:id
  const deleteRes = await request(`/verifications/issued-destroyed/${createdRecord.id}`, 'DELETE', null, sadminToken);
  assert.equal(deleteRes.status, 200);

  // Verify item quantity restored back to initialQty
  const itemAfterDelete = await db.getInventoryItemById(testItem.id);
  assert.equal(itemAfterDelete.quantity, initialQty);

  // Verify record no longer exists (404)
  const getDeletedRes = await request(`/verifications/issued-destroyed/${createdRecord.id}`, 'GET', null, sadminToken);
  assert.equal(getDeletedRes.status, 404);
});
