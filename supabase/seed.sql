-- === SEED DATA for Development ===
-- 開発用テストデータ

-- === 1. 役割マスタ ===
INSERT INTO public.roles (code, label) VALUES
  ('lighting', '照明'),
  ('rigging', 'リギング')
ON CONFLICT (code) DO NOTHING;

-- === 2. 会場データ（福岡市内）===
INSERT INTO public.venues (id, name, address, lat, lon, capacity) VALUES
  ('11111111-1111-1111-1111-111111111111', 'マリンメッセ福岡A館', '福岡県福岡市博多区沖浜町2-1', 33.5951, 130.4137, 15000),
  ('22222222-2222-2222-2222-222222222222', '福岡サンパレス', '福岡県福岡市博多区築港本町2-1', 33.5948, 130.4077, 2300),
  ('33333333-3333-3333-3333-333333333333', '福岡国際センター', '福岡県福岡市博多区築港本町2-2', 33.5947, 130.4083, 10000),
  ('44444444-4444-4444-4444-444444444444', 'Zepp Fukuoka', '福岡県福岡市中央区地行浜2-2-1', 33.5934, 130.3577, 2500),
  ('55555555-5555-5555-5555-555555555555', '福岡市民会館', '福岡県福岡市中央区天神5-1-23', 33.5852, 130.3946, 1770)
ON CONFLICT (id) DO NOTHING;

-- === 3. 機材データ（物理QRコード）===
INSERT INTO public.equipment (venue_id, name, qr_code, equipment_type, location_hint) VALUES
  ('11111111-1111-1111-1111-111111111111', 'マリンメッセA館_照明卓', 'MARINE-A-LIGHT-001', 'lighting', 'ステージ左袖'),
  ('11111111-1111-1111-1111-111111111111', 'マリンメッセA館_音響卓', 'MARINE-A-SOUND-001', 'sound', 'PA席'),
  ('11111111-1111-1111-1111-111111111111', 'マリンメッセA館_リギング機材', 'MARINE-A-RIG-001', 'rigging', 'バトン室'),
  ('22222222-2222-2222-2222-222222222222', 'サンパレス_照明卓', 'SUNPALACE-LIGHT-001', 'lighting', '調光室'),
  ('22222222-2222-2222-2222-222222222222', 'サンパレス_音響卓', 'SUNPALACE-SOUND-001', 'sound', 'PA席'),
  ('33333333-3333-3333-3333-333333333333', '国際センター_照明卓', 'KOKUSAI-LIGHT-001', 'lighting', 'ステージ右袖'),
  ('44444444-4444-4444-4444-444444444444', 'Zepp_照明卓', 'ZEPP-LIGHT-001', 'lighting', '2F調光室'),
  ('44444444-4444-4444-4444-444444444444', 'Zepp_音響卓', 'ZEPP-SOUND-001', 'sound', '2F PA席'),
  ('55555555-5555-5555-5555-555555555555', '市民会館_照明卓', 'SHIMIN-LIGHT-001', 'lighting', '3F調光室')
ON CONFLICT DO NOTHING;

-- === 4. テストユーザー作成（Supabase Auth）===
-- 注意: これらはSupabase DashboardのAuthenticationセクションで手動作成してください
-- または supabase.auth.admin.createUser() を使用
-- テストユーザー例:
-- admin@haas.test (パスワード: admin123) - 管理者
-- manager@haas.test (パスワード: manager123) - マネージャー
-- staff1@haas.test (パスワード: staff123) - スタッフ1
-- staff2@haas.test (パスワード: staff123) - スタッフ2
-- staff3@haas.test (パスワード: staff123) - スタッフ3

-- === 5. スタッフデータ ===
-- AuthでユーザーIDを作成後、そのIDをuser_idに設定してください
INSERT INTO public.staff (id, user_id, code, name, phone, email, address, lat, lon, skill_tags, hourly_rate, daily_rate) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'ADM001', '管理 太郎', '090-1111-1111', 'admin@haas.test', '福岡県福岡市中央区天神1-1-1', 33.5904, 130.4017, ARRAY['admin', 'lighting', 'rigging'], null, null),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, 'MGR001', 'マネージャー 花子', '090-2222-2222', 'manager@haas.test', '福岡県福岡市博多区博多駅前1-1-1', 33.5897, 130.4207, ARRAY['manager', 'lighting'], null, null),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', null, 'STF001', '照明 一郎', '090-3333-3333', 'staff1@haas.test', '福岡県福岡市早良区西新1-1-1', 33.5826, 130.3598, ARRAY['lighting'], 1500, 15000),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', null, 'STF002', 'リギング 次郎', '090-4444-4444', 'staff2@haas.test', '福岡県福岡市東区香椎1-1-1', 33.6597, 130.4438, ARRAY['rigging'], 1800, 18000),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', null, 'STF003', 'オペ 三郎', '090-5555-5555', 'staff3@haas.test', '福岡県福岡市南区大橋1-1-1', 33.5749, 130.4262, ARRAY['lighting', 'rigging'], 2000, 20000)
ON CONFLICT (id) DO NOTHING;

-- === 6. ユーザー権限 ===
INSERT INTO public.user_roles (staff_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'manager'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'staff'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'staff'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'staff')
ON CONFLICT (staff_id, role) DO NOTHING;

-- === 7. イベントデータ（今月〜来月）===
INSERT INTO public.events (id, venue_id, event_date, open_time, start_time, end_time, notes) VALUES
  ('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', CURRENT_DATE + INTERVAL '3 days', '17:00', '19:00', '22:00', 'テストライブA'),
  ('e2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', CURRENT_DATE + INTERVAL '7 days', '16:00', '18:00', '21:00', 'コンサートB'),
  ('e3333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', CURRENT_DATE + INTERVAL '10 days', '18:00', '19:30', '22:30', 'ロックフェス'),
  ('e4444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', CURRENT_DATE + INTERVAL '14 days', '15:00', '17:00', '20:00', 'アイドルイベント'),
  ('e5555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', CURRENT_DATE + INTERVAL '21 days', '17:30', '19:00', '21:30', 'クラシックコンサート')
ON CONFLICT (id) DO NOTHING;

-- === 8. シフトデータ ===
DO $$
DECLARE
  lighting_id INT;
  rigging_id INT;
BEGIN
  SELECT id INTO lighting_id FROM public.roles WHERE code = 'lighting';
  SELECT id INTO rigging_id FROM public.roles WHERE code = 'rigging';

  -- イベント1のシフト
  INSERT INTO public.shifts (event_id, role_id, start_ts, end_ts, required) VALUES
    ('e1111111-1111-1111-1111-111111111111', lighting_id, 
     (CURRENT_DATE + INTERVAL '3 days')::date + TIME '16:00', 
     (CURRENT_DATE + INTERVAL '3 days')::date + TIME '23:00', 2),
    ('e1111111-1111-1111-1111-111111111111', rigging_id, 
     (CURRENT_DATE + INTERVAL '3 days')::date + TIME '14:00', 
     (CURRENT_DATE + INTERVAL '3 days')::date + TIME '23:00', 1);

  -- イベント2のシフト
  INSERT INTO public.shifts (event_id, role_id, start_ts, end_ts, required) VALUES
    ('e2222222-2222-2222-2222-222222222222', lighting_id,
     (CURRENT_DATE + INTERVAL '7 days')::date + TIME '15:00',
     (CURRENT_DATE + INTERVAL '7 days')::date + TIME '22:00', 1),
    ('e2222222-2222-2222-2222-222222222222', rigging_id,
     (CURRENT_DATE + INTERVAL '7 days')::date + TIME '13:00',
     (CURRENT_DATE + INTERVAL '7 days')::date + TIME '22:00', 2);

  -- イベント3のシフト
  INSERT INTO public.shifts (event_id, role_id, start_ts, end_ts, required) VALUES
    ('e3333333-3333-3333-3333-333333333333', lighting_id,
     (CURRENT_DATE + INTERVAL '10 days')::date + TIME '17:00',
     (CURRENT_DATE + INTERVAL '10 days')::date + TIME '23:30', 3),
    ('e3333333-3333-3333-3333-333333333333', rigging_id,
     (CURRENT_DATE + INTERVAL '10 days')::date + TIME '15:00',
     (CURRENT_DATE + INTERVAL '10 days')::date + TIME '23:30', 2);
END $$;

-- === 9. サンプルアサインメント ===
-- 最初の数シフトにスタッフをアサイン
INSERT INTO public.assignments (shift_id, staff_id, status, score) 
SELECT 
  s.id,
  st.id,
  'confirmed',
  random() * 100
FROM public.shifts s
CROSS JOIN public.staff st
WHERE st.code IN ('STF001', 'STF002', 'STF003')
  AND s.event_id = 'e1111111-1111-1111-1111-111111111111'
LIMIT 3
ON CONFLICT DO NOTHING;

-- === 開発用メモ ===
-- 1. Supabase DashboardでAuthユーザーを作成
-- 2. 作成したユーザーIDをstaff.user_idに更新
-- UPDATE public.staff SET user_id = 'xxxxx-xxxxx-xxxxx' WHERE email = 'admin@haas.test';
-- 3. アプリケーションでログインテスト

COMMENT ON SCHEMA public IS 'HAAS開発用シードデータ - テスト環境専用';