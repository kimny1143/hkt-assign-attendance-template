-- 一時的にRLSを完全に無効化してテスト

-- 1. 既存のポリシーをすべて削除
DROP POLICY IF EXISTS "staff_select_temp" ON staff;
DROP POLICY IF EXISTS "staff_insert_temp" ON staff;
DROP POLICY IF EXISTS "staff_update_temp" ON staff;
DROP POLICY IF EXISTS "staff_delete_temp" ON staff;

DROP POLICY IF EXISTS "user_roles_select_temp" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert_temp" ON user_roles;
DROP POLICY IF EXISTS "user_roles_update_temp" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete_temp" ON user_roles;

-- 2. RLSを無効化
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- 3. データ確認
SELECT 
  s.id,
  s.name,
  s.email,
  s.user_id,
  ur.role
FROM staff s
LEFT JOIN user_roles ur ON ur.staff_id = s.id
ORDER BY s.email;