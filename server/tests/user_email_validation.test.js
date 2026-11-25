const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/server');
const db = require('../src/services/db');
const { Profile } = require('../src/models');
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

test('User Email Mandatory & Validation Enforcement Tests', async (t) => {
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

  const units = await db.getUnits();
  const targetUnit = units.find(u => u.unit_type !== 'area');

  await t.test('1. Create without email returns 400 "Email address is required."', async () => {
    // Completely omitted email
    const resOmitted = await request('/users', 'POST', {
      username: 'no_email_user_1',
      full_name: 'No Email User One',
      role: 'employee',
      permission_level: 'read_write',
      password: 'password123',
      unit_id: targetUnit.id
    }, superAdminToken);

    assert.equal(resOmitted.status, 400);
    assert.equal(resOmitted.body.success, false);
    assert.equal(resOmitted.body.message, 'Email address is required.');

    // Empty string email
    const resEmpty = await request('/users', 'POST', {
      username: 'no_email_user_2',
      full_name: 'No Email User Two',
      email: '',
      role: 'employee',
      permission_level: 'read_write',
      password: 'password123',
      unit_id: targetUnit.id
    }, superAdminToken);

    assert.equal(resEmpty.status, 400);
    assert.equal(resEmpty.body.success, false);
    assert.equal(resEmpty.body.message, 'Email address is required.');

    // Whitespace only email
    const resWhitespace = await request('/users', 'POST', {
      username: 'no_email_user_3',
      full_name: 'No Email User Three',
      email: '   ',
      role: 'employee',
      permission_level: 'read_write',
      password: 'password123',
      unit_id: targetUnit.id
    }, superAdminToken);

    assert.equal(resWhitespace.status, 400);
    assert.equal(resWhitespace.body.success, false);
    assert.equal(resWhitespace.body.message, 'Email address is required.');
  });

  await t.test('2. Create with invalid email returns 400 format error', async () => {
    const invalidEmails = [
      'plainaddress',
      'missingatsign.com',
      '@missinguser.com',
      'user@missingdomain',
      'user@.com',
      'user@domain..com'
    ];

    for (const badEmail of invalidEmails) {
      const res = await request('/users', 'POST', {
        username: `bad_email_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        full_name: 'Invalid Email User',
        email: badEmail,
        role: 'employee',
        permission_level: 'read_write',
        password: 'password123',
        unit_id: targetUnit.id
      }, superAdminToken);

      assert.equal(res.status, 400, `Failed to reject invalid email: ${badEmail}`);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Enter a valid email address, for example name@edl.lk.');
    }
  });

  await t.test('2b. Create with non-EDL domain returns 400 corporate domain error', async () => {
    const nonEdlEmails = [
      'user@gmail.com',
      'admin@yahoo.com',
      'staff@hotmail.com',
      'test@edl.com',
      'fake@edl.org'
    ];

    for (const badEmail of nonEdlEmails) {
      const res = await request('/users', 'POST', {
        username: `non_edl_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        full_name: 'Non EDL Email User',
        email: badEmail,
        role: 'employee',
        permission_level: 'read_write',
        password: 'password123',
        unit_id: targetUnit.id
      }, superAdminToken);

      assert.equal(res.status, 400, `Failed to reject non-EDL email: ${badEmail}`);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Enter a valid EDL corporate email address ending in @edl.lk (e.g. name@edl.lk).');
    }
  });

  await t.test('3. Create with valid email returns 201 and saves exact entered email (not auto-generated)', async () => {
    const enteredEmail = '  Manually.Entered.Staff@edl.lk  ';
    const expectedNormalized = 'manually.entered.staff@edl.lk';

    const res = await request('/users', 'POST', {
      username: 'manual_email_staff',
      full_name: 'Manual Email Staff Member',
      email: enteredEmail,
      role: 'employee',
      permission_level: 'read_write',
      password: 'password123',
      unit_id: targetUnit.id
    }, superAdminToken);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.email, expectedNormalized);

    // Verify in database that it was saved with exact normalized email, not username@edl.lk
    const saved = await db.getProfileById(res.body.data.id);
    assert.ok(saved);
    assert.equal(saved.email, expectedNormalized);
    assert.notEqual(saved.email, 'manual_email_staff@edl.lk');
  });

  await t.test('4. Duplicate email returns 400 "Email already in use."', async () => {
    // Attempt to create user with an email already taken by seed Super Admin
    const resExisting = await request('/users', 'POST', {
      username: 'duplicate_email_user',
      full_name: 'Duplicate Email User',
      email: 'sadmin@edl.lk', // Already taken
      role: 'employee',
      permission_level: 'read_write',
      password: 'password123',
      unit_id: targetUnit.id
    }, superAdminToken);

    assert.equal(resExisting.status, 400);
    assert.equal(resExisting.body.success, false);
    assert.equal(resExisting.body.message, 'Email already in use.');

    // Case-insensitive duplicate check
    const resCaseInsensitive = await request('/users', 'POST', {
      username: 'duplicate_case_user',
      full_name: 'Duplicate Case User',
      email: 'SADMIN@EDL.LK',
      role: 'employee',
      permission_level: 'read_write',
      password: 'password123',
      unit_id: targetUnit.id
    }, superAdminToken);

    assert.equal(resCaseInsensitive.status, 400);
    assert.equal(resCaseInsensitive.body.success, false);
    assert.equal(resCaseInsensitive.body.message, 'Email already in use.');
  });

  await t.test('5. Update keeps a valid email, normalizes it, and allows keeping own email', async () => {
    // Create a user to test updates
    const createRes = await request('/users', 'POST', {
      username: 'update_target_user',
      full_name: 'Update Target User',
      email: 'target.before@edl.lk',
      role: 'employee',
      permission_level: 'read_write',
      password: 'password123',
      unit_id: targetUnit.id
    }, superAdminToken);
    assert.equal(createRes.status, 201);
    const userId = createRes.body.data.id;

    // 1. Updating with own existing email should succeed (not treated as duplicate)
    const updateOwnRes = await request(`/users/${userId}`, 'PUT', {
      full_name: 'Updated Name Same Email',
      email: 'target.before@edl.lk',
      role: 'employee',
      permission_level: 'read_write',
      unit_id: targetUnit.id
    }, superAdminToken);
    assert.equal(updateOwnRes.status, 200);
    assert.equal(updateOwnRes.body.data.email, 'target.before@edl.lk');

    // 2. Updating with new valid email (with uppercase & spaces to verify normalization)
    const updateNewRes = await request(`/users/${userId}`, 'PUT', {
      full_name: 'Updated Name New Email',
      email: '  TARGET.AFTER@EDL.LK  ',
      role: 'employee',
      permission_level: 'read_write',
      unit_id: targetUnit.id
    }, superAdminToken);
    assert.equal(updateNewRes.status, 200);
    assert.equal(updateNewRes.body.data.email, 'target.after@edl.lk');

    const inDb = await db.getProfileById(userId);
    assert.equal(inDb.email, 'target.after@edl.lk');

    // 3. Attempting to update to another user's email fails with duplicate error
    const updateDupRes = await request(`/users/${userId}`, 'PUT', {
      full_name: 'Hacker Attempt',
      email: 'sadmin@edl.lk', // Belongs to superadmin
      role: 'employee',
      permission_level: 'read_write',
      unit_id: targetUnit.id
    }, superAdminToken);
    assert.equal(updateDupRes.status, 400);
    assert.equal(updateDupRes.body.success, false);
    assert.equal(updateDupRes.body.message, 'Email already in use.');
  });

  await t.test('6. Update with empty or invalid email returns 400', async () => {
    // Create a user
    const createRes = await request('/users', 'POST', {
      username: 'empty_update_target',
      full_name: 'Empty Target',
      email: 'empty.target@edl.lk',
      role: 'employee',
      permission_level: 'read_write',
      password: 'password123',
      unit_id: targetUnit.id
    }, superAdminToken);
    assert.equal(createRes.status, 201);
    const userId = createRes.body.data.id;

    // Empty string email
    const emptyRes = await request(`/users/${userId}`, 'PUT', {
      full_name: 'Empty Target Updated',
      email: '',
      role: 'employee',
      permission_level: 'read_write',
      unit_id: targetUnit.id
    }, superAdminToken);
    assert.equal(emptyRes.status, 400);
    assert.equal(emptyRes.body.success, false);
    assert.equal(emptyRes.body.message, 'Email address is required.');

    // Whitespace only email
    const whitespaceRes = await request(`/users/${userId}`, 'PUT', {
      full_name: 'Whitespace Target Updated',
      email: '   ',
      role: 'employee',
      permission_level: 'read_write',
      unit_id: targetUnit.id
    }, superAdminToken);
    assert.equal(whitespaceRes.status, 400);
    assert.equal(whitespaceRes.body.success, false);
    assert.equal(whitespaceRes.body.message, 'Email address is required.');

    // Invalid format email
    const invalidRes = await request(`/users/${userId}`, 'PUT', {
      full_name: 'Invalid Target Updated',
      email: 'not-an-email-format',
      role: 'employee',
      permission_level: 'read_write',
      unit_id: targetUnit.id
    }, superAdminToken);
    assert.equal(invalidRes.status, 400);
    assert.equal(invalidRes.body.success, false);
    assert.equal(invalidRes.body.message, 'Enter a valid email address, for example name@edl.lk.');

    // Non-EDL domain email
    const nonEdlRes = await request(`/users/${userId}`, 'PUT', {
      full_name: 'Non EDL Target Updated',
      email: 'user@gmail.com',
      role: 'employee',
      permission_level: 'read_write',
      unit_id: targetUnit.id
    }, superAdminToken);
    assert.equal(nonEdlRes.status, 400);
    assert.equal(nonEdlRes.body.success, false);
    assert.equal(nonEdlRes.body.message, 'Enter a valid EDL corporate email address ending in @edl.lk (e.g. name@edl.lk).');
  });
});
