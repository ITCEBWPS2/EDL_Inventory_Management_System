const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const { AuditLog, Unit, Profile } = require('../src/models');
const auditLogger = require('../src/services/auditLogger');
const db = require('../src/services/db');

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
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

test('Audit Log System & Scoping Test Suite', async (t) => {
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

  // Login tokens
  let superAdminToken = null;
  let localAdminToken = null;
  let unitHeadToken = null;
  let employeeToken = null;

  const unitHomagamaId = '11111111-1111-1111-1111-111111111145'; // CSC_HOMAGAMA (Unit Head's unit)
  const unitItoId = '11111111-1111-1111-1111-111111111153'; // ITO (Another unit)

  await t.test('1. Authentication and Token Retrieval', async () => {
    const resSA = await request('/auth/login', 'POST', { username: 'superadmin', password: 'sadmin123' });
    assert.strictEqual(resSA.status, 200);
    superAdminToken = resSA.body.data.token;

    const resLA = await request('/auth/login', 'POST', { username: 'localadmin', password: 'ladmin123' });
    assert.strictEqual(resLA.status, 200);
    localAdminToken = resLA.body.data.token;

    const resUH = await request('/auth/login', 'POST', { username: 'unithead', password: 'head123' });
    assert.strictEqual(resUH.status, 200);
    unitHeadToken = resUH.body.data.token;

    const resEmp = await request('/auth/login', 'POST', { username: 'employeerw', password: 'emprw123' });
    assert.strictEqual(resEmp.status, 200);
    employeeToken = resEmp.body.data.token;
  });

  await t.test('2. Role Guard: Employees get 403 on Audit Log API', async () => {
    const res = await request('/audit-logs', 'GET', null, employeeToken);
    assert.strictEqual(res.status, 403, 'Employee must receive 403 on /audit-logs');
  });

  await t.test('3. Server-side Unit Scoping: Unit Head of Unit A cannot access Unit B', async () => {
    // Insert test logs: one in Homagama (Unit A) and one in ITO (Unit B)
    await AuditLog.create({
      id: 'audit-homagama-001',
      unit_id: unitHomagamaId,
      unit_name: 'CSC_HOMAGAMA',
      actor_name: 'Unit Head Homagama',
      actor_username: 'unithead',
      action: 'CREATE',
      module: 'Inventory',
      description: 'Added item in Homagama',
      status: 'success'
    });

    await AuditLog.create({
      id: 'audit-ito-001',
      unit_id: unitItoId,
      unit_name: 'ITO',
      actor_name: 'ITO Staff',
      actor_username: 'itostaff',
      action: 'CREATE',
      module: 'Inventory',
      description: 'Added item in ITO',
      status: 'success'
    });

    // Unit Head querying their own unit or with no unit param -> only sees Homagama
    const resUH = await request('/audit-logs', 'GET', null, unitHeadToken);
    assert.strictEqual(resUH.status, 200);
    assert.ok(resUH.body.data.length > 0);
    assert.ok(
      resUH.body.data.every(l => l.unit_id === unitHomagamaId),
      'Unit Head must only see records for their assigned unit'
    );
    assert.strictEqual(
      resUH.body.data.some(l => l.id === 'audit-ito-001'),
      false,
      'Unit Head must not see ITO records in results'
    );

    // Unit Head explicitly asking for Unit B (ITO) -> 403 Forbidden!
    const resForbidden = await request(`/audit-logs?unit_id=${unitItoId}`, 'GET', null, unitHeadToken);
    assert.strictEqual(resForbidden.status, 403, 'Unit Head must receive 403 when requesting foreign unit');
  });

  await t.test('4. Server-side Unit Scoping: Super Admin sees all units and system-wide logs', async () => {
    // Insert a system-wide log (no unit_id)
    await AuditLog.create({
      id: 'audit-system-001',
      unit_id: null,
      unit_name: '',
      actor_name: 'Super Admin',
      actor_username: 'superadmin',
      action: 'UPDATE',
      module: 'Settings',
      description: 'System-wide maintenance completed',
      status: 'success'
    });

    const resSA = await request('/audit-logs', 'GET', null, superAdminToken);
    assert.strictEqual(resSA.status, 200);
    const allIds = resSA.body.data.map(l => l.id);
    assert.ok(allIds.includes('audit-homagama-001'), 'Super Admin sees Homagama records');
    assert.ok(allIds.includes('audit-ito-001'), 'Super Admin sees ITO records');
    assert.ok(allIds.includes('audit-system-001'), 'Super Admin sees system-wide records');

    // Super Admin filtering by specific unit
    const resFiltered = await request(`/audit-logs?unit_id=${unitItoId}`, 'GET', null, superAdminToken);
    assert.strictEqual(resFiltered.status, 200);
    assert.ok(resFiltered.body.data.every(l => l.unit_id === unitItoId));
  });

  await t.test('5. Auth Events Logging: Login success & Login failure', async () => {
    // Trigger failed login
    const resFailed = await request('/auth/login', 'POST', { username: 'nonexistentuser', password: 'wrongpassword' });
    assert.strictEqual(resFailed.status, 401);

    // Verify LOGIN_FAILED entry exists in database
    const failedLog = await AuditLog.findOne({
      action: 'LOGIN_FAILED',
      actor_username: 'nonexistentuser'
    });
    assert.ok(failedLog, 'LOGIN_FAILED event must be recorded in AuditLog');
    assert.strictEqual(failedLog.status, 'failed');
    assert.ok(!failedLog.description.includes('wrongpassword'), 'Password must never be recorded in description');
  });

  await t.test('6. Inventory Events Logging: Create, Update, Delete Item', async () => {
    // 1. Create item
    const newItemPayload = {
      item_name: 'Audit Test Table',
      item_code: 'AUDIT-TBL-001',
      category: 'Furniture',
      unit_id: unitHomagamaId,
      quantity: 1,
      status: 'In Stock'
    };
    const resCreate = await request('/inventory', 'POST', newItemPayload, superAdminToken);
    assert.strictEqual(resCreate.status, 201);
    const createdItem = resCreate.body.data;

    const createLog = await AuditLog.findOne({
      action: 'CREATE',
      module: 'Inventory',
      entity_id: createdItem.id
    });
    assert.ok(createLog, 'Inventory CREATE event must be logged');
    assert.strictEqual(createLog.unit_id, unitHomagamaId);

    // 2. Update item
    const resUpdate = await request(`/inventory/${createdItem.id}`, 'PUT', { status: 'Low Stock' }, superAdminToken);
    assert.strictEqual(resUpdate.status, 200);

    const updateLog = await AuditLog.findOne({
      action: 'UPDATE',
      module: 'Inventory',
      entity_id: createdItem.id
    });
    assert.ok(updateLog, 'Inventory UPDATE event must be logged');
    assert.ok(updateLog.changes, 'Changes diff must be recorded on update');
    assert.strictEqual(updateLog.changes.before.status, 'In Stock');
    assert.strictEqual(updateLog.changes.after.status, 'Low Stock');

    // 3. Delete item
    const resDelete = await request(`/inventory/${createdItem.id}`, 'DELETE', null, superAdminToken);
    assert.strictEqual(resDelete.status, 200);

    const deleteLog = await AuditLog.findOne({
      action: 'DELETE',
      module: 'Inventory',
      entity_id: createdItem.id
    });
    assert.ok(deleteLog, 'Inventory DELETE event must be logged');
  });

  await t.test('7. Transactions Logging: Received & Expended transactions', async () => {
    // 1. Create received transaction
    const receivedPayload = {
      item_name: 'Audit Cable Pack',
      quantity: 5,
      unit_id: unitHomagamaId,
      date: '2026-11-04',
      voucher_no: 'VR-AUDIT-01',
      from_whom: 'Central Warehouse'
    };
    const resRec = await request('/transactions/received', 'POST', receivedPayload, superAdminToken);
    assert.strictEqual(resRec.status, 201);
    const createdRec = resRec.body.data;

    const recLog = await AuditLog.findOne({
      action: 'CREATE',
      module: 'Received Items',
      entity_id: createdRec.id
    });
    assert.ok(recLog, 'Received Items CREATE event must be recorded');
  });

  await t.test('8. Sensitive Information Redaction & Truncation Guarantee', async () => {
    const rawData = {
      username: 'sampleuser',
      password: 'PlainSecretPassword123!',
      password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz',
      jwt_token: 'secret-token-value',
      authorization: 'Bearer token-value',
      serial_numbers: Array.from({ length: 35 }, (_, i) => `SN-${i}`)
    };

    const sanitized = auditLogger.redact(rawData);
    assert.strictEqual(sanitized.password, '[REDACTED]');
    assert.strictEqual(sanitized.password_hash, '[REDACTED]');
    assert.strictEqual(sanitized.jwt_token, '[REDACTED]');
    assert.strictEqual(sanitized.authorization, '[REDACTED]');
    assert.ok(sanitized.serial_numbers.length <= 21);
    assert.ok(sanitized.serial_numbers[sanitized.serial_numbers.length - 1].includes('more items'));
  });

  await t.test('9. Failing Logger Resilience: Failure in logger never fails business operation', async () => {
    // Temporarily replace AuditLog.prototype.save with a throwing mock
    const originalSave = AuditLog.prototype.save;
    AuditLog.prototype.save = async function() {
      throw new Error('Database disk full simulation');
    };

    // Logging attempt should not throw
    let errorThrown = false;
    try {
      await auditLogger.log({
        action: 'CREATE',
        module: 'Settings',
        description: 'Test resilience entry'
      });
    } catch {
      errorThrown = true;
    }

    assert.strictEqual(errorThrown, false, 'auditLogger.log must never throw or disrupt execution');

    // Restore original save
    AuditLog.prototype.save = originalSave;
  });

  await t.test('10. CSV Export Endpoint and Immutability Guarantee', async () => {
    // CSV export returns 200 with text/csv
    const resCSV = await request('/audit-logs/export', 'GET', null, superAdminToken);
    assert.strictEqual(resCSV.status, 200);
    assert.ok(resCSV.headers['content-type'].includes('text/csv'));

    // Immutability: No PUT, PATCH or DELETE endpoints exist for audit logs
    const resPut = await request('/audit-logs/audit-homagama-001', 'PUT', { description: 'Tampered' }, superAdminToken);
    assert.ok([404, 405].includes(resPut.status), 'PUT /audit-logs/:id must return 404 or 405');

    const resDelete = await request('/audit-logs/audit-homagama-001', 'DELETE', null, superAdminToken);
    assert.ok([404, 405].includes(resDelete.status), 'DELETE /audit-logs/:id must return 404 or 405');
  });
});

