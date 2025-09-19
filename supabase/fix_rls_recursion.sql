-- 1. まず問題のあるポリシーを削除
DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;

DROP POLICY IF EXISTS "staff_select" ON staff;
DROP POLICY IF EXISTS "staff_insert" ON staff;
DROP POLICY IF EXISTS "staff_update" ON staff;
DROP POLICY IF EXISTS "staff_delete" ON staff;

-- 2. staffテーブルの新しいポリシー（再帰を避ける）
CREATE POLICY "staff_select" ON staff FOR SELECT TO authenticated
USING (
  -- 自分自身のレコード
  auth.uid() = user_id
  OR
  -- 管理者・マネージャーは全員見れる（user_rolesを直接参照）
  EXISTS (
    SELECT 1 FROM user_roles ur
    INNER JOIN staff s ON s.id = ur.staff_id
    WHERE s.user_id = auth.uid()
    AND ur.role IN ('admin', 'manager')
  )
);

CREATE POLICY "staff_insert" ON staff FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    INNER JOIN staff s ON s.id = ur.staff_id
    WHERE s.user_id = auth.uid()
    AND ur.role = 'admin'
  )
);

CREATE POLICY "staff_update" ON staff FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    INNER JOIN staff s ON s.id = ur.staff_id
    WHERE s.user_id = auth.uid()
    AND ur.role = 'admin'
  )
);

CREATE POLICY "staff_delete" ON staff FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    INNER JOIN staff s ON s.id = ur.staff_id
    WHERE s.user_id = auth.uid()
    AND ur.role = 'admin'
  )
);

-- 3. user_rolesテーブルの新しいポリシー（staffを直接参照）
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT TO authenticated
USING (
  -- 管理者のみ
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.user_id = auth.uid()
    AND staff.role = 'admin'
  )
);

CREATE POLICY "user_roles_insert" ON user_roles FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.user_id = auth.uid()
    AND staff.role = 'admin'
  )
);

CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.user_id = auth.uid()
    AND staff.role = 'admin'
  )
);

CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.user_id = auth.uid()
    AND staff.role = 'admin'
  )
);