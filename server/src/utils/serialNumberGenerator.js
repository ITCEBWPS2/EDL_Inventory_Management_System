/**
 * Server-side Serial Number Generator Utility for EDL IMS
 *
 * Generates standardized serial numbers matching:
 * DGM(WPSII)/CE(COM)/{UNIT}/{CATEGORY_CODE}/{SUBCATEGORY_CODE}/{ITEM_TYPE_CODE}-{SEQUENCE}
 */

const CONSTANT_PREFIX = 'DGM(WPSII)/CE(COM)';

const CATEGORY_CODES = {
  furniture: 'FUR',
  'it-computing-equipment': 'IT',
  'network-communication-equipment': 'NET',
  'audio-visual-presentation-equipment': 'AV',
  'tools-equipment': 'TLS',
  Furniture: 'FUR',
  'IT & Computing Equipment': 'IT',
  'Network & Communication Equipment': 'NET',
  'Audio Visual & Presentation Equipment': 'AV',
  'Tools & Equipment': 'TLS'
};

const SUBCATEGORY_CODES = {
  chairs: 'CHR',
  tables: 'TBL',
  'cupboards-cabinets': 'CAB',
  'shelving-racking': 'SHL',
  workstations: 'WST',
  'computers-peripherals': 'CMP',
  'storage-devices': 'STR',
  'printers-printing-equipment': 'PRN',
  'scanning-office-machines': 'SCN',
  'network-equipment': 'NET',
  'servers-storage': 'SRV',
  'telephones-phones': 'TEL',
  cameras: 'CAM',
  'cctv-recording-display': 'CCTV',
  'audio-equipment': 'AUD',
  'display-presentation': 'DSP',
  projectors: 'PRJ',
  'hand-tools': 'HTL',
  'electrical-tools-testing-equipment': 'ETE',
  'tool-storage-handling': 'TSH',
  'safety-equipment-ppe': 'PPE',
  'power-utility-equipment': 'PUE',
  'air-conditioning-ventilation': 'ACV',
  'cleaning-equipment': 'CLN',
  'kitchen-refreshment-equipment': 'KTC'
};

const ITEM_TYPE_CODES = {
  'Clerical Chair': 'CLERICL-CHR',
  'Visitor Chair': 'VISITOR-CHR',
  'Executive Chair': 'EXEC-CHR',
  'Low Back Chair': 'LOWBACK-CHR',
  'Mid Back Chair': 'MIDBACK-CHR',
  'High Back Chair': 'HIGHBACK-CHR',
  'Computer Executive': 'COMP-EXEC-CHR',
  'Computer Typist': 'COMP-TYPIST-CHR',
  'Computer Assistant': 'COMP-ASST-CHR',
  'Front Chair': 'FRONT-CHR',
  'Executive Table': 'EXEC-TBL',
  'Computer Table': 'COMP-TBL',
  'Writing Table': 'WRITE-TBL',
  'Clerical Table': 'CLERICL-TBL',
  'Wooden Table': 'WOOD-TBL',
  'Draughtsman Table': 'DRAUGHT-TBL',
  'Drawing Table': 'DRAW-TBL',
  'Printer Table': 'PRINT-TBL',
  'Office Table': 'OFFICE-TBL',
  'Library Cupboard': 'LIB-CAB',
  'Drawer Cabinet': 'DRAWER-CAB',
  'Cupboard – 2 Door': '2DOOR-CAB',
  'Cupboard – 4 Door': '4DOOR-CAB',
  'Cupboard – 2 Drawer': '2DRW-CAB',
  'Full Height Cupboard': 'FULLHT-CAB',
  'Half Height Cupboard': 'HALFHT-CAB',
  'Steel Cabinet – 4 Drawer': 'STEEL4D-CAB',
  'Wooden Cabinet – 3 Door': 'WOOD3D-CAB',
  'File Rack – 8 Compartments': 'FILERACK8-SHL',
  'CPU Rack – Iron': 'CPURACK-SHL',
  'Book Rack': 'BOOKRACK-SHL',
  '2-Seater Workstation': '2SEAT-WST',
  '4-Seater Workstation': '4SEAT-WST',
  'Desktop Computer': 'DESKTOP-CMP',
  Laptop: 'LAPTOP-CMP',
  CPU: 'CPU-CMP',
  'Backup CPU': 'BCKCPU-CMP',
  Monitor: 'MONITOR-CMP',
  'Backup Monitor': 'BCKMON-CMP',
  Keyboard: 'KYBRD-CMP',
  Mouse: 'MOUSE-CMP',
  'DVD Writer': 'DVDWR-CMP',
  'Pen Drive': 'PENDRV-STR',
  'External Hard Drive': 'EXTHDD-STR',
  'Portable Backup Drive': 'PORTDRV-STR',
  'IDE/SATA Docking Station': 'DOCKSTN-STR',
  HDD: 'HDD-STR',
  '512 GB Globaltec SATA SSD': '512SSD-STR',
  'Line Printer': 'LINE-PRN',
  'Dot Matrix Printer': 'DOTMTX-PRN',
  'Brother Laser Printer': 'BROTHER-PRN',
  'Epson Dot Matrix Impact Printer': 'EPSON-PRN',
  'Laser Printer': 'LASER-PRN',
  'Thermal Printer': 'THERMAL-PRN',
  'Color A3 Printer': 'COLORA3-PRN',
  'Cheque Printer': 'CHEQUE-PRN',
  Plotter: 'PLOTTER-PRN',
  Scanner: 'SCANNER-SCN',
  'Photocopy Machine': 'PHOTOCOPY-SCN',
  'Fax Machine': 'FAX-SCN',
  Firewall: 'FIREWALL-NET',
  'Network Switch /PoE Switch': 'SWITCH-NET',
  'Wireless Access Point': 'WAP-NET',
  Modem: 'MODEM-NET',
  'Wi-Fi Dongle': 'DONGLE-NET',
  'Patch Panel': 'PATCHPNL-NET',
  'Network Toner & Probe': 'TONER-NET',
  'Network Server': 'NET-SRV',
  'Billing Server': 'BILLING-SRV',
  'Server with License': 'LICENSED-SRV',
  NAS: 'NAS-SRV',
  'Analog Telephone': 'ANALOG-TEL',
  'Digital Telephone': 'DIGITAL-TEL',
  'Basic Phone': 'BASIC-TEL',
  'Analog Phone': 'ANALOGP-TEL',
  'Digital Phone': 'DIGITALP-TEL',
  'Bullet Camera': 'BULLET-CAM',
  'Thermal Camera': 'THERMAL-CAM',
  'Network Camera': 'NET-CAM',
  'Network Video Recorder': 'NVR-CCTV',
  'Network Video Decoder': 'NVD-CCTV',
  'TOA FM Mic': 'TOAFM-AUD',
  'JBL Speaker': 'JBLSPK-AUD',
  'JBL Wired Mic': 'JBLMIC-AUD',
  'Mic Stand': 'MICSTAND-AUD',
  'TOA Dual Wireless Receiver': 'TOARECV-AUD',
  'Collar Mic & Wireless Transmitter': 'COLLARMIC-AUD',
  Projector: 'PROJ-DSP',
  'HDMI Cable': 'HDMI-DSP',
  'LED Television': 'LEDTV-DSP'
};

function resolveUnitCode(unit) {
  if (!unit) return 'EDL-HQ';
  if (typeof unit === 'string') {
    return unit.trim().replace(/\s+/g, '_').toUpperCase();
  }
  const name = unit.unit_name || unit.unit_code || 'EDL-HQ';
  return name.trim().replace(/\s+/g, '_').toUpperCase();
}

function resolveCategoryCode(category) {
  if (!category) return 'FUR';
  const key = typeof category === 'string' ? category.trim() : (category.slug || category.name || '');
  if (CATEGORY_CODES[key]) return CATEGORY_CODES[key];
  if (CATEGORY_CODES[key.toLowerCase()]) return CATEGORY_CODES[key.toLowerCase()];

  const slug = key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (CATEGORY_CODES[slug]) return CATEGORY_CODES[slug];

  const cleaned = key.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return cleaned.substring(0, 3) || 'GEN';
}

function resolveSubCategoryCode(subType) {
  if (!subType) return 'GEN';
  const key = typeof subType === 'string' ? subType.trim().toLowerCase() : (subType.slug || subType.name || '').toLowerCase();
  if (SUBCATEGORY_CODES[key]) return SUBCATEGORY_CODES[key];

  const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (SUBCATEGORY_CODES[slug]) return SUBCATEGORY_CODES[slug];

  const cleaned = key.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return cleaned.substring(0, 3) || 'GEN';
}

function deriveItemTypeCode(itemType, subcatCode = 'CHR') {
  if (!itemType || typeof itemType !== 'string') return `ITM-${subcatCode}`;
  const trimmed = itemType.trim();

  if (ITEM_TYPE_CODES[trimmed]) {
    return ITEM_TYPE_CODES[trimmed];
  }

  const lower = trimmed.toLowerCase();
  for (const [name, code] of Object.entries(ITEM_TYPE_CODES)) {
    if (name.toLowerCase() === lower) {
      return code;
    }
  }

  const stopWords = ['chair', 'table', 'desk', 'cabinet', 'cupboard', 'rack', 'device', 'unit', 'machine', 'equipment', 'item'];
  let words = trimmed.split(/[\s\-–_]+/);
  let filtered = words.filter(w => !stopWords.includes(w.toLowerCase()));
  if (filtered.length === 0) filtered = words;

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

  if (!code.endsWith(`-${subcatCode}`)) {
    code += `-${subcatCode}`;
  }

  return code;
}

function getNextSequence(existingItems = [], basePrefix = '', serverCounters = {}) {
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

function generateBatchSerialNumbers({
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

function generateSerialNumber({
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

function isBatchItem(item) {
  if (!item) return false;
  return Boolean(
    item.is_batch ||
    (Array.isArray(item.serial_numbers) && item.serial_numbers.length > 1) ||
    Number(item.quantity) > 1
  );
}

module.exports = {
  CONSTANT_PREFIX,
  CATEGORY_CODES,
  SUBCATEGORY_CODES,
  ITEM_TYPE_CODES,
  resolveUnitCode,
  resolveCategoryCode,
  resolveSubCategoryCode,
  deriveItemTypeCode,
  getNextSequence,
  generateBatchSerialNumbers,
  generateSerialNumber,
  isBatchItem
};


