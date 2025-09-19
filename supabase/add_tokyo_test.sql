-- 東京のテスト会場を追加（JR八王子駅周辺）

-- 1. JR八王子駅を会場として追加
INSERT INTO venues (id, name, address, lat, lon, capacity)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'JR八王子駅（テスト会場）',
  '東京都八王子市旭町1-1',
  35.6555,  -- JR八王子駅の緯度
  139.3389, -- JR八王子駅の経度
  1000
);

-- 2. テスト用機材を追加
INSERT INTO equipment (id, venue_id, qr_code, name, type, active)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'HACHIOJI-LIGHT-001',
  '八王子テスト照明セット',
  'lighting',
  true
);

-- 3. テスト用イベントを追加
INSERT INTO events (id, venue_id, name, start_date, end_date)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '八王子テストイベント',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '7 days'
);

-- 4. テスト用シフトを追加
INSERT INTO shifts (id, event_id, name, start_ts, end_ts, required_staff, role_type, rate_type, rate_amount)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  '照明設営（テスト）',
  CURRENT_DATE + TIME '09:00:00',
  CURRENT_DATE + TIME '18:00:00',
  2,
  'lighting',
  'daily',
  15000
);

-- 5. スタッフをアサイン
INSERT INTO assignments (id, shift_id, staff_id, status, confirmed_at)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444',
  'cccccccc-cccc-cccc-cccc-cccccccccccc', -- staff1@haas.test
  'confirmed',
  NOW()
);

-- 確認
SELECT 
  v.name as venue,
  e.qr_code,
  e.name as equipment,
  v.lat,
  v.lon
FROM venues v
JOIN equipment e ON e.venue_id = v.id
WHERE v.id = '11111111-1111-1111-1111-111111111111';