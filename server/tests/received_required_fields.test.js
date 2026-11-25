const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const db = require('../src/services/db');

let server = null;
let API_BASE = '';

test('Received Items - Required Date and Sender Validation Test Suite', async (t) => {
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

  let authToken = null;
  const testUnitId = '11111111-1111-1111-1111-111111111145'; // Homagama CSC unit assigned to unithead

  await t.test('1. Setup authentication for unit head', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'unithead',
        password: 'head123'
      })
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    authToken = json.data?.token || json.token;
    assert.ok(authToken, 'Failed to acquire auth token');
  });

  await t.test('2. POST received record with NO date and NO sender -> 400 with both messages', async () => {
    const res = await fetch(`${API_BASE}/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        item_name: 'Test Computer Chair',
        quantity: 2,
        unit_id: testUnitId
        // date and from_whom omitted
      })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(Array.isArray(json.errors), 'Response should have errors array');
    assert.ok(json.errors.some(e => e.includes('Date is required')), 'Should contain "Date is required" error');
    assert.ok(json.errors.some(e => e.includes('From whom received is required')), 'Should contain "From whom received is required" error');
    assert.ok(json.message.includes('Date is required') && json.message.includes('From whom received is required'), 'Message should contain both');
  });

  await t.test('3. POST received record with ONLY date (missing sender) -> 400 with sender message', async () => {
    const res = await fetch(`${API_BASE}/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        item_name: 'Test Computer Chair',
        quantity: 2,
        unit_id: testUnitId,
        date: '2026-11-05'
        // from_whom omitted
      })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.errors.some(e => e.includes('From whom received is required')), 'Should contain sender required message');
    assert.ok(!json.errors.some(e => e.includes('Date is required')), 'Should not contain date error');
  });

  await t.test('4. POST received record with ONLY sender (missing date) -> 400 with date message', async () => {
    const res = await fetch(`${API_BASE}/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        item_name: 'Test Computer Chair',
        quantity: 2,
        unit_id: testUnitId,
        from_whom: 'Finco Furnitures'
        // date omitted
      })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.errors.some(e => e.includes('Date is required')), 'Should contain date required message');
    assert.ok(!json.errors.some(e => e.includes('From whom received is required')), 'Should not contain sender error');
  });

  await t.test('5. POST received record with invalid date string -> 400 with "Date is invalid"', async () => {
    const res = await fetch(`${API_BASE}/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        item_name: 'Test Computer Chair',
        quantity: 2,
        unit_id: testUnitId,
        date: 'not-a-valid-date',
        from_whom: 'Finco Furnitures'
      })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.errors.some(e => e.includes('Date is invalid')), 'Should contain "Date is invalid" error');
  });

  let createdRecordId = null;

  await t.test('6. POST received record with all required fields valid -> success (201)', async () => {
    const res = await fetch(`${API_BASE}/transactions/received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        item_name: 'Test Executive Desk',
        quantity: 3,
        unit_id: testUnitId,
        date: '2026-11-05',
        from_whom: '  Abans Lanka PLC  ',
        voucher_no: 'RV-TEST-001'
      })
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.from_whom, 'Abans Lanka PLC', 'Sender should be trimmed');
    assert.equal(json.data.date, '2026-11-05');
    createdRecordId = json.data.id;
    assert.ok(createdRecordId, 'Record ID should exist');
  });

  await t.test('7. PUT update received record with fields blanked -> 400', async () => {
    const res = await fetch(`${API_BASE}/transactions/received/${createdRecordId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        date: '   ',
        from_whom: ''
      })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.errors.some(e => e.includes('Date is required')), 'Should require date');
    assert.ok(json.errors.some(e => e.includes('From whom received is required')), 'Should require sender');
  });

  await t.test('8. PUT update received record with valid values -> success (200)', async () => {
    const res = await fetch(`${API_BASE}/transactions/received/${createdRecordId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        date: '2026-11-06',
        from_whom: '  Singer Sri Lanka  '
      })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.date, '2026-11-06');
    assert.equal(json.data.from_whom, 'Singer Sri Lanka');
  });

  await t.test('9. PUT update received record omitting date and sender keeps existing values -> success (200)', async () => {
    const res = await fetch(`${API_BASE}/transactions/received/${createdRecordId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        quantity: 5
        // date and from_whom omitted
      })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.quantity, 5);
    assert.equal(json.data.date, '2026-11-06', 'Should preserve existing date');
    assert.equal(json.data.from_whom, 'Singer Sri Lanka', 'Should preserve existing sender');
  });

  await t.test('10. PUT update old record that has NO date and NO sender -> 400 with both required messages', async () => {
    // Insert an old legacy record with empty date and empty sender directly in db
    const oldLegacy = await db.createReceivedTransaction({
      item_name: 'Old Legacy Received Item',
      quantity: 1,
      unit_id: testUnitId,
      date: '',
      from_whom: ''
    });

    const res = await fetch(`${API_BASE}/transactions/received/${oldLegacy.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        quantity: 2
        // date and from_whom omitted
      })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.errors.some(e => e.includes('Date is required')), 'Should require date to be completed on edit');
    assert.ok(json.errors.some(e => e.includes('From whom received is required')), 'Should require sender to be completed on edit');
  });
});
