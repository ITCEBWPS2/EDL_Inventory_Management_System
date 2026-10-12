const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { connect, disconnect, mongoose } = require('../config/mongo');
const {
  Profile,
  Unit,
  UserUnit,
  Category,
  InventoryItem,
  ReceivedTransaction,
  ExpendedTransaction,
  Verification,
  VerificationItem,
  IssuedDestroyedItem,
  SerialCounter
} = require('../models');

const units = [
  // Root & Divisional Hierarchy
  { id: '11111111-1111-1111-1111-111111111001', unit_name: 'Electrical Distribution Lanka (Pvt) Ltd', unit_code: 'EDL-HQ', unit_type: 'area', parent_unit_id: null, location: 'Corporate Headquarters, Colombo', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111002', unit_name: 'D3', unit_code: 'DIV-D3', unit_type: 'area', parent_unit_id: '11111111-1111-1111-1111-111111111001', location: 'Distribution Division 3, Colombo', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111003', unit_name: 'WPS-II', unit_code: 'REG-WPS-II', unit_type: 'area', parent_unit_id: '11111111-1111-1111-1111-111111111002', location: 'Western Province South II Regional Complex', status: 'active' },

  // Direct units & sub-areas under WPS-II
  { id: '11111111-1111-1111-1111-111111111101', unit_name: 'ACC EXP', unit_code: 'ACC-EXP', unit_type: 'unit', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Accounts Expenditure Office, WPS-II', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111102', unit_name: 'ACC REV', unit_code: 'ACC-REV', unit_type: 'unit', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Accounts Revenue Office, WPS-II', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111103', unit_name: 'AMU_JAPURA', unit_code: 'AMU-JAPURA', unit_type: 'unit', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Area Maintenance Unit, Jayawardenapura', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111110', unit_name: 'AREA AVISSAWELLA', unit_code: 'AREA-AVISSAWELLA', unit_type: 'area', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Avissawella Area Office', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111120', unit_name: 'AREA BANDARAGAMA', unit_code: 'AREA-BANDARAGAMA', unit_type: 'area', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Bandaragama Area Office', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111130', unit_name: 'AREA HOMAGAMA', unit_code: 'AREA-HOMAGAMA', unit_type: 'unit', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Homagama Area Operations Office', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111140', unit_name: 'AREA HORANA', unit_code: 'AREA-HORANA', unit_type: 'area', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Horana Area Office', status: 'active' },

  // Children under AREA AVISSAWELLA
  { id: '11111111-1111-1111-1111-111111111111', unit_name: 'AMU-Avissawella', unit_code: 'AMU-AVISSAWELLA', unit_type: 'unit', parent_unit_id: '11111111-1111-1111-1111-111111111110', location: 'Area Maintenance Unit, Avissawella', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111112', unit_name: 'CSC_AVISSAWELLA', unit_code: 'CSC-AVISSAWELLA', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111110', location: 'Customer Service Center, Avissawella', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111113', unit_name: 'CSC-HANWELLA', unit_code: 'CSC-HANWELLA', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111110', location: 'Customer Service Center, Hanwella', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111114', unit_name: 'CSC-PADUKKA', unit_code: 'CSC-PADUKKA', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111110', location: 'Customer Service Center, Padukka', status: 'active' },

  // Children under AREA BANDARAGAMA
  { id: '11111111-1111-1111-1111-111111111121', unit_name: 'CSC BANDARAGAMA', unit_code: 'CSC-BANDARAGAMA', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111120', location: 'Customer Service Center, Bandaragama', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111122', unit_name: 'CSC MILLENIYA', unit_code: 'CSC-MILLENIYA', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111120', location: 'Customer Service Center, Milleniya', status: 'active' },

  // Direct units & sub-areas under WPS-II (including 13 re-parented units)
  { id: '11111111-1111-1111-1111-111111111141', unit_name: 'AREA JAPURA', unit_code: 'WPS-AREA-JAPURA', unit_type: 'unit', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Japura Operations Sub-Office, WPS-II', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111142', unit_name: 'COMMERCIAL', unit_code: 'WPS-COMMERCIAL', unit_type: 'unit', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Commercial Operations Branch, WPS-II', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111143', unit_name: 'CONSTRUCTION', unit_code: 'WPS-CONSTRUCTION', unit_type: 'unit', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Construction Branch, WPS-II', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111144', unit_name: 'CSC_HOKANDARA', unit_code: 'CSC-HOKANDARA', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Customer Service Center, Hokandara', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111145', unit_name: 'CSC_HOMAGAMA', unit_code: 'CSC-HOMAGAMA', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Customer Service Center, Homagama', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111146', unit_name: 'CSC_MALAMBE', unit_code: 'CSC-MALAMBE', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Customer Service Center, Malambe', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111147', unit_name: 'CSC_PANNIPITIYA', unit_code: 'CSC-PANNIPITIYA', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Customer Service Center, Pannipitiya', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111148', unit_name: 'CSC_THALANGAMA', unit_code: 'CSC-THALANGAMA', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Customer Service Center, Thalangama', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111149', unit_name: 'CSC_WALIWITA', unit_code: 'CSC-WALIWITA', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Customer Service Center, Waliwita', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111150', unit_name: 'DD3_METER LAB', unit_code: 'DD3-METER-LAB', unit_type: 'unit', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'DD3 Meter Testing Laboratory, WPS-II', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111151', unit_name: 'DM & EM Office', unit_code: 'WPS-DM-EM', unit_type: 'unit', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'District Maintenance & Electrical Mechanical Office', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111152', unit_name: 'HRO', unit_code: 'WPS-HRO', unit_type: 'unit', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Human Resources Operations Office, WPS-II', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111153', unit_name: 'ITO', unit_code: 'WPS-ITO', unit_type: 'unit', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Information Technology Operations Office, WPS-II', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111160', unit_name: 'PLANNING', unit_code: 'PLANNING-WPS-II', unit_type: 'area', parent_unit_id: '11111111-1111-1111-1111-111111111003', location: 'Planning Branch, WPS-II Complex', status: 'active', sort_order: 999 },

  // Children under AREA HORANA (5 new locations)
  { id: '11111111-1111-1111-1111-111111111154', unit_name: 'AMU-Horana', unit_code: 'AMU-HORANA', unit_type: 'unit', parent_unit_id: '11111111-1111-1111-1111-111111111140', location: 'Area Maintenance Unit, Horana', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111155', unit_name: 'CSC BULATHSINHALA', unit_code: 'CSC-BULATHSINHALA', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111140', location: 'Customer Service Center, Bulathsinhala', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111156', unit_name: 'CSC HORANA', unit_code: 'CSC-HORANA', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111140', location: 'Customer Service Center, Horana', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111157', unit_name: 'CSC INGIRIYA', unit_code: 'CSC-INGIRIYA', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111140', location: 'Customer Service Center, Ingiriya', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111158', unit_name: 'CSC MORAGAHAHENA', unit_code: 'CSC-MORAGAHAHENA', unit_type: 'csc', parent_unit_id: '11111111-1111-1111-1111-111111111140', location: 'Customer Service Center, Moragahahena', status: 'active' },

  // Children under PLANNING
  { id: '11111111-1111-1111-1111-111111111161', unit_name: 'CALL CENTER & DCC', unit_code: 'CALL-CENTER-DCC', unit_type: 'unit', parent_unit_id: '11111111-1111-1111-1111-111111111160', location: 'Distribution Control Center & Call Center, WPS-II', status: 'active' }
];

const profiles = [
  { id: '00000000-0000-0000-0000-000000000001', username: 'superadmin', full_name: 'Gamini Wickramasinghe (Super Admin)', email: 'sadmin@edl.lk', role: 'super_admin', permission_level: null, contact_info: '+94 11 2345678', account_status: 'active', plainPassword: 'sadmin123' },
  { id: '00000000-0000-0000-0000-000000000002', username: 'localadmin', full_name: 'Sunil Perera (Local Admin Horana & WPS-II)', email: 'ladmin@edl.lk', role: 'local_admin', permission_level: null, contact_info: '+94 11 2894512', account_status: 'active', plainPassword: 'ladmin123' },
  { id: '00000000-0000-0000-0000-000000000003', username: 'unithead', full_name: 'Nihal Fernando (Homagama CSC Head)', email: 'headit@edl.lk', role: 'unit_head', permission_level: null, contact_info: '+94 11 2912445', account_status: 'active', plainPassword: 'head123' },
  { id: '00000000-0000-0000-0000-000000000004', username: 'employeerw', full_name: 'Kavinda Silva (Inventory Officer RW)', email: 'emp.rw@edl.lk', role: 'employee', permission_level: 'read_write', contact_info: '+94 77 1234567', account_status: 'active', plainPassword: 'emprw123' },
  { id: '00000000-0000-0000-0000-000000000005', username: 'employeero', full_name: 'Anura Jayawardena (Audit Observer RO)', email: 'emp.ro@edl.lk', role: 'employee', permission_level: 'read_only', contact_info: '+94 71 8901234', account_status: 'active', plainPassword: 'empro123' },
  { id: '00000000-0000-0000-0000-000000000006', username: 'employeenone', full_name: 'Dinesh Kumara (Restricted Staff)', email: 'emp.none@edl.lk', role: 'employee', permission_level: 'no_permission', contact_info: '+94 70 5556677', account_status: 'active', plainPassword: 'empnone123' }
];

const user_units = [
  // Local Admin: Full WPS-II Region scope
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111003' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111101' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111102' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111103' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111110' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111111' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111112' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111113' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111114' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111120' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111121' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111122' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111130' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111140' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111141' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111142' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111143' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111144' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111145' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111146' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111147' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111148' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111149' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111150' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111151' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111152' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111153' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111154' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111155' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111156' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111157' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111158' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111160' },
  { user_id: '00000000-0000-0000-0000-000000000002', unit_id: '11111111-1111-1111-1111-111111111161' },
  // Unit Head: Homagama CSC
  { user_id: '00000000-0000-0000-0000-000000000003', unit_id: '11111111-1111-1111-1111-111111111145' },
  // Employee RW: Homagama CSC
  { user_id: '00000000-0000-0000-0000-000000000004', unit_id: '11111111-1111-1111-1111-111111111145' },
  // Employee RO: Homagama CSC
  { user_id: '00000000-0000-0000-0000-000000000005', unit_id: '11111111-1111-1111-1111-111111111145' },
  // Employee None: Call Center & DCC
  { user_id: '00000000-0000-0000-0000-000000000006', unit_id: '11111111-1111-1111-1111-111111111161' }
];

const categories = [
  { id: '22222222-2222-2222-2222-222222222201', name: 'Furniture', parent_id: null, requires_serial: false, description: 'Office desks, ergonomic chairs, steel storage cabinets, conference tables' },
  { id: '22222222-2222-2222-2222-222222222202', name: 'IT & Computing Equipment', parent_id: null, requires_serial: false, description: 'Desktop PCs, laptops, enterprise servers, optical meter reader PDAs, printers' },
  { id: '22222222-2222-2222-2222-222222222203', name: 'Network & Communication Equipment', parent_id: null, requires_serial: false, description: 'Core network switches, routers, fiber transceivers, wireless access points, GPRS modems' },
  { id: '22222222-2222-2222-2222-222222222204', name: 'Audio Visual & Presentation Equipment', parent_id: null, requires_serial: false, description: 'Conference multimedia projectors, interactive smart displays, PA speaker systems' },
  { id: '22222222-2222-2222-2222-222222222206', name: 'Tools & Equipment', parent_id: null, requires_serial: false, description: 'Digital multimeters, insulation testers, crimping tools, electrical maintenance apparatus' }
];

const inventory_items = [
  { id: '33333333-3333-3333-3333-333333333301', item_name: '100 kVA 33kV/400V Distribution Transformer', item_code: 'TX-100KVA-01', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 12, serial_number: 'SN-TX-2024-8891', status: 'In Stock', sub_type: 'power-utility-equipment' },
  { id: '33333333-3333-3333-3333-333333333302', item_name: '160 kVA 11kV/400V Sealed Transformer', item_code: 'TX-160KVA-02', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 6, serial_number: 'SN-TX-2024-9104', status: 'In Stock', sub_type: 'power-utility-equipment' },
  { id: '33333333-3333-3333-3333-333333333303', item_name: '3-Phase 60A Smart Energy Meter (GPRS)', item_code: 'MTR-3PH-88', category: 'Network & Communication Equipment', category_id: '22222222-2222-2222-2222-222222222203', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 85, serial_number: 'SN-MTR-3P-4401', status: 'In Stock', sub_type: 'network-equipment' },
  { id: '33333333-3333-3333-3333-333333333304', item_name: 'Single Phase 30A Digital Energy Meter', item_code: 'MTR-1PH-12', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 140, serial_number: 'SN-MTR-1P-7720', status: 'In Stock', sub_type: 'electrical-tools-testing-equipment' },
  { id: '33333333-3333-3333-3333-333333333305', item_name: '11kV Auto-Recloser Vacuum Circuit Breaker', item_code: 'SW-ACR-11KV', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 4, serial_number: 'SN-ACR-8812', status: 'Low Stock', sub_type: 'power-utility-equipment' },
  { id: '33333333-3333-3333-3333-333333333306', item_name: '3x70+54.6mm² Aerial Bundled Conductor (m)', item_code: 'CAB-ABC-70', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 2500, serial_number: null, status: 'In Stock', sub_type: 'hand-tools' },
  { id: '33333333-3333-3333-3333-333333333307', item_name: 'Pre-stressed Spun Concrete Pole 10m 500daN', item_code: 'POL-10M-500', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 38, serial_number: null, status: 'In Stock', sub_type: 'tool-storage-handling' },
  { id: '33333333-3333-3333-3333-333333333308', item_name: 'Ergonomic Office High-Back Chair', item_code: 'FURN-CHR-01', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 18, serial_number: null, status: 'In Stock', sub_type: 'chairs' },
  { id: '33333333-3333-3333-3333-333333333321', item_name: 'Clerical Chair', item_code: 'FURN-CHR-02', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 12, serial_number: null, status: 'In Stock', sub_type: 'chairs' },
  { id: '33333333-3333-3333-3333-333333333322', item_name: 'Visitor Chair', item_code: 'FURN-CHR-03', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 24, serial_number: null, status: 'In Stock', sub_type: 'chairs' },
  { id: '33333333-3333-3333-3333-333333333323', item_name: 'Executive Chair', item_code: 'FURN-CHR-04', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 8, serial_number: null, status: 'In Stock', sub_type: 'chairs' },
  { id: '33333333-3333-3333-3333-333333333324', item_name: 'Low Back Chair', item_code: 'FURN-CHR-05', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 10, serial_number: null, status: 'In Stock', sub_type: 'chairs' },
  { id: '33333333-3333-3333-3333-333333333317', item_name: 'Conference Room Mahogany Table (10-Seater)', item_code: 'FURN-TBL-01', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 3, serial_number: null, status: 'In Stock', sub_type: 'tables' },
  { id: '33333333-3333-3333-3333-333333333318', item_name: 'Solid Teak Executive Office Table', item_code: 'FURN-TBL-02', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 6, serial_number: null, status: 'In Stock', sub_type: 'tables' },
  { id: '33333333-3333-3333-3333-333333333325', item_name: 'Computer Table', item_code: 'FURN-TBL-03', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 15, serial_number: null, status: 'In Stock', sub_type: 'tables' },
  { id: '33333333-3333-3333-3333-333333333326', item_name: 'Clerical Table', item_code: 'FURN-TBL-04', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 9, serial_number: null, status: 'In Stock', sub_type: 'tables' },
  { id: '33333333-3333-3333-3333-333333333309', item_name: 'Heavy Duty Steel Document Cabinet (4-drawer)', item_code: 'FURN-CAB-04', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 7, serial_number: null, status: 'In Stock', sub_type: 'cupboards-cabinets' },
  { id: '33333333-3333-3333-3333-333333333327', item_name: 'Library Cupboard', item_code: 'FURN-CAB-01', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 4, serial_number: null, status: 'In Stock', sub_type: 'cupboards-cabinets' },
  { id: '33333333-3333-3333-3333-333333333328', item_name: 'Full Height Cupboard', item_code: 'FURN-CAB-02', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 5, serial_number: null, status: 'In Stock', sub_type: 'cupboards-cabinets' },
  { id: '33333333-3333-3333-3333-333333333319', item_name: 'Heavy Duty Industrial Metal Storage Rack (5-Tier)', item_code: 'FURN-SHL-01', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 12, serial_number: null, status: 'In Stock', sub_type: 'shelving-racking' },
  { id: '33333333-3333-3333-3333-333333333329', item_name: 'File Rack – 8 Compartments', item_code: 'FURN-SHL-02', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 8, serial_number: null, status: 'In Stock', sub_type: 'shelving-racking' },
  { id: '33333333-3333-3333-3333-333333333320', item_name: 'Modular 4-Person Open Office Workstation', item_code: 'FURN-WST-01', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 5, serial_number: null, status: 'In Stock', sub_type: 'workstations' },
  { id: '33333333-3333-3333-3333-333333333330', item_name: '2-Seater Workstation', item_code: 'FURN-WST-02', category: 'Furniture', category_id: '22222222-2222-2222-2222-222222222201', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 6, serial_number: null, status: 'In Stock', sub_type: 'workstations' },
  { id: '33333333-3333-3333-3333-333333333310', item_name: 'Rugged Handheld Optical Meter Reader PDA', item_code: 'DEV-PDA-OPT', category: 'IT & Computing Equipment', category_id: '22222222-2222-2222-2222-222222222202', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 8, serial_number: 'SN-PDA-2023-1102', status: 'In Stock', sub_type: 'computers-peripherals' },
  { id: '33333333-3333-3333-3333-333333333312', item_name: 'Dell Latitude 5440 Core i7 Laptop', item_code: 'IT-LAP-5440', category: 'IT & Computing Equipment', category_id: '22222222-2222-2222-2222-222222222202', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 14, serial_number: 'SN-DELL-5440-9921', status: 'In Stock', sub_type: 'computers-peripherals' },
  { id: '33333333-3333-3333-3333-333333333331', item_name: 'Desktop Computer', item_code: 'IT-CMP-01', category: 'IT & Computing Equipment', category_id: '22222222-2222-2222-2222-222222222202', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 20, serial_number: null, status: 'In Stock', sub_type: 'computers-peripherals' },
  { id: '33333333-3333-3333-3333-333333333332', item_name: 'Brother Laser Printer', item_code: 'IT-PRN-01', category: 'IT & Computing Equipment', category_id: '22222222-2222-2222-2222-222222222202', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 11, serial_number: null, status: 'In Stock', sub_type: 'printers-printing-equipment' },
  { id: '33333333-3333-3333-3333-333333333333', item_name: '512 GB Globaltec SATA SSD', item_code: 'IT-STR-01', category: 'IT & Computing Equipment', category_id: '22222222-2222-2222-2222-222222222202', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 30, serial_number: null, status: 'In Stock', sub_type: 'storage-devices' },
  { id: '33333333-3333-3333-3333-333333333334', item_name: 'Scanner', item_code: 'IT-SCN-01', category: 'IT & Computing Equipment', category_id: '22222222-2222-2222-2222-222222222202', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 5, serial_number: null, status: 'In Stock', sub_type: 'scanning-office-machines' },
  { id: '33333333-3333-3333-3333-333333333313', item_name: 'Cisco Catalyst 2960-X 48-Port PoE Switch', item_code: 'NET-SW-2960X', category: 'Network & Communication Equipment', category_id: '22222222-2222-2222-2222-222222222203', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 8, serial_number: 'SN-CSCO-2960-401', status: 'In Stock', sub_type: 'network-equipment', sub_classification: 'Network Switch /PoE Switch', brand: 'Cisco', description: 'Catalyst 2960-X 48-Port PoE Switch' },
  { id: '33333333-3333-3333-3333-333333333335', item_name: 'Network Video Recorder', item_code: 'NET-CCTV-01', category: 'Network & Communication Equipment', category_id: '22222222-2222-2222-2222-222222222203', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 4, serial_number: null, status: 'In Stock', sub_type: 'cctv-recording-display' },
  { id: '33333333-3333-3333-3333-333333333336', item_name: 'IP Dome Camera', item_code: 'NET-CAM-01', category: 'Network & Communication Equipment', category_id: '22222222-2222-2222-2222-222222222203', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 16, serial_number: null, status: 'In Stock', sub_type: 'cameras' },
  { id: '33333333-3333-3333-3333-333333333337', item_name: 'Digital Phone', item_code: 'NET-TEL-01', category: 'Network & Communication Equipment', category_id: '22222222-2222-2222-2222-222222222203', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 25, serial_number: null, status: 'In Stock', sub_type: 'telephones-phones' },
  { id: '33333333-3333-3333-3333-333333333314', item_name: 'Epson EB-2250U Full HD Conference Projector', item_code: 'AV-PRJ-2250', category: 'Audio Visual & Presentation Equipment', category_id: '22222222-2222-2222-2222-222222222204', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 5, serial_number: 'SN-PRJ-2024-551', status: 'In Stock', sub_type: 'display-presentation' },
  { id: '33333333-3333-3333-3333-333333333338', item_name: 'TOA FM Mic', item_code: 'AV-AUD-01', category: 'Audio Visual & Presentation Equipment', category_id: '22222222-2222-2222-2222-222222222204', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 8, serial_number: null, status: 'In Stock', sub_type: 'audio-equipment' },
  { id: '33333333-3333-3333-3333-333333333339', item_name: 'JBL Speaker', item_code: 'AV-AUD-02', category: 'Audio Visual & Presentation Equipment', category_id: '22222222-2222-2222-2222-222222222204', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 6, serial_number: null, status: 'In Stock', sub_type: 'audio-equipment' },
  { id: '33333333-3333-3333-3333-333333333340', item_name: 'LED Television', item_code: 'AV-DSP-01', category: 'Audio Visual & Presentation Equipment', category_id: '22222222-2222-2222-2222-222222222204', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 4, serial_number: null, status: 'In Stock', sub_type: 'display-presentation' },
  { id: '33333333-3333-3333-3333-333333333311', item_name: '250 kVA Substation Transformer', item_code: 'TX-250KVA-03', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111146', quantity: 15, serial_number: 'SN-TX-MAL-001', status: 'In Stock', sub_type: 'power-utility-equipment' },
  { id: '33333333-3333-3333-3333-333333333316', item_name: 'Fluke 87V Industrial Digital Multimeter', item_code: 'TOOL-FLK-87V', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 12, serial_number: null, status: 'In Stock', sub_type: 'electrical-tools-testing-equipment' },
  { id: '33333333-3333-3333-3333-333333333341', item_name: 'Crimping Tool', item_code: 'TOOL-ETE-01', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 10, serial_number: null, status: 'In Stock', sub_type: 'electrical-tools-testing-equipment' },
  { id: '33333333-3333-3333-3333-333333333342', item_name: 'Hammer', item_code: 'TOOL-HTL-01', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 15, serial_number: null, status: 'In Stock', sub_type: 'hand-tools' },
  { id: '33333333-3333-3333-3333-333333333343', item_name: 'Tool Box', item_code: 'TOOL-TSH-01', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 8, serial_number: null, status: 'In Stock', sub_type: 'tool-storage-handling' },
  { id: '33333333-3333-3333-3333-333333333344', item_name: 'Safety Helmet', item_code: 'TOOL-PPE-01', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 35, serial_number: null, status: 'In Stock', sub_type: 'safety-equipment-ppe' },
  { id: '33333333-3333-3333-3333-333333333345', item_name: 'UPS', item_code: 'TOOL-PUE-01', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 14, serial_number: null, status: 'In Stock', sub_type: 'power-utility-equipment' },
  { id: '33333333-3333-3333-3333-333333333346', item_name: 'Air Conditioner', item_code: 'TOOL-ACV-01', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 6, serial_number: null, status: 'In Stock', sub_type: 'air-conditioning-ventilation' },
  { id: '33333333-3333-3333-3333-333333333347', item_name: 'Vacuum Cleaner', item_code: 'TOOL-CLN-01', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 4, serial_number: null, status: 'In Stock', sub_type: 'cleaning-equipment' },
  { id: '33333333-3333-3333-3333-333333333348', item_name: 'Water Dispenser', item_code: 'TOOL-KTC-01', category: 'Tools & Equipment', category_id: '22222222-2222-2222-2222-222222222206', unit_id: '11111111-1111-1111-1111-111111111145', quantity: 5, serial_number: null, status: 'In Stock', sub_type: 'kitchen-refreshment-equipment' }
];

async function seed(options = {}) {
  if (mongoose.connection.readyState !== 1) {
    await connect(options.uri);
  }

  const dbName = mongoose.connection.name;
  if (dbName !== 'edl_ims') {
    console.error(`❌ ABORT: Connected database is "${dbName}", expected "edl_ims". Only edl_ims may be modified!`);
    process.exit(1);
  }

  console.log(`🌱 Seeding database: ${dbName}...`);

  // 1. Seed Units
  let unitsCount = 0;
  for (const u of units) {
    await Unit.findOneAndUpdate({ id: u.id }, { $set: u }, { upsert: true, returnDocument: 'after' });
    unitsCount++;
  }
  console.log(`✓ Units seeded: ${unitsCount}`);

  // 2. Seed Categories
  let catsCount = 0;
  for (const c of categories) {
    await Category.findOneAndUpdate({ id: c.id }, { $set: c }, { upsert: true, returnDocument: 'after' });
    catsCount++;
  }
  console.log(`✓ Categories seeded: ${catsCount}`);

  // 3. Seed Profiles (hash passwords with bcrypt)
  let profilesCount = 0;
  for (const p of profiles) {
    const password_hash = await bcrypt.hash(p.plainPassword, 10);
    const profileDoc = {
      id: p.id,
      username: p.username,
      full_name: p.full_name,
      email: p.email,
      role: p.role,
      permission_level: p.permission_level,
      contact_info: p.contact_info,
      account_status: p.account_status,
      password_hash
    };
    await Profile.findOneAndUpdate({ id: p.id }, { $set: profileDoc }, { upsert: true, returnDocument: 'after' });
    profilesCount++;
  }
  console.log(`✓ Profiles seeded (passwords hashed): ${profilesCount}`);

  // 4. Seed UserUnits
  let uuCount = 0;
  for (const uu of user_units) {
    await UserUnit.findOneAndUpdate(
      { user_id: uu.user_id, unit_id: uu.unit_id },
      { $setOnInsert: { id: uuidv4() } },
      { upsert: true, returnDocument: 'after' }
    );
    uuCount++;
  }
  console.log(`✓ User Units seeded: ${uuCount}`);

  // 5. Seed Inventory Items
  let invCount = 0;
  for (const item of inventory_items) {
    await InventoryItem.findOneAndUpdate(
      { id: item.id },
      { $set: item },
      { upsert: true, returnDocument: 'after' }
    );
    invCount++;
  }
  console.log(`✓ Inventory items seeded: ${invCount}`);

  // 6. Sample Received Transactions
  const received_transactions = [
    { id: '44444444-4444-4444-4444-444444444401', item_name: '100 kVA 33kV/400V Distribution Transformer', category: 'Tools & Equipment', quantity: 15, date: '2026-08-10', unit_id: '11111111-1111-1111-1111-111111111145', voucher_image_path: 'vouchers/sample_vr_1.png', voucher_no: 'VR-2026-0801', serial_number: 'SN-TX-2024-8891', from_whom: 'Central Logistics Depot - Kolonnawa', notes: 'Batch of brand new 100kVA transformers delivered per PO #49281' },
    { id: '44444444-4444-4444-4444-444444444402', item_name: '3-Phase 60A Smart Energy Meter (GPRS)', category: 'Network & Communication Equipment', quantity: 100, date: '2026-08-14', unit_id: '11111111-1111-1111-1111-111111111145', voucher_image_path: 'vouchers/sample_vr_2.png', voucher_no: 'VR-2026-0814', serial_number: 'SN-MTR-3P-4401', from_whom: 'Lanka Electricity Metering Co (Pvt) Ltd', notes: 'Initial delivery of 3-Phase smart meters with SIM modules pre-installed' },
    { id: '44444444-4444-4444-4444-444444444403', item_name: 'Single Phase 30A Digital Energy Meter', category: 'Tools & Equipment', quantity: 150, date: '2026-08-20', unit_id: '11111111-1111-1111-1111-111111111145', voucher_image_path: 'vouchers/sample_vr_3.png', voucher_no: 'VR-2026-0820', serial_number: 'SN-MTR-1P-7720', from_whom: 'Lanka Electricity Metering Co (Pvt) Ltd', notes: 'Batch replenishment for consumer service connections in Homagama' }
  ];
  let recCount = 0;
  for (const r of received_transactions) {
    await ReceivedTransaction.findOneAndUpdate({ id: r.id }, { $set: r }, { upsert: true, returnDocument: 'after' });
    recCount++;
  }
  console.log(`✓ Received transactions seeded: ${recCount}`);

  // 7. Sample Expended Transactions
  const expended_transactions = [
    { id: '55555555-5555-5555-5555-555555555501', item_name: '100 kVA 33kV/400V Distribution Transformer', category: 'Tools & Equipment', quantity: 3, date: '2026-08-25', unit_id: '11111111-1111-1111-1111-111111111145', voucher_no: 'EV-2026-0901', disposition: 'Installed at Homagama Industrial Zone Substation Sub-04', notes: 'Emergency transformer replacement following lightning fault' },
    { id: '55555555-5555-5555-5555-555555555502', item_name: '3-Phase 60A Smart Energy Meter (GPRS)', category: 'Network & Communication Equipment', quantity: 15, date: '2026-08-28', unit_id: '11111111-1111-1111-1111-111111111145', voucher_no: 'EV-2026-0915', disposition: 'Issued to Field Tech Team 2 for Commercial New Connections', notes: 'New 3-phase commercial service setups along High Level Road' },
    { id: '55555555-5555-5555-5555-555555555503', item_name: 'Single Phase 30A Digital Energy Meter', category: 'Tools & Equipment', quantity: 10, date: '2026-09-01', unit_id: '11111111-1111-1111-1111-111111111145', voucher_no: 'EV-2026-0922', disposition: 'Issued for Residential Meter Replacements - Homagama Zone 3', notes: 'Defective mechanical meter replacement schedule' }
  ];
  let expCount = 0;
  for (const e of expended_transactions) {
    await ExpendedTransaction.findOneAndUpdate({ id: e.id }, { $set: e }, { upsert: true, returnDocument: 'after' });
    expCount++;
  }
  console.log(`✓ Expended transactions seeded: ${expCount}`);

  // 8. Verifications
  const verifications = [
    { id: '66666666-6666-6666-6666-666666666601', unit_id: '11111111-1111-1111-1111-111111111145', date: '2025-12-28', year: 2025, verified_by: ['H.M. Karunaratne (Chief Audit Officer)', 'S.D. Wijesinghe (Field Engineer)', 'R.K. Bandara (Storekeeper)'], verifier_1: 'H.M. Karunaratne', verifier_2: 'S.D. Wijesinghe', verifier_3: 'R.K. Bandara', status: 'confirmed', summary: 'Annual Board of Survey Verification 2025 for CSC Homagama completed with minor line hardware write-offs.' },
    { id: '66666666-6666-6666-6666-666666666602', unit_id: '11111111-1111-1111-1111-111111111145', date: '2026-03-15', year: 2026, verified_by: ['J. Santos', 'M. Reyes', 'A. Cruz'], verifier_1: 'J. Santos', verifier_2: 'M. Reyes', verifier_3: 'A. Cruz', status: 'confirmed', summary: 'Annual Board of Survey Verification 2026' }
  ];
  let verCount = 0;
  for (const v of verifications) {
    await Verification.findOneAndUpdate({ id: v.id }, { $set: v }, { upsert: true, returnDocument: 'after' });
    verCount++;
  }
  console.log(`✓ Verifications seeded: ${verCount}`);

  // 9. Verification Items
  const verification_items = [
    { id: '77777777-7777-7777-7777-777777777701', verification_id: '66666666-6666-6666-6666-666666666601', item_code: 'TX-100KVA-01', item_name: '100 kVA 33kV/400V Distribution Transformer', category: 'Tools & Equipment', system_qty: 12, physical_qty: 12, difference: 0, condition: 'Good', label_no: 'TAG-TX-101', remarks: 'All units secured in weather-protected shed', status: 'Counted', in_inventory: true },
    { id: '77777777-7777-7777-7777-777777777702', verification_id: '66666666-6666-6666-6666-666666666601', item_code: 'MTR-3PH-88', item_name: '3-Phase 60A Smart Energy Meter (GPRS)', category: 'Network & Communication Equipment', system_qty: 85, physical_qty: 85, difference: 0, condition: 'Good', label_no: 'TAG-MTR-001', remarks: 'Boxes sealed and factory calibrated', status: 'Counted', in_inventory: true },
    { id: '77777777-7777-7777-7777-777777777703', verification_id: '66666666-6666-6666-6666-666666666601', item_code: 'SW-ACR-11KV', item_name: '11kV Auto-Recloser Vacuum Circuit Breaker', category: 'Tools & Equipment', system_qty: 5, physical_qty: 4, difference: -1, condition: 'Fair', label_no: 'TAG-SW-404', remarks: '1 unit damaged during transit and moved to write-off', status: 'Discrepancy', in_inventory: true },
    { id: '77777777-7777-7777-7777-777777777704', verification_id: '66666666-6666-6666-6666-666666666602', item_code: 'IT1020', item_name: 'Office Chair', category: 'Furniture', system_qty: 42, physical_qty: 40, difference: -2, condition: 'Good', label_no: 'VL-0101', remarks: '', disposition: '', in_inventory: true, status: 'Shortage' },
    { id: '77777777-7777-7777-7777-777777777705', verification_id: '66666666-6666-6666-6666-666666666602', item_code: 'IT1021', item_name: 'Dell Laptop', category: 'IT & Computing Equipment', system_qty: 15, physical_qty: 13, difference: -2, condition: 'Good', label_no: 'VL-0102', remarks: '2 units issued to IT dept', disposition: 'Issued', in_inventory: true, status: 'Shortage' },
    { id: '77777777-7777-7777-7777-777777777706', verification_id: '66666666-6666-6666-6666-666666666602', item_code: 'IT1022', item_name: 'UPS Battery', category: 'Network & Communication Equipment', system_qty: 24, physical_qty: 22, difference: -2, condition: 'Damaged', label_no: 'VL-0103', remarks: '2 units beyond repair', disposition: 'Destroyed', in_inventory: true, status: 'Shortage' },
    { id: '77777777-7777-7777-7777-777777777707', verification_id: '66666666-6666-6666-6666-666666666602', item_code: 'IT1023', item_name: 'Projector', category: 'Audio Visual & Presentation Equipment', system_qty: 6, physical_qty: 6, difference: 0, condition: 'Good', label_no: 'VL-0104', remarks: '', disposition: '', in_inventory: true, status: 'Matched' },
    { id: '77777777-7777-7777-7777-777777777708', verification_id: '66666666-6666-6666-6666-666666666602', item_code: 'IT1024', item_name: 'Visitor Chair', category: 'Furniture', system_qty: 31, physical_qty: 29, difference: -2, condition: 'Good', label_no: 'VL-0105', remarks: '', disposition: '', in_inventory: true, status: 'Shortage' },
    { id: '77777777-7777-7777-7777-777777777709', verification_id: '66666666-6666-6666-6666-666666666602', item_code: 'IT1025', item_name: 'Whiteboard', category: 'Tools & Equipment', system_qty: 4, physical_qty: 4, difference: 0, condition: 'Good', label_no: 'VL-0106', remarks: '', disposition: '', in_inventory: true, status: 'Matched' }
  ];
  let viCount = 0;
  for (const vi of verification_items) {
    await VerificationItem.findOneAndUpdate({ id: vi.id }, { $set: vi }, { upsert: true, returnDocument: 'after' });
    viCount++;
  }
  console.log(`✓ Verification items seeded: ${viCount}`);

  // 10. Issued Destroyed Items
  const issued_destroyed_items = [
    { id: '88888888-8888-8888-8888-888888888801', item_id: '33333333-3333-3333-3333-333333333305', quantity: 1, disposition: 'Scrapped', reason: 'Damaged porcelain bushing and casing fracture from transit incident', date: '2025-12-29', verification_id: '66666666-6666-6666-6666-666666666601' }
  ];
  let idiCount = 0;
  for (const idi of issued_destroyed_items) {
    await IssuedDestroyedItem.findOneAndUpdate({ id: idi.id }, { $set: idi }, { upsert: true, returnDocument: 'after' });
    idiCount++;
  }
  console.log(`✓ Issued/Destroyed items seeded: ${idiCount}`);

  console.log('✅ Seeding complete!');
  if (options.disconnect || require.main === module) {
    await disconnect();
  }
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
}

module.exports = seed;
