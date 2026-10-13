/**
 * Configuration for category sub-types / taxonomies
 * Designed to be modular and reusable across all 6 inventory categories.
 */
export const CATEGORY_SUBTYPES = {
  furniture: [
    { name: 'Chairs', slug: 'chairs' },
    { name: 'Tables', slug: 'tables' },
    { name: 'Cupboards & Cabinets', slug: 'cupboards-cabinets' },
    { name: 'Shelving & Racking', slug: 'shelving-racking' },
    { name: 'Workstations', slug: 'workstations' }
  ],
  'it-computing-equipment': [
    { name: 'Computers & Peripherals', slug: 'computers-peripherals' },
    { name: 'Storage Devices', slug: 'storage-devices' },
    { name: 'Printers & Printing Equipment', slug: 'printers-printing-equipment' },
    { name: 'Scanning & Office Machines', slug: 'scanning-office-machines' }
  ],
  'network-communication-equipment': [
    { name: 'Network Equipment', slug: 'network-equipment' },
    { name: 'Servers & Storage', slug: 'servers-storage' },
    { name: 'Telephones & Phones', slug: 'telephones-phones' },
    { name: 'Cameras', slug: 'cameras' },
    { name: 'CCTV Recording & Display', slug: 'cctv-recording-display' }
  ],
  'audio-visual-presentation-equipment': [
    { name: 'Audio Equipment', slug: 'audio-equipment' },
    { name: 'Display & Presentation', slug: 'display-presentation' }
  ],
  'tools-equipment': [
    { name: 'Hand Tools', slug: 'hand-tools' },
    { name: 'Electrical Tools & Testing Equipment', slug: 'electrical-tools-testing-equipment' },
    { name: 'Tool Storage & Handling', slug: 'tool-storage-handling' },
    { name: 'Safety Equipment & PPE', slug: 'safety-equipment-ppe' },
    { name: 'Power & Utility Equipment', slug: 'power-utility-equipment' },
    { name: 'Air Conditioning & Ventilation', slug: 'air-conditioning-ventilation' },
    { name: 'Cleaning Equipment', slug: 'cleaning-equipment' },
    { name: 'Kitchen / Refreshment Equipment', slug: 'kitchen-refreshment-equipment' },
    { name: 'Office & General Equipment', slug: 'office-general-equipment' }
  ]
};

/**
 * Metadata per sub-type including code prefix, singular form, field label, and example options
 */
export const SUBTYPE_METADATA = {
  // Furniture
  chairs: {
    codePrefix: 'CHR',
    singularTitle: 'Chair',
    subTypeFieldLabel: 'Chair Type',
    subTypeOptions: [
      'Clerical Chair',
      'Visitor Chair',
      'Executive Chair',
      'Low Back Chair',
      'Mid Back Chair',
      'High Back Chair',
      'Computer Executive',
      'Computer Typist',
      'Computer Assistant',
      'Front Chair'
    ]
  },
  tables: {
    codePrefix: 'TBL',
    singularTitle: 'Table',
    subTypeFieldLabel: 'Table Type',
    subTypeOptions: [
      'Executive Table',
      'Computer Table',
      'Writing Table',
      'Clerical Table',
      'Wooden Table',
      'Draughtsman Table',
      'Drawing Table',
      'Printer Table',
      'Office Table'
    ]
  },
  'cupboards-cabinets': {
    codePrefix: 'CAB',
    singularTitle: 'Cabinet',
    subTypeFieldLabel: 'Cabinet Type',
    subTypeOptions: [
      'Library Cupboard',
      'Drawer Cabinet',
      'Cupboard – 2 Door',
      'Cupboard – 4 Door',
      'Cupboard – 2 Drawer',
      'Full Height Cupboard',
      'Half Height Cupboard',
      'Steel Cabinet – 4 Drawer',
      'Wooden Cabinet – 3 Door'
    ]
  },
  'shelving-racking': {
    codePrefix: 'SHL',
    singularTitle: 'Shelving Unit',
    subTypeFieldLabel: 'Shelving / Rack Type',
    subTypeOptions: [
      'File Rack – 8 Compartments',
      'CPU Rack – Iron',
      'Book Rack'
    ]
  },
  workstations: {
    codePrefix: 'WST',
    singularTitle: 'Workstation',
    subTypeFieldLabel: 'Workstation Type',
    subTypeOptions: [
      '2-Seater Workstation',
      '4-Seater Workstation'
    ]
  },

  // IT & Computing Equipment
  'computers-peripherals': {
    codePrefix: 'CMP',
    singularTitle: 'Computer / Peripheral',
    subTypeFieldLabel: 'Device Type',
    subTypeOptions: [
      'Desktop Computer',
      'Laptop',
      'CPU',
      'Backup CPU',
      'Monitor',
      'Backup Monitor',
      'Keyboard',
      'Mouse',
      'DVD Writer',
      'Tab'
    ]
  },
  'storage-devices': {
    codePrefix: 'STR',
    singularTitle: 'Storage Device',
    subTypeFieldLabel: 'Storage Device Type',
    subTypeOptions: [
      'Pen Drive',
      'External Hard Drive',
      'Portable Backup Drive',
      'IDE/SATA Docking Station',
      'HDD',
      '512 GB Globaltec SATA SSD'
    ]
  },
  'printers-printing-equipment': {
    codePrefix: 'PRN',
    singularTitle: 'Printer',
    subTypeFieldLabel: 'Printer Type',
    subTypeOptions: [
      'Line Printer',
      'Dot Matrix Printer',
      'Brother Laser Printer',
      'Epson Dot Matrix Impact Printer',
      'Laser Printer',
      'Thermal Printer',
      'Color A3 Printer',
      'Cheque Printer',
      'Plotter'
    ]
  },
  'scanning-office-machines': {
    codePrefix: 'SCN',
    singularTitle: 'Scanning / Office Machine',
    subTypeFieldLabel: 'Machine Type',
    subTypeOptions: [
      'Scanner',
      'Photocopy Machine',
      'Fax Machine'
    ]
  },

  // Network & Communication Equipment
  'network-equipment': {
    codePrefix: 'NET',
    singularTitle: 'Network Equipment',
    subTypeFieldLabel: 'Equipment Type',
    subTypeOptions: [
      'Firewall',
      'Network Switch /PoE Switch',
      'Wireless Access Point',
      'Modem',
      'Wi-Fi Dongle',
      'Patch Panel',
      'Network Toner & Probe'
    ]
  },
  'servers-storage': {
    codePrefix: 'SRV',
    singularTitle: 'Server / Storage Unit',
    subTypeFieldLabel: 'Server / Storage Type',
    subTypeOptions: [
      'Network Server',
      'Billing Server',
      'Server with License',
      'NAS'
    ]
  },
  'telephones-phones': {
    codePrefix: 'TEL',
    singularTitle: 'Telephone / Phone',
    subTypeFieldLabel: 'Telephone Type',
    subTypeOptions: [
      'Analog Telephone',
      'Digital Telephone',
      'Basic Phone',
      'Analog Phone',
      'Digital Phone'
    ]
  },
  cameras: {
    codePrefix: 'CAM',
    singularTitle: 'Camera',
    subTypeFieldLabel: 'Camera Type',
    subTypeOptions: [
      'Bullet Camera',
      'Thermal Camera',
      'Network Camera'
    ]
  },
  'network-cameras': {
    codePrefix: 'NCAM',
    singularTitle: 'Network Camera',
    subTypeFieldLabel: 'Network Camera Type',
    subTypeOptions: [
      'IP Dome Camera',
      'IP Bullet Camera',
      'IP PTZ Speed Dome Camera',
      'PoE Network Camera',
      'Wireless IP Camera',
      'Panoramic 360° IP Camera'
    ]
  },
  'cctv-recording-display': {
    codePrefix: 'CCTV',
    singularTitle: 'CCTV Unit',
    subTypeFieldLabel: 'Device Type',
    subTypeOptions: [
      'Network Video Recorder',
      'Network Video Decoder'
    ]
  },

  // Audio Visual & Presentation Equipment
  'audio-equipment': {
    codePrefix: 'AUD',
    singularTitle: 'Audio Equipment',
    subTypeFieldLabel: 'Audio Equipment Type',
    subTypeOptions: [
      'TOA FM Mic',
      'JBL Speaker',
      'JBL Wired Mic',
      'Mic Stand',
      'TOA Dual Wireless Receiver',
      'Collar Mic & Wireless Transmitter'
    ]
  },
  'display-presentation': {
    codePrefix: 'DSP',
    singularTitle: 'Display & Presentation Unit',
    subTypeFieldLabel: 'Display / Presentation Type',
    subTypeOptions: [
      'Projector',
      'HDMI Cable',
      'LED Television'
    ]
  },
  projectors: {
    codePrefix: 'PRJ',
    singularTitle: 'Projector',
    subTypeFieldLabel: 'Projector Type',
    subTypeOptions: [
      'Full HD Conference Projector',
      'Short Throw Laser Projector',
      'Portable LED Projector'
    ]
  },
  'smart-displays': {
    codePrefix: 'DSP',
    singularTitle: 'Smart Display',
    subTypeFieldLabel: 'Display Type',
    subTypeOptions: [
      'Interactive 75" Touch Display',
      'Commercial LED Monitor 55"',
      'Digital Signage Panel'
    ]
  },
  'pa-systems': {
    codePrefix: 'PAS',
    singularTitle: 'Sound System',
    subTypeFieldLabel: 'Audio System Type',
    subTypeOptions: [
      'Conference Microphone Array',
      'PA Amplifier System',
      'Ceiling Speaker Set',
      'Wireless Lapel Mic System'
    ]
  },

  // Media Equipment
  'digital-cameras': {
    codePrefix: 'CAM',
    singularTitle: 'Camera',
    subTypeFieldLabel: 'Camera Type',
    subTypeOptions: [
      'Mirrorless Inspection Camera',
      'Thermal Imaging Camera',
      'Compact Digital Camera'
    ]
  },
  'inspection-drones': {
    codePrefix: 'DRN',
    singularTitle: 'Inspection Drone',
    subTypeFieldLabel: 'Drone Type',
    subTypeOptions: [
      'Powerline Inspection Quadcopter',
      'Thermal Sensor Drone',
      'Compact Aerial Survey Drone'
    ]
  },
  'field-recorders': {
    codePrefix: 'REC',
    singularTitle: 'Field Recorder',
    subTypeFieldLabel: 'Recorder Type',
    subTypeOptions: [
      'Handheld Field Audio Recorder',
      'Body-Worn Safety Camera',
      'Multi-Track Field Recorder'
    ]
  },

  // Tools & Equipment (New Subcategories)
  'hand-tools': {
    codePrefix: 'HTL',
    singularTitle: 'Hand Tool',
    subTypeFieldLabel: 'Hand Tool Type',
    subTypeOptions: [
      'Hammer',
      'Hacksaw',
      'Scratch Awl',
      'Punching Tool',
      'Puncher',
      'Screwdriver Set',
      'Pliers',
      'Wire Cutter',
      'Measuring Tape',
      'Rod'
    ]
  },
  'electrical-tools-testing-equipment': {
    codePrefix: 'ETE',
    singularTitle: 'Electrical Tool / Tester',
    subTypeFieldLabel: 'Equipment Type',
    subTypeOptions: [
      'Crimping Tool',
      'Earth Tester',
      'U Meter',
      'HV Tester',
      'Digital Clamp Meter',
      'Phasing Tester',
      'Current Measuring Equipment',
      'LV Power Quality Analyzer',
      'Drill Machine',
      'Electric Blower',
      'Trimble GPS Receiver',
      'Bluebird Data Collector',
      'Binocular'
    ]
  },
  'tool-storage-handling': {
    codePrefix: 'TSH',
    singularTitle: 'Storage / Handling Unit',
    subTypeFieldLabel: 'Storage / Handling Type',
    subTypeOptions: [
      'Tool Box',
      'Trolley'
    ]
  },
  'safety-equipment-ppe': {
    codePrefix: 'PPE',
    singularTitle: 'Safety Equipment',
    subTypeFieldLabel: 'Safety Equipment Type',
    subTypeOptions: [
      'Safety Helmet',
      'Electric Gloves',
      'Linesmen Belt',
      'Safety Shoes',
      'Alpha Safe'
    ]
  },
  'power-utility-equipment': {
    codePrefix: 'PUE',
    singularTitle: 'Power / Utility Equipment',
    subTypeFieldLabel: 'Equipment Type',
    subTypeOptions: [
      'UPS',
      'Battery'
    ]
  },
  'air-conditioning-ventilation': {
    codePrefix: 'ACV',
    singularTitle: 'Air Conditioning & Ventilation',
    subTypeFieldLabel: 'Equipment Type',
    subTypeOptions: [
      'Air Conditioner',
      'AC Unit',
      'Pedestal Fan',
      'KDK Fan'
    ]
  },
  'cleaning-equipment': {
    codePrefix: 'CLN',
    singularTitle: 'Cleaning Equipment',
    subTypeFieldLabel: 'Cleaning Equipment Type',
    subTypeOptions: [
      'Vacuum Cleaner'
    ]
  },
  'kitchen-refreshment-equipment': {
    codePrefix: 'KTC',
    singularTitle: 'Kitchen / Refreshment Unit',
    subTypeFieldLabel: 'Equipment Type',
    subTypeOptions: [
      'Water Dispenser',
      'Kettle',
      'Electric Jug'
    ]
  },
  'office-general-equipment': {
    codePrefix: 'OGE',
    singularTitle: 'Office & General Equipment',
    subTypeFieldLabel: 'Item Type',
    subTypeOptions: [
      'Briefcase',
      'Calculator',
      'Stapler',
      'Cello Tape Machine',
      'Cash Box',
      'Wall Clock',
      'Wireless Door Bell',
      'Ladder',
      'Puncher (L)',
      'Puncher (S)'
    ]
  },

  // Legacy Tools & Equipment (for backward compatibility)
  transformers: {
    codePrefix: 'TRX',
    singularTitle: 'Transformer',
    subTypeFieldLabel: 'Transformer Type',
    subTypeOptions: [
      '100 kVA 33kV/400V Distribution Transformer',
      '160 kVA 11kV/400V Sealed Transformer',
      '250 kVA Substation Transformer',
      '500 kVA Step-Down Transformer'
    ]
  },
  switchgear: {
    codePrefix: 'SWG',
    singularTitle: 'Switchgear',
    subTypeFieldLabel: 'Switchgear Type',
    subTypeOptions: [
      '11kV Auto-Recloser Vacuum Circuit Breaker',
      'Air Break Switch 33kV',
      'Drop-out Fuse Unit 11kV',
      'Load Break Switch'
    ]
  },
  'energy-meters': {
    codePrefix: 'EMR',
    singularTitle: 'Energy Meter',
    subTypeFieldLabel: 'Meter Type',
    subTypeOptions: [
      'Single Phase 30A Digital Energy Meter',
      '3-Phase 60A Whole Current Meter',
      'CT-Operated Industrial Meter'
    ]
  },
  'cables-conductors': {
    codePrefix: 'CBL',
    singularTitle: 'Cable / Conductor',
    subTypeFieldLabel: 'Cable / Conductor Type',
    subTypeOptions: [
      'Aerial Bundled Conductor (ABC) 70mm²',
      'All Aluminium Alloy Conductor (AAAC)',
      'XLPE Insulated Underground Cable'
    ]
  },
  'poles-hardware': {
    codePrefix: 'POL',
    singularTitle: 'Pole / Hardware',
    subTypeFieldLabel: 'Hardware Type',
    subTypeOptions: [
      'Pre-stressed Spun Concrete Pole 10m',
      'Steel Tubular Pole 11m',
      'D-Iron Bracket with Insulator',
      'Stay Wire Assembly'
    ]
  },
  'measuring-tools': {
    codePrefix: 'TLS',
    singularTitle: 'Testing Tool',
    subTypeFieldLabel: 'Tool / Instrument Type',
    subTypeOptions: [
      'Industrial Digital Multimeter',
      '5kV Digital Insulation Tester',
      'Hydraulic Cable Crimping Tool',
      'Earth Resistance Clamp Meter'
    ]
  }
};

/**
 * Helper to auto-generate the next unique item code (e.g. CHR-001, CHR-002...)
 * Scans existing items to increment based on the highest existing code.
 */
export const generateNextItemCode = (existingItems = [], codePrefix = 'CHR') => {
  const prefix = (codePrefix || 'ITM').toUpperCase();
  let maxNum = 0;

  existingItems.forEach(item => {
    const code = (item.item_code || '').toUpperCase();
    // match pattern like CHR-001, CHR-02, FURN-CHR-01, or CHR001
    const match = code.match(new RegExp(`${prefix}[-_]?0*(\\d+)`));
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  const nextNum = maxNum + 1;
  const zeroPadded = String(nextNum).padStart(3, '0');
  return `${prefix}-${zeroPadded}`;
};

/**
 * Helper to match an item to a sub-type slug based on explicit sub_type or keywords
 */
export const itemMatchesSubType = (item, subTypeSlug) => {
  if (!item || !subTypeSlug) return true;
  const target = subTypeSlug.toLowerCase().trim();

  // 1. Explicit sub_type field
  if (item.sub_type) {
    const itemSt = item.sub_type.toLowerCase().trim();
    if (itemSt === target || itemSt.replace(/[^a-z0-9]+/g, '-') === target) {
      return true;
    }
  }

  const name = (item.item_name || '').toLowerCase();
  const code = (item.item_code || '').toLowerCase();

  // 2. Keyword fallback per subcategory
  // Furniture
  if (target === 'chairs') {
    return name.includes('chair') || code.includes('-chr-') || code.startsWith('chr-');
  }
  if (target === 'tables') {
    return name.includes('table') || name.includes('desk') || code.includes('-tbl-') || code.startsWith('tbl-');
  }
  if (target === 'cupboards-cabinets' || target === 'cupboards & cabinets') {
    return name.includes('cabinet') || name.includes('cupboard') || code.includes('-cab-') || code.startsWith('cab-');
  }
  if (target === 'shelving-racking' || target === 'shelving & racking') {
    return name.includes('shelv') || name.includes('rack') || code.includes('-shl-') || code.startsWith('shl-');
  }
  if (target === 'workstations') {
    return name.includes('workstation') || code.includes('-wst-') || code.startsWith('wst-');
  }

  // IT & Computing Equipment
  if (target === 'computers-peripherals') {
    return (item.sub_type === 'computers-peripherals') || code.startsWith('cmp-') || code.includes('-cmp-');
  }
  if (target === 'storage-devices') {
    return (item.sub_type === 'storage-devices') || code.startsWith('str-') || code.includes('-str-');
  }
  if (target === 'printers-printing-equipment') {
    return (item.sub_type === 'printers-printing-equipment') || code.startsWith('prn-') || code.includes('-prn-');
  }
  if (target === 'scanning-office-machines') {
    return (item.sub_type === 'scanning-office-machines') || code.startsWith('scn-') || code.includes('-scn-');
  }

  // Network & Communication Equipment
  if (target === 'network-equipment') {
    return (item.sub_type === 'network-equipment') || code.startsWith('neq-') || code.includes('-neq-') || code.startsWith('net-') || code.includes('-net-');
  }
  if (target === 'servers-storage') {
    return (item.sub_type === 'servers-storage') || code.startsWith('srv-') || code.includes('-srv-');
  }
  if (target === 'telephones-phones') {
    return (item.sub_type === 'telephones-phones') || code.startsWith('tel-') || code.includes('-tel-');
  }
  if (target === 'cameras') {
    return (item.sub_type === 'cameras') || code.startsWith('cam-') || code.includes('-cam-');
  }
  if (target === 'network-cameras') {
    return (item.sub_type === 'network-cameras') || code.startsWith('ncam-') || code.includes('-ncam-');
  }
  if (target === 'cctv-recording-display') {
    return (item.sub_type === 'cctv-recording-display') || code.startsWith('cctv-') || code.includes('-cctv-');
  }

  // Audio Visual & Presentation Equipment
  if (target === 'audio-equipment') {
    return (item.sub_type === 'audio-equipment') || code.startsWith('aud-') || code.includes('-aud-');
  }
  if (target === 'display-presentation') {
    return (item.sub_type === 'display-presentation') || code.startsWith('dsp-') || code.includes('-dsp-');
  }
  if (target === 'projectors') {
    return name.includes('projector') || code.includes('-prj-') || code.startsWith('av-prj-') || code.startsWith('prj-');
  }
  if (target === 'smart-displays') {
    return name.includes('display') || name.includes('interactive') || code.includes('-dsp-') || code.startsWith('dsp-');
  }
  if (target === 'pa-systems') {
    return name.includes('speaker') || name.includes('sound') || name.includes('microphone') || code.includes('-pas-') || code.startsWith('pas-');
  }

  // Media Equipment
  if (target === 'digital-cameras') {
    return name.includes('camera') || code.includes('-cam-') || code.startsWith('med-cam-') || code.startsWith('cam-');
  }
  if (target === 'inspection-drones') {
    return name.includes('drone') || name.includes('quadcopter') || code.includes('-drn-') || code.startsWith('drn-');
  }
  if (target === 'field-recorders') {
    return name.includes('recorder') || name.includes('audio record') || code.includes('-rec-') || code.startsWith('rec-');
  }

  // Tools & Equipment (New Subcategories)
  if (target === 'hand-tools') {
    return (item.sub_type === 'hand-tools') || code.startsWith('htl-') || code.includes('-htl-');
  }
  if (target === 'electrical-tools-testing-equipment') {
    return (item.sub_type === 'electrical-tools-testing-equipment') || code.startsWith('ete-') || code.includes('-ete-');
  }
  if (target === 'tool-storage-handling') {
    return (item.sub_type === 'tool-storage-handling') || code.startsWith('tsh-') || code.includes('-tsh-');
  }
  if (target === 'safety-equipment-ppe') {
    return (item.sub_type === 'safety-equipment-ppe') || code.startsWith('ppe-') || code.includes('-ppe-');
  }
  if (target === 'power-utility-equipment') {
    return (item.sub_type === 'power-utility-equipment') || code.startsWith('pue-') || code.includes('-pue-');
  }
  if (target === 'air-conditioning-ventilation') {
    return (item.sub_type === 'air-conditioning-ventilation') || code.startsWith('acv-') || code.includes('-acv-');
  }
  if (target === 'cleaning-equipment') {
    return (item.sub_type === 'cleaning-equipment') || code.startsWith('cln-') || code.includes('-cln-');
  }
  if (target === 'kitchen-refreshment-equipment') {
    return (item.sub_type === 'kitchen-refreshment-equipment') || code.startsWith('ktc-') || code.includes('-ktc-');
  }
  if (target === 'office-general-equipment') {
    return (item.sub_type === 'office-general-equipment') || code.startsWith('oge-') || code.includes('-oge-') || code.includes('/oge/');
  }

  // Legacy Tools & Equipment (fallback)
  if (target === 'transformers') {
    return name.includes('transformer') || code.includes('-tx-') || code.startsWith('tx-') || code.startsWith('trx-');
  }
  if (target === 'switchgear') {
    return name.includes('recloser') || name.includes('circuit breaker') || name.includes('switchgear') || code.includes('-sw-') || code.startsWith('sw-') || code.startsWith('swg-');
  }
  if (target === 'energy-meters') {
    return name.includes('energy meter') || name.includes('digital energy') || code.includes('-mtr-') || code.startsWith('mtr-') || code.startsWith('emr-');
  }
  if (target === 'cables-conductors') {
    return name.includes('conductor') || name.includes('cable') || code.includes('-cab-') || code.startsWith('cab-') || code.startsWith('cbl-');
  }
  if (target === 'poles-hardware') {
    return name.includes('pole') || name.includes('hardware') || code.includes('-pol-') || code.startsWith('pol-');
  }
  if (target === 'measuring-tools') {
    return name.includes('multimeter') || name.includes('tester') || name.includes('crimping') || code.includes('-tool-') || code.startsWith('tool-') || code.startsWith('tls-');
  }

  return false;
};

