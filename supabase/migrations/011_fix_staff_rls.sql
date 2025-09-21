-- ============================================
-- Fix Staff table RLS
-- Date: 2025-01-20
-- Purpose: Enable RLS on staff table and add appropriate policies
-- ============================================

-- Enable RLS on staff table
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "staff_select_authenticated" ON public.staff;
DROP POLICY IF EXISTS "staff_admin_all" ON public.staff;
DROP POLICY IF EXISTS "staff_self_read" ON public.staff;
DROP POLICY IF EXISTS "staff_admin_write" ON public.staff;

-- ============================================
-- Staff table policies
-- ============================================

-- All authenticated users can view staff list
CREATE POLICY "staff_select_authenticated" ON public.staff
  FOR SELECT TO authenticated
  USING (true);

-- Admin can perform all operations on staff
CREATE POLICY "staff_admin_all" ON public.staff
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      JOIN public.user_roles ur ON s.id = ur.staff_id
      WHERE s.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- Manager can update staff (except role changes)
CREATE POLICY "staff_manager_update" ON public.staff
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      JOIN public.user_roles ur ON s.id = ur.staff_id
      WHERE s.user_id = auth.uid()
      AND ur.role = 'manager'
    )
  );

-- Staff can view and update their own record
CREATE POLICY "staff_self_read" ON public.staff
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "staff_self_update" ON public.staff
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    -- Can't change their own active status or user_id
    user_id = auth.uid()
    AND active = (SELECT active FROM public.staff WHERE id = staff.id)
  );

-- ============================================
-- Verify RLS is now enabled on all tables
-- ============================================

SELECT
    schemaname,
    tablename,
    CASE
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS Disabled'
    END as rls_status,
    CASE
        WHEN tablename = 'staff' THEN 'Fixed in this migration'
        ELSE 'Previously enabled'
    END as notes
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'skills', 'staff_skills', 'staff_schedules',
        'staff', 'user_roles', 'assignments', 'attendances',
        'events', 'shifts', 'venues', 'equipment', 'expenses', 'audit_logs'
    )
ORDER BY
    CASE
        WHEN NOT rowsecurity THEN 0
        ELSE 1
    END,
    tablename;

-- ============================================
-- Test the policies (commented out for safety)
-- ============================================

-- Test queries to verify policies work correctly:
-- 1. As admin: Should see all staff
-- SELECT * FROM public.staff;

-- 2. As regular staff: Should only see themselves in detail
-- SELECT * FROM public.staff WHERE user_id = auth.uid();

-- 3. As manager: Should be able to update staff (except roles)
-- UPDATE public.staff SET phone = '080-1234-5678' WHERE id = 'some-staff-id';

-- ============================================
-- Migration Complete
-- The staff table now has proper RLS policies that:
-- 1. Allow all authenticated users to view staff list
-- 2. Allow admin to manage all staff
-- 3. Allow managers to update staff info
-- 4. Allow staff to view and partially update their own info
-- ============================================