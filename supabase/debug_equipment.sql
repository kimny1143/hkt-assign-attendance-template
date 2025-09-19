-- HACHIOJI-LIGHT-001の機材がどこに紐付いているか詳細確認

-- 1. 機材の詳細
SELECT 
  e.id as equipment_id,
  e.qr_code,
  e.venue_id,
  v.id as venue_id_from_join,
  v.name as venue_name,
  v.lat,
  v.lon,
  v.address
FROM equipment e
LEFT JOIN venues v ON v.id = e.venue_id
WHERE e.qr_code = 'HACHIOJI-LIGHT-001';

-- 2. 八王子会場の存在確認
SELECT 
  id,
  name,
  lat,
  lon,
  address
FROM venues
WHERE id = '11111111-1111-1111-1111-111111111111'
   OR name LIKE '%八王子%';

-- 3. HACHIOJI-LIGHT-001機材が存在しない場合は作成
-- まず既存を削除
DELETE FROM equipment WHERE qr_code = 'HACHIOJI-LIGHT-001';

-- 新規作成（確実に八王子会場に紐付ける）
INSERT INTO equipment (venue_id, qr_code, name, equipment_type, active)
VALUES (
  '11111111-1111-1111-1111-111111111111',  -- 八王子会場のID
  'HACHIOJI-LIGHT-001',
  '八王子テスト照明セット',
  'lighting',
  true
);

-- 4. 作成後の確認
SELECT 
  e.qr_code,
  v.name as venue_name,
  v.lat,
  v.lon
FROM equipment e
JOIN venues v ON v.id = e.venue_id
WHERE e.qr_code = 'HACHIOJI-LIGHT-001';