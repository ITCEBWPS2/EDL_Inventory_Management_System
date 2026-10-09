-- ====================================================================
-- EDL IMS Database Migration 03: Seed Data
-- Electricity Distribution Lanka (Pvt) Ltd
-- ====================================================================

-- 1. UNITS SEED DATA (Hierarchical: Root -> Division -> Region -> Areas/Units -> Sub-units/CSCs)
INSERT INTO public.units (id, unit_name, unit_code, unit_type, parent_unit_id, location, status) VALUES
    -- Root & Divisional Hierarchy
    ('11111111-1111-1111-1111-111111111001', 'Electrical Distribution Lanka (Pvt) Ltd', 'EDL-HQ', 'area', NULL, 'Corporate Headquarters, Colombo', 'active'),
    ('11111111-1111-1111-1111-111111111002', 'D3', 'DIV-D3', 'area', '11111111-1111-1111-1111-111111111001', 'Distribution Division 3, Colombo', 'active'),
    ('11111111-1111-1111-1111-111111111003', 'WPS-II', 'REG-WPS-II', 'area', '11111111-1111-1111-1111-111111111002', 'Western Province South II Regional Complex', 'active'),

    -- Direct units & sub-areas under WPS-II
    ('11111111-1111-1111-1111-111111111101', 'ACC EXP', 'ACC-EXP', 'unit', '11111111-1111-1111-1111-111111111003', 'Accounts Expenditure Office, WPS-II', 'active'),
    ('11111111-1111-1111-1111-111111111102', 'ACC REV', 'ACC-REV', 'unit', '11111111-1111-1111-1111-111111111003', 'Accounts Revenue Office, WPS-II', 'active'),
    ('11111111-1111-1111-1111-111111111103', 'AMU_JAPURA', 'AMU-JAPURA', 'unit', '11111111-1111-1111-1111-111111111003', 'Area Maintenance Unit, Jayawardenapura', 'active'),
    ('11111111-1111-1111-1111-111111111110', 'AREA AVISSAWELLA', 'AREA-AVISSAWELLA', 'area', '11111111-1111-1111-1111-111111111003', 'Avissawella Area Office', 'active'),
    ('11111111-1111-1111-1111-111111111120', 'AREA BANDARAGAMA', 'AREA-BANDARAGAMA', 'area', '11111111-1111-1111-1111-111111111003', 'Bandaragama Area Office', 'active'),
    ('11111111-1111-1111-1111-111111111130', 'AREA HOMAGAMA', 'AREA-HOMAGAMA', 'unit', '11111111-1111-1111-1111-111111111003', 'Homagama Area Operations Office', 'active'),
    ('11111111-1111-1111-1111-111111111140', 'AREA HORANA', 'AREA-HORANA', 'area', '11111111-1111-1111-1111-111111111003', 'Horana Area Office', 'active'),
    ('11111111-1111-1111-1111-111111111160', 'PLANNING', 'PLANNING-WPS-II', 'area', '11111111-1111-1111-1111-111111111003', 'Planning Branch, WPS-II Complex', 'active'),

    -- Children under AREA AVISSAWELLA
    ('11111111-1111-1111-1111-111111111111', 'AMU-Avissawella', 'AMU-AVISSAWELLA', 'unit', '11111111-1111-1111-1111-111111111110', 'Area Maintenance Unit, Avissawella', 'active'),
    ('11111111-1111-1111-1111-111111111112', 'CSC_AVISSAWELLA', 'CSC-AVISSAWELLA', 'csc', '11111111-1111-1111-1111-111111111110', 'Customer Service Center, Avissawella', 'active'),
    ('11111111-1111-1111-1111-111111111113', 'CSC-HANWELLA', 'CSC-HANWELLA', 'csc', '11111111-1111-1111-1111-111111111110', 'Customer Service Center, Hanwella', 'active'),
    ('11111111-1111-1111-1111-111111111114', 'CSC-PADUKKA', 'CSC-PADUKKA', 'csc', '11111111-1111-1111-1111-111111111110', 'Customer Service Center, Padukka', 'active'),

    -- Children under AREA BANDARAGAMA
    ('11111111-1111-1111-1111-111111111121', 'CSC BANDARAGAMA', 'CSC-BANDARAGAMA', 'csc', '11111111-1111-1111-1111-111111111120', 'Customer Service Center, Bandaragama', 'active'),
    ('11111111-1111-1111-1111-111111111122', 'CSC MILLENIYA', 'CSC-MILLENIYA', 'csc', '11111111-1111-1111-1111-111111111120', 'Customer Service Center, Milleniya', 'active'),

    -- Children under AREA HORANA
    ('11111111-1111-1111-1111-111111111141', 'AREA JAPURA', 'HOR-AREA-JAPURA', 'unit', '11111111-1111-1111-1111-111111111140', 'Japura Operations Sub-Office, Horana', 'active'),
    ('11111111-1111-1111-1111-111111111142', 'COMMERCIAL', 'HOR-COMMERCIAL', 'unit', '11111111-1111-1111-1111-111111111140', 'Commercial Operations Branch, Horana', 'active'),
    ('11111111-1111-1111-1111-111111111143', 'CONSTRUCTION', 'HOR-CONSTRUCTION', 'unit', '11111111-1111-1111-1111-111111111140', 'Construction Branch, Horana', 'active'),
    ('11111111-1111-1111-1111-111111111144', 'CSC_HOKANDARA', 'CSC-HOKANDARA', 'csc', '11111111-1111-1111-1111-111111111140', 'Customer Service Center, Hokandara', 'active'),
    ('11111111-1111-1111-1111-111111111145', 'CSC_HOMAGAMA', 'CSC-HOMAGAMA', 'csc', '11111111-1111-1111-1111-111111111140', 'Customer Service Center, Homagama', 'active'),
    ('11111111-1111-1111-1111-111111111146', 'CSC_MALAMBE', 'CSC-MALAMBE', 'csc', '11111111-1111-1111-1111-111111111140', 'Customer Service Center, Malambe', 'active'),
    ('11111111-1111-1111-1111-111111111147', 'CSC_PANNIPITIYA', 'CSC-PANNIPITIYA', 'csc', '11111111-1111-1111-1111-111111111140', 'Customer Service Center, Pannipitiya', 'active'),
    ('11111111-1111-1111-1111-111111111148', 'CSC_THALANGAMA', 'CSC-THALANGAMA', 'csc', '11111111-1111-1111-1111-111111111140', 'Customer Service Center, Thalangama', 'active'),
    ('11111111-1111-1111-1111-111111111149', 'CSC_WALIWITA', 'CSC-WALIWITA', 'csc', '11111111-1111-1111-1111-111111111140', 'Customer Service Center, Waliwita', 'active'),
    ('11111111-1111-1111-1111-111111111150', 'DD3_METER LAB', 'DD3-METER-LAB', 'unit', '11111111-1111-1111-1111-111111111140', 'DD3 Meter Testing Laboratory, Horana', 'active'),
    ('11111111-1111-1111-1111-111111111151', 'DM & EM Office', 'HOR-DM-EM', 'unit', '11111111-1111-1111-1111-111111111140', 'District Maintenance & Electrical Mechanical Office', 'active'),
    ('11111111-1111-1111-1111-111111111152', 'HRO', 'HOR-HRO', 'unit', '11111111-1111-1111-1111-111111111140', 'Human Resources Operations Office, Horana', 'active'),
    ('11111111-1111-1111-1111-111111111153', 'ITO', 'HOR-ITO', 'unit', '11111111-1111-1111-1111-111111111140', 'Information Technology Operations Office, Horana', 'active'),

    -- Children under PLANNING
    ('11111111-1111-1111-1111-111111111161', 'CALL CENTER & DCC', 'CALL-CENTER-DCC', 'unit', '11111111-1111-1111-1111-111111111160', 'Distribution Control Center & Call Center, WPS-II', 'active')
ON CONFLICT (unit_code) DO NOTHING;

-- 2. CATEGORIES SEED DATA
INSERT INTO public.categories (id, name, parent_id, requires_serial, description) VALUES
    ('22222222-2222-2222-2222-222222222201', 'Furniture', NULL, FALSE, 'Office desks, ergonomic chairs, steel storage cabinets, conference tables'),
    ('22222222-2222-2222-2222-222222222202', 'IT & Computing Equipment', NULL, TRUE, 'Desktop PCs, laptops, enterprise servers, optical meter reader PDAs, printers'),
    ('22222222-2222-2222-2222-222222222203', 'Network & Communication Equipment', NULL, TRUE, 'Core network switches, routers, fiber transceivers, wireless access points, GPRS modems'),
    ('22222222-2222-2222-2222-222222222204', 'Audio Visual & Presentation Equipment', NULL, TRUE, 'Conference multimedia projectors, interactive smart displays, PA speaker systems'),
    ('22222222-2222-2222-2222-222222222205', 'Media Equipment', NULL, TRUE, 'Inspection digital cameras, video recording drones, handheld field audio recorders'),
    ('22222222-2222-2222-2222-222222222206', 'Tools & Equipment', NULL, FALSE, 'Digital multimeters, insulation testers, crimping tools, electrical maintenance apparatus')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    requires_serial = EXCLUDED.requires_serial,
    description = EXCLUDED.description;

-- 3. OPTIONAL AUTH.USERS & AUTH.IDENTITIES SEED (Ensures auth and foreign keys succeed when run in Supabase)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES
            ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sadmin@edl.lk', crypt('sadmin123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Gamini Wickramasinghe"}', NOW(), NOW()),
            ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ladmin@edl.lk', crypt('ladmin123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sunil Perera"}', NOW(), NOW()),
            ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'headit@edl.lk', crypt('head123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Nihal Fernando"}', NOW(), NOW()),
            ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp.rw@edl.lk', crypt('emprw123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kavinda Silva"}', NOW(), NOW()),
            ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp.ro@edl.lk', crypt('empro123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Anura Jayawardena"}', NOW(), NOW()),
            ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp.none@edl.lk', crypt('empnone123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dinesh Kumara"}', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            encrypted_password = EXCLUDED.encrypted_password;

        -- Update existing user rows if they already exist
        UPDATE auth.users SET email = 'sadmin@edl.lk', encrypted_password = crypt('sadmin123', gen_salt('bf')) WHERE id = '00000000-0000-0000-0000-000000000001' OR email = 'sadmin@edl.lk' OR email = 'admin@edl.lk';
        UPDATE auth.users SET email = 'ladmin@edl.lk', encrypted_password = crypt('ladmin123', gen_salt('bf')) WHERE id = '00000000-0000-0000-0000-000000000002' OR email = 'ladmin@edl.lk' OR email = 'colombo.admin@edl.lk';
        UPDATE auth.users SET email = 'headit@edl.lk', encrypted_password = crypt('head123', gen_salt('bf')) WHERE id = '00000000-0000-0000-0000-000000000003' OR email = 'headit@edl.lk' OR email = 'head.kelaniya@edl.lk';
        UPDATE auth.users SET email = 'emp.rw@edl.lk', encrypted_password = crypt('emprw123', gen_salt('bf')) WHERE id = '00000000-0000-0000-0000-000000000004' OR email = 'emp.rw@edl.lk';
        UPDATE auth.users SET email = 'emp.ro@edl.lk', encrypted_password = crypt('empro123', gen_salt('bf')) WHERE id = '00000000-0000-0000-0000-000000000005' OR email = 'emp.ro@edl.lk';
        UPDATE auth.users SET email = 'emp.none@edl.lk', encrypted_password = crypt('empnone123', gen_salt('bf')) WHERE id = '00000000-0000-0000-0000-000000000006' OR email = 'emp.none@edl.lk';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities') THEN
        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id,
            last_sign_in_at, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            u.id,
            jsonb_build_object('sub', u.id::text, 'email', u.email),
            'email',
            u.id::text,
            NOW(), NOW(), NOW()
        FROM auth.users u
        WHERE u.email IN (
            'sadmin@edl.lk', 'ladmin@edl.lk', 'headit@edl.lk',
            'emp.rw@edl.lk', 'emp.ro@edl.lk', 'emp.none@edl.lk',
            'admin@edl.lk', 'colombo.admin@edl.lk', 'head.kelaniya@edl.lk'
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 4. PROFILES SEED (Corresponding to demo users)
INSERT INTO public.profiles (id, username, full_name, role, permission_level, contact_info, account_status) VALUES
    ('00000000-0000-0000-0000-000000000001', 'superadmin', 'Gamini Wickramasinghe (Super Admin)', 'super_admin', NULL, '+94 11 2345678', 'active'),
    ('00000000-0000-0000-0000-000000000002', 'localadmin', 'Sunil Perera (Local Admin Horana & WPS-II)', 'local_admin', NULL, '+94 11 2894512', 'active'),
    ('00000000-0000-0000-0000-000000000003', 'unithead', 'Nihal Fernando (Homagama CSC Head)', 'unit_head', NULL, '+94 11 2912445', 'active'),
    ('00000000-0000-0000-0000-000000000004', 'employeerw', 'Kavinda Silva (Inventory Officer RW)', 'employee', 'read_write', '+94 77 1234567', 'active'),
    ('00000000-0000-0000-0000-000000000005', 'employeero', 'Anura Jayawardena (Audit Observer RO)', 'employee', 'read_only', '+94 71 8901234', 'active'),
    ('00000000-0000-0000-0000-000000000006', 'employeenone', 'Dinesh Kumara (Restricted Staff)', 'employee', 'no_permission', '+94 70 5556677', 'active')
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    permission_level = EXCLUDED.permission_level,
    contact_info = EXCLUDED.contact_info,
    account_status = EXCLUDED.account_status;

-- 5. USER_UNITS MAPPINGS
INSERT INTO public.user_units (user_id, unit_id) VALUES
    -- Local Admin has full WPS-II Regional scope (WPS-II, direct units, areas, and their operational centers/CSCs)
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111003'), -- WPS-II
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101'), -- ACC EXP
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111102'), -- ACC REV
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111103'), -- AMU_JAPURA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111110'), -- AREA AVISSAWELLA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111'), -- AMU-Avissawella
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111112'), -- CSC_AVISSAWELLA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111113'), -- CSC-HANWELLA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111114'), -- CSC-PADUKKA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111120'), -- AREA BANDARAGAMA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111121'), -- CSC BANDARAGAMA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111122'), -- CSC MILLENIYA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111130'), -- AREA HOMAGAMA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111140'), -- AREA HORANA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111141'), -- AREA JAPURA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111142'), -- COMMERCIAL
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111143'), -- CONSTRUCTION
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111144'), -- CSC_HOKANDARA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111145'), -- CSC_HOMAGAMA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111146'), -- CSC_MALAMBE
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111147'), -- CSC_PANNIPITIYA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111148'), -- CSC_THALANGAMA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111149'), -- CSC_WALIWITA
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111150'), -- DD3_METER LAB
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111151'), -- DM & EM Office
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111152'), -- HRO
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111153'), -- ITO
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111160'), -- PLANNING
    ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111161'), -- CALL CENTER & DCC
    -- Unit Head assigned to Homagama CSC
    ('00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111145'),
    -- Employee RW assigned to Homagama CSC
    ('00000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111145'),
    -- Employee RO assigned to Homagama CSC
    ('00000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111145'),
    -- Employee None assigned to Call Center & DCC
    ('00000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111161')
ON CONFLICT DO NOTHING;

-- 6. INVENTORY ITEMS SEED
INSERT INTO public.inventory_items (id, item_name, item_code, category, category_id, unit_id, quantity, serial_number, status) VALUES
    ('33333333-3333-3333-3333-333333333301', '100 kVA 33kV/400V Distribution Transformer', 'TX-100KVA-01', 'Tools & Equipment', '22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111145', 12, 'SN-TX-2024-8891', 'In Stock'),
    ('33333333-3333-3333-3333-333333333302', '160 kVA 11kV/400V Sealed Transformer', 'TX-160KVA-02', 'Tools & Equipment', '22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111145', 6, 'SN-TX-2024-9104', 'In Stock'),
    ('33333333-3333-3333-3333-333333333303', '3-Phase 60A Smart Energy Meter (GPRS)', 'MTR-3PH-88', 'Network & Communication Equipment', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111145', 85, 'SN-MTR-3P-4401', 'In Stock'),
    ('33333333-3333-3333-3333-333333333304', 'Single Phase 30A Digital Energy Meter', 'MTR-1PH-12', 'Tools & Equipment', '22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111145', 140, 'SN-MTR-1P-7720', 'In Stock'),
    ('33333333-3333-3333-3333-333333333305', '11kV Auto-Recloser Vacuum Circuit Breaker', 'SW-ACR-11KV', 'Tools & Equipment', '22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111145', 4, 'SN-ACR-8812', 'Low Stock'),
    ('33333333-3333-3333-3333-333333333306', '3x70+54.6mm² Aerial Bundled Conductor (m)', 'CAB-ABC-70', 'Tools & Equipment', '22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111145', 2500, NULL, 'In Stock'),
    ('33333333-3333-3333-3333-333333333307', 'Pre-stressed Spun Concrete Pole 10m 500daN', 'POL-10M-500', 'Tools & Equipment', '22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111145', 38, NULL, 'In Stock'),
    ('33333333-3333-3333-3333-333333333308', 'Ergonomic Office High-Back Chair', 'FURN-CHR-01', 'Furniture', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111145', 18, NULL, 'In Stock'),
    ('33333333-3333-3333-3333-333333333309', 'Heavy Duty Steel Document Cabinet (4-drawer)', 'FURN-CAB-04', 'Furniture', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111145', 7, NULL, 'In Stock'),
    ('33333333-3333-3333-3333-333333333310', 'Rugged Handheld Optical Meter Reader PDA', 'DEV-PDA-OPT', 'IT & Computing Equipment', '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111145', 8, 'SN-PDA-2023-1102', 'In Stock'),
    ('33333333-3333-3333-3333-333333333311', '250 kVA Substation Transformer', 'TX-250KVA-03', 'Tools & Equipment', '22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111146', 15, 'SN-TX-MAL-001', 'In Stock'),
    ('33333333-3333-3333-3333-333333333312', 'Dell Latitude 5440 Core i7 Laptop', 'IT-LAP-5440', 'IT & Computing Equipment', '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111145', 14, 'SN-DELL-5440-9921', 'In Stock'),
    ('33333333-3333-3333-3333-333333333313', 'Cisco Catalyst 2960-X 48-Port PoE Switch', 'NET-SW-2960X', 'Network & Communication Equipment', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111145', 8, 'SN-CSCO-2960-401', 'In Stock'),
    ('33333333-3333-3333-3333-333333333314', 'Epson EB-2250U Full HD Conference Projector', 'AV-PRJ-2250', 'Audio Visual & Presentation Equipment', '22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111145', 5, 'SN-PRJ-2024-551', 'In Stock'),
    ('33333333-3333-3333-3333-333333333315', 'Sony Alpha 7 IV Mirrorless Inspection Camera', 'MED-CAM-A7IV', 'Media Equipment', '22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111145', 4, 'SN-CAM-A7-881', 'In Stock'),
    ('33333333-3333-3333-3333-333333333316', 'Fluke 87V Industrial Digital Multimeter', 'TOOL-FLK-87V', 'Tools & Equipment', '22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111145', 12, NULL, 'In Stock')
ON CONFLICT (item_code, unit_id) DO NOTHING;

-- 7. RECEIVED TRANSACTIONS SEED
INSERT INTO public.received_transactions (id, item_id, quantity, date, unit_id, voucher_image_path, voucher_no, serial_number, from_whom, notes) VALUES
    ('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', 15, '2026-08-10', '11111111-1111-1111-1111-111111111145', 'vouchers/sample_vr_1.png', 'VR-2026-0801', 'SN-TX-2024-8891', 'Central Logistics Depot - Kolonnawa', 'Batch of brand new 100kVA transformers delivered per PO #49281'),
    ('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333303', 100, '2026-08-14', '11111111-1111-1111-1111-111111111145', 'vouchers/sample_vr_2.png', 'VR-2026-0814', 'SN-MTR-3P-4401', 'Lanka Electricity Metering Co (Pvt) Ltd', 'Initial delivery of 3-Phase smart meters with SIM modules pre-installed'),
    ('44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333304', 150, '2026-08-20', '11111111-1111-1111-1111-111111111145', 'vouchers/sample_vr_3.png', 'VR-2026-0820', 'SN-MTR-1P-7720', 'Lanka Electricity Metering Co (Pvt) Ltd', 'Batch replenishment for consumer service connections in Homagama')
ON CONFLICT DO NOTHING;

-- 8. EXPENDED TRANSACTIONS SEED
INSERT INTO public.expended_transactions (id, item_id, quantity, date, unit_id, voucher_no, disposition, notes) VALUES
    ('55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333301', 3, '2026-08-25', '11111111-1111-1111-1111-111111111145', 'EV-2026-0901', 'Installed at Homagama Industrial Zone Substation Sub-04', 'Emergency transformer replacement following lightning fault'),
    ('55555555-5555-5555-5555-555555555502', '33333333-3333-3333-3333-333333333303', 15, '2026-08-28', '11111111-1111-1111-1111-111111111145', 'EV-2026-0915', 'Issued to Field Tech Team 2 for Commercial New Connections', 'New 3-phase commercial service setups along High Level Road'),
    ('55555555-5555-5555-5555-555555555503', '33333333-3333-3333-3333-333333333304', 10, '2026-09-01', '11111111-1111-1111-1111-111111111145', 'EV-2026-0922', 'Issued for Residential Meter Replacements - Homagama Zone 3', 'Defective mechanical meter replacement schedule')
ON CONFLICT DO NOTHING;

-- 9. VERIFICATIONS SEED
INSERT INTO public.verifications (id, unit_id, date, year, verified_by, status, summary) VALUES
    ('66666666-6666-6666-6666-666666666601', '11111111-1111-1111-1111-111111111145', '2025-12-28', 2025, ARRAY['H.M. Karunaratne (Chief Audit Officer)', 'S.D. Wijesinghe (Field Engineer)', 'R.K. Bandara (Storekeeper)'], 'confirmed', 'Annual Board of Survey Verification 2025 for CSC Homagama completed with minor line hardware write-offs.'),
    ('66666666-6666-6666-6666-666666666602', '11111111-1111-1111-1111-111111111145', '2026-09-02', 2026, ARRAY['Kavinda Silva (Inventory Officer)', 'Nihal Fernando (Unit Head)'], 'draft', 'Preliminary physical count in progress for 2026 mid-year audit cycle.')
ON CONFLICT DO NOTHING;

-- 10. VERIFICATION ITEMS SEED
INSERT INTO public.verification_items (verification_id, item_code, item_name, category, system_qty, physical_qty, condition, label_no, remarks, status) VALUES
    ('66666666-6666-6666-6666-666666666601', 'TX-100KVA-01', '100 kVA 33kV/400V Distribution Transformer', 'Tools & Equipment', 12, 12, 'Good', 'TAG-TX-101', 'All units secured in weather-protected shed', 'Counted'),
    ('66666666-6666-6666-6666-666666666601', 'MTR-3PH-88', '3-Phase 60A Smart Energy Meter (GPRS)', 'Network & Communication Equipment', 85, 85, 'Good', 'TAG-MTR-001', 'Boxes sealed and factory calibrated', 'Counted'),
    ('66666666-6666-6666-6666-666666666601', 'SW-ACR-11KV', '11kV Auto-Recloser Vacuum Circuit Breaker', 'Tools & Equipment', 5, 4, 'Fair', 'TAG-SW-404', '1 unit damaged during transit and moved to write-off', 'Discrepancy'),
    ('66666666-6666-6666-6666-666666666602', 'TX-100KVA-01', '100 kVA 33kV/400V Distribution Transformer', 'Tools & Equipment', 12, 12, 'Good', 'TAG-2026-01', 'Counted in main yard', 'Counted'),
    ('66666666-6666-6666-6666-666666666602', 'MTR-3PH-88', '3-Phase 60A Smart Energy Meter (GPRS)', 'Network & Communication Equipment', 85, 85, 'Good', 'TAG-2026-02', 'Counted in secure meter room', 'Counted');

-- 11. ISSUED/DESTROYED ITEMS SEED
INSERT INTO public.issued_destroyed_items (item_id, quantity, disposition, reason, date, verification_id) VALUES
    ('33333333-3333-3333-3333-333333333305', 1, 'Scrapped', 'Damaged porcelain bushing and casing fracture from transit incident', '2025-12-29', '66666666-6666-6666-6666-666666666601');

