const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  Unit,
  Verification,
  VerificationItem,
  InventoryItem
} = require('../src/models');
const db = require('../src/services/db');
const removeVerificationRecord = require('../src/scripts/remove-verification-record');
const { setupTestDb, teardownTestDb } = require('./testHelper');

test('Remove Verification Record Script Test Suite', async (t) => {
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

  const verifVithanageId = 'verif-vithanage-12345';
  const verifGaminiId = 'verif-gamini-67890';
  const gaminiChairItemId = 'item-gamini-chair-001';
  const gaminiPlaceholderId = 'item-gamini-placeholder-002';
  const vithanageChairItemId = 'item-vithanage-chair-001';

  // Verification 1: P.M.M.Vithanage, K.A.D.S.Mendis, G.M.I.Swarnamali
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
    id: vithanageChairItemId,
    verification_id: verifVithanageId,
    item_name: 'Computer Typist Chair',
    system_qty: 11,
    physical_qty: 11,
    status: 'Matched',
    condition: 'Good',
    label_no: 'FF/CH/04-FF/CH/14',
    serial_numbers: [
      'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/COMP-TYPIST-CHR-001',
      'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/COMP-TYPIST-CHR-002'
    ]
  });

  // Verification 2: Gamini Wickramasinghe
  await Verification.create({
    id: verifGaminiId,
    unit_id: itoUnit.id,
    date: '2026-10-14',
    year: 2026,
    verifier_1: 'Gamini Wickramasinghe',
    verifier_2: '',
    verifier_3: '',
    verified_by: ['Gamini Wickramasinghe'],
    status: 'confirmed'
  });

  await VerificationItem.create({
    id: gaminiChairItemId,
    verification_id: verifGaminiId,
    item_name: 'Computer Typist Chair',
    system_qty: 11,
    physical_qty: 11,
    status: 'Matched',
    condition: 'Good',
    label_no: '',
    serial_numbers: [
      'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/COMP-TYPIST-CHR-001',
      'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/COMP-TYPIST-CHR-002'
    ]
  });

  // Also add an uncounted placeholder in Gamini's verification
  await VerificationItem.create({
    id: gaminiPlaceholderId,
    verification_id: verifGaminiId,
    item_name: 'Printer',
    system_qty: 1,
    physical_qty: null,
    status: 'Not Counted',
    condition: 'Good'
  });

  await t.test('1. Dry-run mode does NOT delete any records', async () => {
    const res = await removeVerificationRecord({ confirm: false, keepConnection: true });
    assert.strictEqual(res.dryRun, true);
    assert.strictEqual(res.candidateItemsCount, 1);

    // Verify records still exist in MongoDB
    const chairInDb = await VerificationItem.findOne({ id: gaminiChairItemId });
    assert.ok(chairInDb, 'Target chair line item should still exist after dry-run');

    const headerInDb = await Verification.findOne({ id: verifGaminiId });
    assert.ok(headerInDb, 'Parent verification header should still exist after dry-run');
  });

  await t.test('2. Confirmed run removes target item, clean placeholders, and removes parent verification header', async () => {
    const res = await removeVerificationRecord({ confirm: true, keepConnection: true });
    assert.strictEqual(res.deletedItems, 1);
    assert.strictEqual(res.deletedHeaders, 1);
    assert.strictEqual(res.deletedPlaceholders, 1);

    // Target item must be deleted
    const chairInDb = await VerificationItem.findOne({ id: gaminiChairItemId });
    assert.strictEqual(chairInDb, null, 'Gamini chair item should be deleted');

    // Placeholders for that verification must be deleted
    const placeholderInDb = await VerificationItem.findOne({ id: gaminiPlaceholderId });
    assert.strictEqual(placeholderInDb, null, 'Gamini placeholder should be deleted');

    // Gamini verification header must be deleted
    const headerInDb = await Verification.findOne({ id: verifGaminiId });
    assert.strictEqual(headerInDb, null, 'Gamini verification header should be deleted');

    // Vithanage verification must remain 100% intact!
    const vithanageHeader = await Verification.findOne({ id: verifVithanageId });
    assert.ok(vithanageHeader, 'Vithanage verification header must still exist');

    const vithanageChair = await VerificationItem.findOne({ id: vithanageChairItemId });
    assert.ok(vithanageChair, 'Vithanage chair line item must still exist');
  });

  await t.test('3. Running script again is idempotent and finds nothing to delete', async () => {
    const res = await removeVerificationRecord({ confirm: true, keepConnection: true });
    assert.strictEqual(res.deletedItems, 0);
    assert.strictEqual(res.deletedHeaders, 0);
  });

  await t.test('4. Safety guard aborts if connected database is not edl_ims', async () => {
    // Temporarily override db name
    const originalName = mongoose.connection.name;
    Object.defineProperty(mongoose.connection, 'name', { value: 'bus-booking', configurable: true });

    await assert.rejects(
      async () => {
        await removeVerificationRecord({ confirm: false, keepConnection: true });
      },
      /Connected database is "bus-booking", expected "edl_ims"/
    );

    // Restore original db name
    Object.defineProperty(mongoose.connection, 'name', { value: originalName, configurable: true });
  });

  await teardownTestDb();
});
