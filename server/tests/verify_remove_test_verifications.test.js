const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  Unit,
  Verification,
  VerificationItem,
  IssuedDestroyedItem
} = require('../src/models');
const removeTestVerifications = require('../src/scripts/remove-test-verifications');
const { setupTestDb, teardownTestDb } = require('./testHelper');

test('Remove Test Verifications Script Test Suite', async (t) => {
  await setupTestDb();

  // Setup test data for ITO
  let itoUnit = await Unit.findOne({ unit_code: 'WPS-ITO' });
  if (!itoUnit) {
    itoUnit = await Unit.create({
      id: '11111111-1111-1111-1111-111111111153',
      unit_name: 'ITO',
      unit_code: 'WPS-ITO',
      unit_type: 'unit'
    });
  }

  const verifVithanageId = 'verif-vithanage-official';
  const testVerif1Id = 'e7f3a952-c25b-4a9a-a4b2-b18c14fa6c29';
  const testVerif2Id = 'bbba5b5f-c645-4a81-9669-c8adbb624801';

  // 1. Official verification (must be preserved)
  await Verification.create({
    id: verifVithanageId,
    unit_id: itoUnit.id,
    date: '2026-10-14',
    year: 2026,
    verifier_1: 'P.M.M.Vithanage',
    verifier_2: 'K.A.D.S.Mendis',
    verifier_3: 'G.M.I.Swarnamali',
    verified_by: ['P.M.M.Vithanage', 'K.A.D.S.Mendis', 'G.M.I.Swarnamali'],
    status: 'confirmed'
  });
  await VerificationItem.create({
    id: 'item-official-1',
    verification_id: verifVithanageId,
    item_name: 'Collar Mic & Wireless Transmitter',
    system_qty: 1,
    physical_qty: 1,
    condition: 'Good',
    status: 'Matched'
  });

  // 2. Test Verification 1: ghb, gvb n, cgvb n
  await Verification.create({
    id: testVerif1Id,
    unit_id: itoUnit.id,
    date: '2026-11-04',
    year: 2026,
    verifier_1: 'ghb',
    verifier_2: 'gvb n',
    verifier_3: 'cgvb n',
    verified_by: ['ghb', 'gvb n', 'cgvb n'],
    status: 'confirmed'
  });
  await VerificationItem.create({
    id: 'test-item-1',
    verification_id: testVerif1Id,
    item_name: 'Collar Mic & Wireless Transmitter',
    system_qty: 1,
    physical_qty: 1,
    condition: 'Good',
    status: 'Matched'
  });
  await VerificationItem.create({
    id: 'test-item-1-placeholder',
    verification_id: testVerif1Id,
    item_name: 'JBL Speaker',
    system_qty: 1,
    physical_qty: null,
    condition: 'Good',
    status: 'Not Counted'
  });

  // 3. Test Verification 2: jbnj, hvjb, hgv
  await Verification.create({
    id: testVerif2Id,
    unit_id: itoUnit.id,
    date: '2026-11-04',
    year: 2026,
    verifier_1: 'jbnj',
    verifier_2: 'hvjb',
    verifier_3: 'hgv',
    verified_by: ['jbnj', 'hvjb', 'hgv'],
    status: 'confirmed'
  });
  await VerificationItem.create({
    id: 'test-item-2',
    verification_id: testVerif2Id,
    item_name: 'Collar Mic & Wireless Transmitter',
    system_qty: 1,
    physical_qty: 1,
    condition: 'Fair',
    status: 'Matched'
  });
  await VerificationItem.create({
    id: 'test-item-2-placeholder',
    verification_id: testVerif2Id,
    item_name: 'JBL Speaker',
    system_qty: 1,
    physical_qty: null,
    condition: 'Good',
    status: 'Not Counted'
  });

  await t.test('1. Dry-run mode does NOT delete any records', async () => {
    const res = await removeTestVerifications({ confirm: false, keepConnection: true });
    assert.strictEqual(res.dryRun, true);
    assert.strictEqual(res.matchedVerificationsCount, 2);
    assert.strictEqual(res.matchedItemsCount, 4);

    // Records must still exist
    const test1 = await Verification.findOne({ id: testVerif1Id });
    const test2 = await Verification.findOne({ id: testVerif2Id });
    assert.ok(test1, 'Test verification 1 must still exist after dry-run');
    assert.ok(test2, 'Test verification 2 must still exist after dry-run');
  });

  await t.test('2. Confirmed run removes target test verifications and their items', async () => {
    const res = await removeTestVerifications({ confirm: true, keepConnection: true });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.deletedVerifications, 2);
    assert.strictEqual(res.deletedItems, 4);

    // Both test verifications and their line items must be gone
    const test1 = await Verification.findOne({ id: testVerif1Id });
    const test2 = await Verification.findOne({ id: testVerif2Id });
    assert.strictEqual(test1, null);
    assert.strictEqual(test2, null);

    const testItem1 = await VerificationItem.findOne({ id: 'test-item-1' });
    const testItem2 = await VerificationItem.findOne({ id: 'test-item-2' });
    assert.strictEqual(testItem1, null);
    assert.strictEqual(testItem2, null);

    // Official verification must be completely untouched
    const officialVerif = await Verification.findOne({ id: verifVithanageId });
    assert.ok(officialVerif, 'Official verification must still exist');

    const officialItem = await VerificationItem.findOne({ id: 'item-official-1' });
    assert.ok(officialItem, 'Official verification item must still exist');
  });

  await t.test('3. Running script again is idempotent and finds nothing to delete', async () => {
    const res = await removeTestVerifications({ confirm: true, keepConnection: true });
    assert.strictEqual(res.deletedVerifications, 0);
    assert.strictEqual(res.deletedItems, 0);
  });

  await t.test('4. Safety guard aborts if connected database is not edl_ims', async () => {
    const originalName = mongoose.connection.name;
    Object.defineProperty(mongoose.connection, 'name', { value: 'bus-booking', configurable: true });

    await assert.rejects(
      async () => {
        await removeTestVerifications({ confirm: false, keepConnection: true });
      },
      /Connected database is "bus-booking", expected "edl_ims"/
    );

    Object.defineProperty(mongoose.connection, 'name', { value: originalName, configurable: true });
  });

  await teardownTestDb();
});

