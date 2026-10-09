-- ====================================================================
-- EDL IMS Database Schema Migration 05: Update Item Categories & Items
-- Electricity Distribution Lanka (Pvt) Ltd
-- ====================================================================

-- 1. Insert/Update 6 new categories
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

-- 2. Migrate existing inventory_items to new categories
UPDATE public.inventory_items
SET category = 'Furniture', category_id = '22222222-2222-2222-2222-222222222201'
WHERE category = 'Furniture' OR category_id = '22222222-2222-2222-2222-222222222207';

UPDATE public.inventory_items
SET category = 'IT & Computing Equipment', category_id = '22222222-2222-2222-2222-222222222202'
WHERE category = 'IT & Devices' OR category_id = '22222222-2222-2222-2222-222222222206';

UPDATE public.inventory_items
SET category = 'Network & Communication Equipment', category_id = '22222222-2222-2222-2222-222222222203'
WHERE item_code = 'MTR-3PH-88';

-- Flagged items mapped to Tools & Equipment:
UPDATE public.inventory_items
SET category = 'Tools & Equipment', category_id = '22222222-2222-2222-2222-222222222206'
WHERE category IN ('Transformers', 'Switchgears & Protection', 'Energy Meters', 'Cables & Conductors', 'Poles & Line Hardware');

-- 3. Delete obsolete categories that are no longer referenced
DELETE FROM public.categories
WHERE name IN ('Transformers', 'Switchgears & Protection', 'Energy Meters', 'Cables & Conductors', 'Poles & Line Hardware', 'IT & Devices');
