-- ============================================
-- Row Level Security (RLS) Policies Setup
-- ============================================
-- This migration implements RLS policies to move authorization logic
-- from middleware to database layer for better security and performance
-- ============================================

-- ============================================
-- Helper Functions for RLS
-- ============================================

-- Function to get current user's staff_id
CREATE OR REPLACE FUNCTION get_current_staff_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id FROM staff
        WHERE user_id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is admin or manager
CREATE OR REPLACE FUNCTION is_admin_or_manager()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN staff s ON ur.staff_id = s.id
        WHERE s.user_id = auth.uid()
        AND ur.role IN ('admin', 'manager')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN staff s ON ur.staff_id = s.id
        WHERE s.user_id = auth.uid()
        AND ur.role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- Enable RLS on Tables
-- ============================================

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Staff Table Policies
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own staff profile" ON staff
    FOR SELECT USING (user_id = auth.uid());

-- Admin/Manager can view all staff
CREATE POLICY "Admin/Manager can view all staff" ON staff
    FOR SELECT USING (is_admin_or_manager());

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON staff
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admin can manage all staff
CREATE POLICY "Admin can manage all staff" ON staff
    FOR ALL USING (is_admin());

-- ============================================
-- Assignments Table Policies
-- ============================================

-- Staff can view their own assignments
CREATE POLICY "Staff can view own assignments" ON assignments
    FOR SELECT USING (staff_id = get_current_staff_id());

-- Admin/Manager can view all assignments
CREATE POLICY "Admin/Manager can view all assignments" ON assignments
    FOR SELECT USING (is_admin_or_manager());

-- Admin/Manager can manage assignments
CREATE POLICY "Admin/Manager can manage assignments" ON assignments
    FOR ALL USING (is_admin_or_manager());

-- ============================================
-- Attendances Table Policies
-- ============================================

-- Staff can view their own attendance
CREATE POLICY "Staff can view own attendance" ON attendances
    FOR SELECT USING (staff_id = get_current_staff_id());

-- Staff can create/update their own attendance (punch in/out)
CREATE POLICY "Staff can punch attendance" ON attendances
    FOR INSERT WITH CHECK (staff_id = get_current_staff_id());

CREATE POLICY "Staff can update own attendance" ON attendances
    FOR UPDATE USING (staff_id = get_current_staff_id())
    WITH CHECK (staff_id = get_current_staff_id());

-- Admin/Manager can view all attendance
CREATE POLICY "Admin/Manager can view all attendance" ON attendances
    FOR SELECT USING (is_admin_or_manager());

-- Admin can manage all attendance
CREATE POLICY "Admin can manage all attendance" ON attendances
    FOR ALL USING (is_admin());

-- ============================================
-- Shifts Table Policies
-- ============================================

-- Everyone can view shifts (needed for assignment viewing)
CREATE POLICY "Everyone can view shifts" ON shifts
    FOR SELECT USING (true);

-- Admin/Manager can manage shifts
CREATE POLICY "Admin/Manager can manage shifts" ON shifts
    FOR ALL USING (is_admin_or_manager());

-- ============================================
-- Events Table Policies
-- ============================================

-- Everyone can view events
CREATE POLICY "Everyone can view events" ON events
    FOR SELECT USING (true);

-- Admin/Manager can manage events
CREATE POLICY "Admin/Manager can manage events" ON events
    FOR ALL USING (is_admin_or_manager());

-- ============================================
-- Venues Table Policies
-- ============================================

-- Everyone can view venues
CREATE POLICY "Everyone can view venues" ON venues
    FOR SELECT USING (true);

-- Admin can manage venues
CREATE POLICY "Admin can manage venues" ON venues
    FOR ALL USING (is_admin());

-- ============================================
-- Equipment Table Policies
-- ============================================

-- Everyone can view active equipment (needed for QR scanning)
CREATE POLICY "Everyone can view active equipment" ON equipment
    FOR SELECT USING (active = true);

-- Admin can manage equipment
CREATE POLICY "Admin can manage equipment" ON equipment
    FOR ALL USING (is_admin());

-- ============================================
-- Grant Function Permissions
-- ============================================

GRANT EXECUTE ON FUNCTION get_current_staff_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_or_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ============================================
-- Add Comments
-- ============================================

COMMENT ON FUNCTION get_current_staff_id() IS 'Gets the staff_id for the currently authenticated user';
COMMENT ON FUNCTION is_admin_or_manager() IS 'Checks if the current user has admin or manager role';
COMMENT ON FUNCTION is_admin() IS 'Checks if the current user has admin role';