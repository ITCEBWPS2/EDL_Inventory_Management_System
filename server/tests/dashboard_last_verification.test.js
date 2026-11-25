const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const { Verification, Unit } = require('../src/models');
const { v4: uuidv4 } = require('uuid');

let server = null;
let API_BASE = '';

test('Dashboard Last Verification Field Test Suite', async (t) => {
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
  let unitHeadToken = null;
  const homagamaUnitId = '11111111-1111-1111-1111-111111111145';
  const emptyUnitId = '11111111-1111-1111-1111-111111111161'; // Unit without verifications

  await t.test('1. Setup authentication tokens', async () => {
    // Super Admin login
    const sRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'superadmin', password: 'sadmin123' })
    });
    const sJson = await sRes.json();
    superAdminToken = sJson.data?.token || sJson.token;
    assert.ok(superAdminToken);

    // Unit Head login (Homagama CSC)
    const uRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'unithead', password: 'head123' })
    });
    const uJson = await uRes.json();
    unitHeadToken = uJson.data?.token || uJson.token;
    assert.ok(unitHeadToken);
  });

  await t.test('2. Dashboard returns last_verification for unit with confirmed records', async () => {
    const res = await fetch(`${API_BASE}/dashboard?unit_id=${homagamaUnitId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${unitHeadToken}` }
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(json.data.last_verification, 'Expected last_verification field to be present');
    assert.equal(typeof json.data.last_verification.date, 'string');
    assert.equal(json.data.last_verification.status, 'confirmed');
    assert.ok(Array.isArray(json.data.last_verification.verified_by));
    assert.ok(json.data.last_verification.unit_name);
  });

  await t.test('3. Draft verifications are strictly ignored in last_verification', async () => {
    // Insert a draft verification with a future date for Homagama CSC
    const futureDraftId = uuidv4();
    await Verification.create({
      id: futureDraftId,
      unit_id: homagamaUnitId,
      date: '2029-12-31',
      year: 2029,
      verifier_1: 'Draft Verifier',
      status: 'draft',
      summary: 'Open unconfirmed draft'
    });

    const res = await fetch(`${API_BASE}/dashboard?unit_id=${homagamaUnitId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${unitHeadToken}` }
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.ok(json.data.last_verification);
    // Must NOT be the future draft
    assert.notEqual(json.data.last_verification.id, futureDraftId);
    assert.notEqual(json.data.last_verification.date, '2029-12-31');
    assert.equal(json.data.last_verification.status, 'confirmed');
  });

  await t.test('4. Dashboard returns null for unit with no confirmed verifications', async () => {
    const res = await fetch(`${API_BASE}/dashboard?unit_id=${emptyUnitId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.last_verification, null, 'Expected last_verification to be null when no confirmed records exist');
  });

  await t.test('5. Global view (All Units) returns the latest confirmed verification across visible units', async () => {
    const res = await fetch(`${API_BASE}/dashboard`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.ok(json.data.last_verification);
    assert.equal(json.data.last_verification.status, 'confirmed');
    assert.ok(json.data.last_verification.unit_name, 'Expected unit_name on global verification view');
  });
});

