const { v4: uuidv4 } = require('uuid');
const { connect, disconnect, mongoose } = require('../config/mongo');
const { Unit, Profile, UserUnit } = require('../models');

const WPS_II_ID = '11111111-1111-1111-1111-111111111003';
const HORANA_ID = '11111111-1111-1111-1111-111111111140';

// 13 units to be placed directly under WPS-II
const unitsToReparent = [
  { unit_name: 'AREA JAPURA', unit_code: 'WPS-AREA-JAPURA', old_unit_code: 'HOR-AREA-JAPURA', unit_type: 'unit', location: 'Japura Operations Sub-Office, WPS-II', defaultId: '11111111-1111-1111-1111-111111111141' },
  { unit_name: 'COMMERCIAL', unit_code: 'WPS-COMMERCIAL', old_unit_code: 'HOR-COMMERCIAL', unit_type: 'unit', location: 'Commercial Operations Branch, WPS-II', defaultId: '11111111-1111-1111-1111-111111111142' },
  { unit_name: 'CONSTRUCTION', unit_code: 'WPS-CONSTRUCTION', old_unit_code: 'HOR-CONSTRUCTION', unit_type: 'unit', location: 'Construction Branch, WPS-II', defaultId: '11111111-1111-1111-1111-111111111143' },
  { unit_name: 'CSC_HOKANDARA', unit_code: 'CSC-HOKANDARA', unit_type: 'csc', location: 'Customer Service Center, Hokandara', defaultId: '11111111-1111-1111-1111-111111111144' },
  { unit_name: 'CSC_HOMAGAMA', unit_code: 'CSC-HOMAGAMA', unit_type: 'csc', location: 'Customer Service Center, Homagama', defaultId: '11111111-1111-1111-1111-111111111145' },
  { unit_name: 'CSC_MALAMBE', unit_code: 'CSC-MALAMBE', unit_type: 'csc', location: 'Customer Service Center, Malambe', defaultId: '11111111-1111-1111-1111-111111111146' },
  { unit_name: 'CSC_PANNIPITIYA', unit_code: 'CSC-PANNIPITIYA', unit_type: 'csc', location: 'Customer Service Center, Pannipitiya', defaultId: '11111111-1111-1111-1111-111111111147' },
  { unit_name: 'CSC_THALANGAMA', unit_code: 'CSC-THALANGAMA', unit_type: 'csc', location: 'Customer Service Center, Thalangama', defaultId: '11111111-1111-1111-1111-111111111148' },
  { unit_name: 'CSC_WALIWITA', unit_code: 'CSC-WALIWITA', unit_type: 'csc', location: 'Customer Service Center, Waliwita', defaultId: '11111111-1111-1111-1111-111111111149' },
  { unit_name: 'DD3_METER LAB', unit_code: 'DD3-METER-LAB', unit_type: 'unit', location: 'DD3 Meter Testing Laboratory, WPS-II', defaultId: '11111111-1111-1111-1111-111111111150' },
  { unit_name: 'DM & EM Office', unit_code: 'WPS-DM-EM', old_unit_code: 'HOR-DM-EM', unit_type: 'unit', location: 'District Maintenance & Electrical Mechanical Office', defaultId: '11111111-1111-1111-1111-111111111151' },
  { unit_name: 'HRO', unit_code: 'WPS-HRO', old_unit_code: 'HOR-HRO', unit_type: 'unit', location: 'Human Resources Operations Office, WPS-II', defaultId: '11111111-1111-1111-1111-111111111152' },
  { unit_name: 'ITO', unit_code: 'WPS-ITO', old_unit_code: 'HOR-ITO', unit_type: 'unit', location: 'Information Technology Operations Office, WPS-II', defaultId: '11111111-1111-1111-1111-111111111153' }
];

// 5 new locations under AREA HORANA
const newHoranaUnits = [
  { id: '11111111-1111-1111-1111-111111111154', unit_name: 'AMU-Horana', unit_code: 'AMU-HORANA', unit_type: 'unit', location: 'Area Maintenance Unit, Horana' },
  { id: '11111111-1111-1111-1111-111111111155', unit_name: 'CSC BULATHSINHALA', unit_code: 'CSC-BULATHSINHALA', unit_type: 'csc', location: 'Customer Service Center, Bulathsinhala' },
  { id: '11111111-1111-1111-1111-111111111156', unit_name: 'CSC HORANA', unit_code: 'CSC-HORANA', unit_type: 'csc', location: 'Customer Service Center, Horana' },
  { id: '11111111-1111-1111-1111-111111111157', unit_name: 'CSC INGIRIYA', unit_code: 'CSC-INGIRIYA', unit_type: 'csc', location: 'Customer Service Center, Ingiriya' },
  { id: '11111111-1111-1111-1111-111111111158', unit_name: 'CSC MORAGAHAHENA', unit_code: 'CSC-MORAGAHAHENA', unit_type: 'csc', location: 'Customer Service Center, Moragahahena' }
];

async function migrateUnits(options = {}) {
  const shouldDisconnect = options.disconnect !== false;

  if (mongoose.connection.readyState !== 1) {
    await connect(options.uri);
  }

  // Guard: Abort unless connected database is "edl_ims"
  const dbName = mongoose.connection.name;
  if (dbName !== 'edl_ims') {
    console.error(`❌ ABORT: Connected database is "${dbName}", expected "edl_ims". Only edl_ims may be modified!`);
    if (shouldDisconnect) await disconnect();
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`🔄 Starting Organization Unit Hierarchy Migration`);
  console.log(`📦 Database: ${dbName}`);
  console.log(`======================================================\n`);

  const initialCount = await Unit.countDocuments();

  // Find parent units
  const wps2 = await Unit.findOne({ $or: [{ id: WPS_II_ID }, { unit_code: 'REG-WPS-II' }] });
  if (!wps2) {
    throw new Error(`Target parent WPS-II (${WPS_II_ID} / REG-WPS-II) not found in database!`);
  }
  const horana = await Unit.findOne({ $or: [{ id: HORANA_ID }, { unit_code: 'AREA-HORANA' }] });
  if (!horana) {
    throw new Error(`Target parent AREA HORANA (${HORANA_ID} / AREA-HORANA) not found in database!`);
  }

  const wps2Id = wps2.id;
  const horanaId = horana.id;

  let createdCount = 0;
  let reparentedCount = 0;
  let upToDateCount = 0;

  // Change 2: Re-parent 13 units directly under WPS-II
  console.log(`--- Applying Change 2: 13 Units under WPS-II (${wps2.unit_name}) ---`);
  for (const item of unitsToReparent) {
    const existing = await Unit.findOne({
      $or: [
        { id: item.defaultId },
        { unit_code: item.unit_code },
        ...(item.old_unit_code ? [{ unit_code: item.old_unit_code }] : [])
      ]
    });
    if (existing) {
      if (existing.parent_unit_id === wps2Id) {
        console.log(`  ✓ [UP TO DATE] ${existing.unit_name} (${existing.unit_code}) already under WPS-II`);
        upToDateCount++;
      } else {
        await Unit.updateOne(
          { id: existing.id },
          { $set: { parent_unit_id: wps2Id } }
        );
        console.log(`  ⚡ [RE-PARENTED] ${existing.unit_name} (${existing.unit_code}) re-parented to WPS-II (id: ${existing.id})`);
        reparentedCount++;
      }
    } else {
      // Unit does not exist; create it under WPS-II using existing seed values
      const idToUse = item.defaultId;
      await Unit.create({
        id: idToUse,
        unit_name: item.unit_name,
        unit_code: item.unit_code,
        unit_type: item.unit_type,
        parent_unit_id: wps2Id,
        location: item.location,
        status: 'active'
      });
      console.log(`  ➕ [CREATED] ${item.unit_name} (${item.unit_code}) created under WPS-II (id: ${idToUse})`);
      createdCount++;
    }
  }

  // Change 1: 5 new units under AREA HORANA
  console.log(`\n--- Applying Change 1: 5 Locations under AREA HORANA (${horana.unit_name}) ---`);
  for (const item of newHoranaUnits) {
    const existing = await Unit.findOne({ unit_code: item.unit_code });
    if (existing) {
      if (existing.parent_unit_id === horanaId) {
        console.log(`  ✓ [UP TO DATE] ${existing.unit_name} (${existing.unit_code}) already under AREA HORANA`);
        upToDateCount++;
      } else {
        await Unit.updateOne(
          { id: existing.id },
          { $set: { parent_unit_id: horanaId } }
        );
        console.log(`  ⚡ [RE-PARENTED] ${existing.unit_name} (${existing.unit_code}) parent updated to AREA HORANA`);
        reparentedCount++;
      }
    } else {
      // Ensure UUID uniqueness
      const existingWithId = await Unit.findOne({ id: item.id });
      const idToUse = existingWithId ? uuidv4() : item.id;
      await Unit.create({
        id: idToUse,
        unit_name: item.unit_name,
        unit_code: item.unit_code,
        unit_type: item.unit_type,
        parent_unit_id: horanaId,
        location: item.location,
        status: 'active'
      });
      console.log(`  ➕ [CREATED] ${item.unit_name} (${item.unit_code}) created under AREA HORANA (id: ${idToUse})`);
      createdCount++;
    }
  }

  // Grant Local Admins access to any newly created units in user_units
  const localAdmins = await Profile.find({ role: 'local_admin' }).lean();
  for (const admin of localAdmins) {
    const assignedUnits = await UserUnit.find({ user_id: admin.id }).lean();
    const assignedSet = new Set(assignedUnits.map(au => au.unit_id));

    const allNewUnitCodes = [...unitsToReparent, ...newHoranaUnits].map(u => u.unit_code);
    const unitsInDb = await Unit.find({ unit_code: { $in: allNewUnitCodes } }).lean();

    const missingAssignments = unitsInDb
      .filter(u => !assignedSet.has(u.id))
      .map(u => ({
        id: uuidv4(),
        user_id: admin.id,
        unit_id: u.id
      }));

    if (missingAssignments.length > 0) {
      await UserUnit.insertMany(missingAssignments);
      console.log(`  🛡️ Assigned ${missingAssignments.length} units to local admin: ${admin.username}`);
    }
  }

  const finalCount = await Unit.countDocuments();

  // Print hierarchy tree under WPS-II and AREA HORANA
  console.log(`\n======================================================`);
  console.log(`🌳 Resulting Organizational Tree Structure`);
  console.log(`======================================================`);

  const wpsChildren = await Unit.find({ parent_unit_id: wps2Id }).lean();
  console.log(`\n[WPS-II] (id: ${wps2Id}, code: ${wps2.unit_code})`);
  for (const child of wpsChildren) {
    console.log(`  ├── [${child.unit_type.toUpperCase()}] ${child.unit_name} (${child.unit_code}) - id: ${child.id}`);
    if (child.id === horanaId) {
      const horanaChildren = await Unit.find({ parent_unit_id: horanaId }).lean();
      for (let i = 0; i < horanaChildren.length; i++) {
        const hc = horanaChildren[i];
        const isLast = i === horanaChildren.length - 1;
        console.log(`  │     ${isLast ? '└──' : '├──'} [${hc.unit_type.toUpperCase()}] ${hc.unit_name} (${hc.unit_code}) - id: ${hc.id}`);
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 Migration Summary:`);
  console.log(`  - Units before:          ${initialCount}`);
  console.log(`  - Units created:         ${createdCount}`);
  console.log(`  - Units re-parented:     ${reparentedCount}`);
  console.log(`  - Already up to date:    ${upToDateCount}`);
  console.log(`  - Units after:           ${finalCount}`);
  console.log(`======================================================\n`);

  if (shouldDisconnect) {
    await disconnect();
  }

  return {
    initialCount,
    finalCount,
    createdCount,
    reparentedCount,
    upToDateCount
  };
}

// Execute migration when run directly
if (require.main === module) {
  migrateUnits()
    .then(() => {
      console.log('✅ Units migration completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Units migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateUnits;
