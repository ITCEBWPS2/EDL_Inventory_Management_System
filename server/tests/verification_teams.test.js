const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const { mongoose } = require('../src/config/mongo');

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

test('Verification Teams API & Hierarchy Access Suite', async (t) => {
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

  // Login as Super Admin
  const adminLogin = await request('/auth/login', 'POST', {
    username: 'superadmin',
    password: 'sadmin123'
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.body.data.token;

  // Login as Employee without manage_verification_teams
  const empLogin = await request('/auth/login', 'POST', {
    username: 'employeero',
    password: 'empro123'
  });
  assert.equal(empLogin.status, 200);
  const empToken = empLogin.body.data.token;

  // Create a CE (Com) user profile in the database
  const bcrypt = require('bcryptjs');
  const ceComPasswordHash = await bcrypt.hash('cecom123', 10);
  await mongoose.connection.db.collection('profiles').insertOne({
    id: '00000000-0000-0000-0000-000000000099',
    username: 'cecom',
    full_name: 'Eng. K.L. Perera (CE Com WPS-II)',
    email: 'ce.com@edl.lk',
    role: 'employee',
    permission_level: 'read_write',
    permissions: {
      manage_verification_teams: true
    },
    password_hash: ceComPasswordHash,
    account_status: 'active'
  });

  // Login as CE (Com)
  const ceLogin = await request('/auth/login', 'POST', {
    username: 'cecom',
    password: 'cecom123'
  });
  assert.equal(ceLogin.status, 200);
  const ceToken = ceLogin.body.data.token;

  await t.test('1. Security check: Employee without permission gets 403 on /locations', async () => {
    const res = await request('/verification-teams/locations', 'GET', null, empToken);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  await t.test('2. Super Admin can access locations hierarchy and sees complete tree', async () => {
    const res = await request('/verification-teams/locations', 'GET', null, adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);

    // Root is EDL-HQ
    const root = res.body.data[0];
    assert.equal(root.code, 'EDL-HQ');
  });

  await t.test('3. CE (Com) can access locations hierarchy tree', async () => {
    const res = await request('/verification-teams/locations', 'GET', null, ceToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.length > 0);
  });

  await t.test('4. Security check: CE (Com) does NOT get User Management access (403 on /users)', async () => {
    const res = await request('/users', 'GET', null, ceToken);
    assert.equal(res.status, 403);
  });

  await t.test('5. Appointing team: CE (Com) saves 3 members for AMU-Avissawella', async () => {
    const saveRes = await request('/verification-teams', 'POST', {
      year: 2026,
      unit_id: '11111111-1111-1111-1111-111111111111',
      unit_name: 'AMU-Avissawella',
      unit_path: 'EDL > D3 > WPS-II > AREA AVISSAWELLA > AMU-Avissawella',
      members: [
        { name: 'K.D. Silva', designation: 'Storekeeper' },
        { name: 'P.M. Jayasinghe', designation: 'Electrical Superintendent' },
        { name: 'S.R. Fonseka', designation: 'Accountant' }
      ]
    }, ceToken);

    assert.equal(saveRes.status, 200);
    assert.equal(saveRes.body.success, true);
    assert.equal(saveRes.body.data.unit_name, 'AMU-Avissawella');
    assert.equal(saveRes.body.data.members.length, 3);
  });

  await t.test('6. Appointing team: CE (Com) saves 3 members for AREA HORANA (group node)', async () => {
    const saveRes = await request('/verification-teams', 'POST', {
      year: 2026,
      unit_id: '11111111-1111-1111-1111-111111111140',
      unit_name: 'AREA HORANA',
      unit_path: 'EDL > D3 > WPS-II > AREA HORANA',
      members: [
        { name: 'M.N. Fernando', designation: 'Area Electrical Engineer' },
        { name: 'T.H. Gunaratne', designation: 'Administrative Officer' },
        { name: 'A.B. Perera', designation: 'Accountant' }
      ]
    }, ceToken);

    assert.equal(saveRes.status, 200);
    assert.equal(saveRes.body.success, true);
    assert.equal(saveRes.body.data.unit_name, 'AREA HORANA');
    assert.equal(saveRes.body.data.members.length, 3);
  });

  await t.test('7. Validation check: Less than 3 members returns 400', async () => {
    const saveRes = await request('/verification-teams', 'POST', {
      year: 2026,
      unit_id: '11111111-1111-1111-1111-111111111153',
      unit_name: 'ITO',
      unit_path: 'EDL > D3 > WPS-II > ITO',
      members: [
        { name: 'Only One Member', designation: 'Tech' }
      ]
    }, ceToken);

    assert.equal(saveRes.status, 400);
    assert.equal(saveRes.body.success, false);
  });

  await t.test('8. Query teams: returns the 2 appointed teams for 2026', async () => {
    const listRes = await request('/verification-teams?year=2026', 'GET', null, ceToken);
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.success, true);
    assert.equal(listRes.body.data.length, 2);
  });
});
