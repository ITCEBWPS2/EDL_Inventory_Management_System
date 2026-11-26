/**
 * countSheetBuilder.js
 * Builds and formats row data for the Physical Verification Count Sheet (Print & Word docx).
 * Pure helper without side effects, database calls, or draft modifications.
 */

export const COUNT_SHEET_STORAGE_KEY = 'edl_count_sheet_options';

/**
 * Default options for count sheet generation.
 */
export const DEFAULT_COUNT_SHEET_OPTIONS = {
  scope: 'all', // 'all' | 'filtered'
  showSystemQty: true,
  groupByCategory: true,
  rowsPerPage: 'auto', // 'auto' | '12' | '15' | '20'
  includeSignatureBlock: true,
  prefillHeader: true
};

/**
 * Safely retrieves persisted count sheet options from localStorage.
 */
export function getStoredCountSheetOptions() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(COUNT_SHEET_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.scope && parsed.scope !== 'all' && parsed.scope !== 'filtered') {
          parsed.scope = 'all';
        }
        return { ...DEFAULT_COUNT_SHEET_OPTIONS, ...parsed };
      }
    }
  } catch (err) {
    console.warn('Failed to read count sheet options from localStorage:', err);
  }
  return { ...DEFAULT_COUNT_SHEET_OPTIONS };
}

/**
 * Persists count sheet options to localStorage.
 */
export function saveStoredCountSheetOptions(options) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        COUNT_SHEET_STORAGE_KEY,
        JSON.stringify(options)
      );
    }
  } catch (err) {
    console.warn('Failed to save count sheet options to localStorage:', err);
  }
}

/**
 * Checks if an item is considered "uncounted" in the current verification.
 */
export function isItemUncounted(item) {
  if (!item) return true;
  const phys = item.physical_qty;
  return phys === '' || phys === null || phys === undefined;
}

/**
 * Checks if an item is pending condemnation (disposal in progress).
 */
export function isItemPendingCondemnation(item) {
  if (!item) return false;
  if (item.pending_condemnation === true || item.is_pending_condemnation === true) {
    return true;
  }
  const status = String(item.status || '').toLowerCase();
  const disposalStatus = String(item.disposal_status || '').toLowerCase();
  return (
    status.includes('condemn') ||
    status.includes('disposal') ||
    disposalStatus.includes('pending') ||
    disposalStatus.includes('in review') ||
    disposalStatus.includes('approved')
  );
}

/**
 * Checks if an item has already been destroyed or sold and should be excluded.
 */
export function isItemDestroyedOrSold(item) {
  if (!item) return false;
  const status = String(item.status || '').toLowerCase();
  return status === 'destroyed' || status === 'sold' || status === 'written off';
}

/**
 * Resolves the clean list of serial numbers for an item, ensuring one entry per serial.
 */
export function resolveItemSerialList(item) {
  if (!item) return [];
  if (Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0) {
    const list = item.serial_numbers
      .map(s => (s !== null && s !== undefined ? String(s).trim() : ''))
      .filter(Boolean);
    if (list.length > 0) return list;
  }
  if (item.item_code) {
    const trimmed = String(item.item_code).trim();
    if (trimmed) return [trimmed];
  }
  if (item.serial_number) {
    const trimmed = String(item.serial_number).trim();
    if (trimmed) return [trimmed];
  }
  return [];
}

/**
 * Sort items stably: category, then sub-category, then item name, then serial number.
 */
export function sortCountSheetItems(itemsList) {
  return [...itemsList].sort((a, b) => {
    const catA = String(a.category || '').toLowerCase();
    const catB = String(b.category || '').toLowerCase();
    if (catA !== catB) return catA.localeCompare(catB);

    const subA = String(a.sub_type || a.sub_category || '').toLowerCase();
    const subB = String(b.sub_type || b.sub_category || '').toLowerCase();
    if (subA !== subB) return subA.localeCompare(subB);

    const nameA = String(a.item_name || '').toLowerCase();
    const nameB = String(b.item_name || '').toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    const codeA = String(a.item_code || (Array.isArray(a.serial_numbers) ? a.serial_numbers[0] : '') || '');
    const codeB = String(b.item_code || (Array.isArray(b.serial_numbers) ? b.serial_numbers[0] : '') || '');
    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Filters the raw list of items according to scope and exclusion rules.
 */
export function filterCountSheetItems(allItems, filteredItems, options = {}) {
  const scope = options.scope || 'all';
  let source = allItems || [];

  if (scope === 'filtered') {
    source = filteredItems || [];
  }

  // Filter out destroyed or sold items
  const activeItems = source.filter(it => !isItemDestroyedOrSold(it));

  // Sort stably
  return sortCountSheetItems(activeItems);
}

/**
 * Builds structured count sheet rows with category grouping metadata.
 * Returns: {
 *   items: Array<FormattedItem>,
 *   groups: Array<{ category: string, items: Array<FormattedItem> }>,
 *   totalItems: number,
 *   totalSystemQty: number,
 *   estimatedPages: number
 * }
 */
export function buildCountSheetData(allItems, filteredItems, options = {}) {
  const mergedOptions = { ...DEFAULT_COUNT_SHEET_OPTIONS, ...options };
  const rawList = filterCountSheetItems(allItems, filteredItems, mergedOptions);

  const formattedItems = rawList.map((item, idx) => {
    const serials = resolveItemSerialList(item);
    const isPending = isItemPendingCondemnation(item);
    const systemQty = Number(item.system_qty !== undefined && item.system_qty !== null ? item.system_qty : (serials.length || 1));

    return {
      index: idx + 1,
      id: item.id || `cs-row-${idx}`,
      inventory_item_id: item.inventory_item_id || item.item_id || item.id,
      item_name: item.item_name || 'Unnamed Item',
      category: item.category || 'General',
      sub_type: item.sub_type || item.sub_category || '',
      serial_numbers: serials,
      primary_serial: serials[0] || item.item_code || '—',
      system_qty: systemQty,
      is_batch: Boolean(item.is_batch) || serials.length > 1,
      is_pending_condemnation: isPending
    };
  });

  const totalItems = formattedItems.length;
  const totalSystemQty = formattedItems.reduce((acc, it) => acc + (Number(it.system_qty) || 0), 0);

  // Group by category if requested
  const groupsMap = new Map();
  formattedItems.forEach(item => {
    const cat = item.category || 'General';
    if (!groupsMap.has(cat)) {
      groupsMap.set(cat, []);
    }
    groupsMap.get(cat).push(item);
  });

  const groups = Array.from(groupsMap.entries()).map(([category, catItems]) => ({
    category,
    items: catItems
  }));

  // Estimate page count
  let estimatedPages = 1;
  const rowsPerPageSetting = mergedOptions.rowsPerPage;
  if (totalItems > 0) {
    if (rowsPerPageSetting === '12') {
      estimatedPages = Math.ceil(totalItems / 12);
    } else if (rowsPerPageSetting === '15') {
      estimatedPages = Math.ceil(totalItems / 15);
    } else if (rowsPerPageSetting === '20') {
      estimatedPages = Math.ceil(totalItems / 20);
    } else {
      // Automatic: landscape table holds ~14-16 average rows per page
      // Add extra weight for batch items with multiple serials
      const effectiveRowsWeight = formattedItems.reduce((sum, it) => {
        const extraLines = Math.max(0, it.serial_numbers.length - 1);
        return sum + 1 + extraLines * 0.4;
      }, 0);
      const categoryHeaderWeight = mergedOptions.groupByCategory ? groups.length * 0.8 : 0;
      estimatedPages = Math.max(1, Math.ceil((effectiveRowsWeight + categoryHeaderWeight) / 14));
    }
  }

  return {
    options: mergedOptions,
    items: formattedItems,
    groups,
    totalItems,
    totalSystemQty,
    estimatedPages
  };
}
