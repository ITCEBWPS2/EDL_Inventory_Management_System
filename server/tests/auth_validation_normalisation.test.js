const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const db = require('../src/services/db');
const { Profile } = require('../src/models');
const { runNormalization } = require('../src/scripts/normalize-profile-emails');

let server = null;
let API_BASE = '';

test('Auth Input Validation & Normalisation Test Suite', async (t) => {
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

  // Test 1: Login succeeds with email typed in uppercase, mixed-case, and with surrounding spaces
  await t.test('1. Login succeeds with email typed in uppercase, mixed case, and with surrounding spaces', async () => {
    // In seed data: unithead has email 'headit@edl.lk', password 'head123'
    const variations = [
      'HEADIT@EDL.LK',
      '  headit@edl.lk  ',
      '  HeadIt@EDL.lk  ',
      'headIT@edl.LK'
    ];

    for (const emailInput of variations) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: emailInput,
          password: 'head123'
        })
      });
      const data = await res.json();
      assert.equal(res.status, 200, `Failed for input: "${emailInput}"`);
      assert.equal(data.success, true);
      assert.ok(data.data?.token, 'Token not received');
      assert.equal(data.data?.user?.username, 'unithead');
    }
  });

  // Test 2: Username lookup is case-insensitive
  await t.test('2. Username lookup is case-insensitive', async () => {
    const variations = [
      'UNITHEAD',
      '  UnitHead  ',
      'uNiThEaD'
    ];

    for (const usernameInput of variations) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput,
          password: 'head123'
        })
      });
      const data = await res.json();
      assert.equal(res.status, 200, `Failed for username: "${usernameInput}"`);
      assert.equal(data.success, true);
      assert.equal(data.data?.user?.username, 'unithead');
    }
  });

  // Test 3: Wrong password and unknown user return the same generic error
  await t.test('3. Wrong password and unknown user return the same generic error', async () => {
    // Unknown user
    const resUnknown = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'nonexistent.user@edl.lk',
        password: 'anyPassword123'
      })
    });
    const dataUnknown = await resUnknown.json();
    assert.equal(resUnknown.status, 401);
    assert.equal(dataUnknown.success, false);
    assert.equal(dataUnknown.message, 'Incorrect username/email or password.');

    // Known user, wrong password
    const resWrongPass = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'unithead',
        password: 'wrongPassword!999'
      })
    });
    const dataWrongPass = await resWrongPass.json();
    assert.equal(resWrongPass.status, 401);
    assert.equal(dataWrongPass.success, false);
    assert.equal(dataWrongPass.message, 'Incorrect username/email or password.');

    // Both messages are strictly identical
    assert.equal(dataUnknown.message, dataWrongPass.message);
  });

  // Test 4: Malformed email returns 400
  await t.test('4. Malformed email returns 400 with field-specific message', async () => {
    const malformedEmails = [
      'not-an-email@',
      '@missing-local.com',
      'user@nodot',
      'user..name@domain.com',
      'user with space@domain.com',
      'user@domain..com'
    ];

    for (const badEmail of malformedEmails) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: badEmail,
          password: 'somePassword123'
        })
      });
      const data = await res.json();
      assert.equal(res.status, 400, `Expected 400 for bad email: "${badEmail}"`);
      assert.equal(data.success, false);
      assert.equal(data.message, 'Enter a valid email address, for example name@edl.lk.');
    }
  });

  // Test 5: Emails are stored lowercase
  await t.test('5. Emails are stored lowercase on create', async () => {
    const newProfile = await db.createProfile({
      username: 'TestStaffCase',
      full_name: 'Test Staff Case',
      email: 'Staff.User.TEST@EDL.LK',
      role: 'employee',
      password: 'password123'
    }, 'super_admin');

    assert.equal(newProfile.email, 'staff.user.test@edl.lk', 'Email was not lowercased');

    // Verify in raw MongoDB
    const doc = await Profile.findOne({ id: newProfile.id }).lean();
    assert.equal(doc.email, 'staff.user.test@edl.lk');
    assert.equal(doc.username, 'teststaffcase');
  });

  // Test 6: Creating "Name@EDL.lk" when "name@edl.lk" exists fails
  await t.test('6. Creating "Name@EDL.lk" when "name@edl.lk" exists fails', async () => {
    // Acquire superadmin auth token
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'superadmin',
        password: 'sadmin123'
      })
    });
    const loginData = await loginRes.json();
    const adminToken = loginData.data?.token;
    assert.ok(adminToken, 'Superadmin login failed');

    // Try creating user with duplicate email in different casing
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        username: 'another_user',
        full_name: 'Another User',
        email: 'STAFF.USER.TEST@EDL.LK', // already exists as staff.user.test@edl.lk
        role: 'employee',
        unit_id: '11111111-1111-1111-1111-111111111145',
        password: 'password123'
      })
    });
    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.equal(data.message, 'Email already in use.');
  });

  // Test 7: Normalisation script dry-run reports mixed-case rows without changing them
  await t.test('7. Normalisation script dry-run reports mixed-case rows without changing them', async () => {
    // Insert a profile directly with uppercase letters into DB to simulate legacy row
    const legacyId = '99999999-9999-9999-9999-999999999999';
    await Profile.collection.insertOne({
      id: legacyId,
      username: 'LegacyUserUPPER',
      full_name: 'Legacy Upper',
      email: '  Legacy.Upper@EDL.LK  ',
      role: 'employee',
      password_hash: '$2a$10$abc',
      account_status: 'active'
    });

    // Run dry-run (confirm: false)
    const result = await runNormalization({
      confirm: false,
      allowTestDb: true
    });

    assert.equal(result.applied, false, 'Dry run should not apply changes');
    assert.ok(result.candidatesCount >= 1, 'Should find at least 1 candidate needing normalisation');

    // Verify database row is STILL unmodified
    const checkDoc = await Profile.findOne({ id: legacyId }).lean();
    assert.equal(checkDoc.username, 'LegacyUserUPPER', 'Username was changed during dry-run!');
    assert.equal(checkDoc.email, '  Legacy.Upper@EDL.LK  ', 'Email was changed during dry-run!');

    // Clean up test document
    await Profile.deleteOne({ id: legacyId });
  });
});
