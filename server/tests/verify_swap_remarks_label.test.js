const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  Unit,
  Verification,
  VerificationItem
} = require('../src/models');
const swapVerificationRemarksLabel = require('../src/scripts/swap-verification-remarks-label');
const { setupTestDb, teardownTestDb } = require('./testHelper');

test('Swap Verification Remarks & Label Script Test Suite', async (t) => {
  await setupTestDb();

  // Ensure ITO Unit exists
  let itoUnit = await Unit.findOne({ unit_code: 'WPS-ITO' });
  if (!itoUnit) {
    itoUnit = await Unit.create({
      id: '11111111-1111-1111-1111-111111111153',
      unit_name: 'ITO',
      unit_code: 'WPS-ITO',
      unit_type: 'unit'
    });
  }

  const verifId = 'test-verif-ito-2026';
  const targetItemId = 'test-item-tab-001';
  const otherItemId = 'test-item-printer-002';

  const WRONG_REMARKS = 'IT/Tab/01-IT/Tab/03';
  const WRONG_LABEL = 'WB No.57699-CE Homagama-03, WB No.577700-EE (MM)-01 WB NO. 210501-CE Horana-05, WB No.210505-EE (DM)-01, WB No.210522-CC DGM (WPS II)-01';

  // Seed confirmed verification
  await Verification.create({
    id: verifId,
    unit_id: itoUnit.id,
    date: '2026-10-14',
    year: 2026,
    verifier_1: 'P.M.M.Vithanage',
    verifier_2: 'K.A.D.S.Mendis',
    verifier_3: 'G.M.I.Swarnamali',
    status: 'confirmed'
  });

  // Seed target item with swapped fields
  await VerificationItem.create({
    id: targetItemId,
    verification_id: verifId,
    item_name: 'Tab',
    system_qty: 18,
    physical_qty: 18,
    issued_destroyed: 'Issued',
    issued_destroyed_qty: 15,
    remarks: WRONG_REMARKS,
    label_no: WRONG_LABEL,
    status: 'Matched',
    condition: 'Good'
  });

  // Seed another item that has a suspicious long label for audit check
  await VerificationItem.create({
    id: otherItemId,
    verification_id: verifId,
    item_name: 'Other Equipment',
    system_qty: 5,
    physical_qty: 5,
    remarks: 'Regular remark',
    label_no: 'WB No. 12345-Sample Location Long Label That Exceeds Forty Characters',
    status: 'Matched',
    condition: 'Good'
  });

  await t.test('1. Dry-run mode correctly identifies target item and does NOT modify the database', async () => {
    const res = await swapVerificationRemarksLabel({ confirm: false, keepConnection: true });
    assert.strictEqual(res.dryRun, true);
    assert.strictEqual(res.targetId, targetItemId);
    assert.strictEqual(res.oldRemarks, WRONG_REMARKS);
    assert.strictEqual(res.oldLabelNo, WRONG_LABEL);
    assert.strictEqual(res.newRemarks, WRONG_LABEL);
    assert.strictEqual(res.newLabelNo, WRONG_REMARKS);

    // Verify DB record is untouched
    const itemInDb = await VerificationItem.findOne({ id: targetItemId });
    assert.strictEqual(itemInDb.remarks, WRONG_REMARKS);
    assert.strictEqual(itemInDb.label_no, WRONG_LABEL);
  });

  await t.test('2. Confirmed run swaps remarks and label_no and updates updated_at', async () => {
    const res = await swapVerificationRemarksLabel({ confirm: true, keepConnection: true });
    assert.strictEqual(res.swappedCount, 1);
    assert.strictEqual(res.targetId, targetItemId);

    // Verify in DB
    const updated = await VerificationItem.findOne({ id: targetItemId });
    assert.strictEqual(updated.label_no, WRONG_REMARKS, 'label_no should now be the IT/Tab label');
    assert.strictEqual(updated.remarks, WRONG_LABEL, 'remarks should now be the long WB text');
    assert.ok(updated.updated_at, 'updated_at should be updated');

    // Other items must remain untouched
    const otherInDb = await VerificationItem.findOne({ id: otherItemId });
    assert.strictEqual(otherInDb.remarks, 'Regular remark');
    assert.strictEqual(otherInDb.label_no, 'WB No. 12345-Sample Location Long Label That Exceeds Forty Characters');
  });

  await t.test('3. Running script again does NOT swap back and reports already correct', async () => {
    const res = await swapVerificationRemarksLabel({ confirm: true, keepConnection: true });
    assert.strictEqual(res.swappedCount, 0);
    assert.strictEqual(res.alreadyCorrect, true);

    // Verify values remain swapped correctly
    const afterSecondRun = await VerificationItem.findOne({ id: targetItemId });
    assert.strictEqual(afterSecondRun.label_no, WRONG_REMARKS);
    assert.strictEqual(afterSecondRun.remarks, WRONG_LABEL);
  });

  await t.test('4. Safety guard aborts if connected database is not edl_ims', async () => {
    const originalName = mongoose.connection.name;
    Object.defineProperty(mongoose.connection, 'name', { value: 'bus-booking', configurable: true });

    await assert.rejects(
      async () => {
        await swapVerificationRemarksLabel({ confirm: false, keepConnection: true });
      },
      /Connected database is "bus-booking", expected "edl_ims"/
    );

    Object.defineProperty(mongoose.connection, 'name', { value: originalName, configurable: true });
  });

  await teardownTestDb();
});
