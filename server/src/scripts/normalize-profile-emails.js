/**
 * normalize-profile-emails.js
 *
 * Idempotent migration script to normalize profile emails and usernames in edl_ims to lowercase and trimmed strings.
 *
 * SAFETY RULES:
 * 1. Abort unless connected database name is strictly "edl_ims" (or test db in tests).
 * 2. Never touch "bus-booking" or any other database.
 * 3. Dry run by default: reports profiles needing normalization and detects potential duplicate conflicts.
 * 4. Only applies changes when explicit --confirm flag is provided.
 * 5. If normalizing would result in duplicates, list them and skip those profiles.
 *
 * Usage:
 *   DRY RUN:
 *     node src/scripts/normalize-profile-emails.js
 *     OR npm run fix:normalize-emails
 *
 *   APPLY CHANGES:
 *     node src/scripts/normalize-profile-emails.js --confirm
 *     (Note: In PowerShell, use the direct node command above as 'npm run ... -- --confirm' does not forward flags properly)
 */

const mongoose = require('mongoose');
const env = require('../config/env');
const { Profile } = require('../models');

async function runNormalization(options = {}) {
  const isConfirm = options.confirm !== undefined ? options.confirm : process.argv.includes('--confirm');
  const customConnection = options.connection;

  let conn = customConnection;
  let shouldDisconnect = false;

  if (!conn) {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      conn = mongoose.connection;
    } else {
      const mongoUri = env.MONGODB_URI || 'mongodb://localhost:27017/edl_ims';
      await mongoose.connect(mongoUri);
      conn = mongoose.connection;
      shouldDisconnect = true;
    }
  }

  const dbName = conn.db ? conn.db.databaseName : conn.name;
  console.log(`[INFO] Connected to MongoDB database: '${dbName}'`);

  // STRICT SAFETY ENFORCEMENT: abort unless connected database name is "edl_ims"
  const isAllowedTestDb = options.allowTestDb && (dbName.startsWith('mongo-mem-') || dbName.includes('test'));
  if (dbName !== 'edl_ims' && !isAllowedTestDb) {
    console.error(`\n[CRITICAL ERROR] Target database is '${dbName}', NOT 'edl_ims'.`);
    console.error(`[ABORT] Aborting immediately to prevent touching unintended databases (e.g. 'bus-booking').\n`);
    if (shouldDisconnect) await mongoose.disconnect();
    if (options.throwOnError) {
      throw new Error(`Aborted: Database '${dbName}' is not 'edl_ims'`);
    }
    process.exit(1);
  }

  const profiles = await Profile.find({}).lean();
  console.log(`[SCAN] Total profiles scanned in '${dbName}': ${profiles.length}`);

  // Find all profiles whose email or username has uppercase letters or surrounding whitespace
  const candidates = [];
  profiles.forEach(p => {
    const rawEmail = p.email || '';
    const normEmail = rawEmail.trim().toLowerCase();
    const rawUsername = p.username || '';
    const normUsername = rawUsername.trim().toLowerCase();

    const emailNeedsNorm = rawEmail !== normEmail;
    const usernameNeedsNorm = rawUsername !== normUsername;

    if (emailNeedsNorm || usernameNeedsNorm) {
      candidates.push({
        id: p.id,
        _id: p._id,
        currentUsername: rawUsername,
        normalizedUsername: normUsername,
        usernameNeedsNorm,
        currentEmail: rawEmail,
        normalizedEmail: normEmail,
        emailNeedsNorm
      });
    }
  });

  console.log(`[SCAN] Profiles with uppercase/spaces needing normalisation: ${candidates.length}`);

  // Detect potential duplicates across all profiles if normalized
  const emailMap = new Map();
  const usernameMap = new Map();

  profiles.forEach(p => {
    const normEmail = (p.email || '').trim().toLowerCase();
    const normUsername = (p.username || '').trim().toLowerCase();

    if (!emailMap.has(normEmail)) emailMap.set(normEmail, []);
    emailMap.get(normEmail).push(p.id);

    if (!usernameMap.has(normUsername)) usernameMap.set(normUsername, []);
    usernameMap.get(normUsername).push(p.id);
  });

  const duplicateEmails = new Set();
  for (const [email, ids] of emailMap.entries()) {
    if (ids.length > 1) duplicateEmails.add(email);
  }

  const duplicateUsernames = new Set();
  for (const [uname, ids] of usernameMap.entries()) {
    if (ids.length > 1) duplicateUsernames.add(uname);
  }

  const conflictingCandidates = [];
  const safeCandidates = [];

  candidates.forEach(cand => {
    const emailConflict = duplicateEmails.has(cand.normalizedEmail);
    const usernameConflict = duplicateUsernames.has(cand.normalizedUsername);

    if (emailConflict || usernameConflict) {
      conflictingCandidates.push({
        ...cand,
        emailConflict,
        usernameConflict
      });
    } else {
      safeCandidates.push(cand);
    }
  });

  if (candidates.length === 0) {
    console.log(`[RESULT] All profile emails and usernames are already normalised. No changes needed.`);
  } else {
    console.log(`\n--- PROFILES REQUIRING NORMALISATION ---`);
    candidates.forEach((c, idx) => {
      console.log(`[${idx + 1}] User ID: ${c.id}`);
      if (c.usernameNeedsNorm) {
        console.log(`    Username: "${c.currentUsername}" -> "${c.normalizedUsername}"`);
      }
      if (c.emailNeedsNorm) {
        console.log(`    Email:    "${c.currentEmail}" -> "${c.normalizedEmail}"`);
      }
    });

    if (conflictingCandidates.length > 0) {
      console.warn(`\n[WARNING] Found ${conflictingCandidates.length} profile(s) that would result in duplicate key conflicts:`);
      conflictingCandidates.forEach(c => {
        const reasons = [];
        if (c.emailConflict) reasons.push(`Email conflict ('${c.normalizedEmail}')`);
        if (c.usernameConflict) reasons.push(`Username conflict ('${c.normalizedUsername}')`);
        console.warn(`    [SKIPPED] ID: ${c.id} - ${reasons.join(', ')}`);
      });
    }
  }

  console.log(`\nSafe profiles eligible for normalisation: ${safeCandidates.length}`);

  if (!isConfirm) {
    console.log(`\n======================================================`);
    console.log(`  DRY RUN ONLY: No database changes were applied.`);
    console.log(`  To apply lowercase/trim updates, run:`);
    console.log(`  node src/scripts/normalize-profile-emails.js --confirm`);
    console.log(`======================================================\n`);
  } else {
    console.log(`\n[CONFIRM] Applying normalisation to ${safeCandidates.length} safe profile(s)...`);
    let updatedCount = 0;
    for (const c of safeCandidates) {
      const updateFields = {};
      if (c.usernameNeedsNorm) updateFields.username = c.normalizedUsername;
      if (c.emailNeedsNorm) updateFields.email = c.normalizedEmail;

      if (Object.keys(updateFields).length > 0) {
        await Profile.updateOne({ _id: c._id }, { $set: updateFields });
        updatedCount++;
      }
    }
    console.log(`[DONE] Successfully normalised ${updatedCount} profile(s).`);
  }

  if (shouldDisconnect) {
    await mongoose.disconnect();
  }

  return {
    scannedCount: profiles.length,
    candidatesCount: candidates.length,
    conflictsCount: conflictingCandidates.length,
    safeCount: safeCandidates.length,
    conflictingCandidates,
    safeCandidates,
    applied: isConfirm
  };
}

if (require.main === module) {
  runNormalization().catch(err => {
    console.error('[FATAL ERROR]', err);
    process.exit(1);
  });
}

module.exports = { runNormalization };
