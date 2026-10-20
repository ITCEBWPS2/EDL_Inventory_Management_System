const mongoose = require('mongoose');
const { connect, disconnect } = require('../config/mongo');
const { ReceivedTransaction } = require('../models');

async function clearAutofilledReceivedDates() {
  const isConfirmed = process.argv.includes('--confirm');

  console.log('========================================================================');
  console.log(' EDL IMS — Clear Auto-filled Dates on Legacy Received Records');
  console.log(` Mode: ${isConfirmed ? 'CONFIRMED (APPLYING CHANGES)' : 'DRY-RUN (NO CHANGES MADE)'}`);
  console.log('========================================================================\n');

  if (mongoose.connection.readyState !== 1) {
    await connect();
  }

  const dbName = mongoose.connection.name;
  if (dbName !== 'edl_ims') {
    console.error(`❌ ABORT: Connected database is "${dbName}". This script only operates on the "edl_ims" database!`);
    await disconnect();
    process.exit(1);
  }

  // Find candidate records whose notes contain "Not identified" (case-insensitive)
  const candidateRecords = await ReceivedTransaction.find({
    notes: { $regex: /not\s*identified/i }
  }).lean();

  // Filter records where date equals the creation date (created_at date)
  const matchedRecords = candidateRecords.filter(r => {
    if (!r.date || !r.created_at) return false;
    const rDate = String(r.date).split('T')[0].trim();
    const createdDateUTC = new Date(r.created_at).toISOString().split('T')[0];
    const localDate = new Date(r.created_at);
    const createdDateLocal = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
    return rDate === createdDateUTC || rDate === createdDateLocal;
  });

  if (matchedRecords.length === 0) {
    console.log('✔ No auto-filled received transaction records found matching the criteria.\n');
    await disconnect();
    return;
  }

  console.log(`Found ${matchedRecords.length} record(s) matching criteria (date == created_at date AND notes contain "Not identified"):\n`);
  matchedRecords.forEach((rec, idx) => {
    console.log(`[#${idx + 1}] ID: ${rec.id || rec._id}`);
    console.log(`     Item:       ${rec.item_name || '—'}`);
    console.log(`     Quantity:   ${rec.quantity}`);
    console.log(`     Date:       ${rec.date}`);
    console.log(`     Created At: ${new Date(rec.created_at).toISOString()}`);
    console.log(`     Notes:      ${rec.notes}`);
    console.log('------------------------------------------------------------------------');
  });

  if (!isConfirmed) {
    console.log('\n🔍 [DRY-RUN COMPLETE] No database changes were made.');
    console.log('To clear (remove) the dates on these records, run with the --confirm flag:');
    console.log('  node src/scripts/clear-autofilled-received-dates.js --confirm\n');
  } else {
    const idsToUpdate = matchedRecords.map(r => r._id);
    const result = await ReceivedTransaction.updateMany(
      { _id: { $in: idsToUpdate } },
      { $set: { date: '' } }
    );
    console.log(`\n✅ [CONFIRMED UPDATE] Successfully cleared date on ${result.modifiedCount} received transaction record(s).\n`);
  }

  await disconnect();
}

if (require.main === module) {
  clearAutofilledReceivedDates().catch(err => {
    console.error('Fatal error during execution:', err);
    process.exit(1);
  });
}

module.exports = { clearAutofilledReceivedDates };
