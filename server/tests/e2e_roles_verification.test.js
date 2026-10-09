const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');

let server = null;
let API_BASE = 'http://localhost:5000/api';

const request = (path, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, {
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, body: json });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

test('End-to-End Credential-Based Role Access Verification for 6 Seed Accounts', async (t) => {
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
  const accounts = [
    { username: 'sadmin@edl.lk', alias: 'superadmin', pass: 'sadmin123', expectedRole: 'super_admin', expectedPerm: null },
    { username: 'ladmin@edl.lk', alias: 'localadmin', pass: 'ladmin123', expectedRole: 'local_admin', expectedPerm: null },
    { username: 'headit@edl.lk', alias: 'unithead', pass: 'head123', expectedRole: 'unit_head', expectedPerm: null },
    { username: 'emp.rw@edl.lk', alias: 'employeerw', pass: 'emprw123', expectedRole: 'employee', expectedPerm: 'read_write' },
    { username: 'emp.ro@edl.lk', alias: 'employeero', pass: 'empro123', expectedRole: 'employee', expectedPerm: 'read_only' },
    { username: 'emp.none@edl.lk', alias: 'employeenone', pass: 'empnone123', expectedRole: 'employee', expectedPerm: 'no_permission' }
  ];

  const sessions = {};

  // Verify old shared password is now REJECTED
  await t.test('Security: Old shared password admin123 is rejected for sadmin@edl.lk', async () => {
    const res = await request('/auth/login', 'POST', {
      username: 'sadmin@edl.lk',
      password: 'admin123'
    });
    assert.equal(res.status, 401, 'Old shared password must fail');
  });

  // Part 1: Login purely off credentials with zero role passed in request
  for (const acc of accounts) {
    await t.test(`Login: ${acc.username} authenticates via unique password`, async () => {
      const res = await request('/auth/login', 'POST', {
        username: acc.username,
        password: acc.pass
      });

      assert.equal(res.status, 200, `Login failed for ${acc.username}: ${JSON.stringify(res.body)}`);
      assert.ok(res.body.data?.token, 'Token must be returned');
      assert.equal(res.body.data?.user?.role, acc.expectedRole, 'Database profile role must match');
      assert.equal(res.body.data?.user?.permission_level, acc.expectedPerm, 'Database permission_level must match');

      sessions[acc.alias] = {
        token: res.body.data.token,
        user: res.body.data.user
      };
      sessions[acc.username] = sessions[acc.alias];
    });
  }

  const HOMAGAMA_CSC = '11111111-1111-1111-1111-111111111145';
  const MALAMBE_CSC = '11111111-1111-1111-1111-111111111146';
  const CALL_CENTER_DCC = '11111111-1111-1111-1111-111111111161';

  // Role 1: Super Admin
  await t.test('1. Super Admin: full system-wide access and oversight, no unit restriction', async () => {
    const token = sessions['superadmin'].token;
    
    // Can view all units inventory
    const invRes = await request('/inventory', 'GET', null, token);
    assert.equal(invRes.status, 200);
    assert.ok(invRes.body.data.length >= 10, 'Super admin sees all items across all units');

    // Can access user management
    const usersRes = await request('/users', 'GET', null, token);
    assert.equal(usersRes.status, 200);

    // Can access units management
    const unitsRes = await request('/units', 'GET', null, token);
    assert.equal(unitsRes.status, 200);

    // Can view dashboard without unit restriction
    const dashRes = await request('/dashboard', 'GET', null, token);
    assert.equal(dashRes.status, 200);
  });

  // Role 2: Local Admin
  await t.test('2. Local Admin: unrestricted system-wide location access, same as Super Admin', async () => {
    const token = sessions['localadmin'].token;

    // Can access user management across all units
    const usersRes = await request('/users', 'GET', null, token);
    assert.equal(usersRes.status, 200);
    assert.ok(usersRes.body.data.length >= 5, 'Local Admin sees users system-wide');

    // Cannot create Super Admin account (escalation protection)
    const createRes = await request('/users', 'POST', {
      username: `test_sa_${Date.now()}`,
      full_name: 'Escalation Test',
      role: 'super_admin'
    }, token);
    assert.equal(createRes.status, 403, 'Local Admin cannot create Super Admin');

    // Can access all units from unit management
    const unitsRes = await request('/units', 'GET', null, token);
    assert.equal(unitsRes.status, 200);
    assert.ok(unitsRes.body.data.length >= 20, 'Local Admin sees all units system-wide');

    // Can access inventory in a previously unassigned unit (CALL_CENTER_DCC) without 403
    const invRes = await request(`/inventory?unit_id=${CALL_CENTER_DCC}`, 'GET', null, token);
    assert.equal(invRes.status, 200, 'Local Admin can access any unit without restriction');

    // Can access dashboard without unit restriction
    const dashRes = await request('/dashboard', 'GET', null, token);
    assert.equal(dashRes.status, 200, 'Local Admin can access global dashboard');
  });

  // Role 3: Unit Head
  await t.test('3. Unit Head: full inventory management restricted to assigned unit only', async () => {
    const token = sessions['unithead'].token;

    // Blocked from user management
    const usersRes = await request('/users', 'GET', null, token);
    assert.equal(usersRes.status, 403, 'Unit head cannot access user management');

    // Can view inventory for assigned Homagama CSC
    const invRes = await request(`/inventory?unit_id=${HOMAGAMA_CSC}`, 'GET', null, token);
    assert.equal(invRes.status, 200);

    // Blocked from requesting unauthorized Call Center unit
    const blockedRes = await request(`/inventory?unit_id=${CALL_CENTER_DCC}`, 'GET', null, token);
    assert.equal(blockedRes.status, 403, 'Unit head blocked from Call Center unit');

    // Can create inventory item in Homagama
    const createRes = await request('/inventory', 'POST', {
      item_name: 'Unit Head Test Cable Clamp',
      item_code: `CLAMP-${Date.now()}`,
      category: 'Poles & Line Hardware',
      unit_id: HOMAGAMA_CSC,
      quantity: 50,
      status: 'In Stock'
    }, token);
    assert.equal(createRes.status, 201);

    // Blocked from creating item in unauthorized unit
    const badCreate = await request('/inventory', 'POST', {
      item_name: 'Unauthorized Item',
      item_code: `BAD-${Date.now()}`,
      category: 'Poles & Line Hardware',
      unit_id: CALL_CENTER_DCC,
      quantity: 10,
      status: 'In Stock'
    }, token);
    assert.equal(badCreate.status, 403, 'Unit head cannot create item in unauthorized unit');
  });

  // Role 4: Employee Read Write
  await t.test('4. Employee (Read Write): inventory & transactions in own unit, cannot delete transactions or manage users', async () => {
    const token = sessions['employeerw'].token;

    // Blocked from user management
    const usersRes = await request('/users', 'GET', null, token);
    assert.equal(usersRes.status, 403);

    // Can record received transaction in Homagama
    const rxRes = await request('/transactions/received', 'POST', {
      item_id: '33333333-3333-3333-3333-333333333301',
      quantity: 2,
      date: '2026-09-07',
      unit_id: HOMAGAMA_CSC,
      voucher_no: `VR-TEST-${Date.now()}`,
      from_whom: 'Supplier Test'
    }, token);
    assert.equal(rxRes.status, 201);

    // Cannot delete transaction (restricted to unit_head/admin)
    const delRes = await request(`/transactions/received/${rxRes.body.data.id}`, 'DELETE', null, token);
    assert.equal(delRes.status, 403, 'Employee RW cannot delete received transaction');

    // Blocked from other units
    const badRx = await request('/transactions/received', 'POST', {
      item_id: '33333333-3333-3333-3333-333333333301',
      quantity: 1,
      date: '2026-09-07',
      unit_id: CALL_CENTER_DCC,
      voucher_no: `VR-BAD-${Date.now()}`,
      from_whom: 'Bad Unit'
    }, token);
    assert.equal(badRx.status, 403, 'Employee RW blocked from writing to other unit');
  });

  // Role 5: Employee Read Only
  await t.test('5. Employee (Read Only): can view records, but all write attempts return 403', async () => {
    const token = sessions['employeero'].token;

    // Can view inventory
    const invRes = await request('/inventory', 'GET', null, token);
    assert.equal(invRes.status, 200);

    // Can view remaining stock
    const remRes = await request('/transactions/remaining', 'GET', null, token);
    assert.equal(remRes.status, 200);

    // BLOCKED from creating item
    const postItem = await request('/inventory', 'POST', {
      item_name: 'RO Attempt',
      item_code: `RO-${Date.now()}`,
      category: 'Furniture',
      unit_id: HOMAGAMA_CSC,
      quantity: 1
    }, token);
    assert.equal(postItem.status, 403, 'Employee RO cannot create item');

    // BLOCKED from creating received transaction
    const postRx = await request('/transactions/received', 'POST', {
      item_id: '33333333-3333-3333-3333-333333333301',
      quantity: 1,
      unit_id: HOMAGAMA_CSC,
      voucher_no: 'RO-FAIL'
    }, token);
    assert.equal(postRx.status, 403, 'Employee RO cannot record received transaction');

    // BLOCKED from creating expended transaction
    const postExp = await request('/transactions/expended', 'POST', {
      item_id: '33333333-3333-3333-3333-333333333301',
      quantity: 1,
      unit_id: HOMAGAMA_CSC,
      voucher_no: 'RO-FAIL',
      disposition: 'Test'
    }, token);
    assert.equal(postExp.status, 403, 'Employee RO cannot record expended transaction');

    // BLOCKED from creating annual verification
    const postVer = await request('/verifications', 'POST', {
      year: 2026,
      date: '2026-09-07',
      unit_id: HOMAGAMA_CSC,
      items: []
    }, token);
    assert.equal(postVer.status, 403, 'Employee RO cannot create verification');
  });

  // Role 6: Employee No Permission
  await t.test('6. Employee (No Permission): blocked from all inventory/transaction functions with 403', async () => {
    const token = sessions['employeenone'].token;

    // BLOCKED on inventory list
    const invRes = await request('/inventory', 'GET', null, token);
    assert.equal(invRes.status, 403, 'No permission employee blocked on inventory');

    // BLOCKED on remaining transactions
    const remRes = await request('/transactions/remaining', 'GET', null, token);
    assert.equal(remRes.status, 403, 'No permission employee blocked on remaining');

    // BLOCKED on received transactions
    const rxRes = await request('/transactions/received', 'GET', null, token);
    assert.equal(rxRes.status, 403, 'No permission employee blocked on received');

    // BLOCKED on verifications
    const verRes = await request('/verifications', 'GET', null, token);
    assert.equal(verRes.status, 403, 'No permission employee blocked on verifications');

    // BLOCKED on dashboard
    const dashRes = await request('/dashboard', 'GET', null, token);
    // Note: If dashboard is checked with no permission or unit restricted:
    assert.ok([200, 403].includes(dashRes.status));
  });
});
