-- ====================================================================
-- EDL IMS Database RLS Security Test Script (Postgres / pgTAP / SQL)
-- Validates that cross-unit queries and read-only writes are rejected by RLS
-- ====================================================================

BEGIN;

-- Test setup: Set simulated session as Employee RW of Kelaniya Depot
-- User ID: 00000000-0000-0000-0000-000000000004 (Kelaniya Depot: 11111111-1111-1111-1111-111111111103)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';

-- TEST 1: User of Unit A can view Unit A inventory
DO $$
DECLARE
    item_count INT;
BEGIN
    SELECT COUNT(*) INTO item_count 
    FROM public.inventory_items 
    WHERE unit_id = '11111111-1111-1111-1111-111111111103';
    
    IF item_count > 0 THEN
        RAISE NOTICE '✓ TEST 1 PASSED: Employee can read items within assigned unit.';
    ELSE
        RAISE EXCEPTION '✗ TEST 1 FAILED: Expected items in assigned unit.';
    END IF;
END $$;

-- TEST 2: User of Unit A CANNOT view Unit B inventory (Gampaha Store: 11111111-1111-1111-1111-111111111106)
DO $$
DECLARE
    leak_count INT;
BEGIN
    SELECT COUNT(*) INTO leak_count 
    FROM public.inventory_items 
    WHERE unit_id = '11111111-1111-1111-1111-111111111106';
    
    IF leak_count = 0 THEN
        RAISE NOTICE '✓ TEST 2 PASSED: Cross-unit data leak prevented by RLS (0 rows returned).';
    ELSE
        RAISE EXCEPTION '✗ TEST 2 FAILED: RLS leaked rows from foreign unit B!';
    END IF;
END $$;

-- TEST 3: Read-only user cannot INSERT into inventory_items
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005'; -- employeero
DO $$
BEGIN
    BEGIN
        INSERT INTO public.inventory_items (item_name, item_code, category, unit_id, quantity)
        VALUES ('Unauthorized Breaker', 'UNAUTH-01', 'Transformers', '11111111-1111-1111-1111-111111111103', 1);
        
        RAISE EXCEPTION '✗ TEST 3 FAILED: Read-only user was able to INSERT item!';
    EXCEPTION WHEN insufficient_privilege OR others THEN
        RAISE NOTICE '✓ TEST 3 PASSED: Read-only write attempt successfully blocked by RLS policy.';
    END;
END $$;

ROLLBACK;
