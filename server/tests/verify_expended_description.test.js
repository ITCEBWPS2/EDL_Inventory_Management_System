const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');
const db = require('../src/services/db');
const { ExpendedTransaction, ReceivedTransaction, Unit, Profile } = require('../src/models');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const transactionRoutes = require('../src/routes/transactions.routes');

test('Expended Transaction Description / Notes Field Test Suite', async (t) => {
  let app;
  let server;
  let baseUrl;
  let adminToken;
  let testUnitId;

  await t.before(async () => {
    await setupTestDb();

    // Find seeded unit
    const unit = await Unit.findOne({});
    testUnitId = unit.id;

    // Get seeded super_admin user
    const adminUser = await Profile.findOne({ role: 'super_admin' });

    // Create a super_admin token
    adminToken = jwt.sign(
      {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        unitIds: [testUnitId]
      },
      process.env.JWT_SECRET || 'edl_ims_secure_jwt_secret_dev_key_2026',
      { expiresIn: '1h' }
    );

    app = express();
    app.use(express.json());
    app.use('/api/transactions', transactionRoutes);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  await t.after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await teardownTestDb();
  });

  await t.test('1. DB service: createExpendedTransaction with description/notes saves and returns description', async () => {
    const descText = 'Reason: Annual sub-station maintenance. Condition: Used good. Serial: SN-98721.';
    const tx = await db.createExpendedTransaction({
      item_name: 'Digital Multimeter',
      category: 'Tools & Equipment',
      quantity: 1,
      unit_id: testUnitId,
      voucher_no: 'EV-TEST-001',
      disposition: 'WPS II Sub-Station',
      notes: descText
    });

    assert.ok(tx.id, 'Transaction ID should exist');
    assert.strictEqual(tx.notes, descText, 'Description/notes should match input text');

    // Retrieve from DB
    const fetched = await ExpendedTransaction.findOne({ id: tx.id }).lean();
    assert.ok(fetched, 'Transaction should exist in database');
    assert.strictEqual(fetched.notes, descText, 'Persisted notes should match description');
  });

  await t.test('2. DB service: createExpendedTransaction with empty or omitted description succeeds and defaults to empty string', async () => {
    const txWithoutNotes = await db.createExpendedTransaction({
      item_name: 'Crimping Tool',
      category: 'Tools & Equipment',
      quantity: 2,
      unit_id: testUnitId,
      voucher_no: 'EV-TEST-002',
      disposition: 'Maintenance Team'
    });

    assert.ok(txWithoutNotes.id, 'Transaction ID should exist');
    assert.strictEqual(txWithoutNotes.notes, '', 'Omitted notes should default to empty string');

    const txWithEmptyNotes = await db.createExpendedTransaction({
      item_name: 'Earth Tester',
      category: 'Tools & Equipment',
      quantity: 1,
      unit_id: testUnitId,
      voucher_no: 'EV-TEST-003',
      disposition: 'Field Inspection',
      notes: ''
    });

    assert.ok(txWithEmptyNotes.id, 'Transaction ID should exist');
    assert.strictEqual(txWithEmptyNotes.notes, '', 'Empty notes should remain empty string');
  });

  await t.test('3. DB service: updateExpendedTransaction modifies description and allows clearing it', async () => {
    const initialTx = await db.createExpendedTransaction({
      item_name: 'Binocular',
      category: 'Tools & Equipment',
      quantity: 1,
      unit_id: testUnitId,
      voucher_no: 'EV-TEST-004',
      disposition: 'Control Room',
      notes: 'Initial description'
    });

    // Update notes
    const updated = await db.updateExpendedTransaction(initialTx.id, {
      notes: 'Updated description: transferred to inspection crew.'
    });
    assert.strictEqual(updated.notes, 'Updated description: transferred to inspection crew.');

    // Clear notes to empty string
    const cleared = await db.updateExpendedTransaction(initialTx.id, {
      notes: ''
    });
    assert.strictEqual(cleared.notes, '');
  });

  await t.test('4. DB service: getExpendedTransactions search includes notes/description', async () => {
    const uniqueTag = 'UNIQUE_NOTE_KEYWORD_XYZ99';
    await db.createExpendedTransaction({
      item_name: 'HV Tester',
      category: 'Tools & Equipment',
      quantity: 1,
      unit_id: testUnitId,
      voucher_no: 'EV-TEST-005',
      disposition: 'Site Lab',
      notes: `Special notes with ${uniqueTag} tag`
    });

    const searchResults = await db.getExpendedTransactions([testUnitId], 'unique_note_keyword_xyz99');
    assert.ok(searchResults.length >= 1, 'Should find at least 1 record matching description keyword');
    assert.ok(searchResults.some(r => r.notes.includes(uniqueTag)), 'Matched item should contain the tag');
  });

  await t.test('5. API route: POST and PUT /api/transactions/expended handles description and trims whitespace', async () => {
    // First, ensure received item exists so stock is available to expend
    await db.createReceivedTransaction({
      item_name: 'Test Device XYZ',
      category: 'Tools & Equipment',
      quantity: 10,
      unit_id: testUnitId,
      voucher_no: 'RV-TEST-999',
      from_whom: 'Supplier ABC'
    });

    // POST create with leading/trailing whitespace
    const postRes = await fetch(`${baseUrl}/api/transactions/expended`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        item_name: 'Test Device XYZ',
        category: 'Tools & Equipment',
        quantity: 1,
        date: '2026-10-14',
        voucher_no: 'EV-API-001',
        disposition: 'Workshop A',
        notes: '   Line 1: Sent for repair\nLine 2: Return expected next week   ',
        unit_id: testUnitId
      })
    });

    assert.strictEqual(postRes.status, 201, 'POST should return 201 Created');
    const postData = await postRes.json();
    assert.ok(postData.success, 'Response success should be true');
    assert.strictEqual(
      postData.data.notes,
      'Line 1: Sent for repair\nLine 2: Return expected next week',
      'Should trim outer whitespace while preserving internal newline'
    );

    // PUT update description
    const putRes = await fetch(`${baseUrl}/api/transactions/expended/${postData.data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        notes: '   Repaired and fully operational   '
      })
    });

    assert.strictEqual(putRes.status, 200, 'PUT should return 200 OK');
    const putData = await putRes.json();
    assert.ok(putData.success, 'Response success should be true');
    assert.strictEqual(putData.data.notes, 'Repaired and fully operational', 'Updated notes should be trimmed');
  });

  await t.test('6. API route: POST with empty description succeeds without error', async () => {
    const postRes = await fetch(`${baseUrl}/api/transactions/expended`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        item_name: 'Test Device XYZ',
        category: 'Tools & Equipment',
        quantity: 1,
        date: '2026-10-14',
        voucher_no: 'EV-API-002',
        disposition: 'Workshop B',
        notes: '',
        unit_id: testUnitId
      })
    });

    assert.strictEqual(postRes.status, 201, 'POST with empty notes should return 201 Created');
    const postData = await postRes.json();
    assert.ok(postData.success);
    assert.strictEqual(postData.data.notes, '', 'Notes should be empty string');
  });
});
