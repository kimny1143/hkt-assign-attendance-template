-- 八王子のテストデータを完全に作成

-- 1. 八王子会場の確認/作成
INSERT INTO venues (id, name, address, lat, lon, capacity)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'JR八王子駅（テスト会場）',
  '東京都八王子市旭町1-1',
  35.6555,
  139.3389,
  1000
) ON CONFLICT (id) DO NOTHING;

-- 2. 機材の確認/作成
INSERT INTO equipment (id, venue_id, qr_code, name, equipment_type, active)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'HACHIOJI-LIGHT-001',
  '八王子テスト照明セット',
  'lighting',
  true
) ON CONFLICT (id) DO NOTHING;

-- 3. イベントの確認/作成（nameカラムがないので追加）
ALTER TABLE events ADD COLUMN IF NOT EXISTS name TEXT;

-- イベントを作成/更新
INSERT INTO events (id, venue_id, name, event_date)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '八王子テストイベント',
  CURRENT_DATE
) ON CONFLICT (id) DO UPDATE SET 
  event_date = CURRENT_DATE,
  name = '八王子テストイベント';

-- 4. シフトの作成/更新（nameカラムは既に追加済み）
-- まず古いシフトを削除
DELETE FROM shifts 
WHERE id = '44444444-4444-4444-4444-444444444444';

-- 新しいシフトを作成（role_idは1を使用、後で無視される）
INSERT INTO shifts (id, event_id, role_id, name, start_ts, end_ts, required)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  1, -- とりあえず1を入れる（NOT NULL制約があるため）
  '照明・リギング設営（テスト）',
  CURRENT_TIMESTAMP::date + TIME '09:00:00',
  CURRENT_TIMESTAMP::date + TIME '18:00:00',
  2
);

-- 5. アサインメントの作成/更新
INSERT INTO assignments (id, shift_id, staff_id, status)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444',
  'cccccccc-cccc-cccc-cccc-cccccccccccc', -- staff1@haas.test
  'confirmed'
) ON CONFLICT (shift_id, staff_id) DO UPDATE SET 
  status = 'confirmed';

-- 6. 最終確認
SELECT 
  '八王子会場' as label,
  v.name as venue,
  v.lat,
  v.lon
FROM venues v
WHERE v.id = '11111111-1111-1111-1111-111111111111'
UNION ALL
SELECT 
  '機材QR' as label,
  e.qr_code as venue,
  NULL as lat,
  NULL as lon
FROM equipment e
WHERE e.venue_id = '11111111-1111-1111-1111-111111111111'
UNION ALL
SELECT 
  'シフト' as label,
  s.name as venue,
  NULL as lat,
  NULL as lon
FROM shifts s
JOIN events ev ON ev.id = s.event_id
WHERE ev.venue_id = '11111111-1111-1111-1111-111111111111'
  AND DATE(s.start_ts) = CURRENT_DATE;