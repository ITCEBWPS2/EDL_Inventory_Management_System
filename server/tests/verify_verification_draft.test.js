const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const app = require('../src/server');
const Verification = require('../src/models/Verification');
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

test('Verification Draft Lifecycle and Per-Row Save Test Suite', async (t) => {
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

  // Login Super Admin and Read-Only
  const sadminLogin = await request('/auth/login', 'POST', { username: 'sadmin@edl.lk', password: 'sadmin123' });
  const sadminToken = sadminLogin.body.data.token;

  const roLogin = await request('/auth/login', 'POST', { username: 'emp.ro@edl.lk', password: 'empro123' });
  const roToken = roLogin.body.data.token;

  const homagamaUnit = '11111111-1111-1111-1111-111111111145';

  // Fetch available inventory items for Homagama
  const invRes = await request(`/verifications/inventory-items?unit_id=${homagamaUnit}`, 'GET', null, sadminToken);
  assert.equal(invRes.status, 200);
  assert.ok(Array.isArray(invRes.body.data) && invRes.body.data.length >= 2, 'Inventory items found');
  const item1 = invRes.body.data[0];
  const item2 = invRes.body.data[1];

  let draftId = null;

  await t.test('1. Creates draft verification on first row save', async () => {
    const saveRes = await request(`/verifications/draft/items/${item1.inventory_item_id}`, 'PUT', {
      unit_id: homagamaUnit,
      rowData: {
        item_id: item1.inventory_item_id,
        item_name: item1.item_name,
        category: item1.category,
        system_qty: item1.system_qty,
        physical_qty: item1.system_qty,
        condition: 'Good',
        label_no: 'VL-1001',
        remarks: 'First saved item in draft'
      },
      headerData: {
        date: '2026-10-14',
        year: 2026,
        verifier_1: 'John Doe',
        verifier_2: 'Jane Smith'
      }
    }, sadminToken);

    assert.equal(saveRes.status, 200);
    assert.equal(saveRes.body.success, true);
    assert.ok(saveRes.body.data.draft, 'Draft returned');
    assert.equal(saveRes.body.data.draft.status, 'draft');
    assert.equal(saveRes.body.data.draft.verifier_1, 'John Doe');
    assert.equal(saveRes.body.data.item.label_no, 'VL-1001');

    draftId = saveRes.body.data.draft.id;
  });

  await t.test('2. Upserts the same row twice without creating duplicates', async () => {
    const updateRes = await request(`/verifications/draft/items/${item1.inventory_item_id}`, 'PUT', {
      unit_id: homagamaUnit,
      rowData: {
        item_id: item1.inventory_item_id,
        item_name: item1.item_name,
        category: item1.category,
        system_qty: item1.system_qty,
        physical_qty: Number(item1.system_qty) + 2,
        condition: 'Fair',
        label_no: 'VL-1001-REV',
        remarks: 'Updated remark without duplicating row'
      },
      headerData: {
        date: '2026-10-14',
        year: 2026,
        verifier_1: 'John Doe'
      }
    }, sadminToken);

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.success, true);
    assert.equal(updateRes.body.data.draft.id, draftId);

    // Verify only one VerificationItem exists for item1 in this draft
    const count = await VerificationItem.countDocuments({
      verification_id: draftId,
      item_id: item1.inventory_item_id
    });
    assert.equal(count, 1, 'Only one verification item for item1 in draft');

    const updatedItem = await VerificationItem.findOne({
      verification_id: draftId,
      item_id: item1.inventory_item_id
    });
    assert.equal(updatedItem.label_no, 'VL-1001-REV');
    assert.equal(updatedItem.condition, 'Fair');
    assert.equal(updatedItem.physical_qty, Number(item1.system_qty) + 2);
  });

  await t.test('3. Enforces one draft per unit when saving second row', async () => {
    const save2Res = await request(`/verifications/draft/items/${item2.inventory_item_id}`, 'PUT', {
      unit_id: homagamaUnit,
      rowData: {
        item_id: item2.inventory_item_id,
        item_name: item2.item_name,
        category: item2.category,
        system_qty: item2.system_qty,
        physical_qty: item2.system_qty,
        condition: 'Good',
        label_no: 'VL-1002',
        remarks: 'Second item saved'
      }
    }, sadminToken);

    assert.equal(save2Res.status, 200);
    assert.equal(save2Res.body.data.draft.id, draftId, 'Reuses existing draft for unit');

    const draftDocs = await Verification.find({ unit_id: homagamaUnit, status: 'draft' });
    assert.equal(draftDocs.length, 1, 'Exactly one draft exists for the unit');
  });

  await t.test('4. GET /verifications/draft returns active draft with saved line items', async () => {
    const getDraftRes = await request(`/verifications/draft?unit_id=${homagamaUnit}`, 'GET', null, sadminToken);
    assert.equal(getDraftRes.status, 200);
    assert.equal(getDraftRes.body.success, true);
    assert.ok(getDraftRes.body.data, 'Draft data returned');
    assert.equal(getDraftRes.body.data.id, draftId);
    assert.equal(getDraftRes.body.data.status, 'draft');
    assert.equal(getDraftRes.body.data.items.length, 2, 'Contains 2 saved items');
  });

  await t.test('5. Generic list, history, and reports ignore drafts', async () => {
    // History / list endpoint
    const listRes = await request('/verifications', 'GET', null, sadminToken);
    assert.equal(listRes.status, 200);
    const hasDraftInList = listRes.body.data.some(v => v.id === draftId || v.status === 'draft');
    assert.equal(hasDraftInList, false, 'Draft is not listed in generic verifications list');

    // History items endpoint
    const historyRes = await request('/verifications/history-items', 'GET', null, sadminToken);
    assert.equal(historyRes.status, 200);
    const hasDraftInHistory = historyRes.body.data.some(h => h.verification_id === draftId);
    assert.equal(hasDraftInHistory, false, 'Draft items are excluded from history items');
  });

  await t.test('6. Final confirm turns open draft into confirmed status without duplicate record', async () => {
    const confirmRes = await request('/verifications', 'POST', {
      unit_id: homagamaUnit,
      date: '2026-10-14',
      year: 2026,
      verifier_1: 'John Doe',
      verifier_2: 'Jane Smith',
      status: 'confirmed',
      summary: 'Annual Physical Count Confirmed',
      items: [
        {
          item_id: item1.inventory_item_id,
          item_name: item1.item_name,
          category: item1.category,
          system_qty: item1.system_qty,
          physical_qty: item1.system_qty,
          condition: 'Good',
          label_no: 'VL-1001',
          remarks: 'Confirmed item 1'
        }
      ]
    }, sadminToken);

    assert.equal(confirmRes.status, 201);
    assert.equal(confirmRes.body.success, true);
    assert.equal(confirmRes.body.data.id, draftId, 'Confirmed record has the same ID as the draft');
    assert.equal(confirmRes.body.data.status, 'confirmed', 'Status updated to confirmed');

    // Verify open draft no longer exists
    const draftCheck = await request(`/verifications/draft?unit_id=${homagamaUnit}`, 'GET', null, sadminToken);
    assert.equal(draftCheck.status, 200);
    assert.equal(draftCheck.body.data, null, 'No open draft remaining after confirmation');

    // Verify confirmed record now appears in list
    const listRes = await request('/verifications', 'GET', null, sadminToken);
    const foundConfirmed = listRes.body.data.find(v => v.id === draftId);
    assert.ok(foundConfirmed, 'Confirmed record now listed in verifications list');
    assert.equal(foundConfirmed.status, 'confirmed');
  });

  await t.test('7. Discard draft removes in-progress draft and its items', async () => {
    // Create new draft
    const newSave = await request(`/verifications/draft/items/${item1.inventory_item_id}`, 'PUT', {
      unit_id: homagamaUnit,
      rowData: {
        item_id: item1.inventory_item_id,
        item_name: item1.item_name,
        system_qty: item1.system_qty,
        physical_qty: item1.system_qty,
        condition: 'Good'
      }
    }, sadminToken);

    assert.equal(newSave.status, 200);
    const newDraftId = newSave.body.data.draft.id;
    assert.notEqual(newDraftId, draftId, 'New draft created');

    // Discard draft
    const discardRes = await request(`/verifications/draft?unit_id=${homagamaUnit}`, 'DELETE', null, sadminToken);
    assert.equal(discardRes.status, 200);
    assert.equal(discardRes.body.success, true);

    // Verify draft is gone
    const checkDraft = await request(`/verifications/draft?unit_id=${homagamaUnit}`, 'GET', null, sadminToken);
    assert.equal(checkDraft.status, 200);
    assert.equal(checkDraft.body.data, null, 'Draft successfully deleted');

    const leftoverItems = await VerificationItem.find({ verification_id: newDraftId });
    assert.equal(leftoverItems.length, 0, 'Draft items deleted from database');
  });

  await t.test('8. Read-only users cannot save or discard drafts', async () => {
    const roSaveRes = await request(`/verifications/draft/items/${item1.inventory_item_id}`, 'PUT', {
      unit_id: homagamaUnit,
      rowData: { physical_qty: 1 }
    }, roToken);
    assert.equal(roSaveRes.status, 403, 'Read-only forbidden from saving draft');

    const roDiscardRes = await request(`/verifications/draft?unit_id=${homagamaUnit}`, 'DELETE', null, roToken);
    assert.equal(roDiscardRes.status, 403, 'Read-only forbidden from discarding draft');
  });
});
