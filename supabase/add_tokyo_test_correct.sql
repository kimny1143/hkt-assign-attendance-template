-- 東京のテスト会場を正しく追加

-- 1. まず既存のrolesを確認
SELECT id, type, base_rate FROM roles;

-- 2. 八王子の会場が既に存在するか確認
SELECT * FROM venues WHERE id = '11111111-1111-1111-1111-111111111111';

-- 3. 八王子の機材が既に存在するか確認  
SELECT * FROM equipment WHERE id = '22222222-2222-2222-2222-222222222222';

-- 4. もし機材がなければ追加
INSERT INTO equipment (id, venue_id, qr_code, name, equipment_type, active)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'HACHIOJI-LIGHT-001',
  '八王子テスト照明セット',
  'lighting',
  true
) ON CONFLICT (id) DO NOTHING;

-- 5. イベントがなければ追加
INSERT INTO events (id, venue_id, name, event_date)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '八王子テストイベント',
  CURRENT_DATE
) ON CONFLICT (id) DO UPDATE SET event_date = CURRENT_DATE;

-- 6. lightingロールのIDを取得してシフトを追加
INSERT INTO shifts (id, event_id, role_id, start_ts, end_ts, required)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  (SELECT id FROM roles WHERE type = 'lighting' LIMIT 1),
  CURRENT_DATE + TIME '09:00:00',
  CURRENT_DATE + TIME '18:00:00',
  2
) ON CONFLICT (id) DO UPDATE SET 
  start_ts = CURRENT_DATE + TIME '09:00:00',
  end_ts = CURRENT_DATE + TIME '18:00:00';

-- 7. スタッフをアサイン（staff1）
INSERT INTO assignments (id, shift_id, staff_id, status)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444',
  'cccccccc-cccc-cccc-cccc-cccccccccccc', -- staff1@haas.test
  'confirmed'
) ON CONFLICT (shift_id, staff_id) DO UPDATE SET status = 'confirmed';

-- 8. 確認
SELECT 
  v.name as venue,
  e.qr_code,
  e.name as equipment,
  v.lat,
  v.lon,
  s.start_ts,
  s.end_ts,
  r.type as role_type
FROM venues v
JOIN equipment e ON e.venue_id = v.id
LEFT JOIN events ev ON ev.venue_id = v.id
LEFT JOIN shifts s ON s.event_id = ev.id
LEFT JOIN roles r ON r.id = s.role_id
WHERE v.id = '11111111-1111-1111-1111-111111111111'
  AND DATE(s.start_ts) = CURRENT_DATE;