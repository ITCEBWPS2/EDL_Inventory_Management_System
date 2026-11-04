/**
 * Selection Helper Utilities for Serial Numbers and Batch Rows
 */

import { isBatchItem } from './serialNumberGenerator.js';

/**
 * Derives batch serial numbers list for an item
 */
export function getBatchSerialList(item) {
  if (Array.isArray(item?.serial_numbers) && item.serial_numbers.length > 0) {
    return item.serial_numbers;
  }
  const qty = Math.max(1, parseInt(item?.quantity, 10) || 1);
  const baseCode = (item?.item_code || 'ITM-001').trim();
  if (qty <= 1) return [baseCode];

  // Derive sequential serials from baseCode (e.g. ...-001 -> 001, 002, 003...)
  const match = baseCode.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const numDigits = Math.max(3, match[2].length);
    const startNum = parseInt(match[2], 10);
    const list = [];
    for (let i = 0; i < qty; i++) {
      list.push(`${prefix}${String(startNum + i).padStart(numDigits, '0')}`);
    }
    return list;
  }

  const list = [];
  for (let i = 1; i <= qty; i++) {
    list.push(`${baseCode}-${String(i).padStart(3, '0')}`);
  }
  return list;
}

/**
 * Returns all serial numbers belonging to an inventory item
 */
export function getItemSerials(item) {
  if (!item) return [];
  const isBatch = isBatchItem ? isBatchItem(item) : Boolean(item.is_batch || (Number(item.quantity) > 1));
  if (isBatch) {
    const list = getBatchSerialList(item);
    return Array.isArray(list) ? list.filter(Boolean) : [];
  }
  if (item.item_code && String(item.item_code).trim()) {
    return [String(item.item_code).trim()];
  }
  return [];
}

/**
 * Checks whether an item can be selected for serial label printing
 */
export function isItemSelectable(item) {
  return getItemSerials(item).length > 0;
}

/**
 * Determines the selection state of an item (checked, indeterminate, unchecked, disabled)
 */
export function getBatchSelectionStatus(item, selectedSerialsSet) {
  const serials = getItemSerials(item);
  if (!serials.length) return 'disabled';
  if (!selectedSerialsSet || selectedSerialsSet.size === 0) return 'unchecked';

  let selectedCount = 0;
  for (const s of serials) {
    if (selectedSerialsSet.has(s)) {
      selectedCount++;
    }
  }

  if (selectedCount === 0) return 'unchecked';
  if (selectedCount === serials.length) return 'checked';
  return 'indeterminate';
}

/**
 * Toggles selection of an entire item (all its serials if batch)
 */
export function toggleBatchSerials(item, selectedSerialsSet) {
  const nextSet = new Set(selectedSerialsSet);
  const serials = getItemSerials(item);
  if (!serials.length) return nextSet;

  const currentStatus = getBatchSelectionStatus(item, selectedSerialsSet);
  if (currentStatus === 'checked') {
    // Unselect all
    for (const s of serials) {
      nextSet.delete(s);
    }
  } else {
    // Select all
    for (const s of serials) {
      nextSet.add(s);
    }
  }
  return nextSet;
}

/**
 * Toggles a single individual serial number
 */
export function toggleSingleSerial(serial, selectedSerialsSet) {
  const nextSet = new Set(selectedSerialsSet);
  if (!serial) return nextSet;
  if (nextSet.has(serial)) {
    nextSet.delete(serial);
  } else {
    nextSet.add(serial);
  }
  return nextSet;
}

/**
 * Adds all serial numbers of all given items to the set
 */
export function selectAllFilteredSerials(items, selectedSerialsSet) {
  const nextSet = new Set(selectedSerialsSet);
  if (!Array.isArray(items)) return nextSet;

  items.forEach(item => {
    const serials = getItemSerials(item);
    serials.forEach(s => nextSet.add(s));
  });
  return nextSet;
}

/**
 * Resolves selected serials into ordered print items preserving table sequence
 */
export function resolvePrintItems(items = [], selectedSerialsSet = new Set(), serialMetadataMap = new Map()) {
  const results = [];
  const processedSerials = new Set();

  // 1. Process items in the table order
  items.forEach(item => {
    const serials = getItemSerials(item);
    const itemName = item.sub_classification || item.item_name || '';
    serials.forEach(serial => {
      if (selectedSerialsSet.has(serial)) {
        results.push({
          serial,
          itemName,
          itemId: item.id
        });
        processedSerials.add(serial);
      }
    });
  });

  // 2. Append any serials that were selected from other pages/filters but not in current items
  selectedSerialsSet.forEach(serial => {
    if (!processedSerials.has(serial)) {
      const meta = serialMetadataMap?.get?.(serial) || {};
      results.push({
        serial,
        itemName: meta.itemName || '',
        itemId: meta.itemId || null
      });
      processedSerials.add(serial);
    }
  });

  return results;
}
