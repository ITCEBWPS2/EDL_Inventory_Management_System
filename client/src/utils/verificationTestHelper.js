/**
 * verificationTestHelper.js
 * In-memory testing utilities for the New Verification page.
 * Generates sample data without database writes or submission side-effects.
 */

export const CONDITION_OPTIONS_LIST = ['—', 'Good', 'Fair', 'Damaged', 'Needs Repair'];

/**
 * Check if testing tools are allowed for the current user and environment.
 * Allowed ONLY for super_admin and local_admin, and NEVER in production builds
 * unless explicitly enabled via VITE_ENABLE_TEST_TOOLS=true.
 */
export function isTestToolsAllowed(user, env = (typeof import.meta !== 'undefined' ? import.meta.env : process.env)) {
  if (!user || (user.role !== 'super_admin' && user.role !== 'local_admin')) {
    return false;
  }

  const isDev = env?.DEV === true || env?.MODE === 'development' || env?.NODE_ENV === 'development';
  const isExplicitlyEnabled = env?.VITE_ENABLE_TEST_TOOLS === 'true' || env?.VITE_ENABLE_TEST_TOOLS === true;

  return Boolean(isDev || isExplicitlyEnabled);
}

/**
 * Check if an item row is considered empty (uncounted)
 */
export function isRowEmpty(row) {
  if (!row) return true;
  const phys = row.physical_qty;
  return phys === '' || phys === null || phys === undefined;
}

/**
 * Check whether any row currently contains test-generated values (e.g. TEST- label)
 */
export function hasTestGeneratedData(items, testGeneratedIndices = null) {
  if (testGeneratedIndices && testGeneratedIndices.size > 0) {
    return true;
  }
  if (!Array.isArray(items)) return false;
  return items.some(item => {
    const label = String(item?.label_no || '').trim();
    return label.startsWith('TEST-');
  });
}

/**
 * Count how many rows currently have test-generated values
 */
export function countTestGeneratedRows(items, testGeneratedIndices = null) {
  if (testGeneratedIndices && testGeneratedIndices.size > 0) {
    return testGeneratedIndices.size;
  }
  if (!Array.isArray(items)) return 0;
  return items.filter(item => {
    const label = String(item?.label_no || '').trim();
    return label.startsWith('TEST-');
  }).length;
}

/**
 * Generate test data for selected items
 * Returns: { updatedItems, modifiedIndices, labelCounter }
 */
export function generateVerificationTestData({
  items = [],
  targetIndices = [],
  pattern = 'realistic', // 'realistic' | 'all_matched' | 'shortages_excess'
  onlyEmpty = true,
  percentage = 100,
  startLabelSeq = 1,
  randomFn = Math.random
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { updatedItems: [], modifiedIndices: new Set(), labelCounter: startLabelSeq };
  }

  // 1. Identify eligible row indices based on targetIndices and onlyEmpty
  const candidateIndices = targetIndices.filter(idx => {
    if (idx < 0 || idx >= items.length) return false;
    const row = items[idx];
    if (onlyEmpty && !isRowEmpty(row)) return false;
    return true;
  });

  // 2. Apply percentage limit
  const pct = Math.max(1, Math.min(100, Number(percentage) || 100));
  const countToFill = Math.min(
    candidateIndices.length,
    Math.ceil(candidateIndices.length * (pct / 100))
  );
  const selectedIndices = candidateIndices.slice(0, countToFill);

  // 3. Generate values for each selected row
  const updatedItems = [...items];
  const modifiedIndices = new Set();
  let labelSeq = startLabelSeq;

  selectedIndices.forEach((itemIdx) => {
    const original = updatedItems[itemIdx];
    const systemQty = Math.max(0, Number(original.system_qty ?? original.quantity ?? 1));

    let physicalQty = systemQty;

    if (pattern === 'all_matched') {
      physicalQty = systemQty;
    } else if (pattern === 'shortages_excess') {
      const isShortage = randomFn() < 0.5;
      if (isShortage) {
        const reduction = systemQty > 1 ? Math.floor(randomFn() * Math.min(3, systemQty)) + 1 : 1;
        physicalQty = Math.max(0, systemQty - reduction);
      } else {
        const excess = Math.floor(randomFn() * 2) + 1;
        physicalQty = systemQty + excess;
      }
    } else {
      // 'realistic' pattern
      // ~80% matched, ~12% shortage, ~8% excess
      const roll = randomFn();
      if (roll < 0.80) {
        physicalQty = systemQty;
      } else if (roll < 0.92) {
        const reduction = systemQty > 1 ? Math.floor(randomFn() * Math.min(3, systemQty)) + 1 : 1;
        physicalQty = Math.max(0, systemQty - reduction);
      } else {
        const excess = Math.floor(randomFn() * 2) + 1;
        physicalQty = systemQty + excess;
      }
    }

    // Condition
    let condition = 'Good';
    if (pattern !== 'all_matched') {
      const condRoll = randomFn();
      if (condRoll < 0.90) {
        condition = 'Good';
      } else {
        condition = 'Damaged';
      }
    }

    // Issued / Destroyed (~5% of rows, only if physicalQty > 0)
    let issuedDestroyed = '—';
    let issuedDestroyedQty = '';
    if (pattern !== 'all_matched' && physicalQty > 0 && randomFn() < 0.05) {
      issuedDestroyed = randomFn() < 0.5 ? 'Issued' : 'Destroyed';
      const maxAllowed = Math.max(1, Math.min(physicalQty, systemQty));
      issuedDestroyedQty = Math.max(1, Math.min(maxAllowed, Math.floor(randomFn() * maxAllowed) + 1));
    }

    // Label No: sequential "TEST-0001", "TEST-0002"
    const labelNo = `TEST-${String(labelSeq).padStart(4, '0')}`;
    labelSeq += 1;

    // Remarks: short sample text on ~10% of rows
    let remarks = '';
    if (pattern !== 'all_matched' && randomFn() < 0.10) {
      remarks = 'Test remark - sample data';
    }

    // Difference and Status
    const diff = physicalQty - systemQty;
    let status = 'Matched';
    if (diff < 0) status = 'Shortage';
    else if (diff > 0) status = 'Excess';

    updatedItems[itemIdx] = {
      ...original,
      physical_qty: physicalQty,
      difference: diff,
      condition,
      issued_destroyed: issuedDestroyed,
      issued_destroyed_qty: issuedDestroyedQty,
      label_no: labelNo,
      remarks,
      status,
      __isTestGenerated: true
    };

    modifiedIndices.add(itemIdx);
  });

  return {
    updatedItems,
    modifiedIndices,
    labelCounter: labelSeq
  };
}

/**
 * Clear test data: restores rows back to clean/backup state.
 * Guaranteed to clear all test-generated rows (starts with 'TEST-' or __isTestGenerated)
 * even if no backup was provided or if backup rows themselves were corrupted.
 */
export function clearTestGeneratedData(currentItems, backupItems, modifiedIndices) {
  if (!Array.isArray(currentItems)) return [];

  return currentItems.map((item, idx) => {
    const label = String(item?.label_no || '').trim();
    const isTestItem = Boolean(
      item?.__isTestGenerated ||
      label.startsWith('TEST-') ||
      (modifiedIndices && modifiedIndices.has(idx))
    );

    if (!isTestItem) {
      return item;
    }

    // Check if we have a clean backup row that wasn't itself a test item
    const backup = backupItems && backupItems[idx];
    const backupLabel = String(backup?.label_no || '').trim();
    const backupIsTest = backup && (
      backup.__isTestGenerated ||
      backupLabel.startsWith('TEST-')
    );

    if (backup && !backupIsTest) {
      const restored = { ...backup };
      delete restored.__isTestGenerated;
      return restored;
    }

    // Reset to pristine uncounted state
    return {
      ...item,
      physical_qty: '',
      difference: null,
      condition: '—',
      issued_destroyed: '—',
      issued_destroyed_qty: null,
      issued_destroyed_id: null,
      label_no: '',
      remarks: '',
      status: 'Not Counted',
      __isTestGenerated: false
    };
  });
}

