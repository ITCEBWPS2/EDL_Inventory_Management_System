/**
 * EDL IMS — Safe One-Off Cleanup Script: Non-ITO Data Removal
 *
 * Removes leftover test/sample data belonging to every unit EXCEPT the ITO unit.
 *
 * Safety Guarantees:
 * - Operates STRICTLY on the "edl_ims" database (aborts if connected to any other DB).
 * - Matches and validates the ITO unit (unit_code "WPS-ITO" or unit_name "ITO", ID 11111111-1111-1111-1111-111111111153).
 * - Default mode is DRY RUN (deletes nothing, previews exact counts and samples).
 * - Full JSON backup of every document to be deleted is written before any deletion occurs.
 * - Deletes in safe dependency order (verification_items -> verifications -> issued_destroyed_items -> received_transactions -> expended_transactions -> inventory_items).
 * - Verifies before-and-after counts of ITO data to ensure 0 ITO data loss.
 * - Orphan records (missing/empty unit_id) are preserved and listed for manual review.
 * - Units, users/profiles, user_units, categories, item_types, audit_logs are NEVER deleted.
 * - Serial counters (keyed by prefix) are listed and preserved.
 * - Idempotent: re-running finds 0 records to delete and does not error.
 *
 * Direct CLI invocation:
 *   Dry run:          node src/scripts/cleanup-non-ito-data.js
 *   Confirmed delete: node src/scripts/cleanup-non-ito-data.js --confirm
 *   With attachments: node src/scripts/cleanup-non-ito-data.js --confirm --include-files
 *
 * Note: In PowerShell, use the direct `node` command because `npm run ... -- --confirm`
 * does not pass arguments through to the child process reliably.
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { connect, disconnect } = require('../config/mongo');
const {
  Unit,
  InventoryItem,
  ReceivedTransaction,
  ExpendedTransaction,
  Verification,
  VerificationItem,
  IssuedDestroyedItem,
  SerialCounter,
  AuditLog,
  Profile,
  Category
} = require('../models');

const EXPECTED_DATABASE = 'edl_ims';
const ITO_UNIT_CODE = 'WPS-ITO';
const ITO_UNIT_NAME = 'ITO';
const ITO_KNOWN_ID = '11111111-1111-1111-1111-111111111153';

/**
 * Parse command line flags
 */
function parseCliArgs() {
  const args = process.argv.slice(2);
  const isConfirmed = args.includes('--confirm');
  const includeFiles = args.includes('--include-files');
  return { isConfirmed, includeFiles };
}

/**
 * Resolve disk path for an attachment voucher file
 */
function resolveVoucherDiskPath(voucherPath) {
  if (!voucherPath || typeof voucherPath !== 'string') return null;
  const uploadsDir = path.resolve(__dirname, '../../uploads/vouchers');

  let filename = voucherPath;
  if (filename.startsWith('local:')) {
    filename = filename.slice(6);
  } else if (filename.startsWith('vouchers/')) {
    filename = filename.slice(9);
  } else if (filename.startsWith('/api/vouchers/file/')) {
    filename = filename.slice(19);
  } else {
    filename = path.basename(filename);
  }

  const fullPath = path.join(uploadsDir, filename);
  return {
    filename,
    fullPath,
    exists: fs.existsSync(fullPath)
  };
}

/**
 * Main cleanup function
 *
 * @param {Object} options
 * @param {boolean} [options.confirm=false] - If true, execute deletions
 * @param {boolean} [options.includeFiles=false] - If true, also delete unreferenced attachment files
 * @param {boolean} [options.keepConnection=false] - If true, do not disconnect after execution
 * @param {string} [options.backupDir] - Custom backup directory path (used in tests)
 * @returns {Promise<Object>} Summary of inspection and actions taken
 */
async function cleanupNonItoData(options = {}) {
  const cli = parseCliArgs();
  const isConfirmed = options.confirm ?? cli.isConfirmed ?? false;
  const includeFiles = options.includeFiles ?? cli.includeFiles ?? false;
  const keepConnection = options.keepConnection ?? false;
  const isSilent = options.silent ?? false;

  const log = (...args) => {
    if (!isSilent) console.log(...args);
  };
  const warn = (...args) => {
    if (!isSilent) console.warn(...args);
  };
  const error = (...args) => {
    console.error(...args);
  };

  log('='.repeat(78));
  log(' EDL IMS — Non-ITO Sample & Test Data Cleanup');
  log(` Mode:               ${isConfirmed ? '🚨 CONFIRMED EXECUTION (DELETIONS ENABLED)' : '🔍 DRY-RUN (PREVIEW ONLY — NO DATA REMOVED)'}`);
  log(` File Deletion:      ${includeFiles ? 'YES (--include-files enabled)' : 'NO (leave files untouched)'}`);
  log('='.repeat(78) + '\n');

  // 1. Ensure Database Connection
  if (mongoose.connection.readyState !== 1) {
    await connect();
  }

  // 2. Database Name Guard
  const dbName = mongoose.connection.name;
  if (dbName !== EXPECTED_DATABASE) {
    const errorMsg = `❌ CRITICAL SAFETY GUARD: Connected to database "${dbName}", expected "${EXPECTED_DATABASE}". Aborting immediately to prevent touching unrelated databases!`;
    console.error(errorMsg);
    if (!keepConnection) await disconnect();
    if (require.main === module) process.exit(1);
    throw new Error(errorMsg);
  }
  log(`✔ Database guard passed: Connected to "${dbName}"\n`);

  // 3. Resolve and Verify ITO Unit
  const itoUnits = await Unit.find({
    $or: [{ unit_code: ITO_UNIT_CODE }, { unit_name: ITO_UNIT_NAME }]
  }).lean();

  if (itoUnits.length === 0) {
    const errorMsg = `❌ CRITICAL ERROR: ITO unit not found by code "${ITO_UNIT_CODE}" or name "${ITO_UNIT_NAME}". Aborting!`;
    console.error(errorMsg);
    if (!keepConnection) await disconnect();
    if (require.main === module) process.exit(1);
    throw new Error(errorMsg);
  }

  if (itoUnits.length > 1) {
    const errorMsg = `❌ CRITICAL ERROR: Found multiple (${itoUnits.length}) units matching ITO. Ambiguous target! Aborting!`;
    console.error(errorMsg);
    if (!keepConnection) await disconnect();
    if (require.main === module) process.exit(1);
    throw new Error(errorMsg);
  }

  const itoUnit = itoUnits[0];
  log(`✔ ITO Unit Resolved:`);
  log(`   ID:        ${itoUnit.id}`);
  log(`   Name:      ${itoUnit.unit_name}`);
  log(`   Code:      ${itoUnit.unit_code}`);
  if (itoUnit.id === ITO_KNOWN_ID) {
    log(`   Match:     Matches expected reference ID (${ITO_KNOWN_ID})`);
  } else {
    log(`   Note:      Using resolved ID ${itoUnit.id}`);
  }
  log('');

  // 4. Load Unit Metadata Cache
  const allUnits = await Unit.find().lean();
  const unitMap = new Map(allUnits.map(u => [u.id, u]));

  // Helper to format unit info
  const formatUnit = (unitId) => {
    if (!unitId) return 'NO UNIT ID (Orphan)';
    const u = unitMap.get(unitId);
    if (!u) return `Unknown Unit (${unitId})`;
    return `${u.unit_name} [${u.unit_code}] (${u.id})`;
  };

  // 5. Gather All Target Collections Data
  log('--- Inspecting Database Collections ---');

  const [
    allInventory,
    allReceived,
    allExpended,
    allVerifications,
    allVerificationItems,
    allIssuedDestroyed,
    allSerialCounters
  ] = await Promise.all([
    InventoryItem.find().lean(),
    ReceivedTransaction.find().lean(),
    ExpendedTransaction.find().lean(),
    Verification.find().lean(),
    VerificationItem.find().lean(),
    IssuedDestroyedItem.find().lean(),
    SerialCounter.find().lean()
  ]);

  // A. Inventory Items
  const itoInventory = allInventory.filter(i => i.unit_id === itoUnit.id);
  const deleteInventory = allInventory.filter(i => i.unit_id && i.unit_id.trim() !== '' && i.unit_id !== itoUnit.id);
  const orphanInventory = allInventory.filter(i => !i.unit_id || i.unit_id.trim() === '');

  // B. Received Transactions
  const itoReceived = allReceived.filter(r => r.unit_id === itoUnit.id);
  const deleteReceived = allReceived.filter(r => r.unit_id && r.unit_id.trim() !== '' && r.unit_id !== itoUnit.id);
  const orphanReceived = allReceived.filter(r => !r.unit_id || r.unit_id.trim() === '');

  // C. Expended Transactions
  const itoExpended = allExpended.filter(e => e.unit_id === itoUnit.id);
  const deleteExpended = allExpended.filter(e => e.unit_id && e.unit_id.trim() !== '' && e.unit_id !== itoUnit.id);
  const orphanExpended = allExpended.filter(e => !e.unit_id || e.unit_id.trim() === '');

  // D. Verifications
  const itoVerifications = allVerifications.filter(v => v.unit_id === itoUnit.id);
  const deleteVerifications = allVerifications.filter(v => v.unit_id && v.unit_id.trim() !== '' && v.unit_id !== itoUnit.id);
  const orphanVerifications = allVerifications.filter(v => !v.unit_id || v.unit_id.trim() === '');

  const itoVerifIds = new Set(itoVerifications.map(v => v.id));
  const deleteVerifIds = new Set(deleteVerifications.map(v => v.id));

  // E. Verification Items (via verification_id)
  const itoVerificationItems = allVerificationItems.filter(vi => itoVerifIds.has(vi.verification_id));
  const deleteVerificationItems = allVerificationItems.filter(vi => deleteVerifIds.has(vi.verification_id));
  const orphanVerificationItems = allVerificationItems.filter(vi => !itoVerifIds.has(vi.verification_id) && !deleteVerifIds.has(vi.verification_id));

  // F. Issued / Destroyed Items
  const itoIssuedDestroyed = allIssuedDestroyed.filter(id => id.unit_id === itoUnit.id);
  const deleteIssuedDestroyed = allIssuedDestroyed.filter(id => id.unit_id && id.unit_id.trim() !== '' && id.unit_id !== itoUnit.id);
  const orphanIssuedDestroyed = allIssuedDestroyed.filter(id => !id.unit_id || id.unit_id.trim() === '');

  // G. Serial Counters
  // Counters in schema are keyed by prefix string, e.g. DGM(WPSII)/CE(COM)/ITO/FUR/...
  // Per requirement: "(only if the counter documents are keyed by unit and clearly belong to another unit; if they are shared or keyed differently, list them and leave them)"
  // Since serial counters do NOT possess a unit_id field, they are keyed by prefix.
  // We list all non-ITO counters and leave them untouched.
  const itoSerialCounters = allSerialCounters.filter(sc => (sc.prefix || '').includes('/ITO/'));
  const nonItoSerialCounters = allSerialCounters.filter(sc => !(sc.prefix || '').includes('/ITO/'));

  // 6. Attachment / File Analysis
  const deletedTxFiles = [
    ...deleteReceived.map(r => r.voucher_image_path).filter(Boolean),
    ...deleteExpended.map(e => e.voucher_image_path).filter(Boolean)
  ];

  const keptTxFiles = new Set([
    ...itoReceived.map(r => r.voucher_image_path).filter(Boolean),
    ...orphanReceived.map(r => r.voucher_image_path).filter(Boolean),
    ...itoExpended.map(e => e.voucher_image_path).filter(Boolean),
    ...orphanExpended.map(e => e.voucher_image_path).filter(Boolean)
  ]);

  const unreferencedFilePaths = [...new Set(deletedTxFiles.filter(f => !keptTxFiles.has(f)))];
  const diskFiles = unreferencedFilePaths.map(resolveVoucherDiskPath).filter(Boolean);
  const existingDiskFiles = diskFiles.filter(f => f.exists);

  // 7. Unit Breakdown for Deletions
  const nonItoUnitsInvolved = new Map();
  const registerUnitCount = (unitId, collName, count) => {
    if (!unitId || count <= 0) return;
    if (!nonItoUnitsInvolved.has(unitId)) {
      nonItoUnitsInvolved.set(unitId, {
        unitId,
        unitInfo: formatUnit(unitId),
        counts: {
          inventory_items: 0,
          received_transactions: 0,
          expended_transactions: 0,
          verifications: 0,
          verification_items: 0,
          issued_destroyed_items: 0
        }
      });
    }
    nonItoUnitsInvolved.get(unitId).counts[collName] += count;
  };

  deleteInventory.forEach(d => registerUnitCount(d.unit_id, 'inventory_items', 1));
  deleteReceived.forEach(d => registerUnitCount(d.unit_id, 'received_transactions', 1));
  deleteExpended.forEach(d => registerUnitCount(d.unit_id, 'expended_transactions', 1));
  deleteVerifications.forEach(d => registerUnitCount(d.unit_id, 'verifications', 1));
  deleteIssuedDestroyed.forEach(d => registerUnitCount(d.unit_id, 'issued_destroyed_items', 1));

  // Count verification items per unit of parent verification
  const verifUnitMap = new Map(deleteVerifications.map(v => [v.id, v.unit_id]));
  deleteVerificationItems.forEach(vi => {
    const uId = verifUnitMap.get(vi.verification_id);
    if (uId) registerUnitCount(uId, 'verification_items', 1);
  });

  // 8. Print Report
  log('========================================================================');
  log(' 1. BREAKDOWN OF NON-ITO DATA TARGETED FOR REMOVAL');
  log('========================================================================');
  if (nonItoUnitsInvolved.size === 0) {
    log('   (No non-ITO unit data found! The database is already clean.)');
  } else {
    for (const [uId, data] of nonItoUnitsInvolved.entries()) {
      log(`\n• Unit: ${data.unitInfo}`);
      log(`  - inventory_items:         ${data.counts.inventory_items}`);
      log(`  - received_transactions:   ${data.counts.received_transactions}`);
      log(`  - expended_transactions:   ${data.counts.expended_transactions}`);
      log(`  - verifications:           ${data.counts.verifications}`);
      log(`  - verification_items:      ${data.counts.verification_items}`);
      log(`  - issued_destroyed_items:  ${data.counts.issued_destroyed_items}`);
    }
  }

  log('\n========================================================================');
  log(' 2. SAMPLE OF RECORDS TO BE REMOVED (Up to 5 per collection)');
  log('========================================================================');

  const printSample = (collName, docs, formatFn) => {
    log(`\n--- ${collName} (${docs.length} total to remove) ---`);
    if (docs.length === 0) {
      log('  None');
      return;
    }
    docs.slice(0, 5).forEach((d, idx) => {
      log(`  [${idx + 1}] ${formatFn(d)}`);
    });
    if (docs.length > 5) {
      log(`  ... and ${docs.length - 5} more`);
    }
  };

  printSample('inventory_items', deleteInventory, d =>
    `[${formatUnit(d.unit_id)}] "${d.item_name}" | Code: ${d.item_code} | Cat: ${d.category} | Qty: ${d.quantity}`
  );

  printSample('received_transactions', deleteReceived, d =>
    `[${formatUnit(d.unit_id)}] Voucher: ${d.voucher_no || 'N/A'} | Item: "${d.item_name}" | Date: ${d.date} | Qty: ${d.quantity}`
  );

  printSample('expended_transactions', deleteExpended, d =>
    `[${formatUnit(d.unit_id)}] Voucher: ${d.voucher_no || 'N/A'} | Item: "${d.item_name}" | Date: ${d.date} | Qty: ${d.quantity}`
  );

  printSample('verifications', deleteVerifications, d =>
    `[${formatUnit(d.unit_id)}] Date: ${d.date} | Year: ${d.year} | Status: ${d.status} | ID: ${d.id}`
  );

  printSample('verification_items', deleteVerificationItems, d =>
    `Parent Verif: ${d.verification_id} | Item: "${d.item_name}" | Code: ${d.item_code} | Qty: ${d.system_qty ?? d.counted_qty ?? 'N/A'}`
  );

  printSample('issued_destroyed_items', deleteIssuedDestroyed, d =>
    `[${formatUnit(d.unit_id)}] Item ID: ${d.item_id} | Disp: ${d.disposition} | Date: ${d.date} | Qty: ${d.quantity}`
  );

  log('\n========================================================================');
  log(' 3. TOTALS SUMMARY');
  log('========================================================================');
  log(` Collection               | Delete Target | ITO Preserved | Orphans (Kept)`);
  log(` ------------------------ | ------------- | ------------- | --------------`);
  log(` verification_items       | ${String(deleteVerificationItems.length).padStart(13)} | ${String(itoVerificationItems.length).padStart(13)} | ${String(orphanVerificationItems.length).padStart(14)}`);
  log(` verifications            | ${String(deleteVerifications.length).padStart(13)} | ${String(itoVerifications.length).padStart(13)} | ${String(orphanVerifications.length).padStart(14)}`);
  log(` issued_destroyed_items   | ${String(deleteIssuedDestroyed.length).padStart(13)} | ${String(itoIssuedDestroyed.length).padStart(13)} | ${String(orphanIssuedDestroyed.length).padStart(14)}`);
  log(` received_transactions    | ${String(deleteReceived.length).padStart(13)} | ${String(itoReceived.length).padStart(13)} | ${String(orphanReceived.length).padStart(14)}`);
  log(` expended_transactions    | ${String(deleteExpended.length).padStart(13)} | ${String(itoExpended.length).padStart(13)} | ${String(orphanExpended.length).padStart(14)}`);
  log(` inventory_items          | ${String(deleteInventory.length).padStart(13)} | ${String(itoInventory.length).padStart(13)} | ${String(orphanInventory.length).padStart(14)}`);

  const grandTotalToDelete =
    deleteVerificationItems.length +
    deleteVerifications.length +
    deleteIssuedDestroyed.length +
    deleteReceived.length +
    deleteExpended.length +
    deleteInventory.length;

  log(` ------------------------ | ------------- | ------------- | --------------`);
  log(` GRAND TOTAL              | ${String(grandTotalToDelete).padStart(13)} |               | `);

  log('\n========================================================================');
  log(' 4. PRESERVED SERIAL COUNTERS (Keyed by prefix string)');
  log('========================================================================');
  log(` Total Serial Counters:   ${allSerialCounters.length}`);
  log(` ITO Prefixed (/ITO/):    ${itoSerialCounters.length}`);
  log(` Other Prefixes:          ${nonItoSerialCounters.length} (Preserved per safety rule)`);
  if (nonItoSerialCounters.length > 0) {
    nonItoSerialCounters.forEach(sc => {
      log(`   - Prefix: "${sc.prefix}", last_sequence: ${sc.last_sequence}`);
    });
  }

  log('\n========================================================================');
  log(' 5. ORPHAN RECORDS (Missing/empty unit_id — NEVER DELETED)');
  log('========================================================================');
  const allOrphans = [
    ...orphanInventory.map(d => ({ coll: 'inventory_items', id: d.id, desc: d.item_name || d.item_code })),
    ...orphanReceived.map(d => ({ coll: 'received_transactions', id: d.id, desc: `${d.voucher_no || 'No voucher'} - ${d.item_name}` })),
    ...orphanExpended.map(d => ({ coll: 'expended_transactions', id: d.id, desc: `${d.voucher_no || 'No voucher'} - ${d.item_name}` })),
    ...orphanVerifications.map(d => ({ coll: 'verifications', id: d.id, desc: `Date: ${d.date}, Year: ${d.year}` })),
    ...orphanVerificationItems.map(d => ({ coll: 'verification_items', id: d.id, desc: `Verif: ${d.verification_id}, Item: ${d.item_name}` })),
    ...orphanIssuedDestroyed.map(d => ({ coll: 'issued_destroyed_items', id: d.id, desc: `Item: ${d.item_id}, Disp: ${d.disposition}, Date: ${d.date}` }))
  ];

  if (allOrphans.length === 0) {
    log('   (No orphan records found.)');
  } else {
    log(`   Found ${allOrphans.length} orphan record(s) across collections:`);
    allOrphans.forEach(o => {
      log(`   • [${o.coll}] ID: ${o.id} | Info: ${o.desc}`);
    });
  }

  log('\n========================================================================');
  log(' 6. ATTACHMENT FILES IN SERVER/UPLOADS');
  log('========================================================================');
  log(` Referenced by deleted transactions:  ${unreferencedFilePaths.length}`);
  log(` Located on local disk:               ${existingDiskFiles.length}`);
  if (unreferencedFilePaths.length > 0) {
    unreferencedFilePaths.forEach(f => {
      const diskInfo = resolveVoucherDiskPath(f);
      log(`   - ${f} (Disk: ${diskInfo && diskInfo.exists ? 'FOUND at ' + diskInfo.filename : 'NOT ON DISK'})`);
    });
  }
  if (!includeFiles && unreferencedFilePaths.length > 0) {
    log(`   ℹ️ Note: Voucher files are left untouched. Use --include-files if you wish to remove them.`);
  }

  // 9. If DRY RUN, stop here
  if (!isConfirmed) {
    log('\n========================================================================');
    log(' 🔍 DRY-RUN COMPLETE — NO DATA WAS MODIFIED');
    log('========================================================================');
    log(` To execute the cleanup and remove the ${grandTotalToDelete} non-ITO record(s):`);
    log(`   node src/scripts/cleanup-non-ito-data.js --confirm`);
    if (unreferencedFilePaths.length > 0) {
      log(` To also remove unreferenced attachment files:`);
      log(`   node src/scripts/cleanup-non-ito-data.js --confirm --include-files`);
    }
    log('========================================================================\n');

    if (!keepConnection) await disconnect();
    return {
      success: true,
      mode: 'dry-run',
      itoUnit: { id: itoUnit.id, name: itoUnit.unit_name, code: itoUnit.unit_code },
      deletedCounts: {
        verification_items: deleteVerificationItems.length,
        verifications: deleteVerifications.length,
        issued_destroyed_items: deleteIssuedDestroyed.length,
        received_transactions: deleteReceived.length,
        expended_transactions: deleteExpended.length,
        inventory_items: deleteInventory.length,
        grandTotal: grandTotalToDelete
      },
      preservedItoCounts: {
        verification_items: itoVerificationItems.length,
        verifications: itoVerifications.length,
        issued_destroyed_items: itoIssuedDestroyed.length,
        received_transactions: itoReceived.length,
        expended_transactions: itoExpended.length,
        inventory_items: itoInventory.length
      },
      orphanCounts: {
        total: allOrphans.length,
        records: allOrphans
      },
      files: {
        unreferencedCount: unreferencedFilePaths.length,
        existingOnDisk: existingDiskFiles.length
      }
    };
  }

  // 10. CONFIRMED EXECUTION
  log('\n========================================================================');
  log(' 🚨 EXECUTING CONFIRMED CLEANUP');
  log('========================================================================');

  if (grandTotalToDelete === 0) {
    log('✔ Nothing to delete! Database is already clean.');
    if (!keepConnection) await disconnect();
    return {
      success: true,
      mode: 'confirm',
      deletedCounts: { grandTotal: 0 },
      preservedItoCounts: {
        inventory_items: itoInventory.length,
        received_transactions: itoReceived.length,
        expended_transactions: itoExpended.length,
        verifications: itoVerifications.length,
        verification_items: itoVerificationItems.length,
        issued_destroyed_items: itoIssuedDestroyed.length
      }
    };
  }

  // Snapshot before counts for post-verification
  const beforeItoCounts = {
    inventory_items: itoInventory.length,
    received_transactions: itoReceived.length,
    expended_transactions: itoExpended.length,
    verifications: itoVerifications.length,
    verification_items: itoVerificationItems.length,
    issued_destroyed_items: itoIssuedDestroyed.length
  };

  // 10.A WRITE FULL JSON BACKUP
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupBaseDir = options.backupDir || path.resolve(__dirname, '../../backups');
  const backupFolder = path.join(backupBaseDir, `non-ito-cleanup-${timestamp}`);

  try {
    fs.mkdirSync(backupFolder, { recursive: true });

    const backupPayloads = {
      'metadata.json': {
        timestamp: new Date().toISOString(),
        database: dbName,
        itoUnit: { id: itoUnit.id, name: itoUnit.unit_name, code: itoUnit.unit_code },
        totals: {
          verification_items: deleteVerificationItems.length,
          verifications: deleteVerifications.length,
          issued_destroyed_items: deleteIssuedDestroyed.length,
          received_transactions: deleteReceived.length,
          expended_transactions: deleteExpended.length,
          inventory_items: deleteInventory.length,
          grandTotal: grandTotalToDelete
        }
      },
      'verification_items.json': deleteVerificationItems,
      'verifications.json': deleteVerifications,
      'issued_destroyed_items.json': deleteIssuedDestroyed,
      'received_transactions.json': deleteReceived,
      'expended_transactions.json': deleteExpended,
      'inventory_items.json': deleteInventory
    };

    for (const [filename, content] of Object.entries(backupPayloads)) {
      const filePath = path.join(backupFolder, filename);
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
      if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
        throw new Error(`Backup file "${filename}" could not be written or is empty.`);
      }
    }

    log(`✔ Full backup successfully written to:`);
    log(`   ${backupFolder}\n`);
  } catch (backupErr) {
    const errorMsg = `❌ CRITICAL BACKUP FAILURE: ${backupErr.message}. Aborting without deleting any data!`;
    console.error(errorMsg);
    if (!keepConnection) await disconnect();
    if (require.main === module) process.exit(1);
    throw new Error(errorMsg);
  }

  // 10.B EXECUTE DELETIONS IN SAFE ORDER
  // 1. verification_items
  const vItemIds = deleteVerificationItems.map(vi => vi.id);
  const vItemResult = await VerificationItem.deleteMany({ id: { $in: vItemIds } });
  log(`✔ Deleted verification_items:      ${vItemResult.deletedCount}`);

  // 2. verifications
  const vIds = deleteVerifications.map(v => v.id);
  const vResult = await Verification.deleteMany({ id: { $in: vIds } });
  log(`✔ Deleted verifications:           ${vResult.deletedCount}`);

  // 3. issued_destroyed_items
  const idIds = deleteIssuedDestroyed.map(id => id.id);
  const idResult = await IssuedDestroyedItem.deleteMany({ id: { $in: idIds } });
  log(`✔ Deleted issued_destroyed_items:  ${idResult.deletedCount}`);

  // 4. received_transactions
  const rxIds = deleteReceived.map(r => r.id);
  const rxResult = await ReceivedTransaction.deleteMany({ id: { $in: rxIds } });
  log(`✔ Deleted received_transactions:   ${rxResult.deletedCount}`);

  // 5. expended_transactions
  const exIds = deleteExpended.map(e => e.id);
  const exResult = await ExpendedTransaction.deleteMany({ id: { $in: exIds } });
  log(`✔ Deleted expended_transactions:   ${exResult.deletedCount}`);

  // 6. inventory_items
  const invIds = deleteInventory.map(i => i.id);
  const invResult = await InventoryItem.deleteMany({ id: { $in: invIds } });
  log(`✔ Deleted inventory_items:         ${invResult.deletedCount}`);

  // 10.C OPTIONAL FILE REMOVAL
  let filesRemovedCount = 0;
  if (includeFiles && existingDiskFiles.length > 0) {
    for (const f of existingDiskFiles) {
      try {
        fs.unlinkSync(f.fullPath);
        filesRemovedCount++;
        log(`✔ Removed unreferenced voucher file: ${f.filename}`);
      } catch (err) {
        warn(`⚠️ Could not remove file ${f.fullPath}: ${err.message}`);
      }
    }
  }

  // 10.D POST-DELETION INTEGRITY VERIFICATION
  log('\n--- Running Post-Deletion Integrity Verification ---');

  const [
    afterInv,
    afterRx,
    afterEx,
    afterVerif,
    afterVItem,
    afterId
  ] = await Promise.all([
    InventoryItem.find({ unit_id: itoUnit.id }).countDocuments(),
    ReceivedTransaction.find({ unit_id: itoUnit.id }).countDocuments(),
    ExpendedTransaction.find({ unit_id: itoUnit.id }).countDocuments(),
    Verification.find({ unit_id: itoUnit.id }).countDocuments(),
    VerificationItem.find({ verification_id: { $in: [...itoVerifIds] } }).countDocuments(),
    IssuedDestroyedItem.find({ unit_id: itoUnit.id }).countDocuments()
  ]);

  const afterItoCounts = {
    inventory_items: afterInv,
    received_transactions: afterRx,
    expended_transactions: afterEx,
    verifications: afterVerif,
    verification_items: afterVItem,
    issued_destroyed_items: afterId
  };

  let countsMatch = true;
  for (const key of Object.keys(beforeItoCounts)) {
    if (beforeItoCounts[key] !== afterItoCounts[key]) {
      countsMatch = false;
      console.error(`❌ MISMATCH in ${key}: before=${beforeItoCounts[key]}, after=${afterItoCounts[key]}`);
    }
  }

  if (!countsMatch) {
    const errorMsg = `❌ CRITICAL INTEGRITY FAILURE: ITO counts do not match before and after cleanup!`;
    console.error(errorMsg);
    if (!keepConnection) await disconnect();
    if (require.main === module) process.exit(1);
    throw new Error(errorMsg);
  }

  log(`✔ Post-deletion verification PASSED: All ITO records remain 100% intact.`);

  // Verify non-ITO counts are now zero
  const [
    remainingInv,
    remainingRx,
    remainingEx,
    remainingVerif,
    remainingId
  ] = await Promise.all([
    InventoryItem.countDocuments({ unit_id: { $ne: itoUnit.id, $exists: true, $ne: null } }),
    ReceivedTransaction.countDocuments({ unit_id: { $ne: itoUnit.id, $exists: true, $ne: null } }),
    ExpendedTransaction.countDocuments({ unit_id: { $ne: itoUnit.id, $exists: true, $ne: null } }),
    Verification.countDocuments({ unit_id: { $ne: itoUnit.id, $exists: true, $ne: null } }),
    IssuedDestroyedItem.countDocuments({ unit_id: { $ne: itoUnit.id, $exists: true, $ne: null } })
  ]);

  const remainingNonIto = remainingInv + remainingRx + remainingEx + remainingVerif + remainingId;
  log(`✔ Remaining non-ITO documents in business collections: ${remainingNonIto}`);

  log('\n========================================================================');
  log(' 🏁 CLEANUP COMPLETED SUCCESSFULLY');
  log('========================================================================');
  log(` Total deleted records:      ${grandTotalToDelete}`);
  log(` Backup location:            ${backupFolder}`);
  if (includeFiles) {
    log(` Attachment files removed:   ${filesRemovedCount}`);
  }
  log('========================================================================\n');

  if (!keepConnection) await disconnect();

  return {
    success: true,
    mode: 'confirm',
    backupFolder,
    deletedCounts: {
      verification_items: vItemResult.deletedCount,
      verifications: vResult.deletedCount,
      issued_destroyed_items: idResult.deletedCount,
      received_transactions: rxResult.deletedCount,
      expended_transactions: exResult.deletedCount,
      inventory_items: invResult.deletedCount,
      grandTotal: grandTotalToDelete
    },
    preservedItoCounts: afterItoCounts,
    filesRemovedCount
  };
}

// Direct execution from CLI
if (require.main === module) {
  cleanupNonItoData().catch(err => {
    console.error('Fatal cleanup error:', err);
    process.exit(1);
  });
}

module.exports = {
  cleanupNonItoData,
  EXPECTED_DATABASE,
  ITO_UNIT_CODE,
  ITO_UNIT_NAME,
  ITO_KNOWN_ID
};
