-- 現在のデータを完全に確認

-- 1. HACHIOJI-LIGHT-001のQRコードがどの会場に紐付いているか
SELECT 
  e.qr_code,
  e.name as equipment_name,
  v.id as venue_id,
  v.name as venue_name,
  v.lat,
  v.lon,
  v.address
FROM equipment e
JOIN venues v ON v.id = e.venue_id
WHERE e.qr_code = 'HACHIOJI-LIGHT-001';

-- 2. 全ての機材と会場を確認
SELECT 
  e.qr_code,
  v.name as venue_name,
  v.lat,
  v.lon
FROM equipment e
JOIN venues v ON v.id = e.venue_id
ORDER BY e.qr_code;

-- 3. 今日のシフトを確認
SELECT 
  s.id as shift_id,
  s.name as shift_name,
  v.name as venue_name,
  v.lat,
  v.lon,
  s.start_ts,
  s.end_ts
FROM shifts s
JOIN events ev ON ev.id = s.event_id  
JOIN venues v ON v.id = ev.venue_id
WHERE DATE(s.start_ts) = CURRENT_DATE;

-- 4. staff1のアサインメントを確認
SELECT 
  st.email,
  s.name as shift_name,
  a.status,
  v.name as venue_name
FROM assignments a
JOIN shifts s ON s.id = a.shift_id
JOIN events ev ON ev.id = s.event_id
JOIN venues v ON v.id = ev.venue_id
JOIN staff st ON st.id = a.staff_id
WHERE st.email = 'staff1@haas.test'
  AND DATE(s.start_ts) = CURRENT_DATE;