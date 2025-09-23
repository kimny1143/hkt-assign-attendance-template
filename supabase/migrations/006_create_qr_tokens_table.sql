-- 006_create_qr_tokens_table.sql
-- QRトークンテーブルの作成
-- 実行日: 2025-09-23

-- ============================================
-- QRトークンテーブルの作成
-- ============================================

-- qr_tokensテーブルを作成
CREATE TABLE IF NOT EXISTS "public"."qr_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shift_id" UUID NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "purpose" TEXT NOT NULL CHECK (purpose IN ('checkin', 'checkout')),
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMPTZ,
    "used_by" UUID,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "qr_tokens_pkey" PRIMARY KEY ("id")
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS "idx_qr_tokens_token" ON "public"."qr_tokens" ("token");
CREATE INDEX IF NOT EXISTS "idx_qr_tokens_shift_id" ON "public"."qr_tokens" ("shift_id");
CREATE INDEX IF NOT EXISTS "idx_qr_tokens_expires_at" ON "public"."qr_tokens" ("expires_at");
CREATE INDEX IF NOT EXISTS "idx_qr_tokens_is_used" ON "public"."qr_tokens" ("is_used");

-- 外部キー制約の追加
ALTER TABLE "public"."qr_tokens"
    ADD CONSTRAINT "qr_tokens_shift_id_fkey"
    FOREIGN KEY ("shift_id")
    REFERENCES "public"."shifts" ("id")
    ON DELETE CASCADE;

ALTER TABLE "public"."qr_tokens"
    ADD CONSTRAINT "qr_tokens_used_by_fkey"
    FOREIGN KEY ("used_by")
    REFERENCES "public"."staff" ("id")
    ON DELETE SET NULL;

-- トリガー関数: updated_atの自動更新
CREATE OR REPLACE FUNCTION "public"."update_qr_tokens_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成
CREATE TRIGGER "update_qr_tokens_updated_at_trigger"
    BEFORE UPDATE ON "public"."qr_tokens"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_qr_tokens_updated_at"();

-- RLSポリシーの設定
ALTER TABLE "public"."qr_tokens" ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは全てのトークンを閲覧可能（一時的に全ユーザーに許可）
CREATE POLICY "Authenticated users can view qr_tokens" ON "public"."qr_tokens"
    FOR SELECT
    TO authenticated
    USING (true);

-- 認証済みユーザーはトークンを作成可能（一時的に全ユーザーに許可）
CREATE POLICY "Authenticated users can create qr_tokens" ON "public"."qr_tokens"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 認証済みユーザーはトークンを更新可能（一時的に全ユーザーに許可）
CREATE POLICY "Authenticated users can update qr_tokens" ON "public"."qr_tokens"
    FOR UPDATE
    TO authenticated
    USING (true);

-- ============================================
-- コメント
-- ============================================
COMMENT ON TABLE "public"."qr_tokens" IS 'シフト認証用のQRトークン';
COMMENT ON COLUMN "public"."qr_tokens"."id" IS 'トークンID';
COMMENT ON COLUMN "public"."qr_tokens"."shift_id" IS 'シフトID';
COMMENT ON COLUMN "public"."qr_tokens"."token" IS 'トークン文字列（ユニーク）';
COMMENT ON COLUMN "public"."qr_tokens"."purpose" IS '用途（checkin/checkout）';
COMMENT ON COLUMN "public"."qr_tokens"."is_used" IS '使用済みフラグ';
COMMENT ON COLUMN "public"."qr_tokens"."used_at" IS '使用日時';
COMMENT ON COLUMN "public"."qr_tokens"."used_by" IS '使用者（スタッフID）';
COMMENT ON COLUMN "public"."qr_tokens"."expires_at" IS '有効期限';
COMMENT ON COLUMN "public"."qr_tokens"."created_at" IS '作成日時';
COMMENT ON COLUMN "public"."qr_tokens"."updated_at" IS '更新日時';

-- ============================================
-- ログ記録
-- ============================================
INSERT INTO "public"."schema_migrations" (version, executed_at)
VALUES ('006_create_qr_tokens_table', NOW())
ON CONFLICT (version) DO NOTHING;