-- ====================================================================
-- EDL IMS Database Schema Migration 01: Core Tables, Views & Indexes
-- Electricity Distribution Lanka (Pvt) Ltd
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'local_admin', 'unit_head', 'employee')),
    permission_level VARCHAR(50) CHECK (permission_level IN ('read_write', 'read_only', 'no_permission') OR permission_level IS NULL),
    contact_info VARCHAR(255),
    account_status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. UNITS (Hierarchical: Area -> Sub-area/CSC -> Unit)
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_name VARCHAR(255) NOT NULL,
    unit_code VARCHAR(50) UNIQUE NOT NULL,
    unit_type VARCHAR(50) NOT NULL CHECK (unit_type IN ('area', 'csc', 'unit')),
    parent_unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    location VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. USER_UNITS (User-to-Unit access scoping)
CREATE TABLE IF NOT EXISTS public.user_units (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, unit_id)
);

-- 4. CATEGORIES (Item categories & sub-categories with serial requirement flag)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    requires_serial BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. INVENTORY_ITEMS (Master catalog per unit)
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name VARCHAR(255) NOT NULL,
    item_code VARCHAR(100) NOT NULL,
    category VARCHAR(150) NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    serial_number VARCHAR(150),
    status VARCHAR(50) NOT NULL DEFAULT 'In Stock' CHECK (status IN ('In Stock', 'Low Stock', 'Out of Stock', 'Discontinued')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_item_code_per_unit UNIQUE (item_code, unit_id)
);

-- 6. RECEIVED_TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.received_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    voucher_image_path TEXT,
    voucher_no VARCHAR(100) NOT NULL,
    serial_number VARCHAR(150),
    from_whom VARCHAR(255) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. EXPENDED_TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.expended_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    voucher_no VARCHAR(100) NOT NULL,
    disposition VARCHAR(255) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. REMAINING_INVENTORY (Dynamic computed view)
CREATE OR REPLACE VIEW public.remaining_inventory AS
SELECT 
    i.id AS item_id,
    i.item_code,
    i.item_name,
    i.category,
    i.unit_id,
    u.unit_name,
    u.location,
    COALESCE(SUM(r.quantity), 0) AS total_received,
    COALESCE(SUM(e.quantity), 0) AS total_expended,
    (COALESCE(SUM(r.quantity), 0) - COALESCE(SUM(e.quantity), 0)) AS remaining_qty,
    CASE 
        WHEN (COALESCE(SUM(r.quantity), 0) - COALESCE(SUM(e.quantity), 0)) <= 0 THEN 'Out of Stock'
        WHEN (COALESCE(SUM(r.quantity), 0) - COALESCE(SUM(e.quantity), 0)) <= 5 THEN 'Low Stock'
        ELSE 'In Stock'
    END AS stock_status
FROM public.inventory_items i
JOIN public.units u ON i.unit_id = u.id
LEFT JOIN public.received_transactions r ON i.id = r.item_id
LEFT JOIN public.expended_transactions e ON i.id = e.item_id
GROUP BY i.id, i.item_code, i.item_name, i.category, i.unit_id, u.unit_name, u.location;

-- 9. VERIFICATIONS (Annual verification master)
CREATE TABLE IF NOT EXISTS public.verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    year INT NOT NULL CHECK (year >= 2000 AND year <= 2100),
    verified_by TEXT[] NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
    summary TEXT,
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. VERIFICATION_ITEMS (Item line records in verification)
CREATE TABLE IF NOT EXISTS public.verification_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL REFERENCES public.verifications(id) ON DELETE CASCADE,
    item_code VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(150),
    system_qty NUMERIC(12, 2) NOT NULL DEFAULT 0,
    physical_qty NUMERIC(12, 2) NOT NULL DEFAULT 0,
    difference NUMERIC(12, 2) GENERATED ALWAYS AS (physical_qty - system_qty) STORED,
    condition VARCHAR(50) NOT NULL DEFAULT 'Good' CHECK (condition IN ('Good', 'Fair', 'Damaged', 'Obsolete', 'Needs Repair')),
    label_no VARCHAR(100),
    remarks TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Not Counted' CHECK (status IN ('Not Counted', 'Counted', 'Discrepancy')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. ISSUED_DESTROYED_ITEMS (Items written off or scrapped during/outside verification)
CREATE TABLE IF NOT EXISTS public.issued_destroyed_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    disposition VARCHAR(100) NOT NULL CHECK (disposition IN ('Destroyed', 'Auctioned', 'Scrapped', 'Transferred', 'Written Off')),
    reason TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    verification_id UUID REFERENCES public.verifications(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_inventory_unit_id ON public.inventory_items(unit_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_item_code ON public.inventory_items(item_code);
CREATE INDEX IF NOT EXISTS idx_received_unit_date ON public.received_transactions(unit_id, date);
CREATE INDEX IF NOT EXISTS idx_received_item_id ON public.received_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_expended_unit_date ON public.expended_transactions(unit_id, date);
CREATE INDEX IF NOT EXISTS idx_expended_item_id ON public.expended_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_user_units_user ON public.user_units(user_id);
CREATE INDEX IF NOT EXISTS idx_user_units_unit ON public.user_units(unit_id);
CREATE INDEX IF NOT EXISTS idx_verifications_unit_year ON public.verifications(unit_id, year);
CREATE INDEX IF NOT EXISTS idx_verification_items_verif ON public.verification_items(verification_id);
