-- ============================================
-- MVP Migration Script - Execute All Changes
-- Date: 2025-01-20
-- Purpose: Apply all MVP changes in the correct order
--
-- INSTRUCTIONS:
-- 1. Backup your database first
-- 2. Execute this script in Supabase SQL Editor
-- 3. Verify each section completes successfully
-- ============================================

-- ============================================
-- SECTION 1: Rename roles to skills and expand types
-- ============================================

BEGIN;

-- Step 1: Create new skills table with 4 skill types
CREATE TABLE IF NOT EXISTS public.skills (
  id serial PRIMARY KEY,
  code text UNIQUE NOT NULL CHECK (code IN ('pa', 'sound_operator', 'lighting', 'backstage')),
  label text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Step 2: Insert the 4 skill types
INSERT INTO public.skills (code, label, description) VALUES
  ('pa', 'PA', 'PAシステムの操作・音響調整'),
  ('sound_operator', '音源再生マニピュレーター', '音源の再生・タイミング管理'),
  ('lighting', '照明', '照明機材の操作・演出'),
  ('backstage', 'バックヤード', '舞台裏の準備・サポート')
ON CONFLICT (code) DO NOTHING;

-- Step 3: Add skill_id to shifts table
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS skill_id int;

-- Step 4: Map existing shifts to new skills
UPDATE public.shifts sh
SET skill_id = CASE
  WHEN r.code = 'lighting' THEN (SELECT id FROM public.skills WHERE code = 'lighting')
  WHEN r.code = 'rigging' THEN (SELECT id FROM public.skills WHERE code = 'backstage')
END
FROM public.roles r
WHERE sh.role_id = r.id;

-- Step 5: Create staff_skills junction table
CREATE TABLE IF NOT EXISTS public.staff_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  skill_id int NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  proficiency_level int DEFAULT 3 CHECK (proficiency_level BETWEEN 1 AND 5),
  certified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(staff_id, skill_id)
);

-- Step 6: Create indexes
CREATE INDEX IF NOT EXISTS idx_staff_skills_staff_id ON public.staff_skills(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_skills_skill_id ON public.staff_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_shifts_skill_id ON public.shifts(skill_id);

COMMIT;

-- ============================================
-- SECTION 2: Fix attendance_punch function
-- ============================================

BEGIN;

-- Drop incorrect function
DROP FUNCTION IF EXISTS attendance_punch_v2;

-- Create correct function
CREATE OR REPLACE FUNCTION public.attendance_punch(
  p_staff_uid UUID,
  p_shift_id UUID,
  p_equipment_qr TEXT,
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_purpose TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff_id UUID;
  v_attendance_id UUID;
  v_result JSON;
BEGIN
  -- Get staff_id from user_id
  SELECT id INTO v_staff_id FROM staff WHERE user_id = p_staff_uid;

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Staff record not found for user %', p_staff_uid;
  END IF;

  -- Check assignment
  IF NOT EXISTS (
    SELECT 1 FROM assignments
    WHERE staff_id = v_staff_id AND shift_id = p_shift_id AND status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'No confirmed assignment found for this shift';
  END IF;

  -- Get existing attendance
  SELECT id INTO v_attendance_id
  FROM attendances
  WHERE staff_id = v_staff_id AND shift_id = p_shift_id;

  IF p_purpose = 'checkin' THEN
    IF v_attendance_id IS NOT NULL AND (
      SELECT check_in_ts FROM attendances WHERE id = v_attendance_id
    ) IS NOT NULL THEN
      RAISE EXCEPTION 'Already checked in for this shift';
    END IF;

    IF v_attendance_id IS NULL THEN
      INSERT INTO attendances (
        staff_id, shift_id, check_in_ts, check_in_lat, check_in_lon,
        check_in_equipment_qr, status
      ) VALUES (
        v_staff_id, p_shift_id, NOW(), p_lat, p_lon, p_equipment_qr, 'pending'
      ) RETURNING id INTO v_attendance_id;
    ELSE
      UPDATE attendances
      SET check_in_ts = NOW(), check_in_lat = p_lat, check_in_lon = p_lon,
          check_in_equipment_qr = p_equipment_qr, updated_at = NOW()
      WHERE id = v_attendance_id;
    END IF;

    v_result := json_build_object(
      'attendance_id', v_attendance_id, 'purpose', 'checkin',
      'timestamp', NOW(), 'status', 'success'
    );

  ELSIF p_purpose = 'checkout' THEN
    IF v_attendance_id IS NULL THEN
      RAISE EXCEPTION 'No attendance record found for this shift';
    END IF;

    IF (SELECT check_in_ts FROM attendances WHERE id = v_attendance_id) IS NULL THEN
      RAISE EXCEPTION 'Must check in before checking out';
    END IF;

    IF (SELECT check_out_ts FROM attendances WHERE id = v_attendance_id) IS NOT NULL THEN
      RAISE EXCEPTION 'Already checked out for this shift';
    END IF;

    UPDATE attendances
    SET check_out_ts = NOW(), check_out_lat = p_lat, check_out_lon = p_lon,
        check_out_equipment_qr = p_equipment_qr, updated_at = NOW()
    WHERE id = v_attendance_id;

    v_result := json_build_object(
      'attendance_id', v_attendance_id, 'purpose', 'checkout',
      'timestamp', NOW(), 'status', 'success'
    );

  ELSE
    RAISE EXCEPTION 'Invalid purpose: %. Must be "checkin" or "checkout"', p_purpose;
  END IF;

  RETURN v_result;
END;
$$;

COMMIT;

-- ============================================
-- SECTION 3: Create staff_schedules table
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  monday jsonb DEFAULT '{"available": false}',
  tuesday jsonb DEFAULT '{"available": false}',
  wednesday jsonb DEFAULT '{"available": false}',
  thursday jsonb DEFAULT '{"available": false}',
  friday jsonb DEFAULT '{"available": false}',
  saturday jsonb DEFAULT '{"available": false}',
  sunday jsonb DEFAULT '{"available": false}',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(staff_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_id ON public.staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_week_start ON public.staff_schedules(week_start_date);

-- Get staff availability function
CREATE OR REPLACE FUNCTION get_staff_availability(p_date date)
RETURNS TABLE (
  staff_id uuid,
  staff_name text,
  is_available boolean,
  time_from time,
  time_to time,
  notes text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS staff_id,
    s.name AS staff_name,
    CASE EXTRACT(DOW FROM p_date)
      WHEN 0 THEN (ss.sunday->>'available')::boolean
      WHEN 1 THEN (ss.monday->>'available')::boolean
      WHEN 2 THEN (ss.tuesday->>'available')::boolean
      WHEN 3 THEN (ss.wednesday->>'available')::boolean
      WHEN 4 THEN (ss.thursday->>'available')::boolean
      WHEN 5 THEN (ss.friday->>'available')::boolean
      WHEN 6 THEN (ss.saturday->>'available')::boolean
    END AS is_available,
    CASE EXTRACT(DOW FROM p_date)
      WHEN 0 THEN (ss.sunday->>'time_from')::time
      WHEN 1 THEN (ss.monday->>'time_from')::time
      WHEN 2 THEN (ss.tuesday->>'time_from')::time
      WHEN 3 THEN (ss.wednesday->>'time_from')::time
      WHEN 4 THEN (ss.thursday->>'time_from')::time
      WHEN 5 THEN (ss.friday->>'time_from')::time
      WHEN 6 THEN (ss.saturday->>'time_from')::time
    END AS time_from,
    CASE EXTRACT(DOW FROM p_date)
      WHEN 0 THEN (ss.sunday->>'time_to')::time
      WHEN 1 THEN (ss.monday->>'time_to')::time
      WHEN 2 THEN (ss.tuesday->>'time_to')::time
      WHEN 3 THEN (ss.wednesday->>'time_to')::time
      WHEN 4 THEN (ss.thursday->>'time_to')::time
      WHEN 5 THEN (ss.friday->>'time_to')::time
      WHEN 6 THEN (ss.saturday->>'time_to')::time
    END AS time_to,
    ss.notes
  FROM public.staff s
  LEFT JOIN public.staff_schedules ss ON s.id = ss.staff_id
    AND p_date >= ss.week_start_date
    AND p_date <= ss.week_end_date
  WHERE s.active = true
  ORDER BY s.name;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================
-- SECTION 4: Create reserve pool management
-- ============================================

BEGIN;

-- Add is_reserve column to assignments (reusing existing fallback concept)
ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS is_reserve boolean DEFAULT false;

-- Create function to notify reserves
CREATE OR REPLACE FUNCTION notify_reserve_staff(p_shift_id uuid)
RETURNS TABLE (
  staff_id uuid,
  staff_name text,
  notification_sent boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS staff_id,
    s.name AS staff_name,
    true AS notification_sent -- Will be implemented with actual notification logic
  FROM public.assignments a
  JOIN public.staff s ON a.staff_id = s.id
  WHERE a.shift_id = p_shift_id
    AND a.is_reserve = true
    AND a.status = 'candidate'
  ORDER BY a.score DESC; -- Notify in priority order
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================
-- SECTION 5: Create shift requirements validation
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION validate_shift_requirements(p_event_id uuid)
RETURNS json AS $$
DECLARE
  v_result json;
  v_all_skills_covered boolean;
  v_multi_skill_staff_exists boolean;
  v_staff_count int;
BEGIN
  -- Check if all 4 skills are covered
  SELECT COUNT(DISTINCT sk.id) = 4 INTO v_all_skills_covered
  FROM public.skills sk
  WHERE EXISTS (
    SELECT 1 FROM public.shifts sh
    JOIN public.assignments a ON sh.id = a.shift_id
    JOIN public.staff_skills ss ON a.staff_id = ss.staff_id
    WHERE sh.event_id = p_event_id
      AND a.status = 'confirmed'
      AND ss.skill_id = sk.id
  );

  -- Count confirmed staff
  SELECT COUNT(DISTINCT a.staff_id) INTO v_staff_count
  FROM public.shifts sh
  JOIN public.assignments a ON sh.id = a.shift_id
  WHERE sh.event_id = p_event_id
    AND a.status = 'confirmed';

  -- Check if multi-skill staff exists when count > 1
  IF v_staff_count > 1 THEN
    SELECT EXISTS (
      SELECT 1 FROM (
        SELECT ss.staff_id, COUNT(DISTINCT ss.skill_id) AS skill_count
        FROM public.shifts sh
        JOIN public.assignments a ON sh.id = a.shift_id
        JOIN public.staff_skills ss ON a.staff_id = ss.staff_id
        WHERE sh.event_id = p_event_id
          AND a.status = 'confirmed'
        GROUP BY ss.staff_id
        HAVING COUNT(DISTINCT ss.skill_id) >= 2
      ) multi_skill
    ) INTO v_multi_skill_staff_exists;
  ELSE
    v_multi_skill_staff_exists := true; -- Not required for single staff
  END IF;

  v_result := json_build_object(
    'all_skills_covered', v_all_skills_covered,
    'staff_count', v_staff_count,
    'multi_skill_requirement_met', v_multi_skill_staff_exists,
    'is_valid', v_all_skills_covered AND (v_staff_count = 1 OR v_multi_skill_staff_exists)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if all migrations were successful
SELECT 'Skills table created' AS status, COUNT(*) AS count FROM public.skills;
SELECT 'Staff skills table created' AS status, COUNT(*) AS count FROM public.staff_skills;
SELECT 'Staff schedules table created' AS status, COUNT(*) AS count FROM public.staff_schedules;
SELECT 'Attendance punch function exists' AS status,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'attendance_punch') AS exists;

-- ============================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================
-- To rollback these changes, uncomment and run:
/*
DROP TABLE IF EXISTS public.staff_schedules CASCADE;
DROP TABLE IF EXISTS public.staff_skills CASCADE;
DROP TABLE IF EXISTS public.skills CASCADE;
DROP FUNCTION IF EXISTS public.attendance_punch;
DROP FUNCTION IF EXISTS public.get_staff_availability;
DROP FUNCTION IF EXISTS public.notify_reserve_staff;
DROP FUNCTION IF EXISTS public.validate_shift_requirements;
-- Note: You'll need to restore the original roles table from backup
*/