const { connect, disconnect, mongoose } = require('../config/mongo');
const { Unit } = require('../models');

// 6 units moved under WPS-II whose location text must reflect WPS-II
const TARGET_UNIT_LOCATIONS = [
  { unit_code: 'WPS-AREA-JAPURA', old_unit_code: 'HOR-AREA-JAPURA', unit_name: 'AREA JAPURA', location: 'Japura Operations Sub-Office, WPS-II' },
  { unit_code: 'WPS-COMMERCIAL', old_unit_code: 'HOR-COMMERCIAL', unit_name: 'COMMERCIAL', location: 'Commercial Operations Branch, WPS-II' },
  { unit_code: 'WPS-CONSTRUCTION', old_unit_code: 'HOR-CONSTRUCTION', unit_name: 'CONSTRUCTION', location: 'Construction Branch, WPS-II' },
  { unit_code: 'DD3-METER-LAB', unit_name: 'DD3_METER LAB', location: 'DD3 Meter Testing Laboratory, WPS-II' },
  { unit_code: 'WPS-HRO', old_unit_code: 'HOR-HRO', unit_name: 'HRO', location: 'Human Resources Operations Office, WPS-II' },
  { unit_code: 'WPS-ITO', old_unit_code: 'HOR-ITO', unit_name: 'ITO', location: 'Information Technology Operations Office, WPS-II' }
];

async function migrateUnitLocations(options = {}) {
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
  console.log(`🔄 Starting Unit Location Text Migration`);
  console.log(`📦 Database: ${dbName}`);
  console.log(`======================================================\n`);

  let updatedCount = 0;
  let upToDateCount = 0;
  let notFoundCount = 0;
  const results = [];

  for (const target of TARGET_UNIT_LOCATIONS) {
    const unit = await Unit.findOne({
      $or: [
        { unit_code: target.unit_code },
        ...(target.old_unit_code ? [{ unit_code: target.old_unit_code }] : [])
      ]
    });

    if (!unit) {
      console.warn(`⚠️ [NOT FOUND] Unit with code ${target.unit_code} not found in database.`);
      notFoundCount++;
      results.push({
        unit_code: target.unit_code,
        status: 'not_found',
        finalLocation: null
      });
      continue;
    }

    if (unit.location === target.location) {
      console.log(`✓ [ALREADY UP TO DATE] ${unit.unit_name} (${unit.unit_code}) -> "${unit.location}"`);
      upToDateCount++;
      results.push({
        unit_code: unit.unit_code,
        unit_name: unit.unit_name,
        status: 'up_to_date',
        finalLocation: unit.location
      });
    } else {
      const oldLocation = unit.location;
      await Unit.updateOne(
        { id: unit.id },
        { $set: { location: target.location } }
      );
      console.log(`⚡ [UPDATED] ${unit.unit_name} (${unit.unit_code})`);
      console.log(`     Old: "${oldLocation}"`);
      console.log(`     New: "${target.location}"`);
      updatedCount++;
      results.push({
        unit_code: unit.unit_code,
        unit_name: unit.unit_name,
        status: 'updated',
        oldLocation,
        finalLocation: target.location
      });
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 Migration Summary:`);
  console.log(`  - Updated:             ${updatedCount}`);
  console.log(`  - Already up to date:  ${upToDateCount}`);
  console.log(`  - Not found:           ${notFoundCount}`);
  console.log(`\n📍 Final Location Values:`);
  for (const res of results) {
    console.log(`  - ${res.unit_code} (${res.unit_name || 'N/A'}): "${res.finalLocation}" [${res.status}]`);
  }
  console.log(`======================================================\n`);

  if (shouldDisconnect) {
    await disconnect();
  }

  return {
    updatedCount,
    upToDateCount,
    notFoundCount,
    results
  };
}

if (require.main === module) {
  migrateUnitLocations()
    .then(() => {
      console.log('✅ Unit location migration completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Unit location migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateUnitLocations;
