-- ====================================================================
-- EDL IMS Database Migration 05: Remove Public Self-Registration
-- Electricity Distribution Lanka (Pvt) Ltd
-- ====================================================================

-- 1. Lock down profiles INSERT policy: Only Super Admin and Local Admin can insert
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;

CREATE POLICY "profiles_insert_policy" ON public.profiles
    FOR INSERT WITH CHECK (
        public.current_user_role() IN ('super_admin', 'local_admin')
    );

-- 2. Update field lock trigger to raise an error if non-admin attempts profile INSERT
CREATE OR REPLACE FUNCTION public.enforce_profile_field_lock()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip restrictions if caller is backend service role
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF public.current_user_role() IS DISTINCT FROM 'super_admin'
           AND public.current_user_role() IS DISTINCT FROM 'local_admin' THEN
            RAISE EXCEPTION 'Public self-registration is disabled. Profiles must only be created by an Administrator.'
                USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF public.current_user_role() IS DISTINCT FROM 'super_admin'
           AND public.current_user_role() IS DISTINCT FROM 'local_admin' THEN
            NEW.role := OLD.role;
            NEW.permission_level := OLD.permission_level;
            NEW.account_status := OLD.account_status;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
