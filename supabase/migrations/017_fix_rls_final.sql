-- ============================================
-- Fix RLS Final - Remove ALL recursion issues
-- Date: 2025-09-22
-- Purpose: Completely fix the infinite recursion issue
-- ============================================

-- Step 1: Disable RLS and remove ALL existing policies
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;

-- Remove ALL policies (including any we might have missed)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'staff' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff', pol.policyname);
    END LOOP;
END $$;

-- Step 2: Re-enable RLS with SIMPLE policies (no recursion)
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Policy 1: Everyone can read all staff (no conditions that reference the table itself)
CREATE POLICY "staff_select_all_simple" ON public.staff
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy 2: Users can UPDATE their own record (simplified - no self-reference)
CREATE POLICY "staff_update_self_simple" ON public.staff
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy 3: Users can INSERT (for future use, if needed)
CREATE POLICY "staff_insert_simple" ON public.staff
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Step 3: Verify the fix
SELECT
    policyname,
    cmd,
    qual as using_clause,
    with_check as check_clause
FROM pg_policies
WHERE tablename = 'staff' AND schemaname = 'public';

-- Step 4: Test queries (run these manually to verify)
-- Test as authenticated user:
-- SELECT * FROM public.staff WHERE user_id = auth.uid();
-- SELECT * FROM public.staff LIMIT 5;