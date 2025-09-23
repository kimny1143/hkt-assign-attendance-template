-- 004_create_schema_migrations.sql
-- マイグレーション履歴管理テーブルの作成
-- 実行日: 2025-01-23

-- ============================================
-- schema_migrationsテーブルの作成
-- ============================================
CREATE TABLE IF NOT EXISTS "public"."schema_migrations" (
    "version" TEXT NOT NULL,
    "executed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version")
);

-- コメント
COMMENT ON TABLE "public"."schema_migrations" IS 'データベースマイグレーション履歴';
COMMENT ON COLUMN "public"."schema_migrations"."version" IS 'マイグレーションバージョン';
COMMENT ON COLUMN "public"."schema_migrations"."executed_at" IS '実行日時';

-- 初回マイグレーション記録
INSERT INTO "public"."schema_migrations" (version, executed_at)
VALUES ('004_create_schema_migrations', NOW())
ON CONFLICT (version) DO NOTHING;