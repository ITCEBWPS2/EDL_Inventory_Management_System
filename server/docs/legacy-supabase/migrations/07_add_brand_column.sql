-- ====================================================================
-- EDL IMS Database Migration 07: Add Brand to Inventory Items
-- Electricity Distribution Lanka (Pvt) Ltd
-- ====================================================================

ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS brand VARCHAR(150);
