const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const { Unit, Profile, UserUnit, InventoryItem } = require('../src/models');
const migrateUnits = require('../src/scripts/migrate-units-horana');
const db = require('../src/services/db');

const WPS_II_ID = '11111111-1111-1111-1111-111111111003';
const HORANA_ID = '11111111-1111-1111-1111-111111111140';

const EXPECTED_REPARENTED_CODES = [
  'HOR-AREA-JAPURA',
  'HOR-COMMERCIAL',
  'HOR-CONSTRUCTION',
  'CSC-HOKANDARA',
  'CSC-HOMAGAMA',
  'CSC-MALAMBE',
  'CSC-PANNIPITIYA',
  'CSC-THALANGAMA',
  'CSC-WALIWITA',
  'DD3-METER-LAB',
  'HOR-DM-EM',
  'HOR-HRO',
  'HOR-ITO'
];

const EXPECTED_HORANA_CHILD_CODES = [
  'AMU-HORANA',
  'CSC-BULATHSINHALA',
  'CSC-HORANA',
  'CSC-INGIRIYA',
  'CSC-MORAGAHAHENA'
];

test.describe('Organizational Unit Hierarchy & Migration Tests', () => {
  test.beforeEach(async () => {
    await setupTestDb();
  });

  test.afterEach(async () => {
    await teardownTestDb();
  });

  test('1. Fresh seed creates 36 units with correct hierarchy under WPS-II and AREA HORANA', async () => {
    const totalUnits = await Unit.countDocuments();
    assert.equal(totalUnits, 36, `Expected 36 units seeded, got ${totalUnits}`);

    // WPS-II exists
    const wps2 = await Unit.findOne({ id: WPS_II_ID });
    assert.ok(wps2, 'WPS-II must exist');

    // 13 units are direct children of WPS-II
    const wpsChildren = await Unit.find({ parent_unit_id: WPS_II_ID }).lean();
    const wpsChildCodes = wpsChildren.map(u => u.unit_code);

    for (const code of EXPECTED_REPARENTED_CODES) {
      assert.ok(
        wpsChildCodes.includes(code),
        `Unit with code ${code} must be a direct child of WPS-II`
      );
    }

    // AREA HORANA exists and is under WPS-II
    const horana = await Unit.findOne({ id: HORANA_ID });
    assert.ok(horana, 'AREA HORANA must exist');
    assert.equal(horana.parent_unit_id, WPS_II_ID, 'AREA HORANA must be under WPS-II');

    // AREA HORANA has exactly the 5 new children
    const horanaChildren = await Unit.find({ parent_unit_id: HORANA_ID }).lean();
    assert.equal(
      horanaChildren.length,
      5,
      `AREA HORANA must have exactly 5 children, got ${horanaChildren.length}`
    );

    const horanaChildCodes = horanaChildren.map(u => u.unit_code);
    for (const code of EXPECTED_HORANA_CHILD_CODES) {
      assert.ok(
        horanaChildCodes.includes(code),
        `Unit with code ${code} must be under AREA HORANA`
      );
    }

    // Verify exact display names of the 5 new units
    const amuHorana = horanaChildren.find(u => u.unit_code === 'AMU-HORANA');
    assert.equal(amuHorana.unit_name, 'AMU-Horana');
    assert.equal(amuHorana.unit_type, 'unit');
    assert.equal(amuHorana.location, 'Area Maintenance Unit, Horana');

    const cscBulathsinhala = horanaChildren.find(u => u.unit_code === 'CSC-BULATHSINHALA');
    assert.equal(cscBulathsinhala.unit_name, 'CSC BULATHSINHALA');
    assert.equal(cscBulathsinhala.unit_type, 'csc');
    assert.equal(cscBulathsinhala.location, 'Customer Service Center, Bulathsinhala');

    const cscHorana = horanaChildren.find(u => u.unit_code === 'CSC-HORANA');
    assert.equal(cscHorana.unit_name, 'CSC HORANA');
    assert.equal(cscHorana.unit_type, 'csc');

    const cscIngiriya = horanaChildren.find(u => u.unit_code === 'CSC-INGIRIYA');
    assert.equal(cscIngiriya.unit_name, 'CSC INGIRIYA');
    assert.equal(cscIngiriya.unit_type, 'csc');

    const cscMoragahahena = horanaChildren.find(u => u.unit_code === 'CSC-MORAGAHAHENA');
    assert.equal(cscMoragahahena.unit_name, 'CSC MORAGAHAHENA');
    assert.equal(cscMoragahahena.unit_type, 'csc');
  });

  test('2. Existing references, CSC_HOMAGAMA inventory items, and user units remain intact', async () => {
    // Check CSC_HOMAGAMA ID and inventory
    const homagama = await Unit.findOne({ unit_code: 'CSC-HOMAGAMA' });
    assert.ok(homagama);
    assert.equal(homagama.id, '11111111-1111-1111-1111-111111111145');
    assert.equal(homagama.parent_unit_id, WPS_II_ID);

    // Items under Homagama
    const homagamaItems = await InventoryItem.find({ unit_id: homagama.id });
    assert.ok(homagamaItems.length > 0, 'CSC_HOMAGAMA must retain its inventory items');

    // User units assigned to Homagama
    const userUnitsHomagama = await UserUnit.find({ unit_id: homagama.id });
    assert.ok(userUnitsHomagama.length > 0, 'Staff assigned to Homagama must remain assigned');

    // ITO Unit
    const ito = await Unit.findOne({ unit_code: 'HOR-ITO' });
    assert.ok(ito);
    assert.equal(ito.id, '11111111-1111-1111-1111-111111111153');
    assert.equal(ito.parent_unit_id, WPS_II_ID);
  });

  test('3. Migration script runs idempotently without creating duplicates', async () => {
    // Run migration when already up to date
    const result1 = await migrateUnits({ disconnect: false });
    assert.equal(result1.createdCount, 0, 'Should create 0 units when already up to date');
    assert.equal(result1.reparentedCount, 0, 'Should reparent 0 units when already up to date');
    assert.equal(result1.upToDateCount, 18, 'All 18 units should be already up to date');

    const countAfter1 = await Unit.countDocuments();
    assert.equal(countAfter1, 36);

    // Simulate old state: revert 13 units to AREA HORANA, remove 5 new units
    await Unit.updateMany(
      { unit_code: { $in: EXPECTED_REPARENTED_CODES } },
      { $set: { parent_unit_id: HORANA_ID } }
    );
    await Unit.deleteMany({ unit_code: { $in: EXPECTED_HORANA_CHILD_CODES } });

    const revertedCount = await Unit.countDocuments();
    assert.equal(revertedCount, 31);

    // Run migration
    const result2 = await migrateUnits({ disconnect: false });
    assert.equal(result2.createdCount, 5, 'Should create 5 new units under Horana');
    assert.equal(result2.reparentedCount, 13, 'Should reparent 13 units to WPS-II');
    assert.equal(result2.upToDateCount, 0);

    const finalCount = await Unit.countDocuments();
    assert.equal(finalCount, 36);

    // Run again immediately to verify idempotency
    const result3 = await migrateUnits({ disconnect: false });
    assert.equal(result3.createdCount, 0);
    assert.equal(result3.reparentedCount, 0);
    assert.equal(result3.upToDateCount, 18);

    const finalCount2 = await Unit.countDocuments();
    assert.equal(finalCount2, 36);
  });

  test('4. db.getDescendantUnitIds returns all descendants recursively', async () => {
    const wpsDescendants = await db.getDescendantUnitIds(WPS_II_ID);
    assert.ok(wpsDescendants.includes(WPS_II_ID));
    assert.ok(wpsDescendants.includes(HORANA_ID));

    // Must include 13 units re-parented under WPS-II
    for (const code of EXPECTED_REPARENTED_CODES) {
      const u = await Unit.findOne({ unit_code: code });
      assert.ok(wpsDescendants.includes(u.id), `${code} must be a descendant of WPS-II`);
    }

    // Must include 5 units under AREA HORANA
    for (const code of EXPECTED_HORANA_CHILD_CODES) {
      const u = await Unit.findOne({ unit_code: code });
      assert.ok(wpsDescendants.includes(u.id), `${code} must be a descendant of WPS-II via Horana`);
    }

    // AREA HORANA descendants
    const horanaDescendants = await db.getDescendantUnitIds(HORANA_ID);
    assert.ok(horanaDescendants.includes(HORANA_ID));
    assert.equal(horanaDescendants.length, 6, 'HORANA + 5 children = 6');
    for (const code of EXPECTED_HORANA_CHILD_CODES) {
      const u = await Unit.findOne({ unit_code: code });
      assert.ok(horanaDescendants.includes(u.id), `${code} must be a descendant of Horana`);
    }
  });

  test('5. PLANNING branch has sort_order 999 and is the last child under WPS-II', async () => {
    const planning = await Unit.findOne({ unit_code: 'PLANNING-WPS-II' });
    assert.ok(planning);
    assert.equal(planning.sort_order, 999, 'PLANNING must have sort_order 999');

    // Check sibling order under WPS-II using sort_order
    const wpsChildren = await Unit.find({ parent_unit_id: WPS_II_ID }).lean();
    wpsChildren.sort((a, b) => {
      const orderA = a.sort_order !== undefined && a.sort_order !== null ? Number(a.sort_order) : 0;
      const orderB = b.sort_order !== undefined && b.sort_order !== null ? Number(b.sort_order) : 0;
      return orderA - orderB;
    });

    const lastChild = wpsChildren[wpsChildren.length - 1];
    assert.equal(lastChild.unit_code, 'PLANNING-WPS-II', 'Last child under WPS-II must be PLANNING');

    // Child of PLANNING is CALL CENTER & DCC
    const planningChildren = await Unit.find({ parent_unit_id: planning.id }).lean();
    assert.equal(planningChildren.length, 1);
    assert.equal(planningChildren[0].unit_code, 'CALL-CENTER-DCC');
  });

  test('6. migrateUnitOrder script runs idempotently without errors', async () => {
    const migrateUnitOrder = require('../src/scripts/migrate-unit-order');

    // Revert PLANNING sort_order to test migration
    await Unit.updateOne({ unit_code: 'PLANNING-WPS-II' }, { $set: { sort_order: 0 } });
    const reverted = await Unit.findOne({ unit_code: 'PLANNING-WPS-II' });
    assert.equal(reverted.sort_order, 0);

    // Run migration
    const res1 = await migrateUnitOrder({ disconnect: false });
    assert.equal(res1.planningUpdated, true);
    assert.equal(res1.lastChildName, 'PLANNING');

    const updated = await Unit.findOne({ unit_code: 'PLANNING-WPS-II' });
    assert.equal(updated.sort_order, 999);

    // Run second time (idempotency)
    const res2 = await migrateUnitOrder({ disconnect: false });
    assert.equal(res2.planningUpdated, false);
    assert.equal(res2.lastChildName, 'PLANNING');
  });
});
