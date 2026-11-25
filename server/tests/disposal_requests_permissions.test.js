const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const app = require('../src/server');
const { Notification, AuditLog } = require('../src/models');

let server;
let baseUrl;

function makeRequest(path, method = 'GET', body = null, token = null) {
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

test('Disposal Requests Permissions & Notifications Test Suite', async (t) => {
  await setupTestDb();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      resolve();
    });
  });

  t.after(async () => {
    if (server) server.close();
    await teardownTestDb();
  });

  // 1. Authenticate seed users
  const sadminLogin = await makeRequest('/auth/login', 'POST', { username: 'sadmin@edl.lk', password: 'sadmin123' });
  assert.equal(sadminLogin.status, 200);
  const sadminToken = sadminLogin.body.data.token;

  const ladminLogin = await makeRequest('/auth/login', 'POST', { username: 'ladmin@edl.lk', password: 'ladmin123' });
  assert.equal(ladminLogin.status, 200);
  const ladminToken = ladminLogin.body.data.token;

  const headLogin = await makeRequest('/auth/login', 'POST', { username: 'headit@edl.lk', password: 'head123' });
  assert.equal(headLogin.status, 200);
  const headToken = headLogin.body.data.token;

  const empRwLogin = await makeRequest('/auth/login', 'POST', { username: 'emp.rw@edl.lk', password: 'emprw123' });
  assert.equal(empRwLogin.status, 200);
  const empRwToken = empRwLogin.body.data.token;

  const empRoLogin = await makeRequest('/auth/login', 'POST', { username: 'emp.ro@edl.lk', password: 'empro123' });
  assert.equal(empRoLogin.status, 200);
  const empRoToken = empRoLogin.body.data.token;

  const empNoneLogin = await makeRequest('/auth/login', 'POST', { username: 'emp.none@edl.lk', password: 'empnone123' });
  assert.equal(empNoneLogin.status, 200);
  const empNoneToken = empNoneLogin.body.data.token;

  // Create a disposal_only employee user via Super Admin
  const createDisposalUserRes = await makeRequest('/users', 'POST', {
    username: 'empdisp',
    email: 'emp.disp@edl.lk',
    full_name: 'Damith Disposal Officer',
    role: 'employee',
    permission_level: 'disposal_only',
    password: 'dispuser123',
    unit_id: null // Unassigned = receives requests from all units
  }, sadminToken);
  assert.equal(createDisposalUserRes.status, 201);

  const dispUserLogin = await makeRequest('/auth/login', 'POST', { username: 'emp.disp@edl.lk', password: 'dispuser123' });
  assert.equal(dispUserLogin.status, 200);
  const dispUserToken = dispUserLogin.body.data.token;

  const homagamaUnit = '11111111-1111-1111-1111-111111111145'; // Assigned to headit, emp.rw
  const foreignUnit = '11111111-1111-1111-1111-111111111146';   // Different unit

  let testRequestId = null;

  await t.test('1. Creation Permissions (Step 1)', async () => {
    // Super Admin cannot create requests (403)
    const sadminCreate = await makeRequest('/disposal-requests', 'POST', {
      unit_id: homagamaUnit,
      title: 'Super Admin Illegal Creation',
      items: [{ item_name: 'Test Item', quantity: 1 }]
    }, sadminToken);
    assert.equal(sadminCreate.status, 403);

    // Local Admin cannot create requests (403)
    const ladminCreate = await makeRequest('/disposal-requests', 'POST', {
      unit_id: homagamaUnit,
      title: 'Local Admin Illegal Creation',
      items: [{ item_name: 'Test Item', quantity: 1 }]
    }, ladminToken);
    assert.equal(ladminCreate.status, 403);

    // Read Only employee cannot create requests (403)
    const roCreate = await makeRequest('/disposal-requests', 'POST', {
      unit_id: homagamaUnit,
      title: 'RO Illegal Creation',
      items: [{ item_name: 'Test Item', quantity: 1 }]
    }, empRoToken);
    assert.equal(roCreate.status, 403);

    // No permission employee cannot create requests (403)
    const noneCreate = await makeRequest('/disposal-requests', 'POST', {
      unit_id: homagamaUnit,
      title: 'None Illegal Creation',
      items: [{ item_name: 'Test Item', quantity: 1 }]
    }, empNoneToken);
    assert.equal(noneCreate.status, 403);

    // Disposal-only employee cannot create requests (403)
    const dispCreate = await makeRequest('/disposal-requests', 'POST', {
      unit_id: homagamaUnit,
      title: 'Disposal-only Illegal Creation',
      items: [{ item_name: 'Test Item', quantity: 1 }]
    }, dispUserToken);
    assert.equal(dispCreate.status, 403);

    // Unit Head cannot create requests for foreign units (403)
    const foreignCreate = await makeRequest('/disposal-requests', 'POST', {
      unit_id: foreignUnit,
      title: 'Head Foreign Unit Creation',
      items: [{ item_name: 'Test Item', quantity: 1 }]
    }, headToken);
    assert.equal(foreignCreate.status, 403);

    // Unit Head can create request for assigned unit (201)
    const validCreate = await makeRequest('/disposal-requests', 'POST', {
      unit_id: homagamaUnit,
      title: 'Homagama Annual Asset Disposal',
      description: 'Defective office gear write-off',
      items: [
        {
          item_name: 'Laser Printer',
          item_code: 'PRN-001',
          quantity: 1,
          serial_numbers: ['PRN-HOM-001'],
          condition_notes: 'Fuser assembly destroyed'
        }
      ]
    }, headToken);
    assert.equal(validCreate.status, 201);
    assert.ok(validCreate.body.data.id);
    testRequestId = validCreate.body.data.id;

    // Check that denied attempts were logged to audit log
    const deniedLogs = await AuditLog.find({ module: 'Disposal', status: 'denied' });
    assert.ok(deniedLogs.length >= 5);
  });

  await t.test('2. Submission & Notification Trigger', async () => {
    // Other roles cannot submit draft (only Unit Head / RW employee of unit)
    const sadminSubmit = await makeRequest(`/disposal-requests/${testRequestId}/submit`, 'POST', {}, sadminToken);
    assert.equal(sadminSubmit.status, 403);

    // Unit Head submits the draft
    const submitRes = await makeRequest(`/disposal-requests/${testRequestId}/submit`, 'POST', {}, headToken);
    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.body.data.status, 'submitted');

    // Notifications must have been generated
    const notifications = await Notification.find({ request_id: testRequestId });
    assert.ok(notifications.length > 0);

    // Requester (headit) must NOT be notified
    const requesterNotif = notifications.find(n => n.recipient_user_id === '00000000-0000-0000-0000-000000000003');
    assert.equal(requesterNotif, undefined);

    // Super Admin must be notified
    const sadminNotif = notifications.find(n => n.recipient_user_id === '00000000-0000-0000-0000-000000000001');
    assert.ok(sadminNotif);
    assert.ok(sadminNotif.title.includes('Disposal request'));
    assert.ok(sadminNotif.message.includes('New disposal request received from'));
    assert.equal(sadminNotif.link, `/disposal/${testRequestId}`);

    // Notification API checks
    const sadminNotifRes = await makeRequest('/notifications?unread=true', 'GET', null, sadminToken);
    assert.equal(sadminNotifRes.status, 200);
    assert.ok(sadminNotifRes.body.unread_count >= 1);

    // Mark single notification as read
    const markReadRes = await makeRequest(`/notifications/${sadminNotif.id}/read`, 'PATCH', {}, sadminToken);
    assert.equal(markReadRes.status, 200);
    assert.ok(markReadRes.body.data.read_at);
  });

  await t.test('3. Overview vs Detail Access', async () => {
    // Public overview endpoint: accessible to ALL authenticated users (including empNone)
    const ovRes = await makeRequest(`/disposal-requests/${testRequestId}/overview`, 'GET', null, empNoneToken);
    assert.equal(ovRes.status, 200);
    assert.equal(ovRes.body.data.request_no, submitResReqNo(ovRes));
    assert.equal(ovRes.body.data.title, 'Homagama Annual Asset Disposal');
    // Safe fields only - no serials or sensitive attachments
    assert.equal(ovRes.body.data.items, undefined);

    // Detail endpoint: blocked for unauthorized users (empNone)
    const detailBlockedRes = await makeRequest(`/disposal-requests/${testRequestId}`, 'GET', null, empNoneToken);
    assert.equal(detailBlockedRes.status, 403);

    // Detail endpoint: accessible for Unit Head of unit
    const headDetailRes = await makeRequest(`/disposal-requests/${testRequestId}`, 'GET', null, headToken);
    assert.equal(headDetailRes.status, 200);
    assert.ok(headDetailRes.body.data.items.length > 0);

    // Detail endpoint: accessible for Disposal-only user (unassigned = all units)
    const dispDetailRes = await makeRequest(`/disposal-requests/${testRequestId}`, 'GET', null, dispUserToken);
    assert.equal(dispDetailRes.status, 200);
  });

  await t.test('4. Steps 2-5 Workflow Execution Permissions', async () => {
    // Unit Head cannot record board appointment (Steps 2-5 blocked for unit head)
    const headStep2Res = await makeRequest(`/disposal-requests/${testRequestId}/board-appointment`, 'POST', {
      appointment_date: '2026-11-23',
      appointed_by_name: 'Eng.E.K. Indranatha',
      members: [
        { name: 'Eng. A. Perera', designation: 'Senior Electrical Engineer' },
        { name: 'K. Somapala', designation: 'Chief Audit Officer' },
        { name: 'M. Bandara', designation: 'Storekeeper' }
      ]
    }, headToken);
    assert.equal(headStep2Res.status, 403);

    // Disposal-only employee CAN record board appointment (Step 2)
    const dispStep2Res = await makeRequest(`/disposal-requests/${testRequestId}/board-appointment`, 'POST', {
      appointment_date: '2026-11-23',
      appointed_by_name: 'Eng.E.K. Indranatha',
      members: [
        { name: 'Eng. A. Perera', designation: 'Senior Electrical Engineer' },
        { name: 'K. Somapala', designation: 'Chief Audit Officer' },
        { name: 'M. Bandara', designation: 'Storekeeper' }
      ]
    }, dispUserToken);
    assert.equal(dispStep2Res.status, 200);
    assert.equal(dispStep2Res.body.data.status, 'board_appointed');

    // Unit Head cannot record committee decision (Step 3)
    const headStep3Res = await makeRequest(`/disposal-requests/${testRequestId}/committee-decision`, 'POST', {
      report_ref: 'BOS-REP-2026-001',
      decision_date: '2026-11-23',
      members_present: ['Eng. A. Perera', 'K. Somapala'],
      items: [
        {
          id: dispStep2Res.body.data.items[0].id,
          committee_decision_item: 'Approve for Destruction',
          committee_remarks: 'Non-repairable'
        }
      ]
    }, headToken);
    assert.equal(headStep3Res.status, 403);

    // Super Admin CAN record committee decision (Step 3)
    const sadminStep3Res = await makeRequest(`/disposal-requests/${testRequestId}/committee-decision`, 'POST', {
      report_ref: 'BOS-REP-2026-001',
      decision_date: '2026-11-23',
      members_present: ['Eng. A. Perera', 'K. Somapala'],
      items: [
        {
          id: dispStep2Res.body.data.items[0].id,
          committee_decision_item: 'Approve for Destruction',
          committee_remarks: 'Non-repairable'
        }
      ]
    }, sadminToken);
    assert.equal(sadminStep3Res.status, 200);
    assert.equal(sadminStep3Res.body.data.status, 'approved');

    // Disposal-only employee CAN record destruction (Step 4)
    const dispStep4Res = await makeRequest(`/disposal-requests/${testRequestId}/disposal-action`, 'POST', {
      type: 'destruction',
      date: '2026-11-23',
      reference: 'DEST-CERT-2026-001',
      witnesses: ['Damith Disposal Officer', 'Eng. A. Perera'],
      item_ids: [dispStep2Res.body.data.items[0].id]
    }, dispUserToken);
    assert.equal(dispStep4Res.status, 200);
    assert.equal(dispStep4Res.body.data.status, 'completed');

    // Revert last step: Unit Head blocked (403)
    const headRevertRes = await makeRequest(`/disposal-requests/${testRequestId}/revert-step`, 'POST', {
      reason: 'Illegal revert attempt'
    }, headToken);
    assert.equal(headRevertRes.status, 403);

    // Revert last step: Super Admin allowed (200)
    const sadminRevertRes = await makeRequest(`/disposal-requests/${testRequestId}/revert-step`, 'POST', {
      reason: 'Administrative verification check'
    }, sadminToken);
    assert.equal(sadminRevertRes.status, 200);
    assert.equal(sadminRevertRes.body.data.status, 'in_disposal');
  });

  await t.test('5. Central Lockdown for disposal_only Employee', async () => {
    // Disposal-only employee cannot access Inventory (403)
    const invRes = await makeRequest('/inventory', 'GET', null, dispUserToken);
    assert.equal(invRes.status, 403);

    // Disposal-only employee cannot access Received Transactions (403)
    const recRes = await makeRequest('/transactions/received', 'GET', null, dispUserToken);
    assert.equal(recRes.status, 403);

    // Disposal-only employee cannot access Reports (403)
    const repRes = await makeRequest('/reports/asset-distribution', 'GET', null, dispUserToken);
    assert.equal(repRes.status, 403);

    // Disposal-only employee cannot access Users (403)
    const usersRes = await makeRequest('/users', 'GET', null, dispUserToken);
    assert.equal(usersRes.status, 403);

    // Disposal-only employee CAN access Units list (200)
    const unitsRes = await makeRequest('/units', 'GET', null, dispUserToken);
    assert.equal(unitsRes.status, 200);

    // Disposal-only employee CAN access Auth/me (200)
    const meRes = await makeRequest('/auth/me', 'GET', null, dispUserToken);
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.user.permission_level, 'disposal_only');
  });
});

function submitResReqNo(res) {
  return res.body?.data?.request_no;
}
