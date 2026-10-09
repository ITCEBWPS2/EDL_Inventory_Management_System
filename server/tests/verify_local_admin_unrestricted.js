const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/server');

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

test('Local Admin Unrestricted Location Access & Switcher Verification', async (t) => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      resolve();
    });
  });

  t.after(() => {
    if (server) server.close();
  });

  // 1. Authenticate as Local Admin
  const loginRes = await request('/auth/login', 'POST', {
    username: 'ladmin@edl.lk',
    password: 'ladmin123'
  });
  assert.equal(loginRes.status, 200, 'Local Admin login successful');
  const token = loginRes.body.data.token;
  assert.ok(token);

  // 2. Fetch all organizational units (Local Admin should see full system catalog)
  const unitsRes = await request('/units', 'GET', null, token);
  assert.equal(unitsRes.status, 200);
  const units = unitsRes.body.data;
  assert.ok(units.length >= 20, 'Local Admin receives all units system-wide');

  // 3. Fetch unit tree (used by Location Switcher Modal)
  const treeRes = await request('/units/tree', 'GET', null, token);
  assert.equal(treeRes.status, 200);
  const tree = treeRes.body.data;
  assert.ok(tree.length >= 1, 'Hierarchy root loaded');
  assert.equal(tree[0].unit_name, 'Electrical Distribution Lanka (Pvt) Ltd');

  // 4. Test querying a unit outside Local Admin previous scope: CALL CENTER & DCC
  const CALL_CENTER_DCC = '11111111-1111-1111-1111-111111111161';
  const invCallCenter = await request(`/inventory?unit_id=${CALL_CENTER_DCC}`, 'GET', null, token);
  assert.equal(invCallCenter.status, 200, 'Local Admin can access CALL CENTER & DCC inventory');

  // 5. Test querying another area: AREA AVISSAWELLA & CSC_AVISSAWELLA
  const CSC_AVISSAWELLA = '11111111-1111-1111-1111-111111111112';
  const invAvissawella = await request(`/inventory?unit_id=${CSC_AVISSAWELLA}`, 'GET', null, token);
  assert.equal(invAvissawella.status, 200, 'Local Admin can access Avissawella inventory');

  // 6. Test unscoped/global inventory query (Global / All Units mode)
  const invGlobal = await request('/inventory', 'GET', null, token);
  assert.equal(invGlobal.status, 200, 'Local Admin can access global inventory');
  assert.ok(invGlobal.body.data.length >= 10, 'Global inventory contains items from all units');

  // 7. Test transactions for unassigned unit
  const txReceived = await request(`/transactions/received?unit_id=${CALL_CENTER_DCC}`, 'GET', null, token);
  assert.equal(txReceived.status, 200, 'Local Admin can access received transactions for CALL CENTER & DCC');

  const txExpended = await request(`/transactions/expended?unit_id=${CALL_CENTER_DCC}`, 'GET', null, token);
  assert.equal(txExpended.status, 200, 'Local Admin can access expended transactions for CALL CENTER & DCC');

  const remaining = await request(`/transactions/remaining?unit_id=${CALL_CENTER_DCC}`, 'GET', null, token);
  assert.equal(remaining.status, 200, 'Local Admin can access remaining inventory for CALL CENTER & DCC');

  // 8. Test dashboard for unassigned unit and global
  const dashUnit = await request(`/dashboard?unit_id=${CALL_CENTER_DCC}`, 'GET', null, token);
  assert.equal(dashUnit.status, 200, 'Local Admin can view dashboard for unassigned unit');

  const dashGlobal = await request('/dashboard', 'GET', null, token);
  assert.equal(dashGlobal.status, 200, 'Local Admin can view global dashboard');

  // 9. Confirm that Unit Head and Employee are STILL restricted
  const headLogin = await request('/auth/login', 'POST', {
    username: 'headit@edl.lk',
    password: 'head123'
  });
  const headToken = headLogin.body.data.token;
  const headBlocked = await request(`/inventory?unit_id=${CALL_CENTER_DCC}`, 'GET', null, headToken);
  assert.equal(headBlocked.status, 403, 'Unit Head is STILL restricted and blocked with 403 on Call Center unit');

  const empLogin = await request('/auth/login', 'POST', {
    username: 'emp.rw@edl.lk',
    password: 'emprw123'
  });
  const empToken = empLogin.body.data.token;
  const empBlocked = await request(`/inventory?unit_id=${CALL_CENTER_DCC}`, 'GET', null, empToken);
  assert.equal(empBlocked.status, 403, 'Employee is STILL restricted and blocked with 403 on Call Center unit');

  console.log('✓ All Local Admin unrestricted access rules and Unit Head/Employee restrictions verified successfully!');
});
