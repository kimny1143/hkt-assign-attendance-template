-- ============================================
-- Fix RLS infinite recursion on staff table
-- Date: 2025-09-22
-- Purpose: Remove recursive policies that cause infinite loops
-- ============================================

-- Disable RLS temporarily to clean up
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "staff_select_authenticated" ON public.staff;
DROP POLICY IF EXISTS "staff_admin_all" ON public.staff;
DROP POLICY IF EXISTS "staff_self_read" ON public.staff;
DROP POLICY IF EXISTS "staff_admin_write" ON public.staff;
DROP POLICY IF EXISTS "staff_manager_update" ON public.staff;
DROP POLICY IF EXISTS "staff_self_update" ON public.staff;

-- Re-enable RLS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Create simplified non-recursive policies
-- ============================================

-- Policy 1: All authenticated users can read all staff records
-- This avoids recursion by not checking the staff table itself
CREATE POLICY "anyone_can_read_staff" ON public.staff
  FOR SELECT TO authenticated
  USING (true);

-- Policy 2: Users can update their own record
CREATE POLICY "users_update_own_record" ON public.staff
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy 3: Service role can do everything (for server-side operations)
CREATE POLICY "service_role_all" ON public.staff
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Test query (run in Supabase SQL editor after applying)
-- ============================================
-- SELECT * FROM public.staff LIMIT 5;