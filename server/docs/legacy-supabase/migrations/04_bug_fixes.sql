-- ====================================================================
-- EDL IMS Database Migration 04: Security Bug Fixes
-- Electricity Distribution Lanka (Pvt) Ltd
-- ====================================================================

-- ---------------------------------------------------------------------
-- BUG 1 & 2 FIX: Enforce Profile Field Lock on Self-Signup and Self-Update
-- Prevents unauthorized role escalation to super_admin or local_admin
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_profile_field_lock()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip restrictions if caller is backend using service_role key
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF public.current_user_role() IS DISTINCT FROM 'super_admin'
           AND public.current_user_role() IS DISTINCT FROM 'local_admin' THEN
            NEW.role := 'employee';
            NEW.permission_level := 'no_permission';
            NEW.account_status := 'active';
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

DROP TRIGGER IF EXISTS trg_enforce_profile_field_lock ON public.profiles;
CREATE TRIGGER trg_enforce_profile_field_lock
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_field_lock();


-- ---------------------------------------------------------------------
-- BUG 3 FIX: Permission-Level Gating for Verification Items
-- Split single policy into separate SELECT and WRITE policies
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "verification_items_policy" ON public.verification_items;

CREATE POLICY "verification_items_select_policy" ON public.verification_items
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.verifications v
        WHERE v.id = verification_id
        AND public.has_unit_access(v.unit_id)
        AND COALESCE(public.current_user_permission(), 'read_write') != 'no_permission'
    )
);

CREATE POLICY "verification_items_write_policy" ON public.verification_items
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.verifications v
        WHERE v.id = verification_id
        AND v.status = 'draft'
        AND public.has_unit_access(v.unit_id)
        AND (
            public.current_user_role() IN ('super_admin', 'local_admin', 'unit_head')
            OR (public.current_user_role() = 'employee' AND public.current_user_permission() = 'read_write')
        )
    )
);


-- ---------------------------------------------------------------------
-- BUG 4 FIX: Seed Matching auth.identities Rows for Supabase Auth
-- Ensures email/password signInWithPassword() succeeds for seeded users
-- ---------------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities') THEN
        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id,
            last_sign_in_at, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            u.id,
            jsonb_build_object('sub', u.id::text, 'email', u.email),
            'email',
            u.id::text,
            NOW(), NOW(), NOW()
        FROM auth.users u
        WHERE u.email IN (
            'admin@edl.lk', 'colombo.admin@edl.lk', 'head.kelaniya@edl.lk',
            'emp.rw@edl.lk', 'emp.ro@edl.lk', 'emp.none@edl.lk'
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
