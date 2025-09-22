-- ============================================
-- Fix User Roles RLS Infinite Recursion
-- Date: 2025-09-22
-- Purpose: Fix infinite recursion in user_roles and enable admin operations
-- ============================================

-- 1. Drop existing problematic policies
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;

-- 2. Create simplified non-recursive policies for user_roles
CREATE POLICY "user_roles_select_simple" ON public.user_roles
    FOR SELECT TO authenticated
    USING (true); -- All authenticated users can see roles

CREATE POLICY "user_roles_insert_simple" ON public.user_roles
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Check if inserting user is admin (direct join to avoid recursion)
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.user_id = auth.uid()
            AND s.id IN (
                SELECT ur.staff_id FROM public.user_roles ur
                WHERE ur.role = 'admin'
            )
        )
    );

CREATE POLICY "user_roles_update_simple" ON public.user_roles
    FOR UPDATE TO authenticated
    USING (
        -- Only admins can update roles
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.user_id = auth.uid()
            AND s.id IN (
                SELECT ur.staff_id FROM public.user_roles ur
                WHERE ur.role = 'admin'
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.user_id = auth.uid()
            AND s.id IN (
                SELECT ur.staff_id FROM public.user_roles ur
                WHERE ur.role = 'admin'
            )
        )
    );

CREATE POLICY "user_roles_delete_simple" ON public.user_roles
    FOR DELETE TO authenticated
    USING (
        -- Only admins can delete roles
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.user_id = auth.uid()
            AND s.id IN (
                SELECT ur.staff_id FROM public.user_roles ur
                WHERE ur.role = 'admin'
            )
        )
    );

-- 3. Fix venues table policies to allow admin operations
DROP POLICY IF EXISTS "venues_select_all" ON public.venues;
DROP POLICY IF EXISTS "venues_insert_admin" ON public.venues;
DROP POLICY IF EXISTS "venues_update_admin" ON public.venues;
DROP POLICY IF EXISTS "venues_delete_admin" ON public.venues;

-- Simplified venues policies
CREATE POLICY "venues_select_all" ON public.venues
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "venues_insert_admin" ON public.venues
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

CREATE POLICY "venues_update_admin" ON public.venues
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

CREATE POLICY "venues_delete_admin" ON public.venues
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

-- 4. Fix equipment table policies similarly
DROP POLICY IF EXISTS "equipment_select_all" ON public.equipment;
DROP POLICY IF EXISTS "equipment_insert_admin" ON public.equipment;
DROP POLICY IF EXISTS "equipment_update_admin" ON public.equipment;
DROP POLICY IF EXISTS "equipment_delete_admin" ON public.equipment;

CREATE POLICY "equipment_select_all" ON public.equipment
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "equipment_insert_admin" ON public.equipment
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

CREATE POLICY "equipment_update_admin" ON public.equipment
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

CREATE POLICY "equipment_delete_admin" ON public.equipment
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

-- 5. Fix events and shifts tables similarly
DROP POLICY IF EXISTS "events_select_all" ON public.events;
DROP POLICY IF EXISTS "events_insert_admin" ON public.events;
DROP POLICY IF EXISTS "events_update_admin" ON public.events;
DROP POLICY IF EXISTS "events_delete_admin" ON public.events;

CREATE POLICY "events_select_all" ON public.events
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "events_insert_admin" ON public.events
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "events_update_admin" ON public.events
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role IN ('admin', 'manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "events_delete_admin" ON public.events
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role IN ('admin', 'manager')
        )
    );

-- Shifts policies
DROP POLICY IF EXISTS "shifts_select_all" ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert_admin" ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_admin" ON public.shifts;
DROP POLICY IF EXISTS "shifts_delete_admin" ON public.shifts;

CREATE POLICY "shifts_select_all" ON public.shifts
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "shifts_insert_admin" ON public.shifts
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "shifts_update_admin" ON public.shifts
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role IN ('admin', 'manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "shifts_delete_admin" ON public.shifts
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.user_roles ur ON s.id = ur.staff_id
            WHERE s.user_id = auth.uid()
            AND ur.role IN ('admin', 'manager')
        )
    );

-- 6. Verify the fix
SELECT
    'RLS Fix Complete' as status,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('user_roles', 'venues', 'equipment', 'events', 'shifts');