-- 008_security_fixes_user_roles_and_qr_tokens.sql
-- Security fixes for user_roles and qr_tokens tables
-- Execution date: 2025-09-23
-- CRITICAL: Fixes major security vulnerabilities

-- ============================================
-- PART 1: Secure user_roles table
-- ============================================

-- Enable RLS on user_roles table (CRITICAL FIX)
ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;

-- Create secure RLS policies for user_roles
-- Only admins can view all role assignments
CREATE POLICY "user_roles_select_admin_only" ON "public"."user_roles"
    FOR SELECT
    TO authenticated
    USING (public.is_admin_user());

-- Users can view their own roles only
CREATE POLICY "user_roles_select_own" ON "public"."user_roles"
    FOR SELECT
    TO authenticated
    USING (
        staff_id IN (
            SELECT id FROM public.staff
            WHERE user_id = auth.uid()
        )
    );

-- Only admins can insert new role assignments
CREATE POLICY "user_roles_insert_admin_only" ON "public"."user_roles"
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin_user());

-- Only admins can update role assignments
CREATE POLICY "user_roles_update_admin_only" ON "public"."user_roles"
    FOR UPDATE
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

-- Only admins can delete role assignments
CREATE POLICY "user_roles_delete_admin_only" ON "public"."user_roles"
    FOR DELETE
    TO authenticated
    USING (public.is_admin_user());

-- ============================================
-- PART 2: Create audit function for role changes
-- ============================================

CREATE OR REPLACE FUNCTION "public"."audit_user_role_changes"()
RETURNS TRIGGER AS $$
DECLARE
    current_staff_id UUID;
    action_type TEXT;
BEGIN
    -- Get current user's staff_id for audit trail
    SELECT id INTO current_staff_id
    FROM public.staff
    WHERE user_id = auth.uid();

    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        action_type := 'ROLE_GRANTED';
        -- Set granted_by if not already set
        IF NEW.granted_by IS NULL THEN
            NEW.granted_by := current_staff_id;
        END IF;

        -- Log the action
        INSERT INTO public.audit_logs (
            actor_user_id, action, table_name, record_id, diff
        ) VALUES (
            auth.uid(),
            action_type,
            'user_roles',
            NEW.id,
            jsonb_build_object(
                'staff_id', NEW.staff_id,
                'role', NEW.role,
                'granted_by', NEW.granted_by
            )
        );

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        action_type := 'ROLE_MODIFIED';

        INSERT INTO public.audit_logs (
            actor_user_id, action, table_name, record_id, diff
        ) VALUES (
            auth.uid(),
            action_type,
            'user_roles',
            NEW.id,
            jsonb_build_object(
                'old_role', OLD.role,
                'new_role', NEW.role,
                'modified_by', current_staff_id
            )
        );

        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'ROLE_REVOKED';

        INSERT INTO public.audit_logs (
            actor_user_id, action, table_name, record_id, diff
        ) VALUES (
            auth.uid(),
            action_type,
            'user_roles',
            OLD.id,
            jsonb_build_object(
                'staff_id', OLD.staff_id,
                'revoked_role', OLD.role,
                'revoked_by', current_staff_id
            )
        );

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit trigger for user_roles
CREATE TRIGGER "audit_user_roles_trigger"
    AFTER INSERT OR UPDATE OR DELETE ON "public"."user_roles"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."audit_user_role_changes"();

-- ============================================
-- PART 3: Fix QR tokens security (Remove overly permissive policies)
-- ============================================

-- Drop the temporary overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view qr_tokens" ON "public"."qr_tokens";
DROP POLICY IF EXISTS "Authenticated users can create qr_tokens" ON "public"."qr_tokens";
DROP POLICY IF EXISTS "Authenticated users can update qr_tokens" ON "public"."qr_tokens";

-- Create secure QR token policies
-- Staff can view tokens for their own assigned shifts
CREATE POLICY "qr_tokens_select_own_shifts" ON "public"."qr_tokens"
    FOR SELECT
    TO authenticated
    USING (
        shift_id IN (
            SELECT a.shift_id
            FROM public.assignments a
            JOIN public.staff s ON a.staff_id = s.id
            WHERE s.user_id = auth.uid()
            AND a.status = 'confirmed'
        )
    );

-- Admins and managers can view all QR tokens
CREATE POLICY "qr_tokens_select_admin_manager" ON "public"."qr_tokens"
    FOR SELECT
    TO authenticated
    USING (public.is_admin_or_manager_user());

-- Only admins and managers can create QR tokens
CREATE POLICY "qr_tokens_insert_admin_manager" ON "public"."qr_tokens"
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin_or_manager_user());

-- Staff can update tokens when using them (mark as used)
CREATE POLICY "qr_tokens_update_usage_own_shifts" ON "public"."qr_tokens"
    FOR UPDATE
    TO authenticated
    USING (
        -- Can only update usage fields for their own shifts
        shift_id IN (
            SELECT a.shift_id
            FROM public.assignments a
            JOIN public.staff s ON a.staff_id = s.id
            WHERE s.user_id = auth.uid()
            AND a.status = 'confirmed'
        )
    )
    WITH CHECK (
        -- Can update tokens for their own shifts
        shift_id IN (
            SELECT a.shift_id
            FROM public.assignments a
            JOIN public.staff s ON a.staff_id = s.id
            WHERE s.user_id = auth.uid()
            AND a.status = 'confirmed'
        )
    );

-- Admins and managers can update any QR token
CREATE POLICY "qr_tokens_update_admin_manager" ON "public"."qr_tokens"
    FOR UPDATE
    TO authenticated
    USING (public.is_admin_or_manager_user())
    WITH CHECK (public.is_admin_or_manager_user());

-- Only admins can delete QR tokens
CREATE POLICY "qr_tokens_delete_admin_only" ON "public"."qr_tokens"
    FOR DELETE
    TO authenticated
    USING (public.is_admin_user());

-- ============================================
-- PART 4: Create helper function for safe role assignment
-- ============================================

CREATE OR REPLACE FUNCTION "public"."assign_user_role"(
    p_target_staff_id UUID,
    p_role TEXT,
    p_granted_by_staff_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    current_staff_id UUID;
    current_role TEXT;
BEGIN
    -- Get current user's staff_id and role
    SELECT s.id INTO current_staff_id
    FROM public.staff s
    WHERE s.user_id = auth.uid();

    SELECT public.get_current_user_role() INTO current_role;

    -- Only admins can assign roles
    IF current_role != 'admin' THEN
        RAISE EXCEPTION 'Only administrators can assign user roles';
    END IF;

    -- Prevent self-demotion from admin (must have at least one admin)
    IF p_target_staff_id = current_staff_id AND p_role != 'admin' THEN
        -- Check if there are other admins
        IF (
            SELECT COUNT(*)
            FROM public.user_roles ur
            WHERE ur.role = 'admin' AND ur.staff_id != current_staff_id
        ) = 0 THEN
            RAISE EXCEPTION 'Cannot remove admin role: at least one admin must remain';
        END IF;
    END IF;

    -- Insert or update the role
    INSERT INTO public.user_roles (staff_id, role, granted_by)
    VALUES (p_target_staff_id, p_role, COALESCE(p_granted_by_staff_id, current_staff_id))
    ON CONFLICT (staff_id, role)
    DO UPDATE SET
        granted_at = NOW(),
        granted_by = COALESCE(p_granted_by_staff_id, current_staff_id);

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 5: Data validation and cleanup
-- ============================================

-- Ensure we have at least one admin user
DO $$
DECLARE
    admin_count INTEGER;
    first_staff_id UUID;
BEGIN
    -- Check if we have any admin users
    SELECT COUNT(*) INTO admin_count
    FROM public.user_roles
    WHERE role = 'admin';

    -- If no admins exist, make the first staff member an admin
    IF admin_count = 0 THEN
        SELECT id INTO first_staff_id
        FROM public.staff
        WHERE active = true
        ORDER BY created_at
        LIMIT 1;

        IF first_staff_id IS NOT NULL THEN
            INSERT INTO public.user_roles (staff_id, role, granted_at)
            VALUES (first_staff_id, 'admin', NOW());

            RAISE NOTICE 'Created emergency admin user for staff_id: %', first_staff_id;
        END IF;
    END IF;
END $$;

-- ============================================
-- PART 6: Grant permissions
-- ============================================

-- Grant necessary permissions for the new function
GRANT ALL ON FUNCTION "public"."assign_user_role"(UUID, TEXT, UUID) TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_user_role_changes"() TO "authenticated";

-- ============================================
-- PART 7: Comments and documentation
-- ============================================

COMMENT ON FUNCTION "public"."assign_user_role"(UUID, TEXT, UUID) IS
'Safely assigns or updates user roles with proper authorization checks and audit trail';

COMMENT ON FUNCTION "public"."audit_user_role_changes"() IS
'Audit trigger function that logs all role assignment changes';

COMMENT ON POLICY "user_roles_select_admin_only" ON "public"."user_roles" IS
'Admins can view all role assignments for management purposes';

COMMENT ON POLICY "user_roles_select_own" ON "public"."user_roles" IS
'Users can view their own role assignments only';

COMMENT ON POLICY "qr_tokens_select_own_shifts" ON "public"."qr_tokens" IS
'Staff can view QR tokens only for shifts they are confirmed to work';

-- ============================================
-- Log this migration
-- ============================================
INSERT INTO "public"."schema_migrations" (version, executed_at)
VALUES ('008_security_fixes_user_roles_and_qr_tokens', NOW())
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- Security validation report
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=== SECURITY FIXES COMPLETED ===';
    RAISE NOTICE '1. RLS enabled on user_roles table';
    RAISE NOTICE '2. Secure policies created for role management';
    RAISE NOTICE '3. QR token policies tightened';
    RAISE NOTICE '4. Audit trail implemented for role changes';
    RAISE NOTICE '5. Safe role assignment function created';
    RAISE NOTICE '6. Emergency admin user ensured';
    RAISE NOTICE '=== MANUAL VERIFICATION REQUIRED ===';
    RAISE NOTICE 'Please verify admin access still works after applying this migration';
END $$;