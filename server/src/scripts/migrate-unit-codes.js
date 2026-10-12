const { connect, disconnect, mongoose } = require('../config/mongo');
const { Unit } = require('../models');

// The 6 units moved under WPS-II to rename prefix from HOR- to WPS-
const UNITS_TO_RENAME = [
  { id: '11111111-1111-1111-1111-111111111141', old_unit_code: 'HOR-AREA-JAPURA', new_unit_code: 'WPS-AREA-JAPURA', unit_name: 'AREA JAPURA' },
  { id: '11111111-1111-1111-1111-111111111142', old_unit_code: 'HOR-COMMERCIAL', new_unit_code: 'WPS-COMMERCIAL', unit_name: 'COMMERCIAL' },
  { id: '11111111-1111-1111-1111-111111111143', old_unit_code: 'HOR-CONSTRUCTION', new_unit_code: 'WPS-CONSTRUCTION', unit_name: 'CONSTRUCTION' },
  { id: '11111111-1111-1111-1111-111111111151', old_unit_code: 'HOR-DM-EM', new_unit_code: 'WPS-DM-EM', unit_name: 'DM & EM Office' },
  { id: '11111111-1111-1111-1111-111111111152', old_unit_code: 'HOR-HRO', new_unit_code: 'WPS-HRO', unit_name: 'HRO' },
  { id: '11111111-1111-1111-1111-111111111153', old_unit_code: 'HOR-ITO', new_unit_code: 'WPS-ITO', unit_name: 'ITO' }
];

async function migrateUnitCodes(options = {}) {
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
  console.log(`🔄 Starting Unit Code Prefix Migration (HOR- → WPS-)`);
  console.log(`📦 Database: ${dbName}`);
  console.log(`======================================================\n`);

  let updatedCount = 0;
  let upToDateCount = 0;
  let notFoundCount = 0;
  const results = [];

  for (const item of UNITS_TO_RENAME) {
    // Match by id or old unit code or new unit code
    const unit = await Unit.findOne({
      $or: [
        { id: item.id },
        { unit_code: item.old_unit_code },
        { unit_code: item.new_unit_code }
      ]
    });

    if (!unit) {
      console.warn(`⚠️ [NOT FOUND] Unit "${item.unit_name}" (id: ${item.id}, code: ${item.old_unit_code}/${item.new_unit_code}) not found in database.`);
      notFoundCount++;
      results.push({
        id: item.id,
        unit_name: item.unit_name,
        status: 'not_found',
        finalCode: null
      });
      continue;
    }

    if (unit.unit_code === item.new_unit_code) {
      console.log(`✓ [ALREADY UP TO DATE] ${unit.unit_name} already has code "${unit.unit_code}"`);
      upToDateCount++;
      results.push({
        id: unit.id,
        unit_name: unit.unit_name,
        status: 'up_to_date',
        finalCode: unit.unit_code
      });
    } else {
      const oldCode = unit.unit_code;
      await Unit.updateOne(
        { id: unit.id },
        { $set: { unit_code: item.new_unit_code } }
      );
      console.log(`⚡ [UPDATED] ${unit.unit_name} (id: ${unit.id})`);
      console.log(`     Old code: "${oldCode}"`);
      console.log(`     New code: "${item.new_unit_code}"`);
      updatedCount++;
      results.push({
        id: unit.id,
        unit_name: unit.unit_name,
        status: 'updated',
        oldCode,
        finalCode: item.new_unit_code
      });
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 Unit Code Migration Summary:`);
  console.log(`  - Updated:             ${updatedCount}`);
  console.log(`  - Already up to date:  ${upToDateCount}`);
  console.log(`  - Not found:           ${notFoundCount}`);
  console.log(`\n🏷️ Final Unit Code Values:`);
  for (const res of results) {
    console.log(`  - ${res.unit_name} (id: ${res.id}): "${res.finalCode}" [${res.status}]`);
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
  migrateUnitCodes()
    .then(() => {
      console.log('✅ Unit code migration completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Unit code migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateUnitCodes;
