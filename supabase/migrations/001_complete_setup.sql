-- ============================================
-- HAAS Complete Database Setup
-- Date: 2025-09-22
-- Single consolidated migration file
-- ============================================

-- ============================================
-- PART 1: Extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- PART 2: Enums
-- ============================================
DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM ('candidate','confirmed','declined','fallback');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- PART 3: Core Tables
-- ============================================

-- Venues table
CREATE TABLE IF NOT EXISTS public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  geom GEOGRAPHY(Point,4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
  ) STORED,
  capacity INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skills table (4 types as per requirements)
CREATE TABLE IF NOT EXISTS public.skills (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL
);

-- Insert default skills
INSERT INTO public.skills (code, label) VALUES
  ('pa', 'PA（音響）'),
  ('sound_operator', '音源再生マニピュレーター'),
  ('lighting', '照明'),
  ('backstage', 'バックステージ')
ON CONFLICT (code) DO NOTHING;

-- Staff table
CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  slack_member_id TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  hourly_rate NUMERIC(10,2),
  daily_rate NUMERIC(10,2),
  project_rate NUMERIC(10,2),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipment table
CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qr_code TEXT UNIQUE NOT NULL,
  equipment_type TEXT CHECK (equipment_type IN ('lighting','sound','backstage','other')),
  location_hint TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User roles table (RLS will be DISABLED on this table)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','manager','staff')),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES public.staff(id),
  UNIQUE(staff_id, role)
);

-- Events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  open_time TIME,
  start_time TIME,
  end_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shifts table
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  skill_id INT NOT NULL REFERENCES public.skills(id),
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ NOT NULL,
  required INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff skills junction table
CREATE TABLE IF NOT EXISTS public.staff_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  skill_id INT NOT NULL REFERENCES public.skills(id),
  level INT DEFAULT 3 CHECK (level >= 1 AND level <= 5),
  certified_at TIMESTAMPTZ,
  UNIQUE(staff_id, skill_id)
);

-- Assignments table
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id),
  status assignment_status NOT NULL DEFAULT 'candidate',
  offered_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  UNIQUE(shift_id, staff_id)
);

-- Attendances table
CREATE TABLE IF NOT EXISTS public.attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES public.equipment(id),
  check_in_ts TIMESTAMPTZ,
  check_in_lat DOUBLE PRECISION,
  check_in_lon DOUBLE PRECISION,
  check_in_photo TEXT,
  check_out_ts TIMESTAMPTZ,
  check_out_lat DOUBLE PRECISION,
  check_out_lon DOUBLE PRECISION,
  check_out_photo TEXT,
  break_minutes INT DEFAULT 0,
  status attendance_status DEFAULT 'pending',
  approved_by UUID REFERENCES public.staff(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 4: Views
-- ============================================

-- Payroll export view
CREATE OR REPLACE VIEW public.v_payroll_monthly AS
SELECT
  s.id AS staff_id,
  s.code AS staff_code,
  s.name AS staff_name,
  DATE_TRUNC('month', att.check_in_ts) AS target_month,
  COUNT(DISTINCT DATE(att.check_in_ts)) AS work_days,
  SUM(
    EXTRACT(EPOCH FROM (att.check_out_ts - att.check_in_ts)) / 3600
    - COALESCE(att.break_minutes, 0) / 60.0
  ) AS total_hours,
  SUM(COALESCE(att.break_minutes, 0)) AS total_break_minutes
FROM public.attendances att
JOIN public.assignments asg ON att.assignment_id = asg.id
JOIN public.staff s ON asg.staff_id = s.id
WHERE att.status = 'approved'
AND att.check_in_ts IS NOT NULL
AND att.check_out_ts IS NOT NULL
GROUP BY s.id, s.code, s.name, DATE_TRUNC('month', att.check_in_ts);

-- ============================================
-- PART 5: RLS Helper Functions
-- ============================================

-- Get user role without recursion
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT ur.role INTO user_role
    FROM public.staff s
    JOIN public.user_roles ur ON s.id = ur.staff_id
    WHERE s.user_id = auth.uid()
    LIMIT 1;

    RETURN user_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if user has required role
CREATE OR REPLACE FUNCTION auth.has_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    user_role := auth.get_user_role();
    RETURN user_role = ANY(required_roles);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- PART 6: Row Level Security
-- ============================================

-- Disable RLS on user_roles to prevent recursion
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Enable RLS on other tables
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Staff policies
CREATE POLICY "staff_select" ON public.staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff_update_self" ON public.staff FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "staff_insert_admin" ON public.staff FOR INSERT TO authenticated
  WITH CHECK (auth.has_role(ARRAY['admin']));
CREATE POLICY "staff_delete_admin" ON public.staff FOR DELETE TO authenticated
  USING (auth.has_role(ARRAY['admin']));

-- Venues policies
CREATE POLICY "venues_select" ON public.venues FOR SELECT TO authenticated USING (true);
CREATE POLICY "venues_insert" ON public.venues FOR INSERT TO authenticated
  WITH CHECK (auth.has_role(ARRAY['admin']));
CREATE POLICY "venues_update" ON public.venues FOR UPDATE TO authenticated
  USING (auth.has_role(ARRAY['admin'])) WITH CHECK (auth.has_role(ARRAY['admin']));
CREATE POLICY "venues_delete" ON public.venues FOR DELETE TO authenticated
  USING (auth.has_role(ARRAY['admin']));

-- Equipment policies
CREATE POLICY "equipment_select" ON public.equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipment_insert" ON public.equipment FOR INSERT TO authenticated
  WITH CHECK (auth.has_role(ARRAY['admin']));
CREATE POLICY "equipment_update" ON public.equipment FOR UPDATE TO authenticated
  USING (auth.has_role(ARRAY['admin'])) WITH CHECK (auth.has_role(ARRAY['admin']));
CREATE POLICY "equipment_delete" ON public.equipment FOR DELETE TO authenticated
  USING (auth.has_role(ARRAY['admin']));

-- Events policies
CREATE POLICY "events_select" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events_insert" ON public.events FOR INSERT TO authenticated
  WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));
CREATE POLICY "events_update" ON public.events FOR UPDATE TO authenticated
  USING (auth.has_role(ARRAY['admin', 'manager'])) WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));
CREATE POLICY "events_delete" ON public.events FOR DELETE TO authenticated
  USING (auth.has_role(ARRAY['admin', 'manager']));

-- Shifts policies
CREATE POLICY "shifts_select" ON public.shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "shifts_insert" ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));
CREATE POLICY "shifts_update" ON public.shifts FOR UPDATE TO authenticated
  USING (auth.has_role(ARRAY['admin', 'manager'])) WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));
CREATE POLICY "shifts_delete" ON public.shifts FOR DELETE TO authenticated
  USING (auth.has_role(ARRAY['admin', 'manager']));

-- Assignments policies
CREATE POLICY "assignments_select" ON public.assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "assignments_insert" ON public.assignments FOR INSERT TO authenticated
  WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));
CREATE POLICY "assignments_update" ON public.assignments FOR UPDATE TO authenticated
  USING (auth.has_role(ARRAY['admin', 'manager'])) WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));
CREATE POLICY "assignments_delete" ON public.assignments FOR DELETE TO authenticated
  USING (auth.has_role(ARRAY['admin', 'manager']));

-- Attendances policies
CREATE POLICY "attendances_select" ON public.attendances FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendances_insert" ON public.attendances FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "attendances_update" ON public.attendances FOR UPDATE TO authenticated
  USING (auth.has_role(ARRAY['admin', 'manager'])) WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));

-- Skills policies
CREATE POLICY "skills_select" ON public.skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "skills_manage" ON public.skills FOR ALL TO authenticated
  USING (auth.has_role(ARRAY['admin'])) WITH CHECK (auth.has_role(ARRAY['admin']));

-- Staff skills policies
CREATE POLICY "staff_skills_select" ON public.staff_skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff_skills_manage" ON public.staff_skills FOR ALL TO authenticated
  USING (auth.has_role(ARRAY['admin', 'manager'])) WITH CHECK (auth.has_role(ARRAY['admin', 'manager']));

-- Audit logs policies
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT TO authenticated
  USING (auth.has_role(ARRAY['admin']));
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================
-- PART 7: Initial Test Data
-- ============================================

-- Insert test venues
INSERT INTO public.venues (id, name, address, lat, lon, capacity) VALUES
  ('11111111-1111-1111-1111-111111111111', '八王子駅テスト会場', '東京都八王子市旭町1-1', 35.6558, 139.3389, 500),
  ('22222222-2222-2222-2222-222222222222', 'マリンメッセ福岡A館', '福岡県福岡市博多区沖浜町2-1', 33.5951, 130.4137, 15000)
ON CONFLICT (id) DO NOTHING;

-- Insert test equipment with QR codes
INSERT INTO public.equipment (venue_id, name, qr_code, equipment_type, location_hint) VALUES
  ('11111111-1111-1111-1111-111111111111', '照明制御盤A', 'HACHIOJI-LIGHT-001', 'lighting', 'ステージ左袖'),
  ('22222222-2222-2222-2222-222222222222', 'マリンA館_照明卓', 'MARINE-A-LIGHT-001', 'lighting', 'ステージ左袖')
ON CONFLICT (qr_code) DO NOTHING;

-- ============================================
-- FINAL STATUS CHECK
-- ============================================
SELECT 'Setup Complete' AS status,
       COUNT(*) AS tables_created
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';