-- ============================================
-- EVENT & SHIFT TEMPLATE SYSTEM MIGRATION
-- HKT Staff Assignment & Attendance Management System
-- Migration Date: 2025-09-24
-- ============================================
-- この移行では以下の機能を追加します:
-- 1. イベントテンプレート管理
-- 2. シフトテンプレート管理
-- 3. テンプレートからのイベント/シフト作成
-- 4. デフォルトテンプレートの挿入
-- 5. 適切なRLSポリシーの設定
-- ============================================

-- セッション設定のリセット
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

BEGIN;

-- ============================================
-- 1. イベントテンプレートテーブルの作成
-- ============================================

CREATE TABLE IF NOT EXISTS "public"."event_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'general'::"text",
    "default_duration_hours" integer DEFAULT 8,
    "default_setup_time_minutes" integer DEFAULT 120,
    "default_breakdown_time_minutes" integer DEFAULT 90,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "event_templates_category_check" CHECK (("category" = ANY (ARRAY['concert'::"text", 'theater'::"text", 'corporate'::"text", 'wedding'::"text", 'festival'::"text", 'general'::"text"]))),
    CONSTRAINT "event_templates_default_duration_hours_check" CHECK (("default_duration_hours" > 0 AND "default_duration_hours" <= 24)),
    CONSTRAINT "event_templates_default_setup_time_minutes_check" CHECK (("default_setup_time_minutes" >= 0 AND "default_setup_time_minutes" <= 480)),
    CONSTRAINT "event_templates_default_breakdown_time_minutes_check" CHECK (("default_breakdown_time_minutes" >= 0 AND "default_breakdown_time_minutes" <= 480))
);

ALTER TABLE "public"."event_templates" OWNER TO "postgres";
COMMENT ON TABLE "public"."event_templates" IS 'イベントテンプレート - 定型的なイベント設定のテンプレート';
COMMENT ON COLUMN "public"."event_templates"."name" IS 'テンプレート名';
COMMENT ON COLUMN "public"."event_templates"."description" IS 'テンプレートの説明';
COMMENT ON COLUMN "public"."event_templates"."category" IS 'イベントカテゴリ (concert/theater/corporate/wedding/festival/general)';
COMMENT ON COLUMN "public"."event_templates"."default_duration_hours" IS 'デフォルト イベント時間（時間）';
COMMENT ON COLUMN "public"."event_templates"."default_setup_time_minutes" IS 'デフォルト 設営時間（分）';
COMMENT ON COLUMN "public"."event_templates"."default_breakdown_time_minutes" IS 'デフォルト 撤収時間（分）';
COMMENT ON COLUMN "public"."event_templates"."is_active" IS 'アクティブフラグ';
COMMENT ON COLUMN "public"."event_templates"."created_by" IS 'テンプレート作成者のスタッフID';

-- ============================================
-- 2. シフトテンプレートテーブルの作成
-- ============================================

CREATE TABLE IF NOT EXISTS "public"."shift_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_template_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "skill_id" integer NOT NULL,
    "start_offset_minutes" integer DEFAULT 0 NOT NULL,
    "end_offset_minutes" integer DEFAULT 0 NOT NULL,
    "required_count" integer DEFAULT 1 NOT NULL,
    "description" "text",
    "priority" integer DEFAULT 1 NOT NULL,
    "is_critical" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "shift_templates_start_offset_minutes_check" CHECK (("start_offset_minutes" >= -480 AND "start_offset_minutes" <= 480)),
    CONSTRAINT "shift_templates_end_offset_minutes_check" CHECK (("end_offset_minutes" >= -480 AND "end_offset_minutes" <= 480)),
    CONSTRAINT "shift_templates_required_count_check" CHECK (("required_count" > 0 AND "required_count" <= 20)),
    CONSTRAINT "shift_templates_priority_check" CHECK (("priority" >= 1 AND "priority" <= 5))
);

ALTER TABLE "public"."shift_templates" OWNER TO "postgres";
COMMENT ON TABLE "public"."shift_templates" IS 'シフトテンプレート - イベントテンプレートに含まれるシフトパターン';
COMMENT ON COLUMN "public"."shift_templates"."event_template_id" IS '親となるイベントテンプレートID';
COMMENT ON COLUMN "public"."shift_templates"."name" IS 'シフト名';
COMMENT ON COLUMN "public"."shift_templates"."skill_id" IS '必要なスキルID';
COMMENT ON COLUMN "public"."shift_templates"."start_offset_minutes" IS 'イベント開始時刻からの開始オフセット（分）';
COMMENT ON COLUMN "public"."shift_templates"."end_offset_minutes" IS 'イベント開始時刻からの終了オフセット（分）';
COMMENT ON COLUMN "public"."shift_templates"."required_count" IS '必要人数';
COMMENT ON COLUMN "public"."shift_templates"."priority" IS '優先度 (1=最高 5=最低)';
COMMENT ON COLUMN "public"."shift_templates"."is_critical" IS '必須シフトフラグ';

-- ============================================
-- 3. 既存テーブルへのテンプレート参照列の追加
-- ============================================

-- eventsテーブルにtemplate_id列を追加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'template_id'
    ) THEN
        ALTER TABLE "public"."events" ADD COLUMN "template_id" "uuid";
        COMMENT ON COLUMN "public"."events"."template_id" IS '使用されたイベントテンプレートID（オプション）';
    END IF;
END
$$;

-- shiftsテーブルにtemplate_id列を追加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shifts' AND column_name = 'template_id'
    ) THEN
        ALTER TABLE "public"."shifts" ADD COLUMN "template_id" "uuid";
        COMMENT ON COLUMN "public"."shifts"."template_id" IS '使用されたシフトテンプレートID（オプション）';
    END IF;
END
$$;

-- ============================================
-- 4. プライマリキーと制約の設定
-- ============================================

ALTER TABLE ONLY "public"."event_templates"
    ADD CONSTRAINT "event_templates_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."event_templates"
    ADD CONSTRAINT "event_templates_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."shift_templates"
    ADD CONSTRAINT "shift_templates_pkey" PRIMARY KEY ("id");

-- ============================================
-- 5. インデックスの作成
-- ============================================

CREATE INDEX IF NOT EXISTS "idx_event_templates_category" ON "public"."event_templates" USING "btree" ("category");
CREATE INDEX IF NOT EXISTS "idx_event_templates_is_active" ON "public"."event_templates" USING "btree" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_event_templates_created_by" ON "public"."event_templates" USING "btree" ("created_by");

CREATE INDEX IF NOT EXISTS "idx_shift_templates_event_template_id" ON "public"."shift_templates" USING "btree" ("event_template_id");
CREATE INDEX IF NOT EXISTS "idx_shift_templates_skill_id" ON "public"."shift_templates" USING "btree" ("skill_id");
CREATE INDEX IF NOT EXISTS "idx_shift_templates_priority" ON "public"."shift_templates" USING "btree" ("priority");

CREATE INDEX IF NOT EXISTS "idx_events_template_id" ON "public"."events" USING "btree" ("template_id");
CREATE INDEX IF NOT EXISTS "idx_shifts_template_id" ON "public"."shifts" USING "btree" ("template_id");

-- ============================================
-- 6. 外部キー制約の追加
-- ============================================

ALTER TABLE ONLY "public"."shift_templates"
    ADD CONSTRAINT "shift_templates_event_template_id_fkey"
    FOREIGN KEY ("event_template_id") REFERENCES "public"."event_templates"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."shift_templates"
    ADD CONSTRAINT "shift_templates_skill_id_fkey"
    FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."event_templates"
    ADD CONSTRAINT "event_templates_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "public"."event_templates"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "public"."shift_templates"("id") ON DELETE SET NULL;

-- ============================================
-- 7. トリガー関数の作成 - 更新時刻の自動更新
-- ============================================

CREATE OR REPLACE FUNCTION "public"."update_template_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_template_updated_at"() OWNER TO "postgres";
COMMENT ON FUNCTION "public"."update_template_updated_at"() IS 'テンプレートテーブルの更新時刻を自動更新するトリガー関数';

-- ============================================
-- 8. テンプレート操作関数の作成
-- ============================================

-- テンプレートからイベントを作成する関数
CREATE OR REPLACE FUNCTION "public"."create_event_from_template"(
    "p_template_id" "uuid",
    "p_venue_id" "uuid",
    "p_event_date" "date",
    "p_start_time" time without time zone,
    "p_event_name" "text" DEFAULT NULL
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_event_id UUID;
    v_template RECORD;
    v_shift_template RECORD;
    v_setup_time TIME;
    v_breakdown_time TIME;
    v_shift_start TIMESTAMP WITH TIME ZONE;
    v_shift_end TIMESTAMP WITH TIME ZONE;
    v_base_datetime TIMESTAMP WITH TIME ZONE;
BEGIN
    -- テンプレートの取得
    SELECT * INTO v_template
    FROM public.event_templates
    WHERE id = p_template_id AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active event template not found: %', p_template_id;
    END IF;

    -- 管理者・マネージャー権限チェック
    IF NOT public.is_admin_or_manager_user() THEN
        RAISE EXCEPTION 'Only administrators and managers can create events from templates';
    END IF;

    -- 基準日時の計算
    v_base_datetime := (p_event_date || ' ' || p_start_time)::TIMESTAMP WITH TIME ZONE;

    -- 設営・撤収時刻の計算
    v_setup_time := p_start_time - (v_template.default_setup_time_minutes || ' minutes')::INTERVAL;
    v_breakdown_time := p_start_time + (v_template.default_duration_hours || ' hours')::INTERVAL + (v_template.default_breakdown_time_minutes || ' minutes')::INTERVAL;

    -- イベントの作成
    INSERT INTO public.events (
        venue_id,
        event_date,
        open_time,
        start_time,
        end_time,
        name,
        notes,
        template_id
    ) VALUES (
        p_venue_id,
        p_event_date,
        v_setup_time,
        p_start_time,
        v_breakdown_time,
        COALESCE(p_event_name, v_template.name || ' - ' || p_event_date),
        'テンプレート「' || v_template.name || '」から作成',
        p_template_id
    ) RETURNING id INTO v_event_id;

    -- シフトテンプレートからシフトを作成
    FOR v_shift_template IN
        SELECT * FROM public.shift_templates
        WHERE event_template_id = p_template_id
        ORDER BY priority, name
    LOOP
        -- シフト開始・終了時刻の計算
        v_shift_start := v_base_datetime + (v_shift_template.start_offset_minutes || ' minutes')::INTERVAL;
        v_shift_end := v_base_datetime + (v_shift_template.end_offset_minutes || ' minutes')::INTERVAL;

        -- シフトの作成
        INSERT INTO public.shifts (
            event_id,
            name,
            skill_id,
            start_at,
            end_at,
            required,
            template_id
        ) VALUES (
            v_event_id,
            v_shift_template.name,
            v_shift_template.skill_id,
            v_shift_start,
            v_shift_end,
            v_shift_template.required_count,
            v_shift_template.id
        );
    END LOOP;

    RETURN v_event_id;
END;
$$;

ALTER FUNCTION "public"."create_event_from_template"("p_template_id" "uuid", "p_venue_id" "uuid", "p_event_date" "date", "p_start_time" time without time zone, "p_event_name" "text") OWNER TO "postgres";
COMMENT ON FUNCTION "public"."create_event_from_template" IS 'テンプレートからイベントとシフトを一括作成する関数';

-- テンプレートの検証関数
CREATE OR REPLACE FUNCTION "public"."validate_event_template"("p_template_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_result JSON;
    v_template RECORD;
    v_shift_count INTEGER;
    v_skill_coverage INTEGER;
    v_critical_shifts INTEGER;
    v_total_skills INTEGER;
    v_warnings TEXT[] := ARRAY[]::TEXT[];
    v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- テンプレートの存在確認
    SELECT * INTO v_template
    FROM public.event_templates
    WHERE id = p_template_id;

    IF NOT FOUND THEN
        v_errors := array_append(v_errors, 'Template not found');
        v_result := json_build_object(
            'is_valid', false,
            'errors', v_errors,
            'warnings', v_warnings
        );
        RETURN v_result;
    END IF;

    -- シフト数のチェック
    SELECT COUNT(*) INTO v_shift_count
    FROM public.shift_templates
    WHERE event_template_id = p_template_id;

    IF v_shift_count = 0 THEN
        v_errors := array_append(v_errors, 'No shifts defined in template');
    END IF;

    -- スキルカバレッジのチェック
    SELECT COUNT(DISTINCT skill_id) INTO v_skill_coverage
    FROM public.shift_templates
    WHERE event_template_id = p_template_id;

    SELECT COUNT(*) INTO v_total_skills
    FROM public.skills;

    IF v_skill_coverage < v_total_skills THEN
        v_warnings := array_append(v_warnings,
            'Template does not cover all skills (' || v_skill_coverage || '/' || v_total_skills || ')');
    END IF;

    -- 重要シフトの確認
    SELECT COUNT(*) INTO v_critical_shifts
    FROM public.shift_templates
    WHERE event_template_id = p_template_id AND is_critical = true;

    IF v_critical_shifts = 0 THEN
        v_warnings := array_append(v_warnings, 'No critical shifts defined');
    END IF;

    -- 結果の構築
    v_result := json_build_object(
        'is_valid', array_length(v_errors, 1) IS NULL,
        'template_name', v_template.name,
        'shift_count', v_shift_count,
        'skill_coverage', v_skill_coverage,
        'total_skills', v_total_skills,
        'critical_shifts', v_critical_shifts,
        'errors', v_errors,
        'warnings', v_warnings
    );

    RETURN v_result;
END;
$$;

ALTER FUNCTION "public"."validate_event_template"("p_template_id" "uuid") OWNER TO "postgres";
COMMENT ON FUNCTION "public"."validate_event_template" IS 'イベントテンプレートの整合性を検証する関数';

-- ============================================
-- 9. トリガーの設定
-- ============================================

CREATE OR REPLACE TRIGGER "update_event_templates_updated_at_trigger"
    BEFORE UPDATE ON "public"."event_templates"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_template_updated_at"();

CREATE OR REPLACE TRIGGER "update_shift_templates_updated_at_trigger"
    BEFORE UPDATE ON "public"."shift_templates"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_template_updated_at"();

-- ============================================
-- 10. Row Level Security (RLS) の設定
-- ============================================

-- RLSの有効化
ALTER TABLE "public"."event_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."shift_templates" ENABLE ROW LEVEL SECURITY;

-- イベントテンプレートのRLSポリシー
CREATE POLICY "event_templates_select_all" ON "public"."event_templates"
    FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "event_templates_insert_admin_manager" ON "public"."event_templates"
    FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_manager_user"());

CREATE POLICY "event_templates_update_admin_manager" ON "public"."event_templates"
    FOR UPDATE TO "authenticated"
    USING ("public"."is_admin_or_manager_user"())
    WITH CHECK ("public"."is_admin_or_manager_user"());

CREATE POLICY "event_templates_delete_admin_only" ON "public"."event_templates"
    FOR DELETE TO "authenticated" USING ("public"."is_admin_user"());

-- シフトテンプレートのRLSポリシー
CREATE POLICY "shift_templates_select_all" ON "public"."shift_templates"
    FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "shift_templates_insert_admin_manager" ON "public"."shift_templates"
    FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_manager_user"());

CREATE POLICY "shift_templates_update_admin_manager" ON "public"."shift_templates"
    FOR UPDATE TO "authenticated"
    USING ("public"."is_admin_or_manager_user"())
    WITH CHECK ("public"."is_admin_or_manager_user"());

CREATE POLICY "shift_templates_delete_admin_manager" ON "public"."shift_templates"
    FOR DELETE TO "authenticated" USING ("public"."is_admin_or_manager_user"());

-- ============================================
-- 11. 権限の付与
-- ============================================

-- テーブル権限
GRANT ALL ON TABLE "public"."event_templates" TO "anon";
GRANT ALL ON TABLE "public"."event_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."event_templates" TO "service_role";

GRANT ALL ON TABLE "public"."shift_templates" TO "anon";
GRANT ALL ON TABLE "public"."shift_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."shift_templates" TO "service_role";

-- 関数権限
GRANT ALL ON FUNCTION "public"."create_event_from_template"("p_template_id" "uuid", "p_venue_id" "uuid", "p_event_date" "date", "p_start_time" time without time zone, "p_event_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_event_from_template"("p_template_id" "uuid", "p_venue_id" "uuid", "p_event_date" "date", "p_start_time" time without time zone, "p_event_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_event_from_template"("p_template_id" "uuid", "p_venue_id" "uuid", "p_event_date" "date", "p_start_time" time without time zone, "p_event_name" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."validate_event_template"("p_template_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_event_template"("p_template_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_event_template"("p_template_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."update_template_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_template_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_template_updated_at"() TO "service_role";

-- ============================================
-- 12. デフォルトテンプレートデータの挿入
-- ============================================

-- 標準コンサートテンプレート
INSERT INTO "public"."event_templates" (
    "id",
    "name",
    "description",
    "category",
    "default_duration_hours",
    "default_setup_time_minutes",
    "default_breakdown_time_minutes",
    "notes"
) VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    '標準コンサート',
    'ライブハウスやコンサートホールでの標準的なコンサート設定',
    'concert',
    3,
    180,
    120,
    'PA、照明、バックステージの基本セットアップを含む'
) ON CONFLICT (name) DO NOTHING;

-- シアター公演テンプレート
INSERT INTO "public"."event_templates" (
    "id",
    "name",
    "description",
    "category",
    "default_duration_hours",
    "default_setup_time_minutes",
    "default_breakdown_time_minutes",
    "notes"
) VALUES (
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'シアター公演',
    '劇場での演劇・ミュージカル公演の標準設定',
    'theater',
    4,
    240,
    150,
    '舞台照明と音響に特化したシフト構成'
) ON CONFLICT (name) DO NOTHING;

-- 企業イベントテンプレート
INSERT INTO "public"."event_templates" (
    "id",
    "name",
    "description",
    "category",
    "default_duration_hours",
    "default_setup_time_minutes",
    "default_breakdown_time_minutes",
    "notes"
) VALUES (
    'a0000000-0000-0000-0000-000000000003'::uuid,
    '企業イベント',
    '企業の会議、プレゼンテーション、セミナーなどの標準設定',
    'corporate',
    2,
    90,
    60,
    'シンプルなPA設定とプレゼンテーション支援'
) ON CONFLICT (name) DO NOTHING;

-- 標準コンサートのシフトテンプレート
INSERT INTO "public"."shift_templates" (
    "event_template_id",
    "name",
    "skill_id",
    "start_offset_minutes",
    "end_offset_minutes",
    "required_count",
    "description",
    "priority",
    "is_critical"
) VALUES
-- PA担当（設営から撤収まで）
('a0000000-0000-0000-0000-000000000001'::uuid, 'PA設営・運用', 1, -180, 240, 1, 'PA機材のセットアップから撤収まで', 1, true),
-- 照明担当（設営から撤収まで）
('a0000000-0000-0000-0000-000000000001'::uuid, '照明設営・運用', 3, -180, 240, 1, '照明機材のセットアップから撤収まで', 1, true),
-- 音源再生担当（公演中のみ）
('a0000000-0000-0000-0000-000000000001'::uuid, '音源再生運用', 2, -30, 210, 1, '公演中の音源再生操作', 2, false),
-- バックステージ担当（公演前後）
('a0000000-0000-0000-0000-000000000001'::uuid, 'バックステージ運用', 4, -60, 180, 1, 'アーティストサポートと進行管理', 3, false);

-- シアター公演のシフトテンプレート
INSERT INTO "public"."shift_templates" (
    "event_template_id",
    "name",
    "skill_id",
    "start_offset_minutes",
    "end_offset_minutes",
    "required_count",
    "description",
    "priority",
    "is_critical"
) VALUES
-- PA担当（設営から撤収まで）
('a0000000-0000-0000-0000-000000000002'::uuid, 'PA設営・運用', 1, -240, 270, 1, 'PA機材のセットアップから撤収まで', 1, true),
-- 照明担当（設営から撤収まで、重要度高）
('a0000000-0000-0000-0000-000000000002'::uuid, '舞台照明設営・運用', 3, -240, 270, 2, '舞台照明のセットアップから撤収まで（2名体制）', 1, true),
-- 音源再生担当（リハーサルから本番まで）
('a0000000-0000-0000-0000-000000000002'::uuid, '音響効果・再生', 2, -120, 240, 1, 'リハーサルから本番までの音響効果', 2, false),
-- バックステージ担当（公演前後）
('a0000000-0000-0000-0000-000000000002'::uuid, '舞台進行・管理', 4, -90, 210, 2, '舞台進行管理とキャストサポート（2名体制）', 2, true);

-- 企業イベントのシフトテンプレート
INSERT INTO "public"."shift_templates" (
    "event_template_id",
    "name",
    "skill_id",
    "start_offset_minutes",
    "end_offset_minutes",
    "required_count",
    "description",
    "priority",
    "is_critical"
) VALUES
-- PA担当（設営から撤収まで）
('a0000000-0000-0000-0000-000000000003'::uuid, 'PA設営・運用', 1, -90, 180, 1, 'PA機材のセットアップから撤収まで', 1, true),
-- 音源再生担当（イベント中）
('a0000000-0000-0000-0000-000000000003'::uuid, '音響効果・BGM', 2, -30, 150, 1, 'BGMと音響効果の再生管理', 2, false);

-- ============================================
-- 13. マイグレーション履歴への記録
-- ============================================

INSERT INTO "public"."schema_migrations" ("version")
VALUES ('20250124_event_shift_templates')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================
-- 14. 動作確認用クエリ（実行は任意）
-- ============================================

-- 作成されたテンプレートの確認
-- SELECT
--     et.name as template_name,
--     et.category,
--     COUNT(st.id) as shift_count
-- FROM event_templates et
-- LEFT JOIN shift_templates st ON et.id = st.event_template_id
-- GROUP BY et.id, et.name, et.category
-- ORDER BY et.name;

-- テンプレート検証の実行例
-- SELECT public.validate_event_template('a0000000-0000-0000-0000-000000000001'::uuid);

-- ============================================
-- MIGRATION SUMMARY
-- ============================================
-- ✅ イベントテンプレートテーブルの作成
-- ✅ シフトテンプレートテーブルの作成
-- ✅ 既存テーブルへのtemplate_id列追加
-- ✅ 適切な制約とインデックスの設定
-- ✅ 外部キー制約の設定
-- ✅ テンプレート操作関数の実装
-- ✅ 自動更新トリガーの設定
-- ✅ RLSポリシーの設定
-- ✅ 権限の付与
-- ✅ デフォルトテンプレートデータの挿入
-- ✅ マイグレーション履歴の記録
--
-- 機能概要:
-- - 3つのデフォルトテンプレート（標準コンサート、シアター公演、企業イベント）
-- - テンプレートからの一括イベント/シフト作成機能
-- - テンプレート検証機能
-- - 管理者・マネージャーによるテンプレート管理
-- - 既存データとの後方互換性維持
-- ============================================