-- ====================================================================
-- EDL IMS Database Migration 05: Unrestricted System-Wide Location Access for Local Admin
-- Electricity Distribution Lanka (Pvt) Ltd
-- ====================================================================

-- 1. Redefine has_unit_access to grant both super_admin and local_admin unrestricted unit access
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

-- 2. Update units_select_policy so local_admin can select all units system-wide
DROP POLICY IF EXISTS "units_select_policy" ON public.units;

CREATE POLICY "units_select_policy" ON public.units
    FOR SELECT USING (
        public.current_user_role() IN ('super_admin', 'local_admin')
        OR EXISTS (
            SELECT 1 FROM public.user_units uu
            WHERE uu.user_id = auth.uid() AND uu.unit_id = id
        )
    );
