# RLS無限再帰問題の解決

## 問題の概要

現在のSupabaseデータベースで「infinite recursion detected in policy for relation "user_roles"」エラーが発生し、管理者でも会場（venues）などの削除ができない状況でした。

## 根本原因の分析

### 1. 無限再帰の原因
```sql
-- 問題のある関数
CREATE OR REPLACE FUNCTION "public"."is_admin"("user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.staff s
        INNER JOIN public.user_roles ur ON s.id = ur.staff_id  -- ←この結合が問題
        WHERE s.user_id = user_uuid
        AND ur.role = 'admin'
    );
END;
$$;
```

### 2. 循環参照の流れ
1. 管理者が `venues` テーブルから削除を実行
2. `venues_delete_admin` ポリシーが `is_admin()` 関数を呼び出し
3. `is_admin()` 関数が `user_roles` テーブルにアクセス
4. `user_roles` テーブルにもRLSが有効で、管理者確認が必要
5. 再び `is_admin()` 関数が呼ばれる → **無限再帰発生**

### 3. その他の問題
- 67個ものRLSポリシーが重複して定義されていた
- 同じテーブルに対して複数の類似ポリシーが存在
- `public` スキーマに権限チェック関数が配置されていた

## 解決策

### 1. user_rolesテーブルのRLS無効化
```sql
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
```
→ 権限チェックの基盤となるテーブルはRLSを無効にして循環参照を回避

### 2. auth スキーマに安全な関数を移動
```sql
-- 安全な権限チェック関数
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- user_rolesテーブルはRLS無効なので安全にアクセス可能
    SELECT ur.role INTO user_role
    FROM public.staff s
    JOIN public.user_roles ur ON s.id = ur.staff_id
    WHERE s.user_id = auth.uid()
    ORDER BY CASE ur.role
        WHEN 'admin' THEN 1
        WHEN 'manager' THEN 2
        WHEN 'staff' THEN 3
        ELSE 4
    END
    LIMIT 1;

    RETURN COALESCE(user_role, 'staff');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### 3. シンプルで一貫性のあるポリシー設計
- 各テーブルに対して明確で重複のないポリシーを設定
- 権限レベル別の一貫したルール適用

## 修正内容

### 削除されたポリシー（67個から大幅削減）
- 重複する古いポリシー群
- 問題のある `is_admin()` / `is_admin_or_manager()` 関数

### 新しいポリシー設計
- **staff**: 全員閲覧可、自分のみ更新、管理者のみ追加/削除
- **venues**: 全員閲覧可、管理者のみ管理
- **equipment**: 全員閲覧可、管理者・マネージャーが管理
- **events/shifts**: 全員閲覧可、管理者・マネージャーが管理
- **assignments**: 管理者・マネージャー＋自分の分のみ閲覧可
- **attendances**: 管理者・マネージャー＋自分の分のみ閲覧可

## マイグレーション実行手順

1. **バックアップ作成**（重要）
```sql
-- 現在のポリシー状況をバックアップ
CREATE TABLE policy_backup_20250922 AS
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

2. **マイグレーション実行**
```bash
# Supabase CLIを使用
supabase db reset

# または、SQLエディタで実行
-- 002_fix_rls_recursion.sql の内容を実行
```

3. **動作確認**
```sql
-- ポリシー数確認
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';

-- 管理者でのvenues削除テスト
DELETE FROM public.venues WHERE id = '11111111-1111-1111-1111-111111111111';
```

## 期待される結果

### Before（修正前）
- 67個のRLSポリシー
- 無限再帰エラー
- 管理者でも削除不可

### After（修正後）
- 約15-20個の整理されたポリシー
- エラーなし
- 適切な権限管理

## 今後の運用指針

### 1. RLSポリシー作成時の注意点
- 権限チェック用テーブル（user_roles）にはRLSを設定しない
- 権限チェック関数は `auth` スキーマに配置
- ポリシー名は機能別に統一命名

### 2. テスト方針
- 各権限レベル（admin/manager/staff）での操作テスト
- 特に削除操作での無限再帰チェック
- パフォーマンステスト（大量データでの動作確認）

### 3. 今後の拡張時
- 新しいテーブル追加時は一貫したポリシー設計を適用
- 権限チェック関数の再利用を推奨
- ポリシー数の定期的な監視

## 参考リンク

- [Supabase RLS ベストプラクティス](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS 公式ドキュメント](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)