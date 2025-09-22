# RLS (Row Level Security) 管理ガイド

**最終更新日: 2025年9月22日**

## 1. 概要

このドキュメントは、HaaS Staff Assignment & Attendance Management SystemにおけるSupabase RLSの実装と管理方法を定義します。MVP段階での実用性とセキュリティのバランスを重視した設計です。

## 2. RLS戦略 (MVP段階)

### 2.1 基本方針

MVP段階では以下の方針でRLSを実装します：

1. **シンプルさ優先**: 複雑な階層構造は避け、明確で理解しやすいポリシーを実装
2. **パフォーマンス重視**: インデックスを活用し、無限再帰を回避
3. **段階的強化**: MVPから本番環境に向けて段階的にセキュリティを強化

### 2.2 アクセスパターン分析

| テーブル | 読み取り権限 | 書き込み権限 | 備考 |
|---------|------------|------------|------|
| staff | 全認証ユーザー | 本人のみ（限定的） | user_idの変更は不可 |
| events | 全認証ユーザー | 管理者のみ | イベント情報は全員が見れる |
| shifts | 全認証ユーザー | 管理者のみ | シフト情報は全員が見れる |
| assignments | 本人・管理者 | 管理者のみ | 個人情報保護のため制限 |
| attendances | 本人・管理者 | 本人のみ | 出退勤記録 |
| venues | 全認証ユーザー | 管理者のみ | 会場情報は全員が見れる |

## 3. RLS実装SQL

### 3.1 MVP用RLSポリシー (推奨)

```sql
-- ファイル: supabase/migrations/015_mvp_rls_setup.sql

-- ============================================
-- MVP用RLS設定
-- 目的: シンプルで高性能なRLS実装
-- ============================================

-- 1. パフォーマンス最適化: インデックス作成
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_staff_id ON public.assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendances_staff_id ON public.attendances(staff_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_staff_id ON public.user_roles(staff_id);

-- 2. staffテーブル: シンプルなポリシー
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_all" ON public.staff;
CREATE POLICY "staff_read_all" ON public.staff
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "staff_update_own" ON public.staff;
CREATE POLICY "staff_update_own" ON public.staff
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND user_id = (SELECT user_id FROM public.staff WHERE id = staff.id)
  );

-- 3. eventsテーブル: 読み取り専用
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_read_all" ON public.events;
CREATE POLICY "events_read_all" ON public.events
  FOR SELECT TO authenticated
  USING (true);

-- 4. shiftsテーブル: 読み取り専用
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_read_all" ON public.shifts;
CREATE POLICY "shifts_read_all" ON public.shifts
  FOR SELECT TO authenticated
  USING (true);

-- 5. assignmentsテーブル: 本人と管理者のみ
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments_read_own" ON public.assignments;
CREATE POLICY "assignments_read_own" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    staff_id IN (
      SELECT id FROM public.staff WHERE user_id = auth.uid()
    )
  );

-- 6. attendancesテーブル: 本人のみ
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendances_read_own" ON public.attendances;
CREATE POLICY "attendances_read_own" ON public.attendances
  FOR SELECT TO authenticated
  USING (
    staff_id IN (
      SELECT id FROM public.staff WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attendances_insert_own" ON public.attendances;
CREATE POLICY "attendances_insert_own" ON public.attendances
  FOR INSERT TO authenticated
  WITH CHECK (
    staff_id IN (
      SELECT id FROM public.staff WHERE user_id = auth.uid()
    )
  );

-- 7. venuesテーブル: 読み取り専用
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venues_read_all" ON public.venues;
CREATE POLICY "venues_read_all" ON public.venues
  FOR SELECT TO authenticated
  USING (true);

-- 8. Service Roleポリシー (全テーブル)
-- Service roleはRLSを自動的にバイパスするため、ポリシー不要
```

### 3.2 管理者権限の実装 (将来の拡張用)

```sql
-- ファイル: supabase/migrations/016_admin_policies.sql

-- 管理者権限用のセキュリティ定義関数
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN public.user_roles ur ON s.id = ur.staff_id
    WHERE s.user_id = auth.uid()
    AND ur.role = 'admin'
  );
$$;

-- 管理者用ポリシーの追加例
CREATE POLICY "events_admin_all" ON public.events
  FOR ALL TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));
```

## 4. RLS管理ルーティン

### 4.1 日常運用

1. **開発環境**: RLSは常に有効にして開発
2. **テスト**: service_roleキーを使用してRLSバイパステストを実施
3. **本番環境**: 必ずRLSを有効化

### 4.2 トラブルシューティング

#### 無限再帰エラーが発生した場合

```sql
-- 一時的にRLSを無効化
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;

-- ポリシーを確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'staff';

-- 問題のあるポリシーを削除して再作成
```

#### パフォーマンス問題が発生した場合

```sql
-- EXPLAINで実行計画を確認
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.staff WHERE user_id = auth.uid();

-- インデックスの確認と作成
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff(user_id);
```

### 4.3 監視項目

- [ ] RLS有効化状態の定期確認
- [ ] クエリパフォーマンスの監視
- [ ] エラーログの確認（特に無限再帰）
- [ ] 新規テーブル追加時のRLS設定

## 5. ベストプラクティス (2025年版Supabase公式推奨)

### 5.1 パフォーマンス最適化

1. **インデックス作成**: RLSポリシーで使用する全カラムにインデックスを作成
2. **SELECT句でラップ**: `(SELECT auth.uid())`のように関数をSELECT句でラップ
3. **IN/ANY演算子の使用**: JOINより`IN (SELECT ...)`パターンを優先
4. **Security Definer関数**: 複雑なロジックは関数化してRLSをバイパス

### 5.2 セキュリティ

1. **常にRLSを有効化**: publicスキーマの全テーブルでRLSを有効化
2. **user_metadataは使用禁止**: `raw_app_meta_data`を使用
3. **ロールを明示**: `TO authenticated`でロールを指定
4. **Service Roleキーの保護**: ブラウザに露出させない

### 5.3 テスト戦略

1. **RLSオン/オフでの比較**: パフォーマンス問題の切り分け
2. **各ロールでのテスト**: anon、authenticated、各権限レベル
3. **境界値テスト**: 大量データでのパフォーマンステスト

## 6. 移行手順

### 6.1 新規環境セットアップ

```bash
# 1. マイグレーション実行
supabase db push

# 2. RLS設定SQL実行（Supabase SQL Editor）
-- 015_mvp_rls_setup.sql を実行

# 3. 動作確認
npm run test:rls
```

### 6.2 既存環境への適用

```sql
-- 1. 現状確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- 2. バックアップ
pg_dump -h <host> -U <user> -d <database> > backup.sql

-- 3. RLS適用
-- 015_mvp_rls_setup.sql を実行

-- 4. 動作確認
SELECT * FROM public.staff LIMIT 1;
```

## 7. チェックリスト

### 初期セットアップ
- [ ] インデックスを作成した
- [ ] RLSポリシーを適用した
- [ ] Service Roleキーを環境変数に設定した
- [ ] 各ロールで動作確認した

### 定期メンテナンス（月次）
- [ ] RLS有効化状態の確認
- [ ] パフォーマンスメトリクスの確認
- [ ] エラーログの確認
- [ ] ポリシーの見直し

### リリース前チェック
- [ ] 全テーブルのRLS有効化確認
- [ ] 本番データでのパフォーマンステスト
- [ ] セキュリティ監査の実施
- [ ] ドキュメントの更新

## 8. 参考資料

- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices)
- [Supabase RLS Simplified](https://supabase.com/docs/guides/troubleshooting/rls-simplified)
- [Row Level Security Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

このガイドは定期的に更新してください。質問や改善提案は issue として登録してください。