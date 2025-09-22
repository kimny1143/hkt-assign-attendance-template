-- ============================================
-- Debug RLS Issue
-- Date: 2025-09-22
-- Purpose: Diagnose why RLS is blocking access
-- ============================================

-- 1. Check current RLS status
SELECT
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename = 'staff';

-- 2. List all current policies on staff table
SELECT
    policyname,
    cmd,
    permissive,
    roles,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'staff';

-- 3. Check if auth.uid() returns expected value
SELECT auth.uid() as current_auth_uid;

-- 4. Check staff table data
SELECT
    id,
    name,
    email,
    user_id,
    CASE
        WHEN user_id = auth.uid() THEN '✅ Matches current user'
        ELSE '❌ Different user'
    END as auth_match
FROM public.staff
ORDER BY email;

-- 5. Test direct query as authenticated user (simulate what API is doing)
-- This simulates the query from login route
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO 'bad06d10-4c07-46f2-ae49-f315d779e2eb'; -- admin user_id

-- Try to select staff record
SELECT
    'Direct Query Test' as test_type,
    id,
    name,
    email,
    user_id
FROM public.staff
WHERE user_id = 'bad06d10-4c07-46f2-ae49-f315d779e2eb';

-- Reset role
RESET role;

-- 6. Check if there are any RLS policies that might be blocking
SELECT
    n.nspname as schema_name,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    COUNT(p.polname) as policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname = 'staff'
GROUP BY n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity;

-- 7. Test without RLS (to confirm data exists)
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;
SELECT
    'Without RLS' as test_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_user_ids
FROM public.staff;

-- Re-enable RLS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- 8. Check auth.users table
SELECT
    id,
    email,
    CASE
        WHEN id IN (SELECT user_id FROM public.staff) THEN '✅ Has staff record'
        ELSE '❌ No staff record'
    END as has_staff_record
FROM auth.users
ORDER BY email;