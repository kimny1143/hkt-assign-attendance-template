-- テーブル構造の確認

-- 1. rolesテーブルの構造を確認
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'roles' 
ORDER BY ordinal_position;

-- 2. rolesテーブルのデータ確認
SELECT * FROM roles;

-- 3. もしrolesテーブルが空なら、基本的なロールを追加
INSERT INTO roles (id, type, base_rate) 
VALUES 
  (1, 'lighting', 1500),
  (2, 'sound', 1600),
  (3, 'rigging', 1800)
ON CONFLICT DO NOTHING;

-- 4. 八王子会場と機材の存在確認（シンプルに）
SELECT 
  v.id,
  v.name as venue_name,
  e.qr_code,
  e.name as equipment_name
FROM venues v
LEFT JOIN equipment e ON e.venue_id = v.id
WHERE v.id = '11111111-1111-1111-1111-111111111111';

-- 5. 今日のシフト確認（rolesテーブルを使わずに）
SELECT 
  s.id as shift_id,
  s.start_ts,
  s.end_ts,
  s.required,
  s.role_id,
  ev.name as event_name,
  v.name as venue_name
FROM shifts s
JOIN events ev ON ev.id = s.event_id
JOIN venues v ON v.id = ev.venue_id
WHERE v.id = '11111111-1111-1111-1111-111111111111'
  AND DATE(s.start_ts) = CURRENT_DATE;