/**
 * Migration Script: Migrate Disposal Requests Committee & Approval fields
 *
 * Removes approval.approved_by_name, approval_letter_no and approval_date entirely.
 * Maps legacy inspection/approval fields to new committee_decision structure:
 * {
 *   report_ref: required,
 *   decision_date: required,
 *   inspection_date: optional,
 *   members_present: names,
 *   remarks: string,
 *   attachment: scan object
 * }
 *
 * Safety Guards:
 * - Only runs against edl_ims database (never external or unintended DBs).
 * - Supports --dry-run flag for inspection without modifying records.
 * - Idempotent: Can be run multiple times safely.
 */

const { mongoose, connect } = require('../config/mongo');
const { DisposalRequest } = require('../models');

async function runMigration() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`Starting Disposal Requests Committee Migration ${isDryRun ? '[DRY RUN]' : '[LIVE RUN]'}`);

  await connect();

  const dbName = mongoose.connection.name;
  if (dbName !== 'edl_ims') {
    throw new Error(`Safety Guard Triggered: Connected to "${dbName}", but expected "edl_ims". Aborting migration.`);
  }

  // Find all disposal requests with legacy approval or inspection structures
  const legacyCursor = await mongoose.connection.collection('disposal_requests').find({
    $or: [
      { approval: { $exists: true } },
      { inspection: { $exists: true } },
      { status: 'inspected' }
    ]
  }).toArray();

  console.log(`Found ${legacyCursor.length} disposal request(s) requiring migration.`);

  let migratedCount = 0;

  for (const doc of legacyCursor) {
    const updates = {};
    const unsets = {};

    // 1. Map approval / inspection to committee_decision
    if (!doc.committee_decision && (doc.approval || doc.inspection)) {
      const reportRef = doc.approval?.approval_letter_no ||
                        doc.inspection?.report_ref ||
                        doc.board?.appointment_letter_no ||
                        `CR-${doc.request_no || 'LEGACY'}`;

      const decisionDate = doc.approval?.approval_date ||
                           doc.inspection?.inspection_date ||
                           doc.board?.appointment_date ||
                           new Date().toISOString().split('T')[0];

      const inspectionDate = doc.inspection?.inspection_date || null;

      const membersPresent = doc.inspection?.inspectors ||
                             doc.board?.members?.map(m => (typeof m === 'string' ? m : m.name)) ||
                             [];

      const remarks = doc.approval?.remarks || doc.inspection?.remarks || '';

      const attachment = doc.approval?.attachment || doc.inspection?.attachment || null;

      updates.committee_decision = {
        report_ref: reportRef,
        decision_date: decisionDate,
        inspection_date: inspectionDate,
        members_present: membersPresent.length > 0 ? membersPresent : ['Committee Verifier'],
        remarks,
        attachment
      };
    }

    // 2. Unset legacy fields
    if (doc.approval !== undefined) unsets.approval = '';
    if (doc.inspection !== undefined) unsets.inspection = '';

    // 3. Normalize legacy status 'inspected' -> 'board_appointed'
    if (doc.status === 'inspected') {
      updates.status = 'board_appointed';
    }

    // 4. Normalize legacy items if recommendation & approval were split
    if (Array.isArray(doc.items)) {
      let itemsModified = false;
      const updatedItems = doc.items.map(item => {
        let dec = item.committee_decision_item;
        if (!dec && (item.approval_decision || item.recommendation)) {
          itemsModified = true;
          const rawDec = item.approval_decision || item.recommendation;
          if (rawDec === 'Approve for Destruction' || rawDec === 'Destroy') {
            dec = 'Approve for Destruction';
          } else if (rawDec === 'Approve for Tender' || rawDec === 'Tender') {
            dec = 'Approve for Tender';
          } else if (rawDec === 'Retain') {
            dec = 'Retain';
          } else if (rawDec === 'Repair') {
            dec = 'Repair';
          } else {
            dec = 'Reject';
          }
        }
        const cleanItem = { ...item };
        delete cleanItem.recommendation;
        delete cleanItem.approval_decision;
        if (dec) cleanItem.committee_decision_item = dec;
        return cleanItem;
      });

      if (itemsModified) {
        updates.items = updatedItems;
      }
    }

    const op = {};
    if (Object.keys(updates).length > 0) op.$set = updates;
    if (Object.keys(unsets).length > 0) op.$unset = unsets;

    if (Object.keys(op).length > 0) {
      if (isDryRun) {
        console.log(`[DRY RUN] Would update request ${doc.request_no || doc.id}:`, JSON.stringify(op, null, 2));
      } else {
        await mongoose.connection.collection('disposal_requests').updateOne({ _id: doc._id }, op);
        console.log(`Migrated request ${doc.request_no || doc.id}`);
      }
      migratedCount++;
    }
  }

  console.log(`Migration complete. Total records updated: ${migratedCount} ${isDryRun ? '(Dry run only)' : ''}`);
  await mongoose.disconnect();
}

if (require.main === module) {
  runMigration().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { runMigration };

