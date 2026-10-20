const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const app = require('../src/server');
const VerificationItem = require('../src/models/VerificationItem');

let server;
let baseUrl;

function request(path, method = 'GET', body = null, token = null) {
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

test('Verification Issued / Destroyed Column and Draft Integration Suite', async (t) => {
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

  const sadminLogin = await request('/auth/login', 'POST', { username: 'sadmin@edl.lk', password: 'sadmin123' });
  const sadminToken = sadminLogin.body.data.token;

  const homagamaUnit = '11111111-1111-1111-1111-111111111145';

  const invRes = await request(`/verifications/inventory-items?unit_id=${homagamaUnit}`, 'GET', null, sadminToken);
  assert.equal(invRes.status, 200);
  const item1 = invRes.body.data[0];
  const item2 = invRes.body.data[1];

  let draftId = null;

  await t.test('1. Saves row with issued_destroyed = "Issued" and links issued_destroyed_id in draft', async () => {
    const saveRes = await request(`/verifications/draft/items/${item1.inventory_item_id}`, 'PUT', {
      unit_id: homagamaUnit,
      rowData: {
        item_id: item1.inventory_item_id,
        item_name: item1.item_name,
        category: item1.category,
        system_qty: item1.system_qty,
        physical_qty: item1.system_qty,
        condition: 'Good',
        issued_destroyed: 'Issued',
        issued_destroyed_id: 'rec-test-uuid-001',
        label_no: 'VL-5001'
      },
      headerData: {
        date: '2026-10-14',
        year: 2026,
        verifier_1: 'Auditor A'
      }
    }, sadminToken);

    assert.equal(saveRes.status, 200);
    assert.equal(saveRes.body.success, true);
    draftId = saveRes.body.data.draft.id;

    assert.equal(saveRes.body.data.item.issued_destroyed, 'Issued');
    assert.equal(saveRes.body.data.item.issued_destroyed_id, 'rec-test-uuid-001');
    assert.equal(saveRes.body.data.item.disposition, 'Issued');
  });

  await t.test('2. Saves row with issued_destroyed = "Destroyed"', async () => {
    const save2Res = await request(`/verifications/draft/items/${item2.inventory_item_id}`, 'PUT', {
      unit_id: homagamaUnit,
      rowData: {
        item_id: item2.inventory_item_id,
        item_name: item2.item_name,
        category: item2.category,
        system_qty: item2.system_qty,
        physical_qty: 0,
        condition: 'Damaged',
        issued_destroyed: 'Destroyed',
        label_no: 'VL-5002'
      }
    }, sadminToken);

    assert.equal(save2Res.status, 200);
    assert.equal(save2Res.body.data.item.issued_destroyed, 'Destroyed');
    assert.equal(save2Res.body.data.item.disposition, 'Destroyed');
  });

  await t.test('3. GET /verifications/draft returns rows with issued_destroyed values preserved', async () => {
    const draftRes = await request(`/verifications/draft?unit_id=${homagamaUnit}`, 'GET', null, sadminToken);
    assert.equal(draftRes.status, 200);
    assert.ok(draftRes.body.data);
    const dItem1 = draftRes.body.data.items.find(i => i.item_id === item1.inventory_item_id);
    const dItem2 = draftRes.body.data.items.find(i => i.item_id === item2.inventory_item_id);

    assert.ok(dItem1);
    assert.equal(dItem1.issued_destroyed, 'Issued');
    assert.equal(dItem1.issued_destroyed_id, 'rec-test-uuid-001');

    assert.ok(dItem2);
    assert.equal(dItem2.issued_destroyed, 'Destroyed');
  });

  await t.test('4. Updates issued_destroyed back to "N/A" and "—" gracefully without deleting', async () => {
    const updateRes = await request(`/verifications/draft/items/${item1.inventory_item_id}`, 'PUT', {
      unit_id: homagamaUnit,
      rowData: {
        item_id: item1.inventory_item_id,
        issued_destroyed: 'N/A'
      }
    }, sadminToken);

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.item.issued_destroyed, 'N/A');

    const update2Res = await request(`/verifications/draft/items/${item1.inventory_item_id}`, 'PUT', {
      unit_id: homagamaUnit,
      rowData: {
        item_id: item1.inventory_item_id,
        issued_destroyed: '—'
      }
    }, sadminToken);

    assert.equal(update2Res.status, 200);
    assert.equal(update2Res.body.data.item.issued_destroyed, '');
  });

  await t.test('5. Final confirm stores issued_destroyed and appears in history items endpoint', async () => {
    const confirmRes = await request('/verifications', 'POST', {
      unit_id: homagamaUnit,
      date: '2026-10-14',
      year: 2026,
      verifier_1: 'Auditor A',
      status: 'confirmed',
      summary: 'Confirmed Verification with Issued/Destroyed Items',
      items: [
        {
          item_id: item1.inventory_item_id,
          item_name: item1.item_name,
          category: item1.category,
          system_qty: item1.system_qty,
          physical_qty: item1.system_qty,
          condition: 'Good',
          issued_destroyed: 'Issued',
          issued_destroyed_id: 'rec-test-uuid-001',
          label_no: 'VL-5001'
        },
        {
          item_id: item2.inventory_item_id,
          item_name: item2.item_name,
          category: item2.category,
          system_qty: item2.system_qty,
          physical_qty: 0,
          condition: 'Damaged',
          issued_destroyed: 'Destroyed',
          label_no: 'VL-5002'
        }
      ]
    }, sadminToken);

    assert.equal(confirmRes.status, 201);
    assert.equal(confirmRes.body.data.status, 'confirmed');

    // Check verification history endpoint
    const historyRes = await request(`/verifications/history-items?unitIds=${homagamaUnit}&year=2026`, 'GET', null, sadminToken);
    assert.equal(historyRes.status, 200);
    const histItem1 = historyRes.body.data.find(h => h.item_id === item1.inventory_item_id);
    const histItem2 = historyRes.body.data.find(h => h.item_id === item2.inventory_item_id);

    assert.ok(histItem1, 'History contains item 1');
    assert.equal(histItem1.issued_destroyed, 'Issued');
    assert.equal(histItem1.disposition, 'Issued');

    assert.ok(histItem2, 'History contains item 2');
    assert.equal(histItem2.issued_destroyed, 'Destroyed');
    assert.equal(histItem2.disposition, 'Destroyed');
  });

  await t.test('6. Legacy verification items without issued_destroyed load correctly with default "—"', async () => {
    // Check seeded legacy verification items
    const historyRes = await request('/verifications/history-items', 'GET', null, sadminToken);
    assert.equal(historyRes.status, 200);
    assert.ok(historyRes.body.data.length > 0);

    for (const h of historyRes.body.data) {
      assert.ok(typeof h.issued_destroyed === 'string');
      assert.ok(h.issued_destroyed.length > 0);
    }
  });

  await t.test('7. Stores issued_destroyed_qty with draft and confirmed verification items', async () => {
    const saveQtyRes = await request(`/verifications/draft/items/${item1.inventory_item_id}`, 'PUT', {
      unit_id: homagamaUnit,
      rowData: {
        item_id: item1.inventory_item_id,
        item_name: item1.item_name,
        system_qty: item1.system_qty || 5,
        issued_destroyed: 'Issued',
        issued_destroyed_qty: 3
      }
    }, sadminToken);

    assert.equal(saveQtyRes.status, 200);
    assert.equal(saveQtyRes.body.data.item.issued_destroyed_qty, 3);

    const draftRes = await request(`/verifications/draft?unit_id=${homagamaUnit}`, 'GET', null, sadminToken);
    assert.equal(draftRes.status, 200);
    const dItem = draftRes.body.data.items.find(i => i.item_id === item1.inventory_item_id);
    assert.ok(dItem);
    assert.equal(dItem.issued_destroyed_qty, 3);
  });

  let candidateItem = null;
  await t.test('8. GET /verifications/issued-destroyed-candidates returns marked items with remaining quantities', async () => {
    // Ensure item1 is marked in draft with qty 3
    const candRes = await request(`/verifications/issued-destroyed-candidates?unit_id=${homagamaUnit}`, 'GET', null, sadminToken);
    assert.equal(candRes.status, 200);
    assert.equal(candRes.body.success, true);
    assert.ok(Array.isArray(candRes.body.data));

    const found = candRes.body.data.find(c => c.inventory_item_id === item1.inventory_item_id || c.item_id === item1.inventory_item_id);
    assert.ok(found, 'Item1 should be a candidate');
    assert.equal(found.disposition, 'Issued');
    assert.equal(found.marked_quantity, 3);
    assert.equal(found.already_recorded_quantity, 0);
    assert.equal(found.remaining_quantity, 3);
    assert.ok(Array.isArray(found.serial_numbers));
    candidateItem = found;
  });

  let createdRecordId = null;
  const testSerials = candidateItem?.serial_numbers?.length >= 2
    ? [candidateItem.serial_numbers[0].serial_number, candidateItem.serial_numbers[1].serial_number]
    : ['TEST-SN-001', 'TEST-SN-002'];

  await t.test('9. Creating Issued/Destroyed record with serial_numbers stores them and updates candidates', async () => {
    const createRes = await request('/verifications/issued-destroyed', 'POST', {
      unit_id: homagamaUnit,
      item_id: candidateItem.inventory_item_id || candidateItem.item_id,
      disposition: 'Issued',
      quantity: testSerials.length,
      serial_numbers: testSerials,
      date: '2026-10-14',
      reason: 'Routine wear and tear',
      verification_id: candidateItem.verification_id
    }, sadminToken);

    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.success, true);
    assert.equal(createRes.body.data.quantity, testSerials.length);
    assert.deepEqual(createRes.body.data.serial_numbers, testSerials);
    createdRecordId = createRes.body.data.id;

    // Verify remaining qty decreased in candidates endpoint
    const candRes = await request(`/verifications/issued-destroyed-candidates?unit_id=${homagamaUnit}`, 'GET', null, sadminToken);
    const updated = candRes.body.data.find(c => (c.inventory_item_id || c.item_id) === (candidateItem.inventory_item_id || candidateItem.item_id));
    if (candidateItem.marked_quantity > testSerials.length) {
      assert.ok(updated);
      assert.equal(updated.already_recorded_quantity, testSerials.length);
      assert.equal(updated.remaining_quantity, candidateItem.marked_quantity - testSerials.length);
      // Serial numbers used should now be flagged is_recorded: true
      const recordedSerial = updated.serial_numbers.find(s => s.serial_number === testSerials[0]);
      if (recordedSerial) {
        assert.equal(recordedSerial.is_recorded, true);
      }
    }
  });

  await t.test('10. Duplicate serial numbers across records are rejected', async () => {
    const dupRes = await request('/verifications/issued-destroyed', 'POST', {
      unit_id: homagamaUnit,
      item_id: candidateItem.inventory_item_id || candidateItem.item_id,
      disposition: 'Issued',
      quantity: 1,
      serial_numbers: [testSerials[0]],
      date: '2026-10-14',
      reason: 'Attempt duplicate record'
    }, sadminToken);

    assert.equal(dupRes.status, 400);
    assert.ok(dupRes.body.error || dupRes.body.message);
    const msg = dupRes.body.error || dupRes.body.message;
    assert.match(msg, /already recorded/i);
  });

  await t.test('11. More serials or quantity than remaining quantity is rejected', async () => {
    // Current remaining is 1 (marked 3 - recorded 2) while inventory qty is 4.
    // Sending quantity 3 or 3 serials exceeds remaining (1) while within inventory (4)
    const overflowRes = await request('/verifications/issued-destroyed', 'POST', {
      unit_id: homagamaUnit,
      item_id: candidateItem.inventory_item_id || candidateItem.item_id,
      disposition: 'Issued',
      quantity: 3,
      serial_numbers: ['NEW-SN-A', 'NEW-SN-B', 'NEW-SN-C'],
      date: '2026-10-14',
      reason: 'Exceeding remaining limit'
    }, sadminToken);

    assert.equal(overflowRes.status, 400);
    const msg = overflowRes.body.error || overflowRes.body.message;
    assert.match(msg, /exceeds remaining/i);
  });

  await t.test('12. Deleting Issued/Destroyed record frees the serial numbers and restores candidate remaining qty', async () => {
    const delRes = await request(`/verifications/issued-destroyed/${createdRecordId}`, 'DELETE', null, sadminToken);
    assert.equal(delRes.status, 200);

    // Candidates remaining should now be back to marked_quantity
    const candRes = await request(`/verifications/issued-destroyed-candidates?unit_id=${homagamaUnit}`, 'GET', null, sadminToken);
    const candidateAfterDel = candRes.body.data.find(c => (c.inventory_item_id || c.item_id) === (candidateItem.inventory_item_id || candidateItem.item_id));
    assert.ok(candidateAfterDel);
    assert.equal(candidateAfterDel.already_recorded_quantity, 0);
    assert.equal(candidateAfterDel.remaining_quantity, candidateItem.marked_quantity);

    // The serials can now be re-recorded without duplicate error
    const reCreateRes = await request('/verifications/issued-destroyed', 'POST', {
      unit_id: homagamaUnit,
      item_id: candidateItem.inventory_item_id || candidateItem.item_id,
      disposition: 'Issued',
      quantity: 1,
      serial_numbers: [testSerials[0]],
      date: '2026-10-14',
      reason: 'Re-recording previously deleted serial'
    }, sadminToken);

    assert.equal(reCreateRes.status, 201);
  });
});
