-- ============================================
-- Setup Row Level Security (RLS) Policies
-- Date: 2025-01-20
-- Purpose: Secure tables with appropriate RLS policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Skills table policies
-- ============================================

-- Everyone can view skills
CREATE POLICY "skills_select_all" ON public.skills
  FOR SELECT TO authenticated
  USING (true);

-- Only admin can insert/update/delete skills
CREATE POLICY "skills_admin_all" ON public.skills
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      JOIN public.user_roles ur ON s.id = ur.staff_id
      WHERE s.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- ============================================
-- Staff_skills table policies
-- ============================================

-- Staff can view all skill assignments
CREATE POLICY "staff_skills_select_all" ON public.staff_skills
  FOR SELECT TO authenticated
  USING (true);

-- Admin and manager can manage skill assignments
CREATE POLICY "staff_skills_admin_manager_all" ON public.staff_skills
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      JOIN public.user_roles ur ON s.id = ur.staff_id
      WHERE s.user_id = auth.uid()
      AND ur.role IN ('admin', 'manager')
    )
  );

-- ============================================
-- Staff_schedules table policies
-- ============================================

-- Staff can view their own schedules
CREATE POLICY "staff_schedules_own_select" ON public.staff_schedules
  FOR SELECT TO authenticated
  USING (
    staff_id IN (
      SELECT id FROM public.staff WHERE user_id = auth.uid()
    )
  );

-- Admin and manager can view all schedules
CREATE POLICY "staff_schedules_admin_manager_select" ON public.staff_schedules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      JOIN public.user_roles ur ON s.id = ur.staff_id
      WHERE s.user_id = auth.uid()
      AND ur.role IN ('admin', 'manager')
    )
  );

-- Staff can insert/update their own schedules
CREATE POLICY "staff_schedules_own_insert_update" ON public.staff_schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    staff_id IN (
      SELECT id FROM public.staff WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "staff_schedules_own_update" ON public.staff_schedules
  FOR UPDATE TO authenticated
  USING (
    staff_id IN (
      SELECT id FROM public.staff WHERE user_id = auth.uid()
    )
  );

-- Staff can delete their own schedules
CREATE POLICY "staff_schedules_own_delete" ON public.staff_schedules
  FOR DELETE TO authenticated
  USING (
    staff_id IN (
      SELECT id FROM public.staff WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Update existing table RLS policies (if needed)
-- ============================================

-- Staff table - already has RLS, but add policies if missing
DO $$
BEGIN
  -- Check if policies exist, if not create them
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff'
    AND policyname = 'staff_select_authenticated'
  ) THEN
    CREATE POLICY "staff_select_authenticated" ON public.staff
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff'
    AND policyname = 'staff_admin_all'
  ) THEN
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
  END IF;
END $$;

-- User_roles table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_select_authenticated" ON public.user_roles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      JOIN public.user_roles ur ON s.id = ur.staff_id
      WHERE s.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- ============================================
-- Verify RLS is enabled
-- ============================================

SELECT
    schemaname,
    tablename,
    CASE
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS Disabled'
    END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'skills', 'staff_skills', 'staff_schedules',
        'staff', 'user_roles', 'assignments', 'attendances',
        'events', 'shifts', 'venues', 'equipment'
    )
ORDER BY
    CASE
        WHEN rowsecurity THEN 1
        ELSE 0
    END DESC,
    tablename;

-- ============================================
-- Migration Complete
-- Note: Some tables like assignments, attendances, events, shifts
-- should already have RLS policies from the original migration.
-- This migration focuses on the new tables added for MVP.
-- ============================================