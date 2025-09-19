-- シンプルな解決方法：RLSを一時的に無効化してアクセスできるようにする

-- 1. 既存のポリシーを削除
DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;

DROP POLICY IF EXISTS "staff_select" ON staff;
DROP POLICY IF EXISTS "staff_insert" ON staff;
DROP POLICY IF EXISTS "staff_update" ON staff;
DROP POLICY IF EXISTS "staff_delete" ON staff;

-- 2. staffテーブル: 全認証ユーザーが読み取り可能（暫定）
CREATE POLICY "staff_select_temp" ON staff FOR SELECT TO authenticated
USING (true);

CREATE POLICY "staff_insert_temp" ON staff FOR INSERT TO authenticated
WITH CHECK (false); -- 挿入は不可

CREATE POLICY "staff_update_temp" ON staff FOR UPDATE TO authenticated
USING (auth.uid() = user_id); -- 自分のレコードのみ更新可能

CREATE POLICY "staff_delete_temp" ON staff FOR DELETE TO authenticated
USING (false); -- 削除は不可

-- 3. user_rolesテーブル: 全認証ユーザーが読み取り可能（暫定）
CREATE POLICY "user_roles_select_temp" ON user_roles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "user_roles_insert_temp" ON user_roles FOR INSERT TO authenticated
WITH CHECK (false); -- 挿入は不可

CREATE POLICY "user_roles_update_temp" ON user_roles FOR UPDATE TO authenticated
USING (false); -- 更新は不可

CREATE POLICY "user_roles_delete_temp" ON user_roles FOR DELETE TO authenticated
USING (false); -- 削除は不可