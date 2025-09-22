-- ============================================
-- Complete RLS Rebuild from Scratch
-- Date: 2025-09-22
-- Purpose: Clean slate RLS implementation without recursion
-- ============================================

-- STEP 1: Drop ALL existing policies and functions
-- ================================================

-- Drop all policies on all tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I CASCADE',
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END$$;

-- Drop existing functions with CASCADE
DROP FUNCTION IF EXISTS is_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS is_admin_or_manager(UUID) CASCADE;
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
DROP FUNCTION IF EXISTS auth.is_admin_or_manager() CASCADE;

-- STEP 2: Disable RLS on all tables first
-- ========================================
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_skills DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;

-- STEP 3: Create helper functions in auth schema
-- ===============================================
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Get the role for the current user
    -- This function doesn't use RLS, so no recursion
    SELECT ur.role INTO user_role
    FROM public.staff s
    JOIN public.user_roles ur ON s.id = ur.staff_id
    WHERE s.user_id = auth.uid()
    LIMIT 1;

    RETURN user_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.has_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    user_role := auth.get_user_role();
    RETURN user_role = ANY(required_roles);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- STEP 4: Re-enable RLS on necessary tables
-- ==========================================
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Note: user_roles remains without RLS to avoid recursion

-- STEP 5: Create clean policies for each table
-- =============================================

-- Staff table policies
CREATE POLICY "staff_select" ON public.staff
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "staff_update_self" ON public.staff
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "staff_update_admin" ON public.staff
    FOR UPDATE TO authenticated
    USING (auth.has_role(ARRAY['admin']))
    WITH CHECK (auth.has_role(ARRAY['admin']));

-- Venues table policies
CREATE POLICY "venues_select" ON public.venues
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "venues_insert" ON public.venues
    FOR INSERT TO authenticated
    WITH CHECK (auth.has_role(ARRAY['admin']));

CREATE POLICY "venues_update" ON public.venues
    FOR UPDATE TO authenticated
    USING (auth.has_role(ARRAY['admin']))
    WITH CHECK (auth.has_role(ARRAY['admin']));

CREATE POLICY "venues_delete" ON public.venues
    FOR DELETE TO authenticated
    USING (auth.has_role(ARRAY['admin']));

-- Equipment table policies
CREATE POLICY "equipment_select" ON public.equipment
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "equipment_insert" ON public.equipment
    FOR INSERT TO authenticated
    WITH CHECK (auth.has_role(ARRAY['admin']));

CREATE POLICY "equipment_update" ON public.equipment
    FOR UPDATE TO authenticated
    USING (auth.has_role(ARRAY['admin']))
    WITH CHECK (auth.has_role(ARRAY['admin']));

CREATE POLICY "equipment_delete" ON public.equipment
    FOR DELETE TO authenticated
    USING (auth.has_role(ARRAY['admin']));

-- Events table policies
CREATE POLICY "events_select" ON public.events
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "events_insert" ON public.events
    FOR INSERT TO authenticated
    WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));

CREATE POLICY "events_update" ON public.events
    FOR UPDATE TO authenticated
    USING (auth.has_role(ARRAY['admin', 'manager']))
    WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));

CREATE POLICY "events_delete" ON public.events
    FOR DELETE TO authenticated
    USING (auth.has_role(ARRAY['admin', 'manager']));

-- Shifts table policies
CREATE POLICY "shifts_select" ON public.shifts
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "shifts_insert" ON public.shifts
    FOR INSERT TO authenticated
    WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));

CREATE POLICY "shifts_update" ON public.shifts
    FOR UPDATE TO authenticated
    USING (auth.has_role(ARRAY['admin', 'manager']))
    WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));

CREATE POLICY "shifts_delete" ON public.shifts
    FOR DELETE TO authenticated
    USING (auth.has_role(ARRAY['admin', 'manager']));

-- Assignments table policies
CREATE POLICY "assignments_select" ON public.assignments
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "assignments_insert" ON public.assignments
    FOR INSERT TO authenticated
    WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));

CREATE POLICY "assignments_update" ON public.assignments
    FOR UPDATE TO authenticated
    USING (auth.has_role(ARRAY['admin', 'manager']))
    WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));

CREATE POLICY "assignments_delete" ON public.assignments
    FOR DELETE TO authenticated
    USING (auth.has_role(ARRAY['admin', 'manager']));

-- Attendances table policies
CREATE POLICY "attendances_select" ON public.attendances
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "attendances_insert" ON public.attendances
    FOR INSERT TO authenticated
    WITH CHECK (true); -- Anyone can punch in/out

CREATE POLICY "attendances_update" ON public.attendances
    FOR UPDATE TO authenticated
    USING (auth.has_role(ARRAY['admin', 'manager']))
    WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));

-- QR Tokens table policies
CREATE POLICY "qr_tokens_select" ON public.qr_tokens
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "qr_tokens_insert" ON public.qr_tokens
    FOR INSERT TO authenticated
    WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));

CREATE POLICY "qr_tokens_update" ON public.qr_tokens
    FOR UPDATE TO authenticated
    USING (auth.has_role(ARRAY['admin', 'manager']))
    WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));

-- Skills table policies
CREATE POLICY "skills_select" ON public.skills
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "skills_manage" ON public.skills
    FOR ALL TO authenticated
    USING (auth.has_role(ARRAY['admin']))
    WITH CHECK (auth.has_role(ARRAY['admin']));

-- Staff Skills table policies
CREATE POLICY "staff_skills_select" ON public.staff_skills
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "staff_skills_manage" ON public.staff_skills
    FOR ALL TO authenticated
    USING (auth.has_role(ARRAY['admin', 'manager']))
    WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));

-- Audit logs table policies
CREATE POLICY "audit_logs_select" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (auth.has_role(ARRAY['admin']));

CREATE POLICY "audit_logs_insert" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true); -- System can always write logs

-- STEP 6: Verify the setup
-- ========================
SELECT
    'Tables with RLS enabled' as check_type,
    COUNT(*) as count
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;

SELECT
    'Tables without RLS' as check_type,
    tablename
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false
AND tablename IN ('user_roles', 'staff', 'venues', 'equipment', 'events', 'shifts');

SELECT
    'Functions created' as check_type,
    proname
FROM pg_proc
WHERE pronamespace = 'auth'::regnamespace
AND proname IN ('get_user_role', 'has_role');

-- Final message
SELECT 'RLS Rebuild Complete' as status,
       'user_roles table has RLS disabled to prevent recursion' as note;