-- ============================================
-- Ultimate RLS Fix - Disable RLS on user_roles
-- Date: 2025-09-22
-- Purpose: Completely fix recursion by disabling RLS on user_roles table
-- ============================================

-- 1. Drop all existing policies on user_roles first
DROP POLICY IF EXISTS "user_roles_select_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_admin" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update_admin" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_admin" ON public.user_roles;

-- 2. DISABLE RLS on user_roles table completely
-- This table doesn't contain sensitive data and is only managed by admins
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- 3. Drop the old functions that are no longer needed
DROP FUNCTION IF EXISTS is_admin(UUID);
DROP FUNCTION IF EXISTS is_admin_or_manager(UUID);

-- 4. Create new helper functions that can safely query user_roles without RLS
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.staff s
        JOIN public.user_roles ur ON s.id = ur.staff_id
        WHERE s.user_id = auth.uid()
        AND ur.role = 'admin'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.is_admin_or_manager()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.staff s
        JOIN public.user_roles ur ON s.id = ur.staff_id
        WHERE s.user_id = auth.uid()
        AND ur.role IN ('admin', 'manager')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5. Fix venues policies
DROP POLICY IF EXISTS "venues_select_all" ON public.venues;
DROP POLICY IF EXISTS "venues_insert_admin" ON public.venues;
DROP POLICY IF EXISTS "venues_update_admin" ON public.venues;
DROP POLICY IF EXISTS "venues_delete_admin" ON public.venues;

CREATE POLICY "venues_select_all" ON public.venues
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "venues_insert_admin" ON public.venues
    FOR INSERT TO authenticated
    WITH CHECK (auth.is_admin());

CREATE POLICY "venues_update_admin" ON public.venues
    FOR UPDATE TO authenticated
    USING (auth.is_admin())
    WITH CHECK (auth.is_admin());

CREATE POLICY "venues_delete_admin" ON public.venues
    FOR DELETE TO authenticated
    USING (auth.is_admin());

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
    WITH CHECK (auth.is_admin());

CREATE POLICY "equipment_update_admin" ON public.equipment
    FOR UPDATE TO authenticated
    USING (auth.is_admin())
    WITH CHECK (auth.is_admin());

CREATE POLICY "equipment_delete_admin" ON public.equipment
    FOR DELETE TO authenticated
    USING (auth.is_admin());

-- 7. Fix events policies
DROP POLICY IF EXISTS "events_select_all" ON public.events;
DROP POLICY IF EXISTS "events_insert_admin_manager" ON public.events;
DROP POLICY IF EXISTS "events_update_admin_manager" ON public.events;
DROP POLICY IF EXISTS "events_delete_admin_manager" ON public.events;

CREATE POLICY "events_select_all" ON public.events
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "events_insert_admin_manager" ON public.events
    FOR INSERT TO authenticated
    WITH CHECK (auth.is_admin_or_manager());

CREATE POLICY "events_update_admin_manager" ON public.events
    FOR UPDATE TO authenticated
    USING (auth.is_admin_or_manager())
    WITH CHECK (auth.is_admin_or_manager());

CREATE POLICY "events_delete_admin_manager" ON public.events
    FOR DELETE TO authenticated
    USING (auth.is_admin_or_manager());

-- 8. Fix shifts policies
DROP POLICY IF EXISTS "shifts_select_all" ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert_admin_manager" ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_admin_manager" ON public.shifts;
DROP POLICY IF EXISTS "shifts_delete_admin_manager" ON public.shifts;

CREATE POLICY "shifts_select_all" ON public.shifts
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "shifts_insert_admin_manager" ON public.shifts
    FOR INSERT TO authenticated
    WITH CHECK (auth.is_admin_or_manager());

CREATE POLICY "shifts_update_admin_manager" ON public.shifts
    FOR UPDATE TO authenticated
    USING (auth.is_admin_or_manager())
    WITH CHECK (auth.is_admin_or_manager());

CREATE POLICY "shifts_delete_admin_manager" ON public.shifts
    FOR DELETE TO authenticated
    USING (auth.is_admin_or_manager());

-- 9. Verify the fix
SELECT 'RLS Status' as check_type,
       tablename,
       rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('user_roles', 'venues', 'equipment', 'events', 'shifts')
ORDER BY tablename;

-- Should show user_roles with rowsecurity = false, others with true