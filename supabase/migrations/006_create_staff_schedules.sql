-- ============================================
-- Create staff_schedules table for weekly availability
-- Date: 2025-01-20
-- Purpose: Allow staff to register their weekly availability
-- ============================================

-- Create staff_schedules table
CREATE TABLE IF NOT EXISTS public.staff_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,

  -- Availability for each day of the week (JSON format for flexibility)
  -- Format: {"time_from": "13:00", "time_to": "21:00", "available": true}
  monday jsonb DEFAULT '{"available": false}',
  tuesday jsonb DEFAULT '{"available": false}',
  wednesday jsonb DEFAULT '{"available": false}',
  thursday jsonb DEFAULT '{"available": false}',
  friday jsonb DEFAULT '{"available": false}',
  saturday jsonb DEFAULT '{"available": false}',
  sunday jsonb DEFAULT '{"available": false}',

  -- Additional notes from staff
  notes text,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure one schedule per staff per week
  UNIQUE(staff_id, week_start_date)
);

-- Create indexes for performance
CREATE INDEX idx_staff_schedules_staff_id ON public.staff_schedules(staff_id);
CREATE INDEX idx_staff_schedules_week_start ON public.staff_schedules(week_start_date);
CREATE INDEX idx_staff_schedules_week_range ON public.staff_schedules(week_start_date, week_end_date);

-- Create function to validate week dates
CREATE OR REPLACE FUNCTION validate_week_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure week_start_date is a Monday
  IF EXTRACT(DOW FROM NEW.week_start_date) != 1 THEN
    RAISE EXCEPTION 'week_start_date must be a Monday';
  END IF;

  -- Ensure week_end_date is exactly 6 days after week_start_date (Sunday)
  IF NEW.week_end_date != NEW.week_start_date + INTERVAL '6 days' THEN
    RAISE EXCEPTION 'week_end_date must be exactly 6 days after week_start_date';
  END IF;

  -- Update the updated_at timestamp
  NEW.updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for validation
CREATE TRIGGER validate_staff_schedule_dates
  BEFORE INSERT OR UPDATE ON public.staff_schedules
  FOR EACH ROW
  EXECUTE FUNCTION validate_week_dates();

-- Create function to get staff availability for a specific date
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

-- Create function to copy schedule to next week
CREATE OR REPLACE FUNCTION copy_schedule_to_next_week(p_staff_id uuid, p_current_week_start date)
RETURNS uuid AS $$
DECLARE
  v_new_schedule_id uuid;
  v_current_schedule record;
BEGIN
  -- Get current week's schedule
  SELECT * INTO v_current_schedule
  FROM public.staff_schedules
  WHERE staff_id = p_staff_id
    AND week_start_date = p_current_week_start;

  IF v_current_schedule IS NULL THEN
    RAISE EXCEPTION 'No schedule found for the specified week';
  END IF;

  -- Create new schedule for next week
  INSERT INTO public.staff_schedules (
    staff_id,
    week_start_date,
    week_end_date,
    monday,
    tuesday,
    wednesday,
    thursday,
    friday,
    saturday,
    sunday,
    notes
  ) VALUES (
    p_staff_id,
    p_current_week_start + INTERVAL '7 days',
    p_current_week_start + INTERVAL '13 days',
    v_current_schedule.monday,
    v_current_schedule.tuesday,
    v_current_schedule.wednesday,
    v_current_schedule.thursday,
    v_current_schedule.friday,
    v_current_schedule.saturday,
    v_current_schedule.sunday,
    v_current_schedule.notes
  )
  ON CONFLICT (staff_id, week_start_date) DO UPDATE
  SET
    monday = EXCLUDED.monday,
    tuesday = EXCLUDED.tuesday,
    wednesday = EXCLUDED.wednesday,
    thursday = EXCLUDED.thursday,
    friday = EXCLUDED.friday,
    saturday = EXCLUDED.saturday,
    sunday = EXCLUDED.sunday,
    notes = EXCLUDED.notes,
    updated_at = NOW()
  RETURNING id INTO v_new_schedule_id;

  RETURN v_new_schedule_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE public.staff_schedules IS 'スタッフの週次稼働可能スケジュール';
COMMENT ON COLUMN public.staff_schedules.monday IS '月曜日の稼働可能時間 (JSON形式: {available, time_from, time_to})';
COMMENT ON FUNCTION get_staff_availability IS '指定日のスタッフ稼働可能状況を取得';
COMMENT ON FUNCTION copy_schedule_to_next_week IS '現在週のスケジュールを翌週にコピー';

-- ============================================
-- Migration Complete
-- Usage examples:
--
-- 1. Register weekly availability:
-- INSERT INTO staff_schedules (staff_id, week_start_date, week_end_date, monday, tuesday, wednesday)
-- VALUES ('staff-uuid', '2025-01-20', '2025-01-26',
--   '{"available": true, "time_from": "13:00", "time_to": "21:00"}',
--   '{"available": true, "time_from": "13:00", "time_to": "21:00"}',
--   '{"available": false}'
-- );
--
-- 2. Get available staff for a date:
-- SELECT * FROM get_staff_availability('2025-01-22');
--
-- 3. Copy schedule to next week:
-- SELECT copy_schedule_to_next_week('staff-uuid', '2025-01-20');
-- ============================================