-- ============================================
-- Temporarily disable RLS and check/fix user mappings
-- Date: 2025-09-22
-- ============================================

-- Step 1: Disable RLS on staff table completely
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;

-- Step 2: Check current staff records
SELECT id, name, email, user_id, active
FROM public.staff
ORDER BY email;

-- Step 3: Check if these user_ids exist in auth.users
SELECT
  s.email as staff_email,
  s.user_id as staff_user_id,
  au.email as auth_email,
  au.id as auth_id,
  CASE
    WHEN au.id IS NULL THEN '❌ User not in Auth'
    WHEN s.user_id != au.id THEN '⚠️ ID Mismatch'
    ELSE '✅ OK'
  END as status
FROM public.staff s
LEFT JOIN auth.users au ON s.email = au.email
ORDER BY s.email;

-- Step 4: Update staff table with correct user_ids from auth.users
UPDATE public.staff s
SET user_id = au.id
FROM auth.users au
WHERE s.email = au.email
  AND (s.user_id IS NULL OR s.user_id != au.id);

-- Step 5: Verify the update
SELECT
  s.email,
  s.user_id,
  au.id as auth_user_id,
  s.user_id = au.id as ids_match
FROM public.staff s
LEFT JOIN auth.users au ON s.email = au.email
ORDER BY s.email;