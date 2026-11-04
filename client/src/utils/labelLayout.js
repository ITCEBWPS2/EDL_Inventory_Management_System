/**
 * Utilities for Serial Label Printing Layout, Sizing & Generation
 */

export const PAGE_DIMENSIONS = {
  A4: { widthMm: 210, heightMm: 297 }
};

export const LABEL_PRESETS = {
  '90x25': {
    id: '90x25',
    label: '90 × 25 mm (Wide Asset Tag - Recommended)',
    widthMm: 90,
    heightMm: 25,
    defaultColumns: 2,
    defaultRows: 11,
    marginTopMm: 11,
    marginBottomMm: 11,
    marginLeftMm: 10,
    marginRightMm: 10,
    gapXMm: 5,
    gapYMm: 0
  },
  '70x30': {
    id: '70x30',
    label: '70 × 30 mm (Standard A4 Sticker)',
    widthMm: 70,
    heightMm: 30,
    defaultColumns: 3,
    defaultRows: 9,
    marginTopMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 0,
    marginRightMm: 0,
    gapXMm: 0,
    gapYMm: 0
  },
  '50x25': {
    id: '50x25',
    label: '50 × 25 mm (Small Asset Tag)',
    widthMm: 50,
    heightMm: 25,
    defaultColumns: 4,
    defaultRows: 11,
    marginTopMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 5,
    marginRightMm: 5,
    gapXMm: 0,
    gapYMm: 0
  },
  '100x40': {
    id: '100x40',
    label: '100 × 40 mm (Large Equipment Tag)',
    widthMm: 100,
    heightMm: 40,
    defaultColumns: 2,
    defaultRows: 7,
    marginTopMm: 8,
    marginBottomMm: 8,
    marginLeftMm: 5,
    marginRightMm: 5,
    gapXMm: 0,
    gapYMm: 0
  },
  custom: {
    id: 'custom',
    label: 'Custom Size',
    widthMm: 90,
    heightMm: 25,
    defaultColumns: 2,
    defaultRows: 11,
    marginTopMm: 11,
    marginBottomMm: 11,
    marginLeftMm: 10,
    marginRightMm: 10,
    gapXMm: 5,
    gapYMm: 0
  }
};

export const DEFAULT_PRINT_OPTIONS = {
  layoutMode: 'sheet',
  presetId: '90x25',
  customWidthMm: 90,
  customHeightMm: 25,
  showItemName: false,
  showQrCode: false,
  showCutLines: false,
  copies: 1,
  startPosition: 1,
  marginTopMm: 11,
  marginBottomMm: 11,
  marginLeftMm: 10,
  marginRightMm: 10,
  gapXMm: 5,
  gapYMm: 0
};

/**
 * Calculates columns, rows, and total labels per A4 sheet dynamically
 */
export function calculateSheetLayout({
  pageWidthMm = 210,
  pageHeightMm = 297,
  labelWidthMm = 90,
  labelHeightMm = 25,
  marginTopMm = 11,
  marginBottomMm = 11,
  marginLeftMm = 10,
  marginRightMm = 10,
  gapXMm = 5,
  gapYMm = 0
} = {}) {
  const w = Math.max(10, Number(labelWidthMm) || 90);
  const h = Math.max(10, Number(labelHeightMm) || 25);
  const mt = Math.max(0, Number(marginTopMm) || 0);
  const mb = Math.max(0, Number(marginBottomMm) || 0);
  const ml = Math.max(0, Number(marginLeftMm) || 0);
  const mr = Math.max(0, Number(marginRightMm) || 0);
  const gx = Math.max(0, Number(gapXMm) || 0);
  const gy = Math.max(0, Number(gapYMm) || 0);

  const availableWidth = Math.max(1, pageWidthMm - (ml + mr));
  const availableHeight = Math.max(1, pageHeightMm - (mt + mb));

  // Compute number of columns that can fit
  const columns = Math.max(1, Math.floor((availableWidth + gx) / (w + gx)));
  // Compute number of rows that can fit
  const rows = Math.max(1, Math.floor((availableHeight + gy) / (h + gy)));
  const labelsPerPage = columns * rows;

  return {
    columns,
    rows,
    labelsPerPage,
    availableWidth,
    availableHeight,
    labelWidthMm: w,
    labelHeightMm: h
  };
}

/**
 * Calculates the optimal font size (in pt) for a single-line monospace serial number
 * so that it never wraps or overflows the label width.
 *
 * @param {Object} params
 * @param {string} params.serial - Serial number string
 * @param {number} params.labelWidthMm - Label width in millimeters
 * @param {number} params.labelHeightMm - Label height in millimeters
 * @param {boolean} [params.hasQr=false] - Whether QR barcode is enabled
 * @param {boolean} [params.hasItemName=false] - Whether item name is enabled
 * @param {number} [params.minFontPt=5] - Minimum acceptable font size in pt
 * @param {number} [params.maxFontPt=14] - Maximum font size in pt
 * @returns {{ fontSizePt: number, fits: boolean, availWidthMm: number, textWidthMm: number, qrSize: number }}
 */
export function calculateSerialFontSize({
  serial = '',
  labelWidthMm = 90,
  labelHeightMm = 25,
  hasQr = false,
  hasItemName = false,
  minFontPt = 5,
  maxFontPt = 14
} = {}) {
  const str = String(serial || '').trim();
  const len = Math.max(1, str.length);

  // Label horizontal padding (2mm left + 2mm right = 4mm total)
  const paddingX = 4;
  // If QR code is present, it takes height-based square size + 2.5mm gap
  const qrSize = hasQr ? Math.min(22, Math.max(10, labelHeightMm - 4)) : 0;
  const qrGap = hasQr ? 2.5 : 0;
  const availWidthMm = Math.max(1, labelWidthMm - paddingX - (hasQr ? qrSize + qrGap : 0));

  // Monospace character advance width ≈ 0.6 * fontSize
  // fontSizeMm = fontPt * (25.4 / 72)
  // charWidthMm = 0.6 * fontPt * (25.4 / 72) ≈ 0.211667 * fontPt
  // textWidthMm = len * charWidthMm = len * 0.6 * fontPt * (25.4 / 72)
  // Therefore: fontPtFromWidth = (availWidthMm * 72) / (len * 0.6 * 25.4)
  const fontPtFromWidth = (availWidthMm * 72) / (len * 0.6 * 25.4);

  // Height constraint: serial line + optional item name
  const paddingY = 4;
  const itemNameHeightMm = hasItemName ? 4.5 : 0;
  const availHeightMm = Math.max(1, labelHeightMm - paddingY - itemNameHeightMm);
  // Line height ~ 1.25 of font size
  const fontPtFromHeight = (availHeightMm / 1.25) * (72 / 25.4);

  const idealFontPt = Math.min(fontPtFromWidth, fontPtFromHeight);
  const fits = idealFontPt >= minFontPt;
  const fontSizePt = Number(Math.min(maxFontPt, Math.max(minFontPt, idealFontPt)).toFixed(1));

  const textWidthMm = len * 0.6 * fontSizePt * (25.4 / 72);

  return {
    fontSizePt,
    fits,
    availWidthMm,
    textWidthMm: Number(textWidthMm.toFixed(1)),
    qrSize
  };
}

/**
 * Returns serial as a single line (no-split).
 * Kept for backwards compatibility if referenced elsewhere.
 */
export function splitSerialForDisplay(serial) {
  if (!serial || typeof serial !== 'string') return [''];
  return [serial.trim()];
}

/**
 * Builds the array of pages for sheet printing.
 * Prepends empty slots on sheet 1 according to startPosition,
 * repeats each item by `copies`, and chunks into pages.
 */
export function buildPrintItems({
  items = [],
  copies = 1,
  startPosition = 1,
  layoutMode = 'sheet',
  labelsPerPage = 22
} = {}) {
  const safeCopies = Math.max(1, parseInt(copies, 10) || 1);
  const safeStart = Math.max(1, parseInt(startPosition, 10) || 1);
  const validItems = Array.isArray(items) ? items : [];

  const slots = [];
  const emptyCount = safeStart - 1;
  for (let i = 0; i < emptyCount; i++) {
    slots.push({
      isEmpty: true,
      serial: '',
      itemName: '',
      itemId: `empty-${i}`
    });
  }

  let totalLabels = 0;
  validItems.forEach(item => {
    for (let c = 0; c < safeCopies; c++) {
      slots.push({
        ...item,
        isEmpty: false,
        copyIndex: c + 1
      });
      totalLabels++;
    }
  });

  const pages = [];
  const safeLabelsPerPage = Math.max(1, labelsPerPage);
  for (let i = 0; i < slots.length; i += safeLabelsPerPage) {
    pages.push(slots.slice(i, i + safeLabelsPerPage));
  }

  return {
    pages: pages.length > 0 ? pages : [[]],
    totalLabels,
    totalPages: Math.max(1, pages.length)
  };
}

const STORAGE_KEY_V2 = 'edl_serial_label_options_v2';
const STORAGE_KEY_V1 = 'edl_serial_label_options_v1';

export function loadSavedPrintOptions() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_PRINT_OPTIONS };
    }

    const rawV2 = window.localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      return {
        ...DEFAULT_PRINT_OPTIONS,
        ...parsed,
        layoutMode: 'sheet',
        showItemName: false,
        showQrCode: false,
        showCutLines: false
      };
    }

    const rawV1 = window.localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const parsed = JSON.parse(rawV1);
      // Migrate old default of 70x30 to new 90x25 default when it wasn't a deliberate custom preset
      if (parsed.presetId === '70x30' && (Number(parsed.rollWidthMm) === 70 || !parsed.rollWidthMm)) {
        parsed.presetId = '90x25';
        parsed.marginTopMm = 11;
        parsed.marginBottomMm = 11;
        parsed.marginLeftMm = 10;
        parsed.marginRightMm = 10;
        parsed.gapXMm = 5;
        parsed.gapYMm = 0;
      }
      return {
        ...DEFAULT_PRINT_OPTIONS,
        ...parsed,
        layoutMode: 'sheet',
        showItemName: false,
        showQrCode: false,
        showCutLines: false
      };
    }

    return { ...DEFAULT_PRINT_OPTIONS };
  } catch (err) {
    console.warn('Failed to load saved label print options', err);
    return { ...DEFAULT_PRINT_OPTIONS };
  }
}

export function savePrintOptions(options) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const toSave = { ...options };
    window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(toSave));
  } catch (err) {
    console.warn('Failed to save label print options', err);
  }
}
