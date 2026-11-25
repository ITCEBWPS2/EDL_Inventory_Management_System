const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const app = require('../src/server');

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

test('Disposal Requests Committee Workflow Server Test Suite', async (t) => {
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

  // Login as Super Admin, Unit Head (Homagama), and Read-Only Employee
  const sadminLogin = await makeRequest('/auth/login', 'POST', { username: 'sadmin@edl.lk', password: 'sadmin123' });
  const sadminToken = sadminLogin.body.data.token;

  const headLogin = await makeRequest('/auth/login', 'POST', { username: 'headit@edl.lk', password: 'head123' });
  const headToken = headLogin.body.data.token;

  const homagamaUnit = '11111111-1111-1111-1111-111111111145';

  let createdRequestId = null;

  await t.test('1. Create Draft: Can create a new draft disposal request with line items and serials', async () => {
    const payload = {
      unit_id: homagamaUnit,
      title: 'Disposal of obsolete computer monitors and printers',
      description: 'End-of-life IT assets from Homagama 2026',
      items: [
        {
          item_name: 'Dell 24" LCD Monitor',
          item_code: 'ITO-MON-001',
          category: 'IT & Computing Equipment',
          quantity: 2,
          serial_numbers: ['MON-SN-001', 'MON-SN-002'],
          condition_notes: 'Burnt power supply and cracked panel'
        },
        {
          item_name: 'HP LaserJet Printer',
          item_code: 'ITO-PRN-001',
          category: 'IT & Computing Equipment',
          quantity: 1,
          serial_numbers: ['PRN-SN-001'],
          condition_notes: 'Obsolete, spare parts unavailable'
        },
        {
          item_name: 'Cisco 2960 Switch',
          item_code: 'ITO-NET-001',
          category: 'Network & Communication Equipment',
          quantity: 1,
          serial_numbers: ['SW-SN-001'],
          condition_notes: 'Port flapping, candidate for repair'
        }
      ]
    };

    const res = await makeRequest('/disposal-requests', 'POST', payload, headToken);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.request_no.startsWith('DR-'));
    assert.equal(res.body.data.status, 'draft');
    assert.equal(res.body.data.items.length, 3);
    assert.equal(res.body.data.items[0].serial_status, 'pending_disposal');

    createdRequestId = res.body.data.id;
  });

  await t.test('2. Draft Deletion Allowed: A draft request can be deleted', async () => {
    const tempRes = await makeRequest('/disposal-requests', 'POST', {
      unit_id: homagamaUnit,
      title: 'Temporary draft to test delete',
      items: [{ item_name: 'Test Item', quantity: 1 }]
    }, headToken);
    assert.equal(tempRes.status, 201);
    const tempId = tempRes.body.data.id;

    const delRes = await makeRequest(`/disposal-requests/${tempId}`, 'DELETE', null, headToken);
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.success, true);

    const checkRes = await makeRequest(`/disposal-requests/${tempId}`, 'GET', null, headToken);
    assert.equal(checkRes.status, 404);
  });

  await t.test('3. Submit Transition: Draft transitions to Submitted and deletion is blocked', async () => {
    const res = await makeRequest(`/disposal-requests/${createdRequestId}/submit`, 'POST', null, headToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'submitted');
    assert.ok(res.body.data.submitted_at);

    // Later steps CANNOT be deleted
    const delRes = await makeRequest(`/disposal-requests/${createdRequestId}`, 'DELETE', null, headToken);
    assert.equal(delRes.status, 400);
    assert.match(delRes.body.message, /Only Draft requests can be deleted/);
  });

  await t.test('4. Board Appointment Validation: Rejects less than 3 or more than 6 members', async () => {
    const tooFewRes = await makeRequest(`/disposal-requests/${createdRequestId}/board-appointment`, 'POST', {
      appointment_letter_no: 'APP/2026/01',
      appointment_date: '2026-11-20',
      members: [{ name: 'Member 1' }, { name: 'Member 2' }]
    }, sadminToken);
    assert.equal(tooFewRes.status, 400);
    assert.match(tooFewRes.body.message, /3 to 6 members/);

    const tooManyRes = await makeRequest(`/disposal-requests/${createdRequestId}/board-appointment`, 'POST', {
      appointment_letter_no: 'APP/2026/01',
      appointment_date: '2026-11-20',
      members: [
        { name: 'M1' }, { name: 'M2' }, { name: 'M3' },
        { name: 'M4' }, { name: 'M5' }, { name: 'M6' }, { name: 'M7' }
      ]
    }, sadminToken);
    assert.equal(tooManyRes.status, 400);
    assert.match(tooManyRes.body.message, /3 to 6 members/);
  });

  await t.test('5. Record Board Appointment: Submitted -> Board Appointed with 3 members and optional appointed_by', async () => {
    const res = await makeRequest(`/disposal-requests/${createdRequestId}/board-appointment`, 'POST', {
      appointment_letter_no: 'EDL/WPS2/DISP/2026/44',
      appointment_date: '2026-11-20',
      appointed_by_name: 'DGM (WPS-II)',
      members: [
        { name: 'H.M. Karunaratne', designation: 'Chief Audit Officer' },
        { name: 'S.D. Wijesinghe', designation: 'Senior Electrical Engineer' },
        { name: 'R.K. Bandara', designation: 'Storekeeper' }
      ]
    }, sadminToken);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'board_appointed');
    assert.equal(res.body.data.board.members.length, 3);
    assert.equal(res.body.data.board.appointed_by_name, 'DGM (WPS-II)');
  });

  await t.test('6. Committee Decision Validation: Requires report_ref, decision_date, members_present, and decisions for all items', async () => {
    const res1 = await makeRequest(`/disposal-requests/${createdRequestId}/committee-decision`, 'POST', {
      decision_date: '2026-11-22',
      members_present: ['H.M. Karunaratne'],
      items: []
    }, sadminToken);
    assert.equal(res1.status, 400);
    assert.match(res1.body.message, /Committee report reference is required/);

    const getRes = await makeRequest(`/disposal-requests/${createdRequestId}`, 'GET', null, sadminToken);
    const items = getRes.body.data.items;

    const res2 = await makeRequest(`/disposal-requests/${createdRequestId}/committee-decision`, 'POST', {
      report_ref: 'BOS-REP-2026-08',
      decision_date: '2026-11-22',
      members_present: ['H.M. Karunaratne', 'S.D. Wijesinghe'],
      items: [
        { id: items[0].id, committee_decision_item: 'Approve for Destruction' }
      ]
    }, sadminToken);
    assert.equal(res2.status, 400);
    assert.match(res2.body.message, /Every item must have a valid committee decision/);
  });

  await t.test('7. Record Committee Decision: Board Appointed -> Approved, serials updated, Retain/Repair/Reject serials returned to active', async () => {
    const getRes = await makeRequest(`/disposal-requests/${createdRequestId}`, 'GET', null, sadminToken);
    const items = getRes.body.data.items;

    const res = await makeRequest(`/disposal-requests/${createdRequestId}/committee-decision`, 'POST', {
      report_ref: 'BOS-REP-2026-08',
      decision_date: '2026-11-22',
      inspection_date: '2026-11-21',
      members_present: ['H.M. Karunaratne', 'S.D. Wijesinghe', 'R.K. Bandara'],
      remarks: 'Physical inspection completed. Monitors recommended for destruction, printer for tender, switch to be repaired.',
      items: [
        {
          id: items[0].id,
          committee_decision_item: 'Approve for Destruction',
          committee_remarks: 'Cracked screen not viable for repair'
        },
        {
          id: items[1].id,
          committee_decision_item: 'Approve for Tender',
          committee_remarks: 'Sell for spare metal recycling'
        },
        {
          id: items[2].id,
          committee_decision_item: 'Repair',
          committee_remarks: 'Send to central telecom workshop for port replacement'
        }
      ]
    }, sadminToken);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'approved');

    const updatedItems = res.body.data.items;
    assert.equal(updatedItems[0].serial_status, 'approved_for_disposal');
    assert.equal(updatedItems[0].committee_decision_item, 'Approve for Destruction');

    assert.equal(updatedItems[1].serial_status, 'approved_for_disposal');
    assert.equal(updatedItems[1].committee_decision_item, 'Approve for Tender');

    assert.equal(updatedItems[2].serial_status, 'active');
    assert.equal(updatedItems[2].committee_decision_item, 'Repair');

    const timeline = res.body.data.timeline;
    const lastEvent = timeline[timeline.length - 1];
    assert.equal(lastEvent.action, 'Committee decision recorded');
    assert.match(lastEvent.notes, /Serials returned to active/);
  });

  await t.test('8. Rejection Case: When ALL items are Retain/Repair/Reject, request becomes Rejected', async () => {
    const r1 = await makeRequest('/disposal-requests', 'POST', {
      unit_id: homagamaUnit,
      title: 'Disposal Request to be fully rejected',
      items: [
        { item_name: 'Item A', quantity: 1, serial_numbers: ['SNA'] },
        { item_name: 'Item B', quantity: 1, serial_numbers: ['SNB'] }
      ]
    }, headToken);
    const rejId = r1.body.data.id;
    await makeRequest(`/disposal-requests/${rejId}/submit`, 'POST', null, headToken);
    await makeRequest(`/disposal-requests/${rejId}/board-appointment`, 'POST', {
      appointment_letter_no: 'APP/REJ/01',
      appointment_date: '2026-11-20',
      members: [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
    }, sadminToken);

    const getRes = await makeRequest(`/disposal-requests/${rejId}`, 'GET', null, sadminToken);
    const items = getRes.body.data.items;

    const decRes = await makeRequest(`/disposal-requests/${rejId}/committee-decision`, 'POST', {
      report_ref: 'BOS-REJ-01',
      decision_date: '2026-11-22',
      members_present: ['A'],
      items: [
        { id: items[0].id, committee_decision_item: 'Retain', committee_remarks: 'Keep in service' },
        { id: items[1].id, committee_decision_item: 'Reject', committee_remarks: 'Disposal request denied' }
      ]
    }, sadminToken);

    assert.equal(decRes.status, 200);
    assert.equal(decRes.body.data.status, 'rejected');
    assert.equal(decRes.body.data.items[0].serial_status, 'active');
    assert.equal(decRes.body.data.items[1].serial_status, 'active');
  });

  await t.test('9. Unique Way Bill Rule: Duplicate waybill_no is rejected with HTTP 400', async () => {
    const getRes = await makeRequest(`/disposal-requests/${createdRequestId}`, 'GET', null, sadminToken);
    const tenderItem = getRes.body.data.items.find(i => i.committee_decision_item === 'Approve for Tender');

    const res1 = await makeRequest(`/disposal-requests/${createdRequestId}/disposal-record`, 'POST', {
      type: 'tender',
      reference: 'TENDER-REL-2026-01',
      date: '2026-11-23',
      item_ids: [tenderItem.id],
      waybill_no: 'WB-EDL-2026-001',
      witnesses: ['Storekeeper Bandara', 'Security Officer Perera'],
      remarks: 'Released to bidder ABC Metals'
    }, sadminToken);
    assert.equal(res1.status, 200);
    assert.equal(res1.body.data.status, 'in_disposal');

    // Duplicate waybill_no
    const res2 = await makeRequest(`/disposal-requests/${createdRequestId}/disposal-record`, 'POST', {
      type: 'tender',
      reference: 'TENDER-REL-2026-02',
      date: '2026-11-23',
      item_ids: [tenderItem.id],
      waybill_no: 'WB-EDL-2026-001',
      witnesses: ['Storekeeper Bandara']
    }, sadminToken);

    assert.equal(res2.status, 400);
    assert.match(res2.body.message, /Way Bill number "WB-EDL-2026-001" is already used/);
  });

  await t.test('10. Disposal Action & Completion: Destroy remaining approved items -> Completed status', async () => {
    const getRes = await makeRequest(`/disposal-requests/${createdRequestId}`, 'GET', null, sadminToken);
    const destructionItem = getRes.body.data.items.find(i => i.committee_decision_item === 'Approve for Destruction');

    const res = await makeRequest(`/disposal-requests/${createdRequestId}/disposal-record`, 'POST', {
      type: 'destruction',
      reference: 'CERT-DEST-2026-04',
      date: '2026-11-23',
      item_ids: [destructionItem.id],
      witnesses: ['H.M. Karunaratne', 'R.K. Bandara'],
      remarks: 'Incinerated and crushed at authorized site'
    }, sadminToken);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'completed');

    const item = res.body.data.items.find(i => i.id === destructionItem.id);
    assert.equal(item.final_disposition, 'destroyed');
    assert.equal(item.serial_status, 'destroyed');
  });

  await t.test('11. Super Admin Revert Last Step: Reverts Completed -> In Disposal with reason', async () => {
    const headRes = await makeRequest(`/disposal-requests/${createdRequestId}/revert`, 'POST', {
      reason: 'Accidental completion'
    }, headToken);
    assert.equal(headRes.status, 403);

    const revertRes = await makeRequest(`/disposal-requests/${createdRequestId}/revert`, 'POST', {
      reason: 'Reopened by auditor to attach remaining photos'
    }, sadminToken);

    assert.equal(revertRes.status, 200);
    assert.equal(revertRes.body.success, true);
    assert.equal(revertRes.body.data.status, 'in_disposal');

    const timeline = revertRes.body.data.timeline;
    const lastEvent = timeline[timeline.length - 1];
    assert.match(lastEvent.action, /Step reverted by Super Admin/);
    assert.match(lastEvent.notes, /Reopened by auditor/);
  });
});
