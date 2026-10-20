/**
 * Serial Number Generator Utility for EDL IMS
 *
 * Generates standardized serial numbers matching:
 * DGM(WPSII)/CE(COM)/{UNIT}/{CATEGORY_CODE}/{SUBCATEGORY_CODE}/{ITEM_TYPE_CODE}-{SEQUENCE}
 *
 * Example:
 * Unit = ITO, Category = Furniture, Chair Type = Clerical Chair:
 * -> DGM(WPSII)/CE(COM)/ITO/FUR/CHR/CLERICL-CHR-001
 */

export const CONSTANT_PREFIX = 'DGM(WPSII)/CE(COM)';

// Category code mapping
export const CATEGORY_CODES = {
  furniture: 'FUR',
  'it-computing-equipment': 'IT',
  'network-communication-equipment': 'NET',
  'audio-visual-presentation-equipment': 'AV',
  'tools-equipment': 'TLS',
  // Direct name fallbacks
  Furniture: 'FUR',
  'IT & Computing Equipment': 'IT',
  'Network & Communication Equipment': 'NET',
  'Audio Visual & Presentation Equipment': 'AV',
  'Tools & Equipment': 'TLS'
};

// Subcategory code mapping
export const SUBCATEGORY_CODES = {
  // Furniture
  chairs: 'CHR',
  tables: 'TBL',
  'cupboards-cabinets': 'CAB',
  'shelving-racking': 'SHL',
  workstations: 'WST',

  // IT & Computing
  'computers-peripherals': 'CMP',
  'storage-devices': 'STR',
  'printers-printing-equipment': 'PRN',
  'scanning-office-machines': 'SCN',

  // Network & Communication
  'network-equipment': 'NET',
  'servers-storage': 'SRV',
  'telephones-phones': 'TEL',
  cameras: 'CAM',
  'cctv-recording-display': 'CCTV',

  // Audio Visual
  'audio-equipment': 'AUD',
  'display-presentation': 'DSP',
  projectors: 'PRJ',

  // Tools & Equipment
  'hand-tools': 'HTL',
  'electrical-tools-testing-equipment': 'ETE',
  'tool-storage-handling': 'TSH',
  'safety-equipment-ppe': 'PPE',
  'power-utility-equipment': 'PUE',
  'air-conditioning-ventilation': 'ACV',
  'cleaning-equipment': 'CLN',
  'kitchen-refreshment-equipment': 'KTC',
  'office-general-equipment': 'OGE',
  'Office & General Equipment': 'OGE'
};

// Explicit mappings for standard item types
export const ITEM_TYPE_CODES = {
  // Chairs (CHR)
  'Clerical Chair': 'CLERICL-CHR',
  'Visitor Chair': 'VISITOR-CHR',
  'Executive Chair': 'EXEC-CHR',
  'Low Back Chair': 'LOWBACK-CHR',
  'Mid Back Chair': 'MIDBACK-CHR',
  'High Back Chair': 'HIGHBACK-CHR',
  'Computer Executive Chair': 'COMP-EXEC-CHR',
  'Computer Typist Chair': 'COMP-TYPIST-CHR',
  'Computer Assistant Chair': 'COMP-ASST-CHR',
  'Front Chair': 'FRONT-CHR',

  // Backward compatibility aliases
  'Computer Executive': 'COMP-EXEC-CHR',
  'Computer Typist': 'COMP-TYPIST-CHR',
  'Computer Assistant': 'COMP-ASST-CHR',

  // Tables (TBL)
  'Executive Table': 'EXEC-TBL',
  'Computer Table': 'COMP-TBL',
  'Writing Table': 'WRITE-TBL',
  'Clerical Table': 'CLERICL-TBL',
  'Wooden Table': 'WOOD-TBL',
  'Draughtsman Table': 'DRAUGHT-TBL',
  'Drawing Table': 'DRAW-TBL',
  'Printer Table': 'PRINT-TBL',
  'Office Table': 'OFFICE-TBL',

  // Cabinets & Cupboards (CAB)
  'Library Cupboard': 'LIB-CAB',
  'Drawer Cabinet': 'DRAWER-CAB',
  'Cupboard – 2 Door': '2DOOR-CAB',
  'Cupboard – 4 Door': '4DOOR-CAB',
  'Cupboard – 2 Drawer': '2DRW-CAB',
  'Full Height Cupboard': 'FULLHT-CAB',
  'Half Height Cupboard': 'HALFHT-CAB',
  'Steel Cabinet – 4 Drawer': 'STEEL4D-CAB',
  'Wooden Cabinet – 3 Door': 'WOOD3D-CAB',

  // Shelving (SHL)
  'File Rack – 8 Compartments': 'FILERACK8-SHL',
  'CPU Rack – Iron': 'CPURACK-SHL',
  'Book Rack': 'BOOKRACK-SHL',

  // Workstations (WST)
  '2-Seater Workstation': '2SEAT-WST',
  '4-Seater Workstation': '4SEAT-WST',

  // Computers & Peripherals (CMP)
  'Desktop Computer': 'DESKTOP-CMP',
  Laptop: 'LAPTOP-CMP',
  CPU: 'CPU-CMP',
  'Backup CPU': 'BCKCPU-CMP',
  Monitor: 'MONITOR-CMP',
  'Backup Monitor': 'BCKMON-CMP',
  Keyboard: 'KYBRD-CMP',
  Mouse: 'MOUSE-CMP',
  'DVD Writer': 'DVDWR-CMP',
  Tab: 'TAB-CMP',
  'HDMI to VGA Convertor': 'HDMIVGA-CMP',

  // Storage Devices (STR)
  'Pen Drive': 'PENDRV-STR',
  'External Hard Drive': 'EXTHDD-STR',
  'Portable Backup Drive': 'PORTDRV-STR',
  'IDE/SATA Docking Station': 'DOCKSTN-STR',
  HDD: 'HDD-STR',
  '512 GB Globaltec SATA SSD': '512SSD-STR',

  // Printers (PRN)
  'Line Printer': 'LINE-PRN',
  'Dot Matrix Printer': 'DOTMTX-PRN',
  'Brother Laser Printer': 'BROTHER-PRN',
  'Epson Dot Matrix Impact Printer': 'EPSON-PRN',
  'Laser Printer': 'LASER-PRN',
  'Thermal Printer': 'THERMAL-PRN',
  'Color A3 Printer': 'COLORA3-PRN',
  'Cheque Printer': 'CHEQUE-PRN',
  Plotter: 'PLOTTER-PRN',
  'Dot Matrix Printer Backup': 'BCKDOTMTX-PRN',

  // Scanning & Office Machines (SCN)
  Scanner: 'SCANNER-SCN',
  'Photocopy Machine': 'PHOTOCOPY-SCN',
  'Fax Machine': 'FAX-SCN',

  // Network Equipment (NET)
  Firewall: 'FIREWALL-NET',
  'Network Switch /PoE Switch': 'SWITCH-NET',
  'Wireless Access Point': 'WAP-NET',
  Modem: 'MODEM-NET',
  'Wi-Fi Dongle': 'DONGLE-NET',
  'Patch Panel': 'PATCHPNL-NET',
  'Network Toner & Probe': 'TONER-NET',
  'Managed Access Point': 'MAP-NET',

  // Servers & Storage (SRV)
  'Network Server': 'NET-SRV',
  'Billing Server': 'BILLING-SRV',
  'Server with License': 'LICENSED-SRV',
  NAS: 'NAS-SRV',

  // Telephones (TEL)
  'Analog Telephone': 'ANALOG-TEL',
  'Digital Telephone': 'DIGITAL-TEL',
  'Basic Phone': 'BASIC-TEL',
  'Analog Phone': 'ANALOGP-TEL',
  'Digital Phone': 'DIGITALP-TEL',

  // Cameras (CAM)
  'Bullet Camera': 'BULLET-CAM',
  'Thermal Camera': 'THERMAL-CAM',
  'Network Camera': 'NET-CAM',

  // CCTV (CCTV)
  'Network Video Recorder': 'NVR-CCTV',
  'Network Video Decoder': 'NVD-CCTV',

  // Audio (AUD)
  'TOA FM Mic': 'TOAFM-AUD',
  'JBL Speaker': 'JBLSPK-AUD',
  'JBL Wired Mic': 'JBLMIC-AUD',
  'Mic Stand': 'MICSTAND-AUD',
  'TOA Dual Wireless Receiver': 'TOARECV-AUD',
  'Collar Mic & Wireless Transmitter': 'COLLARMIC-AUD',

  // Display (DSP)
  Projector: 'PROJ-DSP',
  'HDMI Cable': 'HDMI-DSP',
  'LED Television': 'LEDTV-DSP',

  // Office & General Equipment (OGE)
  Briefcase: 'BRIEFCASE-OGE',
  Calculator: 'CALCULATOR-OGE',
  Stapler: 'STAPLER-OGE',
  'Cello Tape Machine': 'CELLO-TAPE-OGE',
  'Cello Tape': 'CELLO-TAPE-OGE',
  'Cash Box': 'CASH-BOX-OGE',
  'Wall Clock': 'WALL-CLOCK-OGE',
  'Wireless Door Bell': 'DOOR-BELL-OGE',
  Ladder: 'LADDER-OGE',
  'Puncher (L)': 'PUNCHER-L-OGE',
  'Puncher (S)': 'PUNCHER-S-OGE',
  'Puncher(L)': 'PUNCHER-L-OGE',
  'Puncher(S)': 'PUNCHER-S-OGE',

  // Electrical Tools & Testing Equipment (ETE)
  'Trimble GPS Receiver': 'TRIMBLE-GPS-RECEIVER-ETE',
  'Bluebird Data Collector': 'BLUEBIRD-DATA-COLLECTOR-ETE',
  'Binocular': 'BINOCULAR-ETE',
  'Binoculars': 'BINOCULAR-ETE',
  'Digital Multimeter': 'MULTIMETER-ETE'
};

/**
 * Resolves the unit code string from unit object, name or code.
 */
export function resolveUnitCode(unit) {
  if (!unit) return 'EDL-HQ';
  if (typeof unit === 'string') {
    return unit.trim().replace(/\s+/g, '_').toUpperCase();
  }
  // Prefer unit_name (e.g. ITO, CSC_HOMAGAMA) or unit_code
  const name = unit.unit_name || unit.unit_code || 'EDL-HQ';
  return name.trim().replace(/\s+/g, '_').toUpperCase();
}

/**
 * Resolves category code (e.g. FUR, IT, NET, AV, TLS)
 */
export function resolveCategoryCode(category) {
  if (!category) return 'FUR';
  const key = typeof category === 'string' ? category.trim() : (category.slug || category.name || '');
  if (CATEGORY_CODES[key]) return CATEGORY_CODES[key];
  if (CATEGORY_CODES[key.toLowerCase()]) return CATEGORY_CODES[key.toLowerCase()];

  // Slugify lookup
  const slug = key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (CATEGORY_CODES[slug]) return CATEGORY_CODES[slug];

  // Fallback: first 3 alphanumeric characters
  const cleaned = key.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return cleaned.substring(0, 3) || 'GEN';
}

/**
 * Resolves subcategory code (e.g. CHR, TBL, CAB...)
 */
export function resolveSubCategoryCode(subType) {
  if (!subType) return 'GEN';
  const key = typeof subType === 'string' ? subType.trim().toLowerCase() : (subType.slug || subType.name || '').toLowerCase();
  if (SUBCATEGORY_CODES[key]) return SUBCATEGORY_CODES[key];

  const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (SUBCATEGORY_CODES[slug]) return SUBCATEGORY_CODES[slug];

  const cleaned = key.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return cleaned.substring(0, 3) || 'GEN';
}

/**
 * Derives item type code (e.g. CLERICL-CHR for "Clerical Chair")
 */
export function deriveItemTypeCode(itemType, subcatCode = 'CHR') {
  if (!itemType || typeof itemType !== 'string') return `ITM-${subcatCode}`;
  const trimmed = itemType.trim();

  // 1. Check exact map
  if (ITEM_TYPE_CODES[trimmed]) {
    return ITEM_TYPE_CODES[trimmed];
  }

  // 2. Normalize and check case-insensitive match
  const lower = trimmed.toLowerCase();
  for (const [name, code] of Object.entries(ITEM_TYPE_CODES)) {
    if (name.toLowerCase() === lower) {
      return code;
    }
  }

  // 3. Dynamic derivation for custom types:
  // Remove common nouns like chair, table, etc.
  const stopWords = ['chair', 'table', 'desk', 'cabinet', 'cupboard', 'rack', 'device', 'unit', 'machine', 'equipment', 'item'];
  let words = trimmed.split(/[\s\-–_]+/);
  let filtered = words.filter(w => !stopWords.includes(w.toLowerCase()));
  if (filtered.length === 0) filtered = words;

  // Shorten first word
  let mainWord = (filtered[0] || 'ITEM').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (mainWord.length > 7) {
    mainWord = mainWord.substring(0, 7);
  }

  let code = mainWord;
  if (filtered.length > 1) {
    let secondWord = (filtered[1] || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (secondWord) {
      code += `-${secondWord.substring(0, 4)}`;
    }
  }

  // Append subcategory suffix if not already present
  if (!code.endsWith(`-${subcatCode}`)) {
    code += `-${subcatCode}`;
  }

  return code;
}

/**
 * Extracts sequence numbers from existing items matching the exact prefix
 */
export function getNextSequence(existingItems = [], basePrefix = '', serverCounters = {}) {
  if (!basePrefix) return '001';

  const escapedPrefix = basePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escapedPrefix}(\\d+)$`, 'i');

  let maxSeq = (serverCounters && serverCounters[basePrefix]) || 0;
  (existingItems || []).forEach(item => {
    const codes = [];
    if (item.item_code) codes.push(item.item_code);
    if (Array.isArray(item.serial_numbers)) {
      item.serial_numbers.forEach(s => {
        if (s) codes.push(s);
      });
    }
    codes.forEach(code => {
      const match = (code || '').trim().match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });
  });

  const nextSeq = maxSeq + 1;
  return String(nextSeq).padStart(3, '0');
}

/**
 * Generates an array of sequential serial numbers for a batch item (Quantity > 1)
 */
export function generateBatchSerialNumbers({
  unit,
  category,
  subCategory,
  itemType,
  quantity = 1,
  existingItems = [],
  serverCounters = {}
}) {
  const unitCode = resolveUnitCode(unit);
  const catCode = resolveCategoryCode(category);
  const subCatCode = resolveSubCategoryCode(subCategory);
  const itemTypeCode = deriveItemTypeCode(itemType, subCatCode);

  const basePrefix = `${CONSTANT_PREFIX}/${unitCode}/${catCode}/${subCatCode}/${itemTypeCode}-`;
  const escapedPrefix = basePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escapedPrefix}(\\d+)$`, 'i');

  let maxSeq = (serverCounters && serverCounters[basePrefix]) || 0;
  (existingItems || []).forEach(item => {
    const codes = [];
    if (item.item_code) codes.push(item.item_code);
    if (Array.isArray(item.serial_numbers)) {
      item.serial_numbers.forEach(s => {
        if (s) codes.push(s);
      });
    }
    codes.forEach(code => {
      const match = (code || '').trim().match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });
  });

  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const serialNumbers = [];
  for (let i = 1; i <= qty; i++) {
    const seq = String(maxSeq + i).padStart(3, '0');
    serialNumbers.push(`${basePrefix}${seq}`);
  }

  const firstSerial = serialNumbers[0];
  const lastSerial = serialNumbers[serialNumbers.length - 1];
  const batchLabel = `${itemType || 'Item'} Batch (Multi-Serial)`;

  return {
    basePrefix,
    serialNumbers,
    firstSerial,
    lastSerial,
    batchLabel,
    count: qty,
    startSeq: maxSeq + 1,
    endSeq: maxSeq + qty
  };
}

/**
 * Main generator function
 *
 * @param {Object} params
 * @param {string|Object} params.unit - Unit object or unit name/code
 * @param {string|Object} params.category - Category object, name, or slug
 * @param {string|Object} params.subCategory - Sub-category slug or name
 * @param {string} params.itemType - Selected item type / name
 * @param {Array} params.existingItems - Array of existing items to calculate next sequence
 * @returns {string} Fully-formed Serial No.
 */
export function generateSerialNumber({
  unit,
  category,
  subCategory,
  itemType,
  existingItems = [],
  serverCounters = {}
}) {
  const unitCode = resolveUnitCode(unit);
  const catCode = resolveCategoryCode(category);
  const subCatCode = resolveSubCategoryCode(subCategory);
  const itemTypeCode = deriveItemTypeCode(itemType, subCatCode);

  const basePrefix = `${CONSTANT_PREFIX}/${unitCode}/${catCode}/${subCatCode}/${itemTypeCode}-`;
  const seq = getNextSequence(existingItems, basePrefix, serverCounters);

  return `${basePrefix}${seq}`;
}

/**
 * Universal helper to detect if an inventory item represents a batch (Quantity > 1)
 */
export function isBatchItem(item) {
  if (!item) return false;
  return Boolean(
    item.is_batch ||
    (Array.isArray(item.serial_numbers) && item.serial_numbers.length > 1) ||
    Number(item.quantity) > 1
  );
}


