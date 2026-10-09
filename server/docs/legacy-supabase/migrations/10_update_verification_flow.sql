-- ====================================================================
-- Migration 10: Enhance Verifications Schema for 3-Step Flow
-- ====================================================================

ALTER TABLE public.verifications ADD COLUMN IF NOT EXISTS verifier_1 VARCHAR(255);
ALTER TABLE public.verifications ADD COLUMN IF NOT EXISTS verifier_2 VARCHAR(255);
ALTER TABLE public.verifications ADD COLUMN IF NOT EXISTS verifier_3 VARCHAR(255);

ALTER TABLE public.verification_items ADD COLUMN IF NOT EXISTS disposition VARCHAR(100);
ALTER TABLE public.verification_items ADD COLUMN IF NOT EXISTS in_inventory BOOLEAN DEFAULT TRUE;
