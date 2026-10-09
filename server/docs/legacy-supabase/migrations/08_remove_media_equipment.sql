-- ====================================================================
-- EDL IMS Database Migration 08: Remove Media Equipment Category
-- Electricity Distribution Lanka (Pvt) Ltd
-- ====================================================================

DELETE FROM public.categories 
WHERE name = 'Media Equipment' OR id = '22222222-2222-2222-2222-222222222205';
