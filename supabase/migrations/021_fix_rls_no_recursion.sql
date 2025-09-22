-- ============================================
-- Fix RLS Without Any Recursion
-- Date: 2025-09-22
-- Purpose: Completely eliminate recursion by using service role for admin checks
-- ============================================

-- 1. First, disable RLS temporarily for user_roles to avoid issues
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies on user_roles
DROP POLICY IF EXISTS "user_roles_select_simple" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_simple" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update_simple" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_simple" ON public.user_roles;

-- 3. Re-enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create ultra-simple policies for user_roles (no recursion possible)
CREATE POLICY "user_roles_select_all" ON public.user_roles
    FOR SELECT TO authenticated
    USING (true);

-- For INSERT/UPDATE/DELETE, we'll use a function approach to avoid recursion
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.staff s
        INNER JOIN public.user_roles ur ON s.id = ur.staff_id
        WHERE s.user_id = user_uuid
        AND ur.role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now create policies using the function
CREATE POLICY "user_roles_insert_admin" ON public.user_roles
    FOR INSERT TO authenticated
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "user_roles_update_admin" ON public.user_roles
    FOR UPDATE TO authenticated
    USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "user_roles_delete_admin" ON public.user_roles
    FOR DELETE TO authenticated
    USING (is_admin(auth.uid()));

-- 5. Fix venues policies using the same function
DROP POLICY IF EXISTS "venues_select_all" ON public.venues;
DROP POLICY IF EXISTS "venues_insert_admin" ON public.venues;
DROP POLICY IF EXISTS "venues_update_admin" ON public.venues;
DROP POLICY IF EXISTS "venues_delete_admin" ON public.venues;

CREATE POLICY "venues_select_all" ON public.venues
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "venues_insert_admin" ON public.venues
    FOR INSERT TO authenticated
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "venues_update_admin" ON public.venues
    FOR UPDATE TO authenticated
    USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "venues_delete_admin" ON public.venues
    FOR DELETE TO authenticated
    USING (is_admin(auth.uid()));

-- 6. Fix equipment policies
DROP POLICY IF EXISTS "equipment_select_all" ON public.equipment;
DROP POLICY IF EXISTS "equipment_insert_admin" ON public.equipment;
DROP POLICY IF EXISTS "equipment_update_admin" ON public.equipment;
DROP POLICY IF EXISTS "equipment_delete_admin" ON public.equipment;

CREATE POLICY "equipment_select_all" ON public.equipment
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "equipment_insert_admin" ON public.equipment
    FOR INSERT TO authenticated
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "equipment_update_admin" ON public.equipment
    FOR UPDATE TO authenticated
    USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "equipment_delete_admin" ON public.equipment
    FOR DELETE TO authenticated
    USING (is_admin(auth.uid()));

-- 7. Create a similar function for admin or manager check
CREATE OR REPLACE FUNCTION is_admin_or_manager(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.staff s
        INNER JOIN public.user_roles ur ON s.id = ur.staff_id
        WHERE s.user_id = user_uuid
        AND ur.role IN ('admin', 'manager')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Fix events policies
DROP POLICY IF EXISTS "events_select_all" ON public.events;
DROP POLICY IF EXISTS "events_insert_admin" ON public.events;
DROP POLICY IF EXISTS "events_update_admin" ON public.events;
DROP POLICY IF EXISTS "events_delete_admin" ON public.events;

CREATE POLICY "events_select_all" ON public.events
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "events_insert_admin_manager" ON public.events
    FOR INSERT TO authenticated
    WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "events_update_admin_manager" ON public.events
    FOR UPDATE TO authenticated
    USING (is_admin_or_manager(auth.uid()))
    WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "events_delete_admin_manager" ON public.events
    FOR DELETE TO authenticated
    USING (is_admin_or_manager(auth.uid()));

-- 9. Fix shifts policies
DROP POLICY IF EXISTS "shifts_select_all" ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert_admin" ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_admin" ON public.shifts;
DROP POLICY IF EXISTS "shifts_delete_admin" ON public.shifts;

CREATE POLICY "shifts_select_all" ON public.shifts
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "shifts_insert_admin_manager" ON public.shifts
    FOR INSERT TO authenticated
    WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "shifts_update_admin_manager" ON public.shifts
    FOR UPDATE TO authenticated
    USING (is_admin_or_manager(auth.uid()))
    WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "shifts_delete_admin_manager" ON public.shifts
    FOR DELETE TO authenticated
    USING (is_admin_or_manager(auth.uid()));

-- 10. Verify the fix
SELECT 'Functions created' as status,
       COUNT(*) as function_count
FROM pg_proc
WHERE proname IN ('is_admin', 'is_admin_or_manager');

SELECT 'Policies created' as status,
       tablename,
       policyname,
       cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('user_roles', 'venues', 'equipment', 'events', 'shifts')
ORDER BY tablename, cmd;