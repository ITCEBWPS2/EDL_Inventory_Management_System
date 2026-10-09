-- ====================================================================
-- EDL IMS Database Migration 02: Row Level Security (RLS) Policies
-- Electricity Distribution Lanka (Pvt) Ltd
-- ====================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.received_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expended_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issued_destroyed_items ENABLE ROW LEVEL SECURITY;

-- Helper functions to check caller role & permission
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS VARCHAR AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_permission()
RETURNS VARCHAR AS $$
    SELECT permission_level FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_unit_access(target_unit_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'local_admin')
    ) OR EXISTS (
        SELECT 1 FROM public.user_units uu
        WHERE uu.user_id = auth.uid() AND uu.unit_id = target_unit_id
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ---------------------------------------------------------------------
-- 1. PROFILES POLICIES
-- ---------------------------------------------------------------------
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id 
        OR public.current_user_role() IN ('super_admin', 'local_admin')
    );

CREATE POLICY "profiles_insert_policy" ON public.profiles
    FOR INSERT WITH CHECK (
        public.current_user_role() IN ('super_admin', 'local_admin')
        OR auth.uid() = id
    );

CREATE POLICY "profiles_update_policy" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id
        OR public.current_user_role() IN ('super_admin', 'local_admin')
    );

CREATE POLICY "profiles_delete_policy" ON public.profiles
    FOR DELETE USING (
        public.current_user_role() = 'super_admin'
    );

-- ---------------------------------------------------------------------
-- 2. UNITS & USER_UNITS POLICIES
-- ---------------------------------------------------------------------
CREATE POLICY "units_select_policy" ON public.units
    FOR SELECT USING (
        public.current_user_role() IN ('super_admin', 'local_admin')
        OR EXISTS (
            SELECT 1 FROM public.user_units uu
            WHERE uu.user_id = auth.uid() AND uu.unit_id = id
        )
    );

CREATE POLICY "units_admin_mutation_policy" ON public.units
    FOR ALL USING (
        public.current_user_role() IN ('super_admin', 'local_admin')
    );

CREATE POLICY "user_units_select_policy" ON public.user_units
    FOR SELECT USING (
        user_id = auth.uid()
        OR public.current_user_role() IN ('super_admin', 'local_admin')
    );

CREATE POLICY "user_units_admin_mutation_policy" ON public.user_units
    FOR ALL USING (
        public.current_user_role() IN ('super_admin', 'local_admin')
    );

-- ---------------------------------------------------------------------
-- 3. CATEGORIES POLICIES
-- ---------------------------------------------------------------------
CREATE POLICY "categories_select_policy" ON public.categories
    FOR SELECT USING (true); -- Read-accessible to all authenticated users

CREATE POLICY "categories_admin_policy" ON public.categories
    FOR ALL USING (
        public.current_user_role() IN ('super_admin', 'local_admin')
    );

-- ---------------------------------------------------------------------
-- 4. INVENTORY_ITEMS POLICIES
-- ---------------------------------------------------------------------
CREATE POLICY "inventory_items_select_policy" ON public.inventory_items
    FOR SELECT USING (
        (public.has_unit_access(unit_id) AND COALESCE(public.current_user_permission(), 'read_write') != 'no_permission')
    );

CREATE POLICY "inventory_items_insert_policy" ON public.inventory_items
    FOR INSERT WITH CHECK (
        public.has_unit_access(unit_id)
        AND (
            public.current_user_role() IN ('super_admin', 'local_admin', 'unit_head')
            OR (public.current_user_role() = 'employee' AND public.current_user_permission() = 'read_write')
        )
    );

CREATE POLICY "inventory_items_update_policy" ON public.inventory_items
    FOR UPDATE USING (
        public.has_unit_access(unit_id)
        AND (
            public.current_user_role() IN ('super_admin', 'local_admin', 'unit_head')
            OR (public.current_user_role() = 'employee' AND public.current_user_permission() = 'read_write')
        )
    );

CREATE POLICY "inventory_items_delete_policy" ON public.inventory_items
    FOR DELETE USING (
        public.has_unit_access(unit_id)
        AND public.current_user_role() IN ('super_admin', 'local_admin', 'unit_head')
    );

-- ---------------------------------------------------------------------
-- 5. RECEIVED_TRANSACTIONS POLICIES
-- ---------------------------------------------------------------------
CREATE POLICY "received_transactions_select_policy" ON public.received_transactions
    FOR SELECT USING (
        public.has_unit_access(unit_id)
        AND COALESCE(public.current_user_permission(), 'read_write') != 'no_permission'
    );

CREATE POLICY "received_transactions_insert_policy" ON public.received_transactions
    FOR INSERT WITH CHECK (
        public.has_unit_access(unit_id)
        AND (
            public.current_user_role() IN ('super_admin', 'local_admin', 'unit_head')
            OR (public.current_user_role() = 'employee' AND public.current_user_permission() = 'read_write')
        )
    );

CREATE POLICY "received_transactions_update_delete_policy" ON public.received_transactions
    FOR ALL USING (
        public.has_unit_access(unit_id)
        AND public.current_user_role() IN ('super_admin', 'local_admin', 'unit_head')
    );

-- ---------------------------------------------------------------------
-- 6. EXPENDED_TRANSACTIONS POLICIES
-- ---------------------------------------------------------------------
CREATE POLICY "expended_transactions_select_policy" ON public.expended_transactions
    FOR SELECT USING (
        public.has_unit_access(unit_id)
        AND COALESCE(public.current_user_permission(), 'read_write') != 'no_permission'
    );

CREATE POLICY "expended_transactions_insert_policy" ON public.expended_transactions
    FOR INSERT WITH CHECK (
        public.has_unit_access(unit_id)
        AND (
            public.current_user_role() IN ('super_admin', 'local_admin', 'unit_head')
            OR (public.current_user_role() = 'employee' AND public.current_user_permission() = 'read_write')
        )
    );

CREATE POLICY "expended_transactions_update_delete_policy" ON public.expended_transactions
    FOR ALL USING (
        public.has_unit_access(unit_id)
        AND public.current_user_role() IN ('super_admin', 'local_admin', 'unit_head')
    );

-- ---------------------------------------------------------------------
-- 7. VERIFICATIONS & VERIFICATION ITEMS POLICIES
-- ---------------------------------------------------------------------
CREATE POLICY "verifications_select_policy" ON public.verifications
    FOR SELECT USING (
        public.has_unit_access(unit_id)
        AND COALESCE(public.current_user_permission(), 'read_write') != 'no_permission'
    );

CREATE POLICY "verifications_insert_policy" ON public.verifications
    FOR INSERT WITH CHECK (
        public.has_unit_access(unit_id)
        AND (
            public.current_user_role() IN ('super_admin', 'local_admin', 'unit_head')
            OR (public.current_user_role() = 'employee' AND public.current_user_permission() = 'read_write')
        )
    );

-- Immutable once confirmed!
CREATE POLICY "verifications_update_policy" ON public.verifications
    FOR UPDATE USING (
        public.has_unit_access(unit_id)
        AND status = 'draft'
        AND (
            public.current_user_role() IN ('super_admin', 'local_admin', 'unit_head')
            OR (public.current_user_role() = 'employee' AND public.current_user_permission() = 'read_write')
        )
    );

CREATE POLICY "verification_items_policy" ON public.verification_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.verifications v
            WHERE v.id = verification_id
            AND public.has_unit_access(v.unit_id)
        )
    );

-- ---------------------------------------------------------------------
-- 8. ISSUED_DESTROYED_ITEMS POLICIES
-- ---------------------------------------------------------------------
CREATE POLICY "issued_destroyed_select_policy" ON public.issued_destroyed_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.inventory_items i
            WHERE i.id = item_id AND public.has_unit_access(i.unit_id)
        )
    );

CREATE POLICY "issued_destroyed_insert_policy" ON public.issued_destroyed_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.inventory_items i
            WHERE i.id = item_id 
            AND public.has_unit_access(i.unit_id)
            AND (
                public.current_user_role() IN ('super_admin', 'local_admin', 'unit_head')
                OR (public.current_user_role() = 'employee' AND public.current_user_permission() = 'read_write')
            )
        )
    );
