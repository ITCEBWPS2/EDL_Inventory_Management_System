-- ====================================================================
-- EDL IMS Database Migration 06: Add Description to Inventory Items
-- Electricity Distribution Lanka (Pvt) Ltd
-- ====================================================================

ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS sub_type VARCHAR(100);
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS sub_classification VARCHAR(150);
