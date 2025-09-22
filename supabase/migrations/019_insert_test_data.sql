-- ============================================
-- Insert Test Data for Equipment and Shifts
-- Date: 2025-09-22
-- Purpose: Fix QR code recognition and shifts loading issues
-- ============================================

-- 1. Ensure venues exist (if not already)
INSERT INTO public.venues (id, name, address, lat, lon, capacity, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'JR八王子駅テスト', '東京都八王子市旭町1-1', 35.6555, 139.3389, 100, NOW()),
  ('22222222-2222-2222-2222-222222222222', 'マリンメッセ福岡A館', '福岡県福岡市博多区沖浜町2-1', 33.5927, 130.4120, 5000, NOW()),
  ('33333333-3333-3333-3333-333333333333', 'サンパレスホテル', '福岡県福岡市博多区築港本町2-1', 33.6034, 130.4021, 1000, NOW()),
  ('44444444-4444-4444-4444-444444444444', 'Zepp Fukuoka', '福岡県福岡市中央区地行浜2-2-1', 33.5935, 130.3569, 1500, NOW()),
  ('55555555-5555-5555-5555-555555555555', '福岡国際センター', '福岡県福岡市博多区築港本町2-2', 33.6021, 130.4015, 3000, NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  lat = EXCLUDED.lat,
  lon = EXCLUDED.lon;

-- 2. Insert equipment with QR codes
INSERT INTO public.equipment (id, venue_id, name, qr_code, equipment_type, location_hint, active, created_at)
VALUES
  -- 八王子テスト
  ('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '照明制御盤A', 'HACHIOJI-LIGHT-001', 'lighting', 'ステージ左袖', true, NOW()),

  -- マリンメッセ福岡A館
  ('e2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '照明制御盤A', 'MARINE-A-LIGHT-001', 'lighting', 'ステージ左袖', true, NOW()),
  ('e2222222-2222-2222-2222-222222222223', '22222222-2222-2222-2222-222222222222', 'PAコンソール', 'MARINE-A-PA-001', 'sound', 'ミキサー室', true, NOW()),

  -- サンパレスホテル
  ('e3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', '照明制御盤A', 'SUNPALACE-LIGHT-001', 'lighting', 'ステージ左袖', true, NOW()),
  ('e3333333-3333-3333-3333-333333333334', '33333333-3333-3333-3333-333333333333', 'PAコンソール', 'SUNPALACE-PA-001', 'sound', 'ミキサー室', true, NOW()),

  -- Zepp Fukuoka
  ('e4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', '照明制御盤A', 'ZEPP-LIGHT-001', 'lighting', 'ステージ左袖', true, NOW()),
  ('e4444444-4444-4444-4444-444444444445', '44444444-4444-4444-4444-444444444444', 'PAコンソール', 'ZEPP-PA-001', 'sound', 'ミキサー室', true, NOW()),

  -- 福岡国際センター
  ('e5555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', '照明制御盤A', 'KOKUSAI-LIGHT-001', 'lighting', 'ステージ左袖', true, NOW()),
  ('e5555555-5555-5555-5555-555555555556', '55555555-5555-5555-5555-555555555555', 'PAコンソール', 'KOKUSAI-PA-001', 'sound', 'ミキサー室', true, NOW())
ON CONFLICT (id) DO UPDATE SET
  qr_code = EXCLUDED.qr_code,
  active = EXCLUDED.active;

-- 3. Create events for today (for testing)
INSERT INTO public.events (id, venue_id, event_date, open_time, start_time, end_time, notes, created_at)
VALUES
  ('ev111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', CURRENT_DATE, '17:00', '18:00', '21:00', '八王子テスト公演', NOW()),
  ('ev222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', CURRENT_DATE, '17:00', '18:00', '21:00', 'マリンメッセテスト公演', NOW())
ON CONFLICT (id) DO UPDATE SET
  event_date = CURRENT_DATE,
  notes = EXCLUDED.notes;

-- 4. Get skill IDs (assuming they exist from migration 004)
DO $$
DECLARE
  v_skill_pa uuid;
  v_skill_sound uuid;
  v_skill_lighting uuid;
  v_skill_backstage uuid;
BEGIN
  -- Get skill IDs
  SELECT id INTO v_skill_pa FROM public.skills WHERE code = 'pa';
  SELECT id INTO v_skill_sound FROM public.skills WHERE code = 'sound_operator';
  SELECT id INTO v_skill_lighting FROM public.skills WHERE code = 'lighting';
  SELECT id INTO v_skill_backstage FROM public.skills WHERE code = 'backstage';

  -- Insert shifts for today's events
  INSERT INTO public.shifts (id, event_id, skill_id, start_ts, end_ts, required, created_at)
  VALUES
    -- 八王子テスト公演のシフト
    ('sh111111-1111-1111-1111-111111111111', 'ev111111-1111-1111-1111-111111111111', v_skill_lighting,
     CURRENT_DATE::timestamp + interval '17 hours',
     CURRENT_DATE::timestamp + interval '21 hours',
     2, NOW()),

    ('sh111111-1111-1111-1111-111111111112', 'ev111111-1111-1111-1111-111111111111', v_skill_pa,
     CURRENT_DATE::timestamp + interval '17 hours',
     CURRENT_DATE::timestamp + interval '21 hours',
     1, NOW()),

    -- マリンメッセテスト公演のシフト
    ('sh222222-2222-2222-2222-222222222222', 'ev222222-2222-2222-2222-222222222222', v_skill_lighting,
     CURRENT_DATE::timestamp + interval '17 hours',
     CURRENT_DATE::timestamp + interval '21 hours',
     2, NOW()),

    ('sh222222-2222-2222-2222-222222222223', 'ev222222-2222-2222-2222-222222222222', v_skill_pa,
     CURRENT_DATE::timestamp + interval '17 hours',
     CURRENT_DATE::timestamp + interval '21 hours',
     1, NOW())
  ON CONFLICT (id) DO UPDATE SET
    start_ts = EXCLUDED.start_ts,
    end_ts = EXCLUDED.end_ts;

  -- Log the result
  RAISE NOTICE 'Test data inserted successfully. Skill IDs - PA: %, Sound: %, Lighting: %, Backstage: %',
    v_skill_pa, v_skill_sound, v_skill_lighting, v_skill_backstage;
END $$;

-- 5. Verify the data
SELECT
  'Equipment Check' as check_type,
  COUNT(*) as count,
  array_agg(qr_code) as qr_codes
FROM public.equipment
WHERE qr_code IN ('HACHIOJI-LIGHT-001', 'MARINE-A-LIGHT-001', 'SUNPALACE-LIGHT-001', 'ZEPP-LIGHT-001', 'KOKUSAI-LIGHT-001');

SELECT
  'Events Today' as check_type,
  COUNT(*) as count
FROM public.events
WHERE event_date = CURRENT_DATE;

SELECT
  'Shifts Today' as check_type,
  COUNT(*) as count
FROM public.shifts
WHERE DATE(start_ts) = CURRENT_DATE;