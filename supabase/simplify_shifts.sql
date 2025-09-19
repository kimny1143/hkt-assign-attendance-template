-- shiftsテーブルを簡素化（role_idを削除して、シンプルなnameカラムを追加）

-- 1. shiftsテーブルにnameカラムを追加
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS name TEXT;

-- 2. 既存のシフトに名前を設定
UPDATE shifts SET name = '照明・リギング作業' WHERE name IS NULL;

-- 3. role_idの外部キー制約を削除
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_role_id_fkey;

-- 4. role_idカラムを削除（まだ削除しない方が安全かも）
-- ALTER TABLE shifts DROP COLUMN IF EXISTS role_id;

-- 5. 八王子のテストシフトを更新
UPDATE shifts 
SET name = '照明・リギング設営（テスト）'
WHERE id = '44444444-4444-4444-4444-444444444444';

-- 6. 確認
SELECT 
  s.id,
  s.name as shift_name,
  s.start_ts,
  s.end_ts,
  s.required,
  ev.event_date,
  v.name as venue_name
FROM shifts s
JOIN events ev ON ev.id = s.event_id
JOIN venues v ON v.id = ev.venue_id
WHERE DATE(s.start_ts) = CURRENT_DATE;