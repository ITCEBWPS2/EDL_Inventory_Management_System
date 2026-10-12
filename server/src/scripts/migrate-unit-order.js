const { connect, disconnect, mongoose } = require('../config/mongo');
const { Unit } = require('../models');

const WPS_II_ID = '11111111-1111-1111-1111-111111111003';
const PLANNING_CODE = 'PLANNING-WPS-II';

async function migrateUnitOrder(options = {}) {
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
  console.log(`🔄 Starting Organization Unit Order Migration`);
  console.log(`📦 Database: ${dbName}`);
  console.log(`======================================================\n`);

  // 1. Ensure all units without a sort_order have default 0
  const defaultUpdated = await Unit.updateMany(
    { unit_code: { $ne: PLANNING_CODE }, $or: [{ sort_order: { $exists: false } }, { sort_order: null }] },
    { $set: { sort_order: 0 } }
  );

  // 2. Set sort_order = 999 for PLANNING unit
  const planningUnit = await Unit.findOne({ unit_code: PLANNING_CODE });
  let planningUpdated = false;
  if (!planningUnit) {
    console.warn(`⚠️ Warning: PLANNING unit (${PLANNING_CODE}) not found in database.`);
  } else if (planningUnit.sort_order === 999) {
    console.log(`✓ [UP TO DATE] ${planningUnit.unit_name} (${planningUnit.unit_code}) already has sort_order = 999`);
  } else {
    await Unit.updateOne(
      { id: planningUnit.id },
      { $set: { sort_order: 999 } }
    );
    console.log(`⚡ [UPDATED] ${planningUnit.unit_name} (${planningUnit.unit_code}) set sort_order = 999 (was: ${planningUnit.sort_order})`);
    planningUpdated = true;
  }

  // 3. Print hierarchy tree under WPS-II to verify PLANNING is last
  const wpsChildren = await Unit.find({ parent_unit_id: WPS_II_ID }).lean();
  wpsChildren.sort((a, b) => {
    const orderA = a.sort_order !== undefined && a.sort_order !== null ? Number(a.sort_order) : 0;
    const orderB = b.sort_order !== undefined && b.sort_order !== null ? Number(b.sort_order) : 0;
    return orderA - orderB;
  });

  console.log(`\n======================================================`);
  console.log(`🌳 Resulting Order of Children under WPS-II:`);
  console.log(`======================================================`);
  for (let i = 0; i < wpsChildren.length; i++) {
    const child = wpsChildren[i];
    const isLast = i === wpsChildren.length - 1;
    console.log(`  ${isLast ? '└──' : '├──'} [sort_order: ${child.sort_order ?? 0}] ${child.unit_name} (${child.unit_code})`);
    if (child.unit_code === PLANNING_CODE) {
      const planChildren = await Unit.find({ parent_unit_id: child.id }).lean();
      for (const pc of planChildren) {
        console.log(`  ${isLast ? ' ' : '│'}     └── [CHILD] ${pc.unit_name} (${pc.unit_code})`);
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 Unit Order Migration Summary:`);
  console.log(`  - Default sort_order initialized: ${defaultUpdated.modifiedCount || 0}`);
  console.log(`  - PLANNING sort_order updated:     ${planningUpdated ? 1 : 0}`);
  console.log(`  - Last child of WPS-II:           ${wpsChildren[wpsChildren.length - 1]?.unit_name || 'N/A'}`);
  console.log(`======================================================\n`);

  if (shouldDisconnect) {
    await disconnect();
  }

  return {
    defaultUpdatedCount: defaultUpdated.modifiedCount || 0,
    planningUpdated,
    lastChildName: wpsChildren[wpsChildren.length - 1]?.unit_name || null
  };
}

if (require.main === module) {
  migrateUnitOrder()
    .then(() => {
      console.log('✅ Unit order migration completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Unit order migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateUnitOrder;
