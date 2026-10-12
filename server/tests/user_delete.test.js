const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/server');
const db = require('../src/services/db');
const userController = require('../src/controllers/userController');
const { Profile, UserUnit, ReceivedTransaction } = require('../src/models');
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

test('User Delete Feature & Security Enforcement Tests', async (t) => {
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

  // Log in as Super Admin
  const superAdminLogin = await request('/auth/login', 'POST', {
    username: 'sadmin@edl.lk',
    password: 'sadmin123'
  });
  assert.equal(superAdminLogin.status, 200);
  const superAdminToken = superAdminLogin.body.data.token;
  const superAdminUser = superAdminLogin.body.data.user;

  // Log in as Local Admin
  const localAdminLogin = await request('/auth/login', 'POST', {
    username: 'ladmin@edl.lk',
    password: 'ladmin123'
  });
  assert.equal(localAdminLogin.status, 200);
  const localAdminToken = localAdminLogin.body.data.token;
  const localAdminUser = localAdminLogin.body.data.user;

  // Log in as Unit Head
  const unitHeadLogin = await request('/auth/login', 'POST', {
    username: 'headit@edl.lk',
    password: 'head123'
  });
  assert.equal(unitHeadLogin.status, 200);
  const unitHeadToken = unitHeadLogin.body.data.token;

  // Log in as Employee
  const employeeLogin = await request('/auth/login', 'POST', {
    username: 'emp.rw@edl.lk',
    password: 'emprw123'
  });
  assert.equal(employeeLogin.status, 200);
  const employeeToken = employeeLogin.body.data.token;

  await t.test('1. Delete success: Super Admin can delete an existing user', async () => {
    // Create a temporary user to delete
    const units = await db.getUnits();
    const leafUnit = units.find(u => u.unit_type !== 'area');

    const createRes = await request('/users', 'POST', {
      username: 'temp_to_delete',
      full_name: 'Temporary User',
      email: 'temp.delete@edl.lk',
      role: 'employee',
      permission_level: 'read_write',
      password: 'password123',
      unit_id: leafUnit.id
    }, superAdminToken);
    assert.equal(createRes.status, 201);
    const tempUserId = createRes.body.data.id;

    // Verify user exists in database
    const profileBefore = await db.getProfileById(tempUserId);
    assert.ok(profileBefore);

    // Super Admin deletes the user
    const deleteRes = await request(`/users/${tempUserId}`, 'DELETE', null, superAdminToken);
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.body.success, true);
    assert.equal(deleteRes.body.message, 'User deleted successfully.');

    // Verify user no longer exists in database
    const profileAfter = await db.getProfileById(tempUserId);
    assert.equal(profileAfter, null);
  });

  await t.test('2. Cannot delete self: Super Admin and Local Admin cannot delete their own account', async () => {
    // Super Admin attempts to delete own account
    const saDeleteSelf = await request(`/users/${superAdminUser.id}`, 'DELETE', null, superAdminToken);
    assert.equal(saDeleteSelf.status, 403);
    assert.equal(saDeleteSelf.body.success, false);
    assert.equal(saDeleteSelf.body.message, 'You cannot delete your own account.');

    // Local Admin attempts to delete own account
    const laDeleteSelf = await request(`/users/${localAdminUser.id}`, 'DELETE', null, localAdminToken);
    assert.equal(laDeleteSelf.status, 403);
    assert.equal(laDeleteSelf.body.success, false);
    assert.equal(laDeleteSelf.body.message, 'You cannot delete your own account.');
  });

  await t.test('3. Local Admin cannot delete Super Admin', async () => {
    const res = await request(`/users/${superAdminUser.id}`, 'DELETE', null, localAdminToken);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Local Admins cannot delete Super Admin accounts.');
  });

  await t.test('4. Cannot delete the last remaining Super Admin', async () => {
    // Currently only 1 Super Admin in DB
    const saCount = await db.countSuperAdmins();
    assert.equal(saCount, 1);

    // Call userController.deleteUser directly simulating a non-self call targeting the sole Super Admin
    let statusCode = null;
    let jsonBody = null;
    const mockRes = {
      status(c) { statusCode = c; return this; },
      json(b) { jsonBody = b; return this; }
    };
    const mockReq = {
      params: { id: superAdminUser.id },
      user: { id: '00000000-9999-9999-9999-000000000000', role: 'super_admin' }
    };

    await userController.deleteUser(mockReq, mockRes);
    assert.equal(statusCode, 400);
    assert.equal(jsonBody.success, false);
    assert.equal(jsonBody.message, 'Cannot delete the last remaining Super Admin account.');

    // Super Admin still exists in database
    const saStillExists = await db.getProfileById(superAdminUser.id);
    assert.ok(saStillExists);
  });

  await t.test('5. Employees and Unit Heads get 403 when attempting to delete a user', async () => {
    // Employee attempt
    const empDelete = await request(`/users/${localAdminUser.id}`, 'DELETE', null, employeeToken);
    assert.equal(empDelete.status, 403);

    // Unit Head attempt
    const uhDelete = await request(`/users/${localAdminUser.id}`, 'DELETE', null, unitHeadToken);
    assert.equal(uhDelete.status, 403);
  });

  await t.test('6. Deleted user token immediately gets 401 on subsequent requests', async () => {
    // Create an employee account
    const units = await db.getUnits();
    const leafUnit = units.find(u => u.unit_type !== 'area');

    const createRes = await request('/users', 'POST', {
      username: 'user_for_token_test',
      full_name: 'Token Test User',
      email: 'token.test@edl.lk',
      role: 'employee',
      permission_level: 'read_write',
      password: 'password123',
      unit_id: leafUnit.id
    }, superAdminToken);
    assert.equal(createRes.status, 201);
    const userId = createRes.body.data.id;

    // Log in as this user to get a valid JWT
    const loginRes = await request('/auth/login', 'POST', {
      username: 'user_for_token_test',
      password: 'password123'
    });
    assert.equal(loginRes.status, 200);
    const userJwt = loginRes.body.data.token;

    // Verify token works before deletion
    const beforeRes = await request('/auth/me', 'GET', null, userJwt);
    assert.equal(beforeRes.status, 200);
    assert.equal(beforeRes.body.data.user.username, 'user_for_token_test');

    // Super Admin deletes this user
    const deleteRes = await request(`/users/${userId}`, 'DELETE', null, superAdminToken);
    assert.equal(deleteRes.status, 200);

    // Now attempt to use the exact same JWT token
    const afterRes = await request('/auth/me', 'GET', null, userJwt);
    assert.equal(afterRes.status, 401);
    assert.equal(afterRes.body.success, false);
    assert.equal(afterRes.body.message, 'User profile not found.');
  });

  await t.test('7. Data integrity: user_units cleaned up, but created transactions remain intact', async () => {
    // Create a user with a unit
    const units = await db.getUnits();
    const leafUnit = units.find(u => u.unit_type !== 'area');

    const createRes = await request('/users', 'POST', {
      username: 'data_integrity_user',
      full_name: 'Integrity Test User',
      email: 'integrity.test@edl.lk',
      role: 'employee',
      permission_level: 'read_write',
      password: 'password123',
      unit_id: leafUnit.id
    }, superAdminToken);
    assert.equal(createRes.status, 201);
    const userId = createRes.body.data.id;

    // Verify user_units assigned
    const assignedUnitsBefore = await db.getUserUnits(userId);
    assert.equal(assignedUnitsBefore.length, 1);
    assert.equal(assignedUnitsBefore[0], leafUnit.id);

    const userUnitDocsBefore = await UserUnit.find({ user_id: userId });
    assert.equal(userUnitDocsBefore.length, 1);

    // User creates a transaction
    const tx = await db.createReceivedTransaction({
      item_name: 'Integrity Test Desk',
      category: 'Furniture',
      quantity: 5,
      unit_id: leafUnit.id,
      voucher_no: 'VR-INT-001',
      created_by: userId
    });
    assert.ok(tx.id);

    // Super Admin deletes the user
    const deleteRes = await request(`/users/${userId}`, 'DELETE', null, superAdminToken);
    assert.equal(deleteRes.status, 200);

    // 1. Verify user_units is cleaned up
    const assignedUnitsAfter = await db.getUserUnits(userId);
    assert.equal(assignedUnitsAfter.length, 0);

    const userUnitDocsAfter = await UserUnit.find({ user_id: userId });
    assert.equal(userUnitDocsAfter.length, 0);

    // 2. Verify created transaction is NOT deleted and still queries safely
    const txDoc = await ReceivedTransaction.findOne({ id: tx.id }).lean();
    assert.ok(txDoc);
    assert.equal(txDoc.created_by, userId);

    const txList = await db.getReceivedTransactions([leafUnit.id]);
    const foundTx = txList.find(t => t.id === tx.id);
    assert.ok(foundTx);
    assert.equal(foundTx.item_name, 'Integrity Test Desk');
    assert.equal(foundTx.created_by, userId);
  });

  await t.test('8. Returns 404 when trying to delete a non-existent user', async () => {
    const res = await request('/users/00000000-0000-0000-0000-000000000999', 'DELETE', null, superAdminToken);
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'User not found.');
  });
});
