
\restrict zBvpzHFhOPzIlQKhXtiO6QT3JViCchJ7dJ8z3uLVy707T7eyj1aj2IqU6w3GwPn


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'HAAS開発用シードデータ - テスト環境専用';



CREATE TYPE "public"."assignment_status" AS ENUM (
    'candidate',
    'confirmed',
    'declined',
    'fallback'
);


ALTER TYPE "public"."assignment_status" OWNER TO "postgres";


CREATE TYPE "public"."attendance_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."attendance_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."attendance_punch"("p_staff_uid" "uuid", "p_shift_id" "uuid", "p_equipment_qr" "text", "p_lat" double precision, "p_lon" double precision, "p_purpose" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_staff_id UUID;
  v_attendance_id UUID;
  v_result JSON;
BEGIN
  -- Get staff_id from user_id
  SELECT id INTO v_staff_id FROM staff WHERE user_id = p_staff_uid;

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Staff record not found for user %', p_staff_uid;
  END IF;

  -- Check assignment
  IF NOT EXISTS (
    SELECT 1 FROM assignments
    WHERE staff_id = v_staff_id AND shift_id = p_shift_id AND status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'No confirmed assignment found for this shift';
  END IF;

  -- Get existing attendance
  SELECT id INTO v_attendance_id
  FROM attendances
  WHERE staff_id = v_staff_id AND shift_id = p_shift_id;

  IF p_purpose = 'checkin' THEN
    IF v_attendance_id IS NOT NULL AND (
      SELECT check_in_ts FROM attendances WHERE id = v_attendance_id
    ) IS NOT NULL THEN
      RAISE EXCEPTION 'Already checked in for this shift';
    END IF;

    IF v_attendance_id IS NULL THEN
      INSERT INTO attendances (
        staff_id, shift_id, check_in_ts, check_in_lat, check_in_lon,
        check_in_equipment_qr, status
      ) VALUES (
        v_staff_id, p_shift_id, NOW(), p_lat, p_lon, p_equipment_qr, 'pending'
      ) RETURNING id INTO v_attendance_id;
    ELSE
      UPDATE attendances
      SET check_in_ts = NOW(), check_in_lat = p_lat, check_in_lon = p_lon,
          check_in_equipment_qr = p_equipment_qr, updated_at = NOW()
      WHERE id = v_attendance_id;
    END IF;

    v_result := json_build_object(
      'attendance_id', v_attendance_id, 'purpose', 'checkin',
      'timestamp', NOW(), 'status', 'success'
    );

  ELSIF p_purpose = 'checkout' THEN
    IF v_attendance_id IS NULL THEN
      RAISE EXCEPTION 'No attendance record found for this shift';
    END IF;

    IF (SELECT check_in_ts FROM attendances WHERE id = v_attendance_id) IS NULL THEN
      RAISE EXCEPTION 'Must check in before checking out';
    END IF;

    IF (SELECT check_out_ts FROM attendances WHERE id = v_attendance_id) IS NOT NULL THEN
      RAISE EXCEPTION 'Already checked out for this shift';
    END IF;

    UPDATE attendances
    SET check_out_ts = NOW(), check_out_lat = p_lat, check_out_lon = p_lon,
        check_out_equipment_qr = p_equipment_qr, updated_at = NOW()
    WHERE id = v_attendance_id;

    v_result := json_build_object(
      'attendance_id', v_attendance_id, 'purpose', 'checkout',
      'timestamp', NOW(), 'status', 'success'
    );

  ELSE
    RAISE EXCEPTION 'Invalid purpose: %. Must be "checkin" or "checkout"', p_purpose;
  END IF;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."attendance_punch"("p_staff_uid" "uuid", "p_shift_id" "uuid", "p_equipment_qr" "text", "p_lat" double precision, "p_lon" double precision, "p_purpose" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_role"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_staff_availability"("p_date" "date") RETURNS TABLE("staff_id" "uuid", "staff_name" "text", "is_available" boolean, "time_from" time without time zone, "time_to" time without time zone, "notes" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS staff_id,
    s.name AS staff_name,
    CASE EXTRACT(DOW FROM p_date)
      WHEN 0 THEN (ss.sunday->>'available')::boolean
      WHEN 1 THEN (ss.monday->>'available')::boolean
      WHEN 2 THEN (ss.tuesday->>'available')::boolean
      WHEN 3 THEN (ss.wednesday->>'available')::boolean
      WHEN 4 THEN (ss.thursday->>'available')::boolean
      WHEN 5 THEN (ss.friday->>'available')::boolean
      WHEN 6 THEN (ss.saturday->>'available')::boolean
    END AS is_available,
    CASE EXTRACT(DOW FROM p_date)
      WHEN 0 THEN (ss.sunday->>'time_from')::time
      WHEN 1 THEN (ss.monday->>'time_from')::time
      WHEN 2 THEN (ss.tuesday->>'time_from')::time
      WHEN 3 THEN (ss.wednesday->>'time_from')::time
      WHEN 4 THEN (ss.thursday->>'time_from')::time
      WHEN 5 THEN (ss.friday->>'time_from')::time
      WHEN 6 THEN (ss.saturday->>'time_from')::time
    END AS time_from,
    CASE EXTRACT(DOW FROM p_date)
      WHEN 0 THEN (ss.sunday->>'time_to')::time
      WHEN 1 THEN (ss.monday->>'time_to')::time
      WHEN 2 THEN (ss.tuesday->>'time_to')::time
      WHEN 3 THEN (ss.wednesday->>'time_to')::time
      WHEN 4 THEN (ss.thursday->>'time_to')::time
      WHEN 5 THEN (ss.friday->>'time_to')::time
      WHEN 6 THEN (ss.saturday->>'time_to')::time
    END AS time_to,
    ss.notes
  FROM public.staff s
  LEFT JOIN public.staff_schedules ss ON s.id = ss.staff_id
    AND p_date >= ss.week_start_date
    AND p_date <= ss.week_end_date
  WHERE s.active = true
  ORDER BY s.name;
END;
$$;


ALTER FUNCTION "public"."get_staff_availability"("p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_any_role"("required_roles" "text"[]) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
    user_role TEXT;
BEGIN
    user_role := public.get_current_user_role();
    RETURN user_role = ANY(required_roles);
END;
$$;


ALTER FUNCTION "public"."has_any_role"("required_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_or_manager_user"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN public.has_any_role(ARRAY['admin', 'manager']);
END;
$$;


ALTER FUNCTION "public"."is_admin_or_manager_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_user"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN public.has_any_role(ARRAY['admin']);
END;
$$;


ALTER FUNCTION "public"."is_admin_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_reserve_staff"("p_shift_id" "uuid") RETURNS TABLE("staff_id" "uuid", "staff_name" "text", "notification_sent" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS staff_id,
    s.name AS staff_name,
    true AS notification_sent -- Will be implemented with actual notification logic
  FROM public.assignments a
  JOIN public.staff s ON a.staff_id = s.id
  WHERE a.shift_id = p_shift_id
    AND a.is_reserve = true
    AND a.status = 'candidate'
  ORDER BY a.score DESC; -- Notify in priority order
END;
$$;


ALTER FUNCTION "public"."notify_reserve_staff"("p_shift_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_shift_requirements"("p_event_id" "uuid") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_result json;
  v_all_skills_covered boolean;
  v_multi_skill_staff_exists boolean;
  v_staff_count int;
BEGIN
  -- Check if all 4 skills are covered
  SELECT COUNT(DISTINCT sk.id) = 4 INTO v_all_skills_covered
  FROM public.skills sk
  WHERE EXISTS (
    SELECT 1 FROM public.shifts sh
    JOIN public.assignments a ON sh.id = a.shift_id
    JOIN public.staff_skills ss ON a.staff_id = ss.staff_id
    WHERE sh.event_id = p_event_id
      AND a.status = 'confirmed'
      AND ss.skill_id = sk.id
  );

  -- Count confirmed staff
  SELECT COUNT(DISTINCT a.staff_id) INTO v_staff_count
  FROM public.shifts sh
  JOIN public.assignments a ON sh.id = a.shift_id
  WHERE sh.event_id = p_event_id
    AND a.status = 'confirmed';

  -- Check if multi-skill staff exists when count > 1
  IF v_staff_count > 1 THEN
    SELECT EXISTS (
      SELECT 1 FROM (
        SELECT ss.staff_id, COUNT(DISTINCT ss.skill_id) AS skill_count
        FROM public.shifts sh
        JOIN public.assignments a ON sh.id = a.shift_id
        JOIN public.staff_skills ss ON a.staff_id = ss.staff_id
        WHERE sh.event_id = p_event_id
          AND a.status = 'confirmed'
        GROUP BY ss.staff_id
        HAVING COUNT(DISTINCT ss.skill_id) >= 2
      ) multi_skill
    ) INTO v_multi_skill_staff_exists;
  ELSE
    v_multi_skill_staff_exists := true; -- Not required for single staff
  END IF;

  v_result := json_build_object(
    'all_skills_covered', v_all_skills_covered,
    'staff_count', v_staff_count,
    'multi_skill_requirement_met', v_multi_skill_staff_exists,
    'is_valid', v_all_skills_covered AND (v_staff_count = 1 OR v_multi_skill_staff_exists)
  );

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."validate_shift_requirements"("p_event_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "status" "public"."assignment_status" DEFAULT 'candidate'::"public"."assignment_status" NOT NULL,
    "score" numeric(8,4),
    "candidate_sent_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "declined_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_reserve" boolean DEFAULT false
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "check_in_ts" timestamp with time zone,
    "check_in_lat" double precision,
    "check_in_lon" double precision,
    "check_in_equipment_qr" "text",
    "check_out_ts" timestamp with time zone,
    "check_out_lat" double precision,
    "check_out_lon" double precision,
    "check_out_equipment_qr" "text",
    "status" "public"."attendance_status" DEFAULT 'pending'::"public"."attendance_status",
    "reviewer_id" "uuid",
    "review_comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."attendances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" bigint NOT NULL,
    "actor_user_id" "uuid",
    "action" "text",
    "table_name" "text",
    "record_id" "uuid",
    "diff" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNED BY "public"."audit_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."cleanup_backup_summary_20250120" (
    "backup_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" "text",
    "record_count" integer,
    "action_planned" "text",
    "backed_up_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cleanup_backup_summary_20250120" OWNER TO "postgres";


COMMENT ON TABLE "public"."cleanup_backup_summary_20250120" IS 'ROLLBACK INSTRUCTIONS:
1. To restore roles table:
   CREATE TABLE roles AS SELECT * FROM roles_backup_20250120;

2. To restore staff.skill_tags:
   ALTER TABLE staff ADD COLUMN skill_tags text[];
   UPDATE staff s SET skill_tags = b.skill_tags
   FROM staff_skill_tags_backup_20250120 b
   WHERE s.id = b.staff_id;

3. To restore shifts.role_id:
   ALTER TABLE shifts ADD COLUMN role_id int;
   UPDATE shifts sh SET role_id = b.old_role_id
   FROM shifts_role_mapping_backup_20250120 b
   WHERE sh.id = b.shift_id;';



CREATE TABLE IF NOT EXISTS "public"."cleanup_report_20250120" (
    "id" integer NOT NULL,
    "action" "text",
    "status" "text",
    "details" "text",
    "executed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cleanup_report_20250120" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cleanup_report_20250120_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cleanup_report_20250120_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cleanup_report_20250120_id_seq" OWNED BY "public"."cleanup_report_20250120"."id";



CREATE TABLE IF NOT EXISTS "public"."equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "venue_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "qr_code" "text" NOT NULL,
    "equipment_type" "text",
    "location_hint" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "equipment_equipment_type_check" CHECK (("equipment_type" = ANY (ARRAY['lighting'::"text", 'sound'::"text", 'rigging'::"text", 'stage'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "venue_id" "uuid" NOT NULL,
    "event_date" "date" NOT NULL,
    "open_time" time without time zone,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" "text"
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attendance_id" "uuid" NOT NULL,
    "kind" "text" DEFAULT 'transport'::"text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "receipt_url" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "expenses_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles_backup_20250120" (
    "id" integer,
    "code" "text",
    "label" "text",
    "backed_up_at" timestamp with time zone,
    "backup_reason" "text"
);


ALTER TABLE "public"."roles_backup_20250120" OWNER TO "postgres";


COMMENT ON TABLE "public"."roles_backup_20250120" IS 'Backup of roles table before migration to skills table on 2025-01-20';



CREATE TABLE IF NOT EXISTS "public"."shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "start_ts" timestamp with time zone NOT NULL,
    "end_ts" timestamp with time zone NOT NULL,
    "required" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" "text",
    "skill_id" integer,
    CONSTRAINT "chk_shift_time" CHECK (("end_ts" > "start_ts"))
);


ALTER TABLE "public"."shifts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."shifts"."skill_id" IS 'Required skill for this shift - Replaces old role_id';



CREATE TABLE IF NOT EXISTS "public"."shifts_role_mapping_backup_20250120" (
    "shift_id" "uuid",
    "old_role_id" integer,
    "old_role_code" "text",
    "new_skill_id" integer,
    "new_skill_code" "text",
    "backed_up_at" timestamp with time zone
);


ALTER TABLE "public"."shifts_role_mapping_backup_20250120" OWNER TO "postgres";


COMMENT ON TABLE "public"."shifts_role_mapping_backup_20250120" IS 'Backup of shifts role-to-skill mapping on 2025-01-20';



CREATE TABLE IF NOT EXISTS "public"."skills" (
    "id" integer NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "skills_code_check" CHECK (("code" = ANY (ARRAY['pa'::"text", 'sound_operator'::"text", 'lighting'::"text", 'backstage'::"text"])))
);


ALTER TABLE "public"."skills" OWNER TO "postgres";


COMMENT ON TABLE "public"."skills" IS 'スタッフスキルマスタ (PA/音源再生/照明/バックヤード) - Replaces old roles table';



CREATE SEQUENCE IF NOT EXISTS "public"."skills_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."skills_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."skills_id_seq" OWNED BY "public"."skills"."id";



CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "code" "text",
    "name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "address" "text",
    "lat" double precision,
    "lon" double precision,
    "hourly_rate" numeric(10,2),
    "daily_rate" numeric(10,2),
    "project_rate" numeric(10,2),
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "week_start_date" "date" NOT NULL,
    "week_end_date" "date" NOT NULL,
    "monday" "jsonb" DEFAULT '{"available": false}'::"jsonb",
    "tuesday" "jsonb" DEFAULT '{"available": false}'::"jsonb",
    "wednesday" "jsonb" DEFAULT '{"available": false}'::"jsonb",
    "thursday" "jsonb" DEFAULT '{"available": false}'::"jsonb",
    "friday" "jsonb" DEFAULT '{"available": false}'::"jsonb",
    "saturday" "jsonb" DEFAULT '{"available": false}'::"jsonb",
    "sunday" "jsonb" DEFAULT '{"available": false}'::"jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."staff_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_skill_tags_backup_20250120" (
    "staff_id" "uuid",
    "staff_name" "text",
    "skill_tags" "text"[],
    "tag_count" integer,
    "backed_up_at" timestamp with time zone
);


ALTER TABLE "public"."staff_skill_tags_backup_20250120" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_skill_tags_backup_20250120" IS 'Backup of staff skill_tags column before dropping on 2025-01-20';



CREATE TABLE IF NOT EXISTS "public"."staff_skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "skill_id" integer NOT NULL,
    "proficiency_level" integer DEFAULT 3,
    "certified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "staff_skills_proficiency_level_check" CHECK ((("proficiency_level" >= 1) AND ("proficiency_level" <= 5)))
);


ALTER TABLE "public"."staff_skills" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_skills" IS 'スタッフとスキルの多対多関連 - Replaces old skill_tags column';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "granted_by" "uuid",
    CONSTRAINT "user_roles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_payroll_monthly" AS
 SELECT "s"."id" AS "staff_id",
    "s"."code" AS "staff_code",
    "s"."name" AS "staff_name",
    "date_trunc"('month'::"text", "sh"."start_ts") AS "pay_month",
    "count"(DISTINCT "a"."id") AS "attendance_count",
    "sum"((EXTRACT(epoch FROM (COALESCE("a"."check_out_ts", "sh"."end_ts") - COALESCE("a"."check_in_ts", "sh"."start_ts"))) / (3600)::numeric)) AS "total_hours",
    "sum"("e"."amount") AS "transport_total",
    "sum"(
        CASE
            WHEN ("s"."hourly_rate" IS NOT NULL) THEN (("s"."hourly_rate" * EXTRACT(epoch FROM (COALESCE("a"."check_out_ts", "sh"."end_ts") - COALESCE("a"."check_in_ts", "sh"."start_ts")))) / (3600)::numeric)
            WHEN ("s"."daily_rate" IS NOT NULL) THEN "s"."daily_rate"
            ELSE (0)::numeric
        END) AS "payment_amount",
    "min"("a"."check_in_ts") AS "first_check_in",
    "max"("a"."check_out_ts") AS "last_check_out"
   FROM ((("public"."staff" "s"
     JOIN "public"."attendances" "a" ON (("a"."staff_id" = "s"."id")))
     JOIN "public"."shifts" "sh" ON (("sh"."id" = "a"."shift_id")))
     LEFT JOIN "public"."expenses" "e" ON ((("e"."attendance_id" = "a"."id") AND ("e"."kind" = 'transport'::"text"))))
  WHERE ("a"."status" = 'approved'::"public"."attendance_status")
  GROUP BY "s"."id", "s"."code", "s"."name", ("date_trunc"('month'::"text", "sh"."start_ts"));


ALTER VIEW "public"."v_payroll_monthly" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "lat" double precision NOT NULL,
    "lon" double precision NOT NULL,
    "geom" "public"."geography"(Point,4326) GENERATED ALWAYS AS (("public"."st_setsrid"("public"."st_makepoint"("lon", "lat"), 4326))::"public"."geography") STORED,
    "capacity" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."venues" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cleanup_report_20250120" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cleanup_report_20250120_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."skills" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."skills_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_shift_id_staff_id_key" UNIQUE ("shift_id", "staff_id");



ALTER TABLE ONLY "public"."attendances"
    ADD CONSTRAINT "attendances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleanup_backup_summary_20250120"
    ADD CONSTRAINT "cleanup_backup_summary_20250120_pkey" PRIMARY KEY ("backup_id");



ALTER TABLE ONLY "public"."cleanup_report_20250120"
    ADD CONSTRAINT "cleanup_report_20250120_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_qr_code_key" UNIQUE ("qr_code");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_staff_id_week_start_date_key" UNIQUE ("staff_id", "week_start_date");



ALTER TABLE ONLY "public"."staff_skills"
    ADD CONSTRAINT "staff_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_skills"
    ADD CONSTRAINT "staff_skills_staff_id_skill_id_key" UNIQUE ("staff_id", "skill_id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."attendances"
    ADD CONSTRAINT "uniq_one_attendance" UNIQUE ("staff_id", "shift_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_staff_id_role_key" UNIQUE ("staff_id", "role");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_assignments_shift" ON "public"."assignments" USING "btree" ("shift_id");



CREATE INDEX "idx_assignments_staff" ON "public"."assignments" USING "btree" ("staff_id");



CREATE INDEX "idx_assignments_staff_id" ON "public"."assignments" USING "btree" ("staff_id");



CREATE INDEX "idx_attendances_staff_id" ON "public"."attendances" USING "btree" ("staff_id");



CREATE INDEX "idx_attendances_staff_shift" ON "public"."attendances" USING "btree" ("staff_id", "shift_id");



CREATE INDEX "idx_equipment_qr_code" ON "public"."equipment" USING "btree" ("qr_code");



CREATE INDEX "idx_equipment_venue_id" ON "public"."equipment" USING "btree" ("venue_id");



CREATE INDEX "idx_events_date" ON "public"."events" USING "btree" ("event_date");



CREATE INDEX "idx_shifts_event" ON "public"."shifts" USING "btree" ("event_id");



CREATE INDEX "idx_shifts_skill_id" ON "public"."shifts" USING "btree" ("skill_id");



CREATE INDEX "idx_staff_schedules_staff_id" ON "public"."staff_schedules" USING "btree" ("staff_id");



CREATE INDEX "idx_staff_schedules_week_start" ON "public"."staff_schedules" USING "btree" ("week_start_date");



CREATE INDEX "idx_staff_skills_skill_id" ON "public"."staff_skills" USING "btree" ("skill_id");



CREATE INDEX "idx_staff_skills_staff_id" ON "public"."staff_skills" USING "btree" ("staff_id");



CREATE INDEX "idx_staff_user_id" ON "public"."staff" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_staff_id" ON "public"."user_roles" USING "btree" ("staff_id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendances"
    ADD CONSTRAINT "attendances_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."attendances"
    ADD CONSTRAINT "attendances_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_skills"
    ADD CONSTRAINT "staff_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_skills"
    ADD CONSTRAINT "staff_skills_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assignments_delete_admin_manager" ON "public"."assignments" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_manager_user"());



CREATE POLICY "assignments_insert_admin_manager" ON "public"."assignments" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_manager_user"());



CREATE POLICY "assignments_select_own_or_admin" ON "public"."assignments" FOR SELECT TO "authenticated" USING ((("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))) OR "public"."is_admin_or_manager_user"()));



CREATE POLICY "assignments_update_admin_manager" ON "public"."assignments" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_manager_user"()) WITH CHECK ("public"."is_admin_or_manager_user"());



CREATE POLICY "assignments_update_own_status" ON "public"."assignments" FOR UPDATE TO "authenticated" USING (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"())))) WITH CHECK (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."attendances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attendances_delete_admin_manager" ON "public"."attendances" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_manager_user"());



CREATE POLICY "attendances_insert_all" ON "public"."attendances" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "attendances_select_own_or_admin" ON "public"."attendances" FOR SELECT TO "authenticated" USING ((("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))) OR "public"."is_admin_or_manager_user"()));



CREATE POLICY "attendances_update_admin_manager" ON "public"."attendances" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_manager_user"()) WITH CHECK ("public"."is_admin_or_manager_user"());



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_insert_all" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "audit_logs_select_admin" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ("public"."is_admin_user"());



ALTER TABLE "public"."equipment" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "equipment_delete_admin_manager" ON "public"."equipment" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_manager_user"());



CREATE POLICY "equipment_insert_admin_manager" ON "public"."equipment" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_manager_user"());



CREATE POLICY "equipment_select_all" ON "public"."equipment" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "equipment_update_admin_manager" ON "public"."equipment" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_manager_user"()) WITH CHECK ("public"."is_admin_or_manager_user"());



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_delete_admin_manager" ON "public"."events" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_manager_user"());



CREATE POLICY "events_insert_admin_manager" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_manager_user"());



CREATE POLICY "events_select_all" ON "public"."events" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "events_update_admin_manager" ON "public"."events" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_manager_user"()) WITH CHECK ("public"."is_admin_or_manager_user"());



ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedules_delete_own_or_admin" ON "public"."staff_schedules" FOR DELETE TO "authenticated" USING ((("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))) OR "public"."is_admin_user"()));



CREATE POLICY "schedules_insert_own" ON "public"."staff_schedules" FOR INSERT TO "authenticated" WITH CHECK (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))));



CREATE POLICY "schedules_select_own_or_admin" ON "public"."staff_schedules" FOR SELECT TO "authenticated" USING ((("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))) OR "public"."is_admin_or_manager_user"()));



CREATE POLICY "schedules_update_own" ON "public"."staff_schedules" FOR UPDATE TO "authenticated" USING (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"())))) WITH CHECK (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."shifts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shifts_delete_admin_manager" ON "public"."shifts" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_manager_user"());



CREATE POLICY "shifts_insert_admin_manager" ON "public"."shifts" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_manager_user"());



CREATE POLICY "shifts_select_all" ON "public"."shifts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "shifts_update_admin_manager" ON "public"."shifts" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_manager_user"()) WITH CHECK ("public"."is_admin_or_manager_user"());



ALTER TABLE "public"."skills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "skills_delete_admin" ON "public"."skills" FOR DELETE TO "authenticated" USING ("public"."is_admin_user"());



CREATE POLICY "skills_insert_admin" ON "public"."skills" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "skills_select_all" ON "public"."skills" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "skills_update_admin" ON "public"."skills" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_delete_admin" ON "public"."staff" FOR DELETE TO "authenticated" USING ("public"."is_admin_user"());



CREATE POLICY "staff_insert_admin" ON "public"."staff" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user"());



ALTER TABLE "public"."staff_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_select_all" ON "public"."staff" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."staff_skills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_skills_delete_admin_manager" ON "public"."staff_skills" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_manager_user"());



CREATE POLICY "staff_skills_insert_admin_manager" ON "public"."staff_skills" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_manager_user"());



CREATE POLICY "staff_skills_select_all" ON "public"."staff_skills" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "staff_skills_update_admin_manager" ON "public"."staff_skills" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_manager_user"()) WITH CHECK ("public"."is_admin_or_manager_user"());



CREATE POLICY "staff_update_self" ON "public"."staff" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."venues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "venues_delete_admin" ON "public"."venues" FOR DELETE TO "authenticated" USING ("public"."is_admin_user"());



CREATE POLICY "venues_insert_admin" ON "public"."venues" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "venues_select_all" ON "public"."venues" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "venues_update_admin" ON "public"."venues" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."attendance_punch"("p_staff_uid" "uuid", "p_shift_id" "uuid", "p_equipment_qr" "text", "p_lat" double precision, "p_lon" double precision, "p_purpose" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."attendance_punch"("p_staff_uid" "uuid", "p_shift_id" "uuid", "p_equipment_qr" "text", "p_lat" double precision, "p_lon" double precision, "p_purpose" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."attendance_punch"("p_staff_uid" "uuid", "p_shift_id" "uuid", "p_equipment_qr" "text", "p_lat" double precision, "p_lon" double precision, "p_purpose" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_staff_availability"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_staff_availability"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staff_availability"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_any_role"("required_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_any_role"("required_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_any_role"("required_roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_manager_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_manager_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_manager_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_reserve_staff"("p_shift_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_reserve_staff"("p_shift_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_reserve_staff"("p_shift_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_shift_requirements"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_shift_requirements"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_shift_requirements"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."attendances" TO "anon";
GRANT ALL ON TABLE "public"."attendances" TO "authenticated";
GRANT ALL ON TABLE "public"."attendances" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cleanup_backup_summary_20250120" TO "anon";
GRANT ALL ON TABLE "public"."cleanup_backup_summary_20250120" TO "authenticated";
GRANT ALL ON TABLE "public"."cleanup_backup_summary_20250120" TO "service_role";



GRANT ALL ON TABLE "public"."cleanup_report_20250120" TO "anon";
GRANT ALL ON TABLE "public"."cleanup_report_20250120" TO "authenticated";
GRANT ALL ON TABLE "public"."cleanup_report_20250120" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cleanup_report_20250120_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cleanup_report_20250120_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cleanup_report_20250120_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."equipment" TO "anon";
GRANT ALL ON TABLE "public"."equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."roles_backup_20250120" TO "anon";
GRANT ALL ON TABLE "public"."roles_backup_20250120" TO "authenticated";
GRANT ALL ON TABLE "public"."roles_backup_20250120" TO "service_role";



GRANT ALL ON TABLE "public"."shifts" TO "anon";
GRANT ALL ON TABLE "public"."shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."shifts" TO "service_role";



GRANT ALL ON TABLE "public"."shifts_role_mapping_backup_20250120" TO "anon";
GRANT ALL ON TABLE "public"."shifts_role_mapping_backup_20250120" TO "authenticated";
GRANT ALL ON TABLE "public"."shifts_role_mapping_backup_20250120" TO "service_role";



GRANT ALL ON TABLE "public"."skills" TO "anon";
GRANT ALL ON TABLE "public"."skills" TO "authenticated";
GRANT ALL ON TABLE "public"."skills" TO "service_role";



GRANT ALL ON SEQUENCE "public"."skills_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."skills_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."skills_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."staff" TO "anon";
GRANT ALL ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";



GRANT ALL ON TABLE "public"."staff_schedules" TO "anon";
GRANT ALL ON TABLE "public"."staff_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."staff_skill_tags_backup_20250120" TO "anon";
GRANT ALL ON TABLE "public"."staff_skill_tags_backup_20250120" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_skill_tags_backup_20250120" TO "service_role";



GRANT ALL ON TABLE "public"."staff_skills" TO "anon";
GRANT ALL ON TABLE "public"."staff_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_skills" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."v_payroll_monthly" TO "anon";
GRANT ALL ON TABLE "public"."v_payroll_monthly" TO "authenticated";
GRANT ALL ON TABLE "public"."v_payroll_monthly" TO "service_role";



GRANT ALL ON TABLE "public"."venues" TO "anon";
GRANT ALL ON TABLE "public"."venues" TO "authenticated";
GRANT ALL ON TABLE "public"."venues" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






\unrestrict zBvpzHFhOPzIlQKhXtiO6QT3JViCchJ7dJ8z3uLVy707T7eyj1aj2IqU6w3GwPn

RESET ALL;
