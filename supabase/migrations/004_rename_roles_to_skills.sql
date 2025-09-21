-- ============================================
-- Migration: Rename 'roles' table to 'skills' and expand from 2 to 4 skill types
-- Date: 2025-01-20
-- Purpose:
--   1. Rename 'roles' table to 'skills' to avoid confusion with 'user_roles'
--   2. Expand skill types from 2 (lighting, rigging) to 4 (PA, sound_operator, lighting, backstage)
-- ============================================

-- Step 1: Create new skills table with expanded types
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

-- Step 3: Create temporary mapping for existing data
CREATE TEMP TABLE role_skill_mapping AS
SELECT
  r.id AS old_role_id,
  CASE
    WHEN r.code = 'lighting' THEN s.id
    WHEN r.code = 'rigging' THEN (SELECT id FROM public.skills WHERE code = 'backstage')
  END AS new_skill_id
FROM public.roles r
LEFT JOIN public.skills s ON
  (r.code = 'lighting' AND s.code = 'lighting');

-- Step 4: Add new column to shifts table
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS skill_id int;

-- Step 5: Update shifts table with new skill_id
UPDATE public.shifts sh
SET skill_id = m.new_skill_id
FROM role_skill_mapping m
WHERE sh.role_id = m.old_role_id;

-- Step 6: Drop the foreign key constraint on role_id
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_role_id_fkey;

-- Step 7: Drop role_id column and rename skill_id
ALTER TABLE public.shifts DROP COLUMN IF EXISTS role_id;
ALTER TABLE public.shifts RENAME COLUMN skill_id TO skill_id_temp;
ALTER TABLE public.shifts ADD COLUMN skill_id int NOT NULL REFERENCES public.skills(id);
UPDATE public.shifts SET skill_id = skill_id_temp WHERE skill_id_temp IS NOT NULL;
ALTER TABLE public.shifts DROP COLUMN skill_id_temp;

-- Step 8: Create staff_skills junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.staff_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  skill_id int NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  proficiency_level int DEFAULT 3 CHECK (proficiency_level BETWEEN 1 AND 5),
  certified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(staff_id, skill_id)
);

-- Step 9: Migrate skill_tags data to staff_skills table
-- Parse the existing skill_tags array and create staff_skills entries
INSERT INTO public.staff_skills (staff_id, skill_id, proficiency_level)
SELECT
  s.id AS staff_id,
  sk.id AS skill_id,
  3 AS proficiency_level -- デフォルトの習熟度
FROM public.staff s
CROSS JOIN LATERAL unnest(s.skill_tags) AS tag
JOIN public.skills sk ON
  (tag = 'lighting' AND sk.code = 'lighting') OR
  (tag = 'rigging' AND sk.code = 'backstage') OR
  (tag = 'pa' AND sk.code = 'pa') OR
  (tag = 'sound' AND sk.code = 'sound_operator')
ON CONFLICT DO NOTHING;

-- Step 10: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_skills_staff_id ON public.staff_skills(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_skills_skill_id ON public.staff_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_shifts_skill_id ON public.shifts(skill_id);

-- Step 11: Create view for easy querying of staff with their skills
CREATE OR REPLACE VIEW v_staff_with_skills AS
SELECT
  s.id,
  s.name,
  s.email,
  s.phone,
  s.active,
  array_agg(
    json_build_object(
      'skill_id', sk.id,
      'skill_code', sk.code,
      'skill_label', sk.label,
      'proficiency_level', ss.proficiency_level,
      'certified', ss.certified
    ) ORDER BY sk.id
  ) AS skills
FROM public.staff s
LEFT JOIN public.staff_skills ss ON s.id = ss.staff_id
LEFT JOIN public.skills sk ON ss.skill_id = sk.id
GROUP BY s.id, s.name, s.email, s.phone, s.active;

-- Step 12: Drop the old roles table (after confirming migration)
-- This is commented out for safety - run manually after verification
-- DROP TABLE IF EXISTS public.roles CASCADE;

-- Step 13: Add comment for documentation
COMMENT ON TABLE public.skills IS 'スタッフのスキル/役割マスタ（PA、音源再生、照明、バックヤード）';
COMMENT ON TABLE public.staff_skills IS 'スタッフとスキルの多対多関連テーブル';
COMMENT ON COLUMN public.staff_skills.proficiency_level IS '習熟度レベル（1:初級〜5:エキスパート）';
COMMENT ON COLUMN public.staff_skills.certified IS '資格認定の有無';

-- Step 14: Create function to check shift requirements
CREATE OR REPLACE FUNCTION check_shift_requirements(p_event_id uuid)
RETURNS TABLE (
  skill_code text,
  skill_label text,
  required_count int,
  assigned_count int,
  is_fulfilled boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sk.code AS skill_code,
    sk.label AS skill_label,
    COALESCE(SUM(sh.required), 0)::int AS required_count,
    COUNT(DISTINCT a.staff_id)::int AS assigned_count,
    COUNT(DISTINCT a.staff_id) >= COALESCE(SUM(sh.required), 0) AS is_fulfilled
  FROM public.skills sk
  LEFT JOIN public.shifts sh ON sh.skill_id = sk.id AND sh.event_id = p_event_id
  LEFT JOIN public.assignments a ON a.shift_id = sh.id AND a.status = 'confirmed'
  GROUP BY sk.id, sk.code, sk.label
  ORDER BY sk.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Migration Complete
-- Next steps:
-- 1. Verify data migration with: SELECT * FROM v_staff_with_skills;
-- 2. Test shift requirements with: SELECT * FROM check_shift_requirements('your-event-id');
-- 3. After verification, manually run: DROP TABLE IF EXISTS public.roles CASCADE;
-- ============================================