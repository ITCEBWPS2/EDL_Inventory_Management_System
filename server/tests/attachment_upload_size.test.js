const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const db = require('../src/services/db');
const { ReceivedTransaction } = require('../src/models');
const storageService = require('../src/services/storageService');
const env = require('../src/config/env');

let server = null;
let API_BASE = '';

test('Attachment Upload Size (800 KB) & Type Restriction Test Suite', async (t) => {
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
  let testUnitId = '11111111-1111-1111-1111-111111111145'; // Homagama CSC unit assigned to unithead

  await t.test('1. Setup authentication for unit head / read_write user', async () => {
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

  await t.test('2. Configuration & env constants are set to 800 KB', () => {
    assert.equal(env.ATTACHMENT_MAX_KB, 800);
    assert.equal(env.MAX_ATTACHMENT_BYTES, 800 * 1024);
    assert.equal(env.MAX_ATTACHMENT_BYTES, 819200);
  });

  await t.test('3. File below 800 KB (e.g. 200 KB) is accepted and recorded (HTTP 201)', async () => {
    const initialRecords = await db.getReceivedTransactions(testUnitId);
    const initialCount = initialRecords.length;

    // Create a 200 KB dummy buffer
    const smallBuffer = Buffer.alloc(200 * 1024, 0x42);
    const formData = new FormData();
    formData.append('item_name', 'Test 24-Port Switch');
    formData.append('category_id', '22222222-2222-2222-2222-222222222203');
    formData.append('quantity', '1');
    formData.append('date', '2026-11-04');
    formData.append('voucher_no', 'VR-SIZE-OK-01');
    formData.append('from_whom', 'Finco Furnitures');
    formData.append('unit_id', testUnitId);
    formData.append('voucher_image', new Blob([smallBuffer], { type: 'image/png' }), 'test_small.png');

    const res = await fetch(`${API_BASE}/transactions/received`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData
    });

    const json = await res.json();
    assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(json)}`);
    assert.equal(json.success, true);
    assert.ok(json.data.voucher_image_path, 'Expected voucher image path to be stored');

    // Verify record exists in DB
    const updatedRecords = await db.getReceivedTransactions(testUnitId);
    assert.equal(updatedRecords.length, initialCount + 1);
  });

  await t.test('4. File above 800 KB (e.g. 1.2 MB) is rejected with HTTP 413 and NO record created', async () => {
    const initialRecords = await db.getReceivedTransactions(testUnitId);
    const initialCount = initialRecords.length;

    // Create a 1.2 MB oversized buffer
    const largeBuffer = Buffer.alloc(Math.round(1.2 * 1024 * 1024), 0x58);
    const formData = new FormData();
    formData.append('item_name', 'Test Oversized Voucher Item');
    formData.append('category_id', '22222222-2222-2222-2222-222222222203');
    formData.append('quantity', '1');
    formData.append('date', '2026-11-04');
    formData.append('voucher_no', 'VR-SIZE-FAIL-01');
    formData.append('from_whom', 'Finco Furnitures');
    formData.append('unit_id', testUnitId);
    formData.append('voucher_image', new Blob([largeBuffer], { type: 'image/jpeg' }), 'large_photo.jpg');

    const res = await fetch(`${API_BASE}/transactions/received`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData
    });

    const json = await res.json();
    assert.equal(res.status, 413, `Expected HTTP 413, got ${res.status}: ${JSON.stringify(json)}`);
    assert.equal(json.success, false);
    assert.equal(json.error, 'LIMIT_FILE_SIZE');
    assert.ok(
      json.message.includes('File is too large') && json.message.includes('800 KB'),
      `Expected 800 KB message, got: ${json.message}`
    );

    // Verify NO record was saved in DB
    const afterRecords = await db.getReceivedTransactions(testUnitId);
    assert.equal(afterRecords.length, initialCount, 'Database record count should not increase on rejected upload');
    const created = afterRecords.find(r => r.voucher_no === 'VR-SIZE-FAIL-01');
    assert.equal(created, undefined, 'Rejected record must not exist in database');
  });

  await t.test('5. Non-image file (e.g. PDF) is rejected with HTTP 400 and NO record created', async () => {
    const initialRecords = await db.getReceivedTransactions(testUnitId);
    const initialCount = initialRecords.length;

    const pdfBuffer = Buffer.from('%PDF-1.4 test dummy content');
    const formData = new FormData();
    formData.append('item_name', 'Test PDF Voucher Item');
    formData.append('category_id', '22222222-2222-2222-2222-222222222203');
    formData.append('quantity', '1');
    formData.append('date', '2026-11-04');
    formData.append('voucher_no', 'VR-TYPE-FAIL-01');
    formData.append('from_whom', 'Finco Furnitures');
    formData.append('unit_id', testUnitId);
    formData.append('voucher_image', new Blob([pdfBuffer], { type: 'application/pdf' }), 'voucher.pdf');

    const res = await fetch(`${API_BASE}/transactions/received`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData
    });

    const json = await res.json();
    assert.equal(res.status, 400, `Expected HTTP 400, got ${res.status}`);
    assert.equal(json.success, false);
    assert.ok(json.message.includes('Only JPG, PNG, and WebP images are allowed'));

    const afterRecords = await db.getReceivedTransactions(testUnitId);
    assert.equal(afterRecords.length, initialCount);
  });

  await t.test('6. Updating existing record with oversized file rejects with HTTP 413 and preserves old data', async () => {
    const records = await db.getReceivedTransactions(testUnitId);
    const existing = records[0];
    assert.ok(existing, 'Expected an existing received record');

    const largeBuffer = Buffer.alloc(900 * 1024, 0x41);
    const formData = new FormData();
    formData.append('notes', 'Attempted oversized voucher update');
    formData.append('voucher_image', new Blob([largeBuffer], { type: 'image/png' }), 'oversized_update.png');

    const res = await fetch(`${API_BASE}/transactions/received/${existing.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData
    });

    const json = await res.json();
    assert.equal(res.status, 413);
    assert.equal(json.error, 'LIMIT_FILE_SIZE');

    // Confirm existing record remains unchanged
    const after = await ReceivedTransaction.findOne({ id: existing.id }).lean();
    assert.equal(after.notes, existing.notes);
    assert.equal(after.voucher_image_path, existing.voucher_image_path);
  });

  await t.test('7. StorageService throws LIMIT_FILE_SIZE error if file exceeds limit directly', async () => {
    const oversizedFile = {
      originalname: 'direct_oversized.jpg',
      size: 900 * 1024,
      buffer: Buffer.alloc(900 * 1024)
    };

    await assert.rejects(
      async () => {
        await storageService.uploadVoucher(oversizedFile, 'test-direct');
      },
      (err) => {
        return err.code === 'LIMIT_FILE_SIZE' && err.status === 413;
      }
    );
  });
});
