-- ============================================
-- Backup Script Before Table Cleanup
-- Date: 2025-01-20
-- Purpose: Create backup of data before removing obsolete tables
-- ============================================

-- IMPORTANT: Run this BEFORE executing cleanup script
-- This creates backup tables with _backup_20250120 suffix

-- ============================================
-- STEP 1: Create backup of roles table (to be removed)
-- ============================================

-- Backup roles table structure and data
CREATE TABLE IF NOT EXISTS roles_backup_20250120 AS
SELECT
    *,
    NOW() as backed_up_at,
    'Before removal - replaced by skills table' as backup_reason
FROM roles;

-- Add comment for documentation
COMMENT ON TABLE roles_backup_20250120 IS 'Backup of roles table before migration to skills table on 2025-01-20';

-- ============================================
-- STEP 2: Backup shifts table role_id references
-- ============================================

-- Create backup of shifts with role mapping
CREATE TABLE IF NOT EXISTS shifts_role_mapping_backup_20250120 AS
SELECT
    sh.id as shift_id,
    sh.role_id as old_role_id,
    r.code as old_role_code,
    sh.skill_id as new_skill_id,
    sk.code as new_skill_code,
    NOW() as backed_up_at
FROM shifts sh
LEFT JOIN roles r ON sh.role_id = r.id
LEFT JOIN skills sk ON sh.skill_id = sk.id;

COMMENT ON TABLE shifts_role_mapping_backup_20250120 IS 'Backup of shifts role-to-skill mapping on 2025-01-20';

-- ============================================
-- STEP 3: Backup staff skill_tags before dropping column
-- ============================================

-- Backup staff skill_tags data
CREATE TABLE IF NOT EXISTS staff_skill_tags_backup_20250120 AS
SELECT
    id as staff_id,
    name as staff_name,
    skill_tags,
    array_length(skill_tags, 1) as tag_count,
    NOW() as backed_up_at
FROM staff
WHERE skill_tags IS NOT NULL AND array_length(skill_tags, 1) > 0;

COMMENT ON TABLE staff_skill_tags_backup_20250120 IS 'Backup of staff skill_tags column before dropping on 2025-01-20';

-- ============================================
-- STEP 4: Create comprehensive backup summary
-- ============================================

CREATE TABLE IF NOT EXISTS cleanup_backup_summary_20250120 (
    backup_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name text,
    record_count int,
    action_planned text,
    backed_up_at timestamptz DEFAULT NOW()
);

INSERT INTO cleanup_backup_summary_20250120 (table_name, record_count, action_planned)
VALUES
    ('roles', (SELECT COUNT(*) FROM roles), 'DROP TABLE - replaced by skills'),
    ('shifts.role_id', (SELECT COUNT(*) FROM shifts WHERE role_id IS NOT NULL), 'DROP COLUMN - replaced by skill_id'),
    ('staff.skill_tags', (SELECT COUNT(*) FROM staff WHERE skill_tags IS NOT NULL), 'DROP COLUMN - replaced by staff_skills table'),
    ('audit_logs', (SELECT COUNT(*) FROM audit_logs), 'KEEP or DROP based on requirements'),
    ('expenses', (SELECT COUNT(*) FROM expenses), 'KEEP or DROP based on requirements');

-- ============================================
-- STEP 5: Verify backups were created successfully
-- ============================================

SELECT
    'Backup Verification' as check_type,
    table_name,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = t.table_name
        ) THEN '✅ Created'
        ELSE '❌ Failed'
    END as status
FROM (
    VALUES
        ('roles_backup_20250120'),
        ('shifts_role_mapping_backup_20250120'),
        ('staff_skill_tags_backup_20250120'),
        ('cleanup_backup_summary_20250120')
) AS t(table_name);

-- ============================================
-- ROLLBACK INFORMATION
-- ============================================

-- To restore from backup if needed:
COMMENT ON TABLE cleanup_backup_summary_20250120 IS
'ROLLBACK INSTRUCTIONS:
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

-- ============================================
-- Display backup summary
-- ============================================

SELECT
    '=== BACKUP COMPLETE ===' as message,
    COUNT(*) as tables_backed_up,
    SUM(record_count) as total_records_backed_up
FROM cleanup_backup_summary_20250120;

SELECT * FROM cleanup_backup_summary_20250120 ORDER BY backed_up_at;