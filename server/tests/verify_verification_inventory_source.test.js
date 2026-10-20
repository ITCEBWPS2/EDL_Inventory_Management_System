const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../src/services/db');
const { Unit, Profile, UserUnit, InventoryItem, Verification, VerificationItem } = require('../src/models');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const verificationRoutes = require('../src/routes/verifications.routes');

test('Verification Inventory Data Source & Batch Row Expansion Test Suite', async (t) => {
  let app;
  let server;
  let baseUrl;
  let adminToken;
  let restrictedUserToken;
  let unitA;
  let unitB;
  let restrictedUser;

  await t.before(async () => {
    await setupTestDb();

    // Fetch seeded units or create test units
    const units = await Unit.find({}).lean();
    assert.ok(units.length >= 1, 'At least 1 unit should exist in test db');
    unitA = units[0];

    // Ensure a second unit exists for cross-unit isolation tests
    if (units.length > 1) {
      unitB = units[1];
    } else {
      unitB = await Unit.create({
        id: uuidv4(),
        unit_name: 'Test Unit B',
        unit_code: 'CSC_TEST_B',
        created_at: new Date().toISOString()
      });
    }

    const adminUser = await Profile.findOne({ role: 'super_admin' }).lean();
    adminToken = jwt.sign(
      {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        unitIds: [unitA.id, unitB.id]
      },
      process.env.JWT_SECRET || 'edl_ims_secure_jwt_secret_dev_key_2026',
      { expiresIn: '1h' }
    );

    restrictedUser = await Profile.create({
      id: uuidv4(),
      username: 'restricted_user',
      full_name: 'Restricted User',
      email: 'restricted.user@test.lk',
      password_hash: 'dummy_hash',
      role: 'employee',
      permission_level: 'read_write',
      unit_ids: [unitA.id]
    });

    await UserUnit.create({
      id: uuidv4(),
      user_id: restrictedUser.id,
      unit_id: unitA.id
    });

    restrictedUserToken = jwt.sign(
      {
        id: restrictedUser.id,
        email: restrictedUser.email,
        role: restrictedUser.role,
        permission_level: restrictedUser.permission_level,
        unitIds: [unitA.id]
      },
      process.env.JWT_SECRET || 'edl_ims_secure_jwt_secret_dev_key_2026',
      { expiresIn: '1h' }
    );

    app = express();
    app.use(express.json());
    app.use('/api/verifications', verificationRoutes);

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

  await t.test('1. Unit access rules apply to GET /api/verifications/inventory-items', async () => {
    // Missing unit_id -> 400
    const resNoUnit = await fetch(`${baseUrl}/api/verifications/inventory-items`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(resNoUnit.status, 400);

    // Restricted user accessing authorized unitA -> 200
    const resAuthUnit = await fetch(`${baseUrl}/api/verifications/inventory-items?unit_id=${unitA.id}`, {
      headers: { Authorization: `Bearer ${restrictedUserToken}` }
    });
    assert.strictEqual(resAuthUnit.status, 200);

    // Restricted user accessing unauthorized unitB -> 403
    const resForbidden = await fetch(`${baseUrl}/api/verifications/inventory-items?unit_id=${unitB.id}`, {
      headers: { Authorization: `Bearer ${restrictedUserToken}` }
    });
    assert.strictEqual(resForbidden.status, 403);

    // Super admin accessing unitB -> 200
    const resAdminUnitB = await fetch(`${baseUrl}/api/verifications/inventory-items?unit_id=${unitB.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(resAdminUnitB.status, 200);
  });

  await t.test('2. Inventory items endpoint returns only items for the requested unit', async () => {
    // Clean items for unitB first
    await InventoryItem.deleteMany({ unit_id: unitB.id });

    // Create item in unitB
    await InventoryItem.create({
      id: uuidv4(),
      unit_id: unitB.id,
      item_name: 'Unit B Exclusive Desk',
      item_code: 'TEST/UNITB/FUR/001',
      category: 'Furniture',
      sub_type: 'Table',
      quantity: 1,
      is_batch: false,
      serial_numbers: ['TEST/UNITB/FUR/001']
    });

    const resB = await fetch(`${baseUrl}/api/verifications/inventory-items?unit_id=${unitB.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const jsonB = await resB.json();
    assert.strictEqual(jsonB.success, true);
    assert.strictEqual(jsonB.data.length, 1);
    assert.strictEqual(jsonB.data[0].item_name, 'Unit B Exclusive Desk');
    assert.strictEqual(jsonB.data[0].item_code, 'TEST/UNITB/FUR/001');

    // Make sure unit A does not contain Unit B Exclusive Desk
    const resA = await fetch(`${baseUrl}/api/verifications/inventory-items?unit_id=${unitA.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const jsonA = await resA.json();
    assert.strictEqual(jsonA.success, true);
    const foundInA = jsonA.data.some(d => d.item_name === 'Unit B Exclusive Desk');
    assert.strictEqual(foundInA, false, 'Item from unit B must not appear in unit A');
  });

  await t.test('3. Row generation: Single items, Batch items (expanded 1 row per serial), and Bulk qty items', async () => {
    // Insert controlled set in unitB
    await InventoryItem.deleteMany({ unit_id: unitB.id });

    // Item 1: Single item (quantity 1)
    const singleItemId = uuidv4();
    await InventoryItem.create({
      id: singleItemId,
      unit_id: unitB.id,
      item_name: 'Executive Chair',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/EXEC-001',
      category: 'Furniture',
      sub_type: 'Chairs',
      quantity: 1,
      is_batch: false,
      serial_number: 'MFG-CHR-999',
      serial_numbers: ['DGM(WPSII)/CE(COM)/ITO/FUR/CHR/EXEC-001'],
      manufacturer_serial_numbers: ['MFG-CHR-999']
    });

    // Item 2: Batch item with 3 serial numbers
    const batchItemId = uuidv4();
    await InventoryItem.create({
      id: batchItemId,
      unit_id: unitB.id,
      item_name: 'Desktop Computer',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/CMP/PC-BATCH',
      category: 'IT & Computing Equipment',
      sub_type: 'Computers & Peripherals',
      quantity: 3,
      is_batch: true,
      serial_numbers: [
        'DGM(WPSII)/CE(COM)/ITO/CMP/PC-001',
        'DGM(WPSII)/CE(COM)/ITO/CMP/PC-002',
        'DGM(WPSII)/CE(COM)/ITO/CMP/PC-003'
      ],
      manufacturer_serial_numbers: [
        'DELL-SN-001',
        'DELL-SN-002',
        ''
      ]
    });

    // Item 3: Bulk item (quantity > 1, no individual serials)
    const bulkItemId = uuidv4();
    await InventoryItem.create({
      id: bulkItemId,
      unit_id: unitB.id,
      item_name: 'Patch Cord 2m',
      item_code: 'DGM(WPSII)/CE(COM)/ITO/NET/CAB-001',
      category: 'Network & Communication Equipment',
      sub_type: 'Network Cables',
      quantity: 10,
      is_batch: false,
      serial_numbers: []
    });

    const res = await fetch(`${baseUrl}/api/verifications/inventory-items?unit_id=${unitB.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const json = await res.json();
    assert.strictEqual(json.success, true);

    // Total rows: 1 (single) + 1 (batch item) + 1 (bulk) = 3 rows (ONE row per inventory item)
    assert.strictEqual(json.data.length, 3, `Expected 3 verification rows (1 per item), got ${json.data.length}`);

    // Verify Single item row
    const singleRow = json.data.find(r => r.inventory_item_id === singleItemId);
    assert.ok(singleRow);
    assert.strictEqual(singleRow.system_qty, 1);
    assert.strictEqual(singleRow.item_code, 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/EXEC-001');
    assert.strictEqual(singleRow.manufacturer_sn, 'MFG-CHR-999');
    assert.deepStrictEqual(singleRow.serial_numbers, ['DGM(WPSII)/CE(COM)/ITO/FUR/CHR/EXEC-001']);

    // Verify Batch item row: ONE row with total system_qty = 3 and all serials listed
    const batchRow = json.data.find(r => r.inventory_item_id === batchItemId);
    assert.ok(batchRow, 'Batch item must produce ONE row');
    assert.strictEqual(batchRow.system_qty, 3, 'Batch item row must show total quantity as system_qty');
    assert.strictEqual(batchRow.is_batch, true);
    assert.strictEqual(batchRow.serial_numbers.length, 3);
    assert.strictEqual(batchRow.serial_numbers[0], 'DGM(WPSII)/CE(COM)/ITO/CMP/PC-001');
    assert.strictEqual(batchRow.serial_numbers[1], 'DGM(WPSII)/CE(COM)/ITO/CMP/PC-002');
    assert.strictEqual(batchRow.serial_numbers[2], 'DGM(WPSII)/CE(COM)/ITO/CMP/PC-003');
    assert.deepStrictEqual(batchRow.manufacturer_serial_numbers, ['DELL-SN-001', 'DELL-SN-002', '']);

    // Verify Bulk item row
    const bulkRow = json.data.find(r => r.inventory_item_id === bulkItemId);
    assert.ok(bulkRow);
    assert.strictEqual(bulkRow.system_qty, 10, 'Bulk item row must preserve inventory quantity');
  });

  await t.test('4. Rows are sorted stably by category, sub-category, item name, then serial number', async () => {
    const res = await fetch(`${baseUrl}/api/verifications/inventory-items?unit_id=${unitB.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const json = await res.json();
    const rows = json.data;

    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i];
      const b = rows[i + 1];

      const catComp = (a.category || '').localeCompare(b.category || '');
      if (catComp < 0) continue;
      assert.ok(catComp <= 0, `Sort violation on category: ${a.category} vs ${b.category}`);

      const subComp = (a.sub_type || '').localeCompare(b.sub_type || '');
      if (subComp < 0) continue;
      assert.ok(subComp <= 0, `Sort violation on sub_type: ${a.sub_type} vs ${b.sub_type}`);

      const nameComp = (a.item_name || '').localeCompare(b.item_name || '');
      if (nameComp < 0) continue;
      assert.ok(nameComp <= 0, `Sort violation on item_name: ${a.item_name} vs ${b.item_name}`);

      const snComp = (a.item_code || '').localeCompare(b.item_code || '', undefined, { numeric: true });
      assert.ok(snComp <= 0, `Sort violation on serial: ${a.item_code} vs ${b.item_code}`);
    }
  });

  await t.test('5. Creating/confirming a verification stores item_id, system_qty and serial_numbers array', async () => {
    // Fetch unitB items to verify
    const invRes = await fetch(`${baseUrl}/api/verifications/inventory-items?unit_id=${unitB.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const invJson = await invRes.json();
    assert.ok(invJson.data.length > 0);

    const verificationPayload = {
      unit_id: unitB.id,
      year: 2026,
      date: '2026-10-14',
      verifier_1: 'Engineer A',
      verifier_2: 'Technician B',
      summary: 'Annual verification completed',
      status: 'confirmed',
      items: invJson.data.map(item => ({
        id: uuidv4(),
        item_id: item.inventory_item_id,
        item_code: item.item_code,
        serial_numbers: item.serial_numbers || [],
        manufacturer_serial_numbers: item.manufacturer_serial_numbers || [],
        is_batch: item.is_batch || false,
        manufacturer_sn: item.manufacturer_sn,
        item_name: item.item_name,
        category: item.category,
        system_qty: item.system_qty,
        physical_qty: item.system_qty,
        difference: 0,
        condition: 'Good',
        label_no: 'VL-1001',
        remarks: 'Verified intact',
        status: 'Matched'
      }))
    };

    const createRes = await fetch(`${baseUrl}/api/verifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(verificationPayload)
    });
    const createJson = await createRes.json();
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createJson.success, true);
    assert.ok(createJson.data.id);

    // Verify stored VerificationItem records in db
    const savedItems = await VerificationItem.find({ verification_id: createJson.data.id }).lean();
    assert.strictEqual(savedItems.length, invJson.data.length);
    for (const saved of savedItems) {
      assert.ok(saved.item_id, 'Verification item must have item_id');
      assert.ok(Array.isArray(saved.serial_numbers), 'Verification item must have serial_numbers array');
    }

    const batchSaved = savedItems.find(s => s.system_qty === 3);
    assert.ok(batchSaved, 'Saved batch item must exist');
    assert.strictEqual(batchSaved.serial_numbers.length, 3);
    assert.strictEqual(batchSaved.is_batch, true);

    // Verify history-items endpoint returns the stored item_id and serial_numbers array
    const histRes = await fetch(`${baseUrl}/api/verifications/history-items?unit_id=${unitB.id}&year=2026`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const histJson = await histRes.json();
    assert.strictEqual(histJson.success, true);
    assert.strictEqual(histJson.data.length, invJson.data.length);
    const histBatch = histJson.data.find(h => h.system_qty === 3);
    assert.ok(histBatch);
    assert.strictEqual(histBatch.serial_numbers.length, 3);
  });

  await t.test('6. Backwards compatibility: legacy verification items with only single item_code load properly', async () => {
    // Insert a legacy verification record and item
    const legacyVerifId = uuidv4();
    await Verification.create({
      id: legacyVerifId,
      unit_id: unitB.id,
      year: 2025,
      date: '2025-05-10',
      status: 'confirmed',
      verifier_1: 'Old Verifier'
    });

    await VerificationItem.create({
      id: uuidv4(),
      verification_id: legacyVerifId,
      item_id: uuidv4(),
      item_code: 'LEGACY-OLD-SN-001',
      manufacturer_sn: 'LEGACY-MFG-001',
      // serial_numbers is undefined/empty in legacy record
      serial_numbers: [],
      item_name: 'Legacy Dot Matrix Printer',
      category: 'IT & Computing Equipment',
      system_qty: 1,
      physical_qty: 1,
      difference: 0,
      condition: 'Good',
      label_no: 'OLD-LABEL-1',
      status: 'Matched'
    });

    const histRes = await fetch(`${baseUrl}/api/verifications/history-items?unit_id=${unitB.id}&year=2025`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const histJson = await histRes.json();
    assert.strictEqual(histJson.success, true);
    const legacyItem = histJson.data.find(h => h.item_code === 'LEGACY-OLD-SN-001');
    assert.ok(legacyItem, 'Legacy item must be found in history-items');
    assert.strictEqual(legacyItem.item_code, 'LEGACY-OLD-SN-001');
    assert.deepStrictEqual(legacyItem.serial_numbers, ['LEGACY-OLD-SN-001'], 'Legacy single item_code should be normalized to serial_numbers array');
  });

  await t.test('7. Sample unit row count report (items vs 1-row-per-batch verification rows)', async () => {
    // Find a unit with items in DB
    const anyItem = await InventoryItem.findOne({ unit_id: { $exists: true, $ne: null } }).lean();
    assert.ok(anyItem, 'At least one inventory item should exist in the database');
    const sampleUnit = await Unit.findOne({ id: anyItem.unit_id }).lean();
    assert.ok(sampleUnit, 'Sample unit should exist');

    const rawItemsCount = await InventoryItem.countDocuments({ unit_id: sampleUnit.id });
    const res = await fetch(`${baseUrl}/api/verifications/inventory-items?unit_id=${sampleUnit.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const json = await res.json();
    assert.strictEqual(json.success, true);
    const verificationRowsCount = json.data.length;

    console.log(`\nSample Unit (${sampleUnit.unit_code || sampleUnit.unit_name}) Row Count Analysis:`);
    console.log(`  - Raw inventory items in DB: ${rawItemsCount}`);
    console.log(`  - Verification rows (1 row per batch item): ${verificationRowsCount}`);
    assert.strictEqual(verificationRowsCount, rawItemsCount, 'Verification rows should equal raw items count (1 row per inventory item)');
  });
});
