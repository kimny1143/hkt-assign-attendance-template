-- ============================================
-- Cleanup Obsolete Tables and Columns
-- Date: 2025-01-20
-- Purpose: Remove obsolete tables and columns after migration to new structure
--
-- WARNING: Run 008_backup_before_cleanup.sql FIRST!
-- ============================================

-- Pre-check: Verify backups exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cleanup_backup_summary_20250120') THEN
        RAISE EXCEPTION 'Backup not found! Run 008_backup_before_cleanup.sql first';
    END IF;
END $$;

-- ============================================
-- STEP 1: Remove obsolete column from shifts table
-- ============================================

-- Create cleanup report table first
CREATE TABLE IF NOT EXISTS cleanup_report_20250120 (
    id serial PRIMARY KEY,
    action text,
    status text,
    details text,
    executed_at timestamptz DEFAULT NOW()
);

-- First verify that all shifts have been migrated to skill_id
DO $$
DECLARE
    unmigrated_count INT;
BEGIN
    SELECT COUNT(*) INTO unmigrated_count
    FROM shifts
    WHERE role_id IS NOT NULL AND skill_id IS NULL;

    IF unmigrated_count > 0 THEN
        -- Attempt final migration
        UPDATE shifts sh
        SET skill_id = CASE
            WHEN r.code = 'lighting' THEN (SELECT id FROM skills WHERE code = 'lighting')
            WHEN r.code = 'rigging' THEN (SELECT id FROM skills WHERE code = 'backstage')
        END
        FROM roles r
        WHERE sh.role_id = r.id AND sh.skill_id IS NULL;
    END IF;
END $$;

-- Drop the foreign key constraint first
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_role_id_fkey;

-- Drop the role_id column
ALTER TABLE shifts DROP COLUMN IF EXISTS role_id;

-- Log the action
INSERT INTO cleanup_report_20250120 (action, status, details)
VALUES ('Drop shifts.role_id', 'COMPLETED', 'Column removed successfully');

-- ============================================
-- STEP 2: Remove skill_tags column from staff table
-- ============================================

-- Verify data has been migrated to staff_skills
DO $$
DECLARE
    unmigrated_staff INT;
BEGIN
    SELECT COUNT(*) INTO unmigrated_staff
    FROM staff s
    WHERE skill_tags IS NOT NULL
    AND array_length(skill_tags, 1) > 0
    AND NOT EXISTS (
        SELECT 1 FROM staff_skills ss WHERE ss.staff_id = s.id
    );

    IF unmigrated_staff > 0 THEN
        -- Migrate remaining skill_tags to staff_skills
        INSERT INTO staff_skills (staff_id, skill_id, proficiency_level)
        SELECT
            s.id AS staff_id,
            sk.id AS skill_id,
            3 AS proficiency_level
        FROM staff s
        CROSS JOIN LATERAL unnest(s.skill_tags) AS tag
        JOIN skills sk ON
            (tag = 'lighting' AND sk.code = 'lighting') OR
            (tag = 'rigging' AND sk.code = 'backstage') OR
            (tag = 'pa' AND sk.code = 'pa') OR
            (tag = 'sound' AND sk.code = 'sound_operator')
        WHERE NOT EXISTS (
            SELECT 1 FROM staff_skills ss2
            WHERE ss2.staff_id = s.id AND ss2.skill_id = sk.id
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Drop the skill_tags column
ALTER TABLE staff DROP COLUMN IF EXISTS skill_tags;

-- Log the action
INSERT INTO cleanup_report_20250120 (action, status, details)
VALUES ('Drop staff.skill_tags', 'COMPLETED', 'Column removed successfully');

-- ============================================
-- STEP 3: Drop the obsolete roles table
-- ============================================

-- Check for any remaining dependencies
DO $$
DECLARE
    dependency_count INT;
BEGIN
    SELECT COUNT(*) INTO dependency_count
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'roles';

    IF dependency_count > 0 THEN
        RAISE WARNING 'roles table still has % dependencies', dependency_count;
    END IF;
END $$;

-- Drop the roles table
DO $$
BEGIN
    DROP TABLE IF EXISTS roles CASCADE;
    INSERT INTO cleanup_report_20250120 (action, status, details)
    VALUES ('Drop roles table', 'COMPLETED', 'Table removed successfully');
EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO cleanup_report_20250120 (action, status, details)
        VALUES ('Drop roles table', 'WARNING', 'Table may have dependencies: ' || SQLERRM);
END $$;

-- ============================================
-- STEP 4: Optional - Clean up unused tables
-- ============================================

-- Keep audit_logs and expenses tables (might be useful later)
INSERT INTO cleanup_report_20250120 (action, status, details)
SELECT
    'Keep audit_logs table',
    'RETAINED',
    'Table retained with ' || COUNT(*) || ' records'
FROM audit_logs;

INSERT INTO cleanup_report_20250120 (action, status, details)
SELECT
    'Keep expenses table',
    'RETAINED',
    'Table retained with ' || COUNT(*) || ' records'
FROM expenses;

-- ============================================
-- STEP 5: Clean up orphaned data
-- ============================================

-- Remove any assignments for non-existent shifts
DELETE FROM assignments a
WHERE NOT EXISTS (SELECT 1 FROM shifts s WHERE s.id = a.shift_id);

-- Remove any attendances for non-existent shifts or staff
DELETE FROM attendances att
WHERE NOT EXISTS (SELECT 1 FROM shifts s WHERE s.id = att.shift_id)
   OR NOT EXISTS (SELECT 1 FROM staff st WHERE st.id = att.staff_id);

INSERT INTO cleanup_report_20250120 (action, status, details)
VALUES ('Clean orphaned data', 'COMPLETED', 'Removed orphaned records from assignments and attendances');

-- ============================================
-- STEP 6: Update table comments and documentation
-- ============================================

COMMENT ON TABLE skills IS 'スタッフスキルマスタ (PA/音源再生/照明/バックヤード) - Replaces old roles table';
COMMENT ON TABLE staff_skills IS 'スタッフとスキルの多対多関連 - Replaces old skill_tags column';
COMMENT ON COLUMN shifts.skill_id IS 'Required skill for this shift - Replaces old role_id';

INSERT INTO cleanup_report_20250120 (action, status, details)
VALUES ('Update documentation', 'COMPLETED', 'Table comments updated');

-- ============================================
-- STEP 7: Final Verification
-- ============================================

-- Verify table structure
WITH table_status AS (
    SELECT
        t.table_name,
        CASE
            WHEN t.table_name IN ('skills', 'staff_skills', 'staff_schedules') THEN '🆕 NEW'
            WHEN t.table_name = 'roles' THEN '❌ REMOVED'
            ELSE '✅ EXISTING'
        END as status,
        COUNT(c.column_name) as column_count
    FROM information_schema.tables t
    LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT LIKE '%backup%'
        AND t.table_name NOT LIKE '%report%'
        AND t.table_name NOT LIKE '%summary%'
    GROUP BY t.table_name
)
SELECT * FROM table_status
ORDER BY
    CASE
        WHEN status = '🆕 NEW' THEN 1
        WHEN status = '❌ REMOVED' THEN 3
        ELSE 2
    END, table_name;

-- ============================================
-- Display Cleanup Report
-- ============================================

SELECT
    '=== CLEANUP COMPLETE ===' as message,
    COUNT(*) as total_actions,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
    COUNT(*) FILTER (WHERE status = 'WARNING') as warnings
FROM cleanup_report_20250120;

-- Show detailed report
SELECT * FROM cleanup_report_20250120 ORDER BY id;

-- ============================================
-- Verify Critical Tables
-- ============================================

-- Verify skills table exists and has data
SELECT 'skills' as table_name, COUNT(*) as record_count FROM skills
UNION ALL
SELECT 'staff_skills' as table_name, COUNT(*) as record_count FROM staff_skills
UNION ALL
SELECT 'staff_schedules' as table_name, COUNT(*) as record_count FROM staff_schedules
UNION ALL
-- Verify roles table is gone
SELECT 'roles (should be 0)' as table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles')
    THEN 1 ELSE 0 END as record_count;

-- ============================================
-- POST-CLEANUP CHECKLIST
-- ============================================
-- [ ] Update all API endpoints to use 'skills' instead of 'roles'
-- [ ] Update UI components to work with new skill structure
-- [ ] Test attendance punch function with new structure
-- [ ] Verify staff schedule functionality
-- [ ] Update documentation to reflect new structure