-- 007_standardize_timestamp_columns.sql
-- タイムスタンプカラムの命名規則統一（_ts → _at）
-- 実行日: 2025-09-23

-- ============================================
-- 注意事項
-- ============================================
-- このマイグレーションは以下のカラム名を変更します：
-- shifts.start_ts → shifts.start_at
-- shifts.end_ts → shifts.end_at
-- attendances.check_in_ts → attendances.checkin_at
-- attendances.check_out_ts → attendances.checkout_at
--
-- アプリケーションコードの更新が必要です

-- ============================================
-- 1. shiftsテーブルのカラム名変更
-- ============================================

-- start_ts → start_at
ALTER TABLE "public"."shifts"
RENAME COLUMN "start_ts" TO "start_at";

-- end_ts → end_at
ALTER TABLE "public"."shifts"
RENAME COLUMN "end_ts" TO "end_at";

-- コメントの更新
COMMENT ON COLUMN "public"."shifts"."start_at" IS 'シフト開始日時';
COMMENT ON COLUMN "public"."shifts"."end_at" IS 'シフト終了日時';

-- ============================================
-- 2. attendancesテーブルのカラム名変更
-- ============================================

-- check_in_ts → checkin_at
ALTER TABLE "public"."attendances"
RENAME COLUMN "check_in_ts" TO "checkin_at";

-- check_out_ts → checkout_at
ALTER TABLE "public"."attendances"
RENAME COLUMN "check_out_ts" TO "checkout_at";

-- コメントの更新
COMMENT ON COLUMN "public"."attendances"."checkin_at" IS '出勤時刻';
COMMENT ON COLUMN "public"."attendances"."checkout_at" IS '退勤時刻';

-- ============================================
-- 3. ビューの再作成
-- ============================================

-- v_payroll_monthlyビューの再作成
DROP VIEW IF EXISTS "public"."v_payroll_monthly";

CREATE OR REPLACE VIEW "public"."v_payroll_monthly" AS
SELECT
    s.id AS staff_id,
    s.name AS staff_name,
    s.email AS staff_email,
    DATE_TRUNC('month', a.checkin_at AT TIME ZONE 'Asia/Tokyo')::date AS month,
    COUNT(DISTINCT DATE(a.checkin_at AT TIME ZONE 'Asia/Tokyo')) AS work_days,
    SUM(
        EXTRACT(EPOCH FROM (
            COALESCE(a.checkout_at, a.checkin_at + INTERVAL '8 hours') - a.checkin_at
        )) / 3600
    ) AS total_hours,
    ARRAY_AGG(
        JSON_BUILD_OBJECT(
            'date', DATE(a.checkin_at AT TIME ZONE 'Asia/Tokyo'),
            'checkin', a.checkin_at,
            'checkout', a.checkout_at,
            'hours', EXTRACT(EPOCH FROM (
                COALESCE(a.checkout_at, a.checkin_at + INTERVAL '8 hours') - a.checkin_at
            )) / 3600
        )
        ORDER BY a.checkin_at
    ) AS daily_records
FROM
    staff s
    LEFT JOIN attendances a ON s.id = a.staff_id
WHERE
    a.checkin_at IS NOT NULL
GROUP BY
    s.id, s.name, s.email, DATE_TRUNC('month', a.checkin_at AT TIME ZONE 'Asia/Tokyo');

COMMENT ON VIEW "public"."v_payroll_monthly" IS '月次給与計算用の勤怠サマリービュー（命名規則統一版）';

-- ============================================
-- 4. 関数の更新（もしstart_ts/end_tsを参照している関数があれば）
-- ============================================
-- 現時点では該当する関数は見つかりませんでした

-- ============================================
-- 5. インデックスの確認と再作成（必要に応じて）
-- ============================================
-- カラム名変更によりインデックスは自動的に更新されます

-- ============================================
-- マイグレーション完了の記録
-- ============================================
INSERT INTO "public"."schema_migrations" (version, executed_at)
VALUES ('007_standardize_timestamp_columns', NOW())
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- 確認用クエリ（コメントアウト）
-- ============================================
-- 以下のクエリで変更が正しく適用されたか確認できます：
--
-- SELECT
--     column_name,
--     data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--     AND table_name IN ('shifts', 'attendances')
--     AND column_name LIKE '%_at'
-- ORDER BY table_name, column_name;