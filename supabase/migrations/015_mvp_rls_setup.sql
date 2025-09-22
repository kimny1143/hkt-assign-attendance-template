-- ============================================
-- MVP用RLS設定
-- Date: 2025-09-22
-- Purpose: シンプルで高性能なRLS実装（無限再帰を回避）
-- ============================================

-- ============================================
-- 1. パフォーマンス最適化: インデックス作成
-- ============================================
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_staff_id ON public.assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendances_staff_id ON public.attendances(staff_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_staff_id ON public.user_roles(staff_id);

-- ============================================
-- 2. 既存のポリシーを全て削除（クリーンスタート）
-- ============================================

-- staffテーブルのポリシー削除
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_read_all" ON public.staff;
DROP POLICY IF EXISTS "staff_update_own" ON public.staff;
DROP POLICY IF EXISTS "anyone_can_read_staff" ON public.staff;
DROP POLICY IF EXISTS "users_update_own_record" ON public.staff;
DROP POLICY IF EXISTS "service_role_all" ON public.staff;
DROP POLICY IF EXISTS "staff_select_authenticated" ON public.staff;
DROP POLICY IF EXISTS "staff_admin_all" ON public.staff;
DROP POLICY IF EXISTS "staff_self_read" ON public.staff;
DROP POLICY IF EXISTS "staff_admin_write" ON public.staff;
DROP POLICY IF EXISTS "staff_manager_update" ON public.staff;
DROP POLICY IF EXISTS "staff_self_update" ON public.staff;

-- その他のテーブルのRLS無効化（後で設定）
ALTER TABLE IF EXISTS public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendances DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.venues DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. staffテーブル: シンプルなポリシー（無限再帰回避）
-- ============================================
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- 全認証ユーザーが読み取り可能
CREATE POLICY "staff_read_all" ON public.staff
  FOR SELECT TO authenticated
  USING (true);

-- 自分のレコードのみ更新可能（user_idの変更は不可）
CREATE POLICY "staff_update_own" ON public.staff
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND user_id = (SELECT user_id FROM public.staff WHERE id = staff.id)
  );

-- ============================================
-- 4. eventsテーブル: 読み取り専用
-- ============================================
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_read_all" ON public.events
  FOR SELECT TO authenticated
  USING (true);

-- ============================================
-- 5. shiftsテーブル: 読み取り専用
-- ============================================
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shifts_read_all" ON public.shifts
  FOR SELECT TO authenticated
  USING (true);

-- ============================================
-- 6. assignmentsテーブル: 本人のみ閲覧可能
-- ============================================
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignments_read_own" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    staff_id IN (
      SELECT id FROM public.staff
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 7. attendancesテーブル: 本人のみ閲覧・作成可能
-- ============================================
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- 読み取り: 本人のみ
CREATE POLICY "attendances_read_own" ON public.attendances
  FOR SELECT TO authenticated
  USING (
    staff_id IN (
      SELECT id FROM public.staff
      WHERE user_id = auth.uid()
    )
  );

-- 作成: 本人のみ
CREATE POLICY "attendances_insert_own" ON public.attendances
  FOR INSERT TO authenticated
  WITH CHECK (
    staff_id IN (
      SELECT id FROM public.staff
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 8. venuesテーブル: 読み取り専用
-- ============================================
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venues_read_all" ON public.venues
  FOR SELECT TO authenticated
  USING (true);

-- ============================================
-- 9. user_rolesテーブル: 本人のロールのみ閲覧可能
-- ============================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_read_own" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    staff_id IN (
      SELECT id FROM public.staff
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 10. RLS状態の確認
-- ============================================
SELECT
    tablename,
    CASE
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS Disabled'
    END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'staff', 'user_roles', 'assignments', 'attendances',
        'events', 'shifts', 'venues'
    )
ORDER BY tablename;

-- ============================================
-- 11. 動作確認用のテストクエリ
-- ============================================
-- 以下のクエリをSupabase SQL Editorで実行して動作確認

-- Test 1: staffテーブルの読み取り（成功するはず）
-- SELECT id, name, email FROM public.staff LIMIT 5;

-- Test 2: 自分のスタッフ情報の確認
-- SELECT * FROM public.staff WHERE user_id = auth.uid();

-- Test 3: イベント一覧の確認（成功するはず）
-- SELECT * FROM public.events LIMIT 5;

-- ============================================
-- 注意事項
-- ============================================
-- 1. Service RoleキーはRLSを自動的にバイパスします
-- 2. この設定はMVP用のシンプルな実装です
-- 3. 本番環境では管理者権限の実装を追加してください
-- 4. パフォーマンス問題が発生した場合はインデックスを確認してください
-- ============================================