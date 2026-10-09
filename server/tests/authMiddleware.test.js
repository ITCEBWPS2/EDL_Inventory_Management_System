const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const db = require('../src/services/db');
const { setupTestDb, teardownTestDb } = require('./testHelper');

test.before(async () => {
  await setupTestDb();
});

test.after(async () => {
  await teardownTestDb();
});

// Test tokens
const createToken = (userId, role, permission_level) => {
  return jwt.sign(
    { sub: userId, id: userId, role, permission_level },
    env.JWT_DEV_FALLBACK_SECRET,
    { expiresIn: '1h' }
  );
};

test('Security & Access Control Enforcement Tests', async (t) => {
  const superAdminToken = createToken('00000000-0000-0000-0000-000000000001', 'super_admin', null);
  const localAdminToken = createToken('00000000-0000-0000-0000-000000000002', 'local_admin', null);
  const unitHeadToken = createToken('00000000-0000-0000-0000-000000000003', 'unit_head', null);
  const employeeRwToken = createToken('00000000-0000-0000-0000-000000000004', 'employee', 'read_write');
  const employeeRoToken = createToken('00000000-0000-0000-0000-000000000005', 'employee', 'read_only');
  const employeeNoneToken = createToken('00000000-0000-0000-0000-000000000006', 'employee', 'no_permission');

  const requireAuth = require('../src/middleware/requireAuth');
  const requireRole = require('../src/middleware/requireRole');
  const requirePermission = require('../src/middleware/requirePermission');
  const requireUnitAccess = require('../src/middleware/requireUnitAccess');

  await t.test('requireAuth: blocks requests without token', async () => {
    const req = { headers: {} };
    let status = null;
    let json = null;
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => { json = j; }
    };
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });
    assert.equal(status, 401);
    assert.equal(nextCalled, false);
  });

  await t.test('requireAuth: accepts valid token and populates req.user and unitIds', async () => {
    const req = { headers: { authorization: `Bearer ${employeeRwToken}` } };
    const res = {};
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.username, 'employeerw');
    assert.equal(req.user.role, 'employee');
    assert.equal(req.user.permission_level, 'read_write');
    assert.ok(req.user.unitIds.includes('11111111-1111-1111-1111-111111111145'));
  });

  await t.test('requirePermission: blocks read_only employee on write operation with 403', () => {
    const req = {
      user: { role: 'employee', permission_level: 'read_only' }
    };
    let status = null;
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => {}
    };
    let nextCalled = false;

    requirePermission(['read_write'])(req, res, () => { nextCalled = true; });
    assert.equal(status, 403);
    assert.equal(nextCalled, false);
  });

  await t.test('requirePermission: blocks no_permission employee from all inventory with 403', () => {
    const req = {
      user: { role: 'employee', permission_level: 'no_permission' }
    };
    let status = null;
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => {}
    };
    let nextCalled = false;

    requirePermission(['read_only', 'read_write'])(req, res, () => { nextCalled = true; });
    assert.equal(status, 403);
    assert.equal(nextCalled, false);
  });

  await t.test('requirePermission: allows read_write employee on write operation', () => {
    const req = {
      user: { role: 'employee', permission_level: 'read_write' }
    };
    let nextCalled = false;
    requirePermission(['read_write'])(req, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  await t.test('requireUnitAccess: blocks employee of Unit A requesting Unit B with 403', () => {
    const req = {
      user: { role: 'employee', unitIds: ['11111111-1111-1111-1111-111111111145'] }, // Homagama CSC
      params: { unitId: '11111111-1111-1111-1111-111111111161' } // Call Center & DCC
    };
    let status = null;
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => {}
    };
    let nextCalled = false;

    requireUnitAccess()(req, res, () => { nextCalled = true; });
    assert.equal(status, 403);
    assert.equal(nextCalled, false);
  });

  await t.test('requireUnitAccess: allows employee on their assigned unit', () => {
    const req = {
      user: { role: 'employee', unitIds: ['11111111-1111-1111-1111-111111111145'] },
      params: { unitId: '11111111-1111-1111-1111-111111111145' }
    };
    let nextCalled = false;
    requireUnitAccess()(req, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  await t.test('requireUnitAccess: allows Super Admin across all units', () => {
    const req = {
      user: { role: 'super_admin', unitIds: [] },
      params: { unitId: '11111111-1111-1111-1111-111111111161' }
    };
    let nextCalled = false;
    requireUnitAccess()(req, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  await t.test('requireUnitAccess: allows Local Admin across all units', () => {
    const req = {
      user: { role: 'local_admin', unitIds: ['11111111-1111-1111-1111-111111111145'] },
      params: { unitId: '11111111-1111-1111-1111-111111111161' } // unit not in unitIds
    };
    let nextCalled = false;
    requireUnitAccess()(req, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  await t.test('Remaining inventory dynamically reconciles received minus expended', async () => {
    const remaining = await db.getRemainingInventory(['11111111-1111-1111-1111-111111111145']);
    const txItem = remaining.find(i => i.item_name.includes('100 kVA 33kV/400V Distribution Transformer'));
    assert.ok(txItem);
    assert.equal(txItem.total_received, 15);
    assert.equal(txItem.total_expended, 3);
    assert.equal(txItem.remaining_qty, 12);
  });

  // --- Bug Fix Verification Tests ---
  await t.test('Bug 1 Fix: Self-signup by non-admin cannot escalate role to super_admin', async () => {
    const attemptedProfile = {
      username: 'hacker_self_signup',
      full_name: 'Malicious User',
      role: 'super_admin',
      permission_level: 'read_write'
    };
    // Simulating non-admin self-signup
    const created = await db.createProfile(attemptedProfile, 'authenticated');
    assert.equal(created.role, 'employee', 'Role must be forced to employee');
    assert.equal(created.permission_level, 'no_permission', 'Permission level must be forced to no_permission');
  });

  await t.test('Bug 2 Fix: Self-update by non-admin cannot escalate role to super_admin', async () => {
    const existing = await db.getProfileByUsername('employeerw');
    assert.ok(existing);
    assert.equal(existing.role, 'employee');

    // Attempting to patch own role to super_admin
    const updated = await db.updateProfile(existing.id, { role: 'super_admin', permission_level: 'read_write' }, 'employee');
    assert.equal(updated.role, 'employee', 'Role escalation must be rejected; remains employee');
  });

  await t.test('Bug 1/2 Fix: Backend service_role client can create users with any role without restriction', async () => {
    const adminCreatedUser = {
      username: 'legit_admin_created',
      full_name: 'Regional Local Admin',
      role: 'local_admin',
      permission_level: null
    };
    const created = await db.createProfile(adminCreatedUser, 'service_role');
    assert.equal(created.role, 'local_admin', 'service_role can assign administrative roles');
  });

  await t.test('Bug 3 Fix: read_only employee cannot write to verification_items', () => {
    const req = {
      user: { role: 'employee', permission_level: 'read_only' }
    };
    let status = null;
    const res = {
      status: (s) => { status = s; return res; },
      json: () => {}
    };
    let nextCalled = false;

    // Writes to verification items require read_write
    requirePermission(['read_write'])(req, res, () => { nextCalled = true; });
    assert.equal(status, 403, 'read_only employee must be blocked with 403 from verification item mutations');
    assert.equal(nextCalled, false);
  });

  await t.test('Expending an item preserves received_transactions rows completely unchanged', async () => {
    const unitId = '11111111-1111-1111-1111-111111111145';
    // 1. Get initial received transactions
    const initialReceived = await db.getReceivedTransactions([unitId]);
    const targetReceived = initialReceived.find(r => r.voucher_no === 'VR-2026-0801');
    assert.ok(targetReceived, 'Target received transaction must exist');
    const initialQty = targetReceived.quantity;
    const initialDate = targetReceived.date;

    // 2. Perform an expend transaction for that item
    const newExpend = await db.createExpendedTransaction({
      item_name: targetReceived.item_name,
      quantity: 2,
      date: '2026-09-11',
      unit_id: unitId,
      voucher_no: 'EV-TEST-999',
      disposition: 'Test Substation Repair'
    });
    assert.ok(newExpend.id);

    // 3. Verify received transactions are 100% unchanged
    const afterReceived = await db.getReceivedTransactions([unitId]);
    const afterTarget = afterReceived.find(r => r.voucher_no === 'VR-2026-0801');
    assert.ok(afterTarget, 'Received transaction must still be present');
    assert.equal(afterTarget.quantity, initialQty, 'Received quantity must not change when expended');
    assert.equal(afterTarget.date, initialDate, 'Received date must not change');
    assert.equal(afterReceived.length, initialReceived.length, 'No received transactions should be removed');

    // 4. Verify only remaining inventory was updated
    const remaining = await db.getRemainingInventory([unitId]);
    const remItem = remaining.find(i => i.item_name === targetReceived.item_name);
    assert.ok(remItem);
    assert.equal(remItem.total_received, 15);
    assert.equal(remItem.total_expended, 5); // 3 original + 2 new
    assert.equal(remItem.remaining_qty, 10); // 15 - 5 = 10
  });
});

