-- 005_cleanup_backup_tables.sql
-- バックアップテーブルの安全な削除
-- 実行日: 2025-01-23

-- ============================================
-- 削除前の確認（実行前に必ず確認してください）
-- ============================================
-- 以下のクエリでバックアップテーブルの存在を確認
-- SELECT
--     table_name,
--     pg_size_pretty(pg_total_relation_size('"'||table_schema||'"."'||table_name||'"')) as size
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND (table_name LIKE '%_backup_%' OR table_name LIKE 'cleanup_%')
-- ORDER BY table_name;

-- ============================================
-- バックアップテーブルの削除
-- ============================================

-- 1. cleanup関連のバックアップテーブル削除
DROP TABLE IF EXISTS "public"."cleanup_backup_summary_20250120" CASCADE;
DROP TABLE IF EXISTS "public"."cleanup_report_20250120" CASCADE;

-- 2. roles関連のバックアップテーブル削除
DROP TABLE IF EXISTS "public"."roles_backup_20250120" CASCADE;
DROP TABLE IF EXISTS "public"."shifts_role_mapping_backup_20250120" CASCADE;

-- 3. staff_skills関連のバックアップテーブル削除
DROP TABLE IF EXISTS "public"."staff_skill_tags_backup_20250120" CASCADE;

-- 4. 関連シーケンスの削除
DROP SEQUENCE IF EXISTS "public"."cleanup_report_20250120_id_seq" CASCADE;

-- ============================================
-- 削除完了の確認
-- ============================================
-- 以下のクエリで削除が完了したことを確認
-- SELECT COUNT(*) as remaining_backup_tables
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND (table_name LIKE '%_backup_%' OR table_name LIKE 'cleanup_%');
--
-- 期待値: 0

-- ============================================
-- ログ記録
-- ============================================
-- マイグレーション実行記録
INSERT INTO "public"."schema_migrations" (version, executed_at)
VALUES ('005_cleanup_backup_tables', NOW())
ON CONFLICT (version) DO NOTHING;