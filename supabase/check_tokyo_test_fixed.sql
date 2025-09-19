-- 既存のデータを確認（正しいカラム名で）

-- 1. 八王子の会場が存在するか確認
SELECT 
  v.id,
  v.name,
  v.address,
  v.lat,
  v.lon
FROM venues v
WHERE v.name LIKE '%八王子%' OR v.id = '11111111-1111-1111-1111-111111111111';

-- 2. 八王子の機材が存在するか確認
SELECT 
  e.id,
  e.qr_code,
  e.name,
  v.name as venue_name
FROM equipment e
JOIN venues v ON v.id = e.venue_id
WHERE e.qr_code = 'HACHIOJI-LIGHT-001' OR e.id = '22222222-2222-2222-2222-222222222222';

-- 3. 今日のシフトとアサインを確認
SELECT 
  s.id as shift_id,
  s.start_ts,
  s.end_ts,
  s.required as required_staff,
  r.name as role_name,
  ev.name as event_name,
  v.name as venue_name,
  a.staff_id,
  st.name as staff_name,
  a.status as assignment_status
FROM shifts s
JOIN events ev ON ev.id = s.event_id
JOIN venues v ON v.id = ev.venue_id
JOIN roles r ON r.id = s.role_id
LEFT JOIN assignments a ON a.shift_id = s.id
LEFT JOIN staff st ON st.id = a.staff_id
WHERE v.id = '11111111-1111-1111-1111-111111111111'
  AND DATE(s.start_ts) = CURRENT_DATE;