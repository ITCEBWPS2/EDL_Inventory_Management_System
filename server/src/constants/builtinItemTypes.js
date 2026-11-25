/**
 * Built-in Sub-category Item Types
 * Synchronized with client SUBTYPE_METADATA.
 */
const BUILTIN_ITEM_TYPES = {
  "chairs": [
    "Clerical Chair",
    "Visitor Chair",
    "Executive Chair",
    "Low Back Chair",
    "Mid Back Chair",
    "High Back Chair",
    "Computer Executive Chair",
    "Computer Typist Chair",
    "Computer Assistant Chair",
    "Front Chair"
  ],
  "tables": [
    "Executive Table",
    "Computer Table",
    "Writing Table",
    "Clerical Table",
    "Wooden Table",
    "Draughtsman Table",
    "Drawing Table",
    "Printer Table",
    "Office Table"
  ],
  "cupboards-cabinets": [
    "Library Cupboard",
    "Drawer Cabinet",
    "Cupboard – 2 Door",
    "Cupboard – 4 Door",
    "Cupboard – 2 Drawer",
    "Full Height Cupboard",
    "Half Height Cupboard",
    "Steel Cabinet – 4 Drawer",
    "Wooden Cabinet – 3 Door"
  ],
  "shelving-racking": [
    "File Rack – 8 Compartments",
    "CPU Rack – Iron",
    "Book Rack"
  ],
  "workstations": [
    "2-Seater Workstation",
    "4-Seater Workstation"
  ],
  "computers-peripherals": [
    "Desktop Computer",
    "Laptop",
    "CPU",
    "Backup CPU",
    "Monitor",
    "Backup Monitor",
    "Keyboard",
    "Mouse",
    "DVD Writer",
    "Tab",
    "HDMI to VGA Convertor"
  ],
  "storage-devices": [
    "Pen Drive",
    "External Hard Drive",
    "Portable Backup Drive",
    "IDE/SATA Docking Station",
    "HDD",
    "512 GB Globaltec SATA SSD"
  ],
  "printers-printing-equipment": [
    "Line Printer",
    "Dot Matrix Printer",
    "Brother Laser Printer",
    "Epson Dot Matrix Impact Printer",
    "Laser Printer",
    "Thermal Printer",
    "Color A3 Printer",
    "Cheque Printer",
    "Plotter",
    "Dot Matrix Printer Backup"
  ],
  "scanning-office-machines": [
    "Scanner",
    "Photocopy Machine",
    "Fax Machine"
  ],
  "network-equipment": [
    "Firewall",
    "Network Switch /PoE Switch",
    "Wireless Access Point",
    "Modem",
    "Wi-Fi Dongle",
    "Patch Panel",
    "Network Toner & Probe",
    "Managed Access Point"
  ],
  "servers-storage": [
    "Network Server",
    "Billing Server",
    "Server with License",
    "NAS"
  ],
  "telephones-phones": [
    "Analog Telephone",
    "Digital Telephone",
    "Basic Phone",
    "Analog Phone",
    "Digital Phone"
  ],
  "cameras": [
    "Bullet Camera",
    "Thermal Camera",
    "Network Camera"
  ],
  "network-cameras": [
    "IP Dome Camera",
    "IP Bullet Camera",
    "IP PTZ Speed Dome Camera",
    "PoE Network Camera",
    "Wireless IP Camera",
    "Panoramic 360° IP Camera"
  ],
  "cctv-recording-display": [
    "Network Video Recorder",
    "Network Video Decoder"
  ],
  "audio-equipment": [
    "TOA FM Mic",
    "JBL Speaker",
    "JBL Wired Mic",
    "Mic Stand",
    "TOA Dual Wireless Receiver",
    "Collar Mic & Wireless Transmitter"
  ],
  "display-presentation": [
    "Projector",
    "HDMI Cable",
    "LED Television"
  ],
  "projectors": [
    "Full HD Conference Projector",
    "Short Throw Laser Projector",
    "Portable LED Projector"
  ],
  "smart-displays": [
    "Interactive 75\" Touch Display",
    "Commercial LED Monitor 55\"",
    "Digital Signage Panel"
  ],
  "pa-systems": [
    "Conference Microphone Array",
    "PA Amplifier System",
    "Ceiling Speaker Set",
    "Wireless Lapel Mic System"
  ],
  "digital-cameras": [
    "Mirrorless Inspection Camera",
    "Thermal Imaging Camera",
    "Compact Digital Camera"
  ],
  "inspection-drones": [
    "Powerline Inspection Quadcopter",
    "Thermal Sensor Drone",
    "Compact Aerial Survey Drone"
  ],
  "field-recorders": [
    "Handheld Field Audio Recorder",
    "Body-Worn Safety Camera",
    "Multi-Track Field Recorder"
  ],
  "hand-tools": [
    "Hammer",
    "Hacksaw",
    "Scratch Awl",
    "Punching Tool",
    "Puncher",
    "Screwdriver Set",
    "Pliers",
    "Wire Cutter",
    "Measuring Tape",
    "Rod"
  ],
  "electrical-tools-testing-equipment": [
    "Crimping Tool",
    "Earth Tester",
    "U Meter",
    "HV Tester",
    "Digital Clamp Meter",
    "Phasing Tester",
    "Current Measuring Equipment",
    "LV Power Quality Analyzer",
    "Drill Machine",
    "Electric Blower",
    "Trimble GPS Receiver",
    "Bluebird Data Collector",
    "Binocular",
    "Digital Multimeter"
  ],
  "tool-storage-handling": [
    "Tool Box",
    "Trolley"
  ],
  "safety-equipment-ppe": [
    "Safety Helmet",
    "Electric Gloves",
    "Linesmen Belt",
    "Safety Shoes",
    "Alpha Safe"
  ],
  "power-utility-equipment": [
    "UPS",
    "Battery"
  ],
  "air-conditioning-ventilation": [
    "Air Conditioner",
    "AC Unit",
    "Pedestal Fan",
    "KDK Fan"
  ],
  "cleaning-equipment": [
    "Vacuum Cleaner"
  ],
  "kitchen-refreshment-equipment": [
    "Water Dispenser",
    "Kettle",
    "Electric Jug"
  ],
  "office-general-equipment": [
    "Briefcase",
    "Calculator",
    "Stapler",
    "Cello Tape Machine",
    "Cash Box",
    "Wall Clock",
    "Wireless Door Bell",
    "Ladder",
    "Puncher (L)",
    "Puncher (S)"
  ],
  "transformers": [
    "100 kVA 33kV/400V Distribution Transformer",
    "160 kVA 11kV/400V Sealed Transformer",
    "250 kVA Substation Transformer",
    "500 kVA Step-Down Transformer"
  ],
  "switchgear": [
    "11kV Auto-Recloser Vacuum Circuit Breaker",
    "Air Break Switch 33kV",
    "Drop-out Fuse Unit 11kV",
    "Load Break Switch"
  ],
  "energy-meters": [
    "Single Phase 30A Digital Energy Meter",
    "3-Phase 60A Whole Current Meter",
    "CT-Operated Industrial Meter"
  ],
  "cables-conductors": [
    "Aerial Bundled Conductor (ABC) 70mm²",
    "All Aluminium Alloy Conductor (AAAC)",
    "XLPE Insulated Underground Cable"
  ],
  "poles-hardware": [
    "Pre-stressed Spun Concrete Pole 10m",
    "Steel Tubular Pole 11m",
    "D-Iron Bracket with Insulator",
    "Stay Wire Assembly"
  ],
  "measuring-tools": [
    "Industrial Digital Multimeter",
    "5kV Digital Insulation Tester",
    "Hydraulic Cable Crimping Tool",
    "Earth Resistance Clamp Meter"
  ]
};

module.exports = {
  BUILTIN_ITEM_TYPES
};
