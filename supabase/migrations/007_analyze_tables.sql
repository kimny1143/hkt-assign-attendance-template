-- ============================================
-- Table Analysis and Cleanup Assessment
-- Date: 2025-01-20
-- Purpose: Identify obsolete tables and their dependencies
-- ============================================

-- STEP 1: Analyze current table structure and dependencies
-- ============================================

-- Check if roles table still has references
SELECT
    'roles' as table_name,
    'OBSOLETE - Replaced by skills' as status,
    COUNT(DISTINCT sh.id) as shifts_using_role_id,
    CASE
        WHEN COUNT(DISTINCT sh.id) > 0 THEN 'Has dependencies in shifts table'
        ELSE 'Safe to delete'
    END as dependency_status
FROM roles r
LEFT JOIN shifts sh ON sh.role_id = r.id
GROUP BY 1,2;

-- Check skills table (new replacement)
SELECT
    'skills' as table_name,
    'ACTIVE - New skill management' as status,
    COUNT(*) as record_count,
    'Keep - Core MVP table' as recommendation
FROM skills;

-- Check staff_skills usage
SELECT
    'staff_skills' as table_name,
    'ACTIVE - Staff-skill relationships' as status,
    COUNT(*) as record_count,
    'Keep - Core MVP table' as recommendation
FROM staff_skills;

-- Check if skill_tags column in staff table is still needed
SELECT
    'staff.skill_tags column' as item,
    'OBSOLETE - Replaced by staff_skills table' as status,
    COUNT(*) FILTER (WHERE skill_tags IS NOT NULL AND array_length(skill_tags, 1) > 0) as non_empty_count,
    CASE
        WHEN COUNT(*) FILTER (WHERE skill_tags IS NOT NULL AND array_length(skill_tags, 1) > 0) > 0
        THEN 'Has data - needs migration check'
        ELSE 'Safe to drop column'
    END as recommendation
FROM staff;

-- Check audit_logs usage
SELECT
    'audit_logs' as table_name,
    CASE
        WHEN COUNT(*) = 0 THEN 'UNUSED - No records'
        ELSE 'ACTIVE - Has ' || COUNT(*) || ' records'
    END as status,
    COUNT(*) as record_count,
    CASE
        WHEN COUNT(*) = 0 THEN 'Safe to keep or remove based on requirements'
        ELSE 'Keep - Contains audit history'
    END as recommendation
FROM audit_logs;

-- Check equipment table usage
SELECT
    'equipment' as table_name,
    'ACTIVE - QR code management' as status,
    COUNT(*) as record_count,
    COUNT(DISTINCT venue_id) as venues_using,
    'Keep - Required for QR-based attendance' as recommendation
FROM equipment;

-- Check expenses table usage
SELECT
    'expenses' as table_name,
    CASE
        WHEN COUNT(*) = 0 THEN 'UNUSED - No records'
        ELSE 'ACTIVE - Has ' || COUNT(*) || ' records'
    END as status,
    COUNT(*) as record_count,
    'Keep if expense tracking is required' as recommendation
FROM expenses;

-- STEP 2: Summary of tables to handle
-- ============================================

WITH table_analysis AS (
    SELECT unnest(ARRAY[
        'roles',
        'skills',
        'staff_skills',
        'staff_schedules',
        'assignments',
        'attendances',
        'audit_logs',
        'equipment',
        'events',
        'expenses',
        'shifts',
        'staff',
        'user_roles',
        'venues'
    ]) as table_name
),
table_status AS (
    SELECT
        table_name,
        CASE table_name
            WHEN 'roles' THEN '❌ REMOVE - Replaced by skills'
            WHEN 'skills' THEN '✅ KEEP - New core table'
            WHEN 'staff_skills' THEN '✅ KEEP - New core table'
            WHEN 'staff_schedules' THEN '✅ KEEP - New core table'
            WHEN 'assignments' THEN '✅ KEEP - Core functionality'
            WHEN 'attendances' THEN '✅ KEEP - Core functionality'
            WHEN 'audit_logs' THEN '🔄 OPTIONAL - Keep if audit needed'
            WHEN 'equipment' THEN '✅ KEEP - QR code functionality'
            WHEN 'events' THEN '✅ KEEP - Core functionality'
            WHEN 'expenses' THEN '🔄 OPTIONAL - Keep if expense tracking needed'
            WHEN 'shifts' THEN '✅ KEEP - Core functionality (needs column update)'
            WHEN 'staff' THEN '✅ KEEP - Core table (drop skill_tags column)'
            WHEN 'user_roles' THEN '✅ KEEP - Permission management'
            WHEN 'venues' THEN '✅ KEEP - Core functionality'
        END as action
    FROM table_analysis
)
SELECT * FROM table_status ORDER BY
    CASE
        WHEN action LIKE '❌%' THEN 1
        WHEN action LIKE '🔄%' THEN 2
        ELSE 3
    END, table_name;

-- STEP 3: Check foreign key dependencies for cleanup
-- ============================================

SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    CASE
        WHEN ccu.table_name = 'roles' THEN '⚠️ Needs update before removing roles table'
        ELSE 'OK'
    END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (ccu.table_name = 'roles' OR tc.table_name = 'roles')
ORDER BY tc.table_name;