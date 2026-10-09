-- 09_decouple_received_transactions.sql
-- Decouples received and expended transactions from the inventory_items catalog.
-- Received records are independent unit receipts, not catalog lookups.

-- 1. Modify received_transactions
ALTER TABLE public.received_transactions ADD COLUMN IF NOT EXISTS item_name VARCHAR(255);
ALTER TABLE public.received_transactions ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE public.received_transactions ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Backfill item_name and category from existing inventory_items
UPDATE public.received_transactions r
SET item_name = i.item_name, category = i.category
FROM public.inventory_items i
WHERE r.item_id = i.id AND (r.item_name IS NULL OR r.item_name = '');

-- Set fallback item_name if still null
UPDATE public.received_transactions
SET item_name = 'Received Item'
WHERE item_name IS NULL OR item_name = '';

ALTER TABLE public.received_transactions ALTER COLUMN item_name SET NOT NULL;
ALTER TABLE public.received_transactions ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE public.received_transactions DROP CONSTRAINT IF EXISTS received_transactions_item_id_fkey;

-- 2. Modify expended_transactions
ALTER TABLE public.expended_transactions ADD COLUMN IF NOT EXISTS item_name VARCHAR(255);
ALTER TABLE public.expended_transactions ADD COLUMN IF NOT EXISTS category VARCHAR(100);

UPDATE public.expended_transactions e
SET item_name = i.item_name, category = i.category
FROM public.inventory_items i
WHERE e.item_id = i.id AND (e.item_name IS NULL OR e.item_name = '');

UPDATE public.expended_transactions
SET item_name = 'Expended Item'
WHERE item_name IS NULL OR item_name = '';

ALTER TABLE public.expended_transactions ALTER COLUMN item_name SET NOT NULL;
ALTER TABLE public.expended_transactions ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE public.expended_transactions DROP CONSTRAINT IF EXISTS expended_transactions_item_id_fkey;

-- 3. Redefine remaining_inventory view based on received - expended per unit and item_name
DROP VIEW IF EXISTS public.remaining_inventory;

CREATE OR REPLACE VIEW public.remaining_inventory AS
WITH rec AS (
    SELECT 
        unit_id,
        LOWER(TRIM(item_name)) AS norm_name,
        MAX(item_name) AS item_name,
        MAX(category) AS category,
        SUM(quantity) AS total_received
    FROM public.received_transactions
    WHERE item_name IS NOT NULL AND item_name != ''
    GROUP BY unit_id, LOWER(TRIM(item_name))
),
exp AS (
    SELECT 
        unit_id,
        LOWER(TRIM(item_name)) AS norm_name,
        SUM(quantity) AS total_expended
    FROM public.expended_transactions
    WHERE item_name IS NOT NULL AND item_name != ''
    GROUP BY unit_id, LOWER(TRIM(item_name))
)
SELECT 
    rec.norm_name AS item_key,
    rec.item_name,
    COALESCE(rec.category, '') AS category,
    rec.unit_id,
    u.unit_name,
    u.location,
    rec.total_received,
    COALESCE(exp.total_expended, 0) AS total_expended,
    (rec.total_received - COALESCE(exp.total_expended, 0)) AS remaining_qty,
    CASE 
        WHEN (rec.total_received - COALESCE(exp.total_expended, 0)) <= 0 THEN 'Out of Stock'
        WHEN (rec.total_received - COALESCE(exp.total_expended, 0)) <= 5 THEN 'Low Stock'
        ELSE 'In Stock'
    END AS stock_status
FROM rec
JOIN public.units u ON rec.unit_id = u.id
LEFT JOIN exp ON rec.unit_id = exp.unit_id AND rec.norm_name = exp.norm_name;
