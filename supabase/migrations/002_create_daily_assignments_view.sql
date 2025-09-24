-- ============================================
-- Daily Assignments Materialized View
-- ============================================
-- This migration creates a materialized view to optimize daily assignment queries
-- by pre-joining all necessary tables and handling JST timezone conversions
-- ============================================

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS v_daily_assignments CASCADE;

-- Create materialized view for daily assignments
CREATE MATERIALIZED VIEW v_daily_assignments AS
WITH tokyo_today AS (
    SELECT
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::DATE as today_jst,
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::DATE - INTERVAL '1 day' as yesterday_jst,
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::DATE + INTERVAL '1 day' as tomorrow_jst
)
SELECT
    a.id as assignment_id,
    a.staff_id,
    st.user_id,
    st.name as staff_name,
    st.phone,
    s.id as shift_id,
    s.start_at AT TIME ZONE 'Asia/Tokyo' as shift_start_jst,
    s.end_at AT TIME ZONE 'Asia/Tokyo' as shift_end_jst,
    s.start_at as shift_start_utc,
    s.end_at as shift_end_utc,
    s.skill_id,
    sk.label as skill_label,
    s.required as required_count,
    e.id as event_id,
    e.name as event_name,
    DATE(s.start_at AT TIME ZONE 'Asia/Tokyo') as shift_date_jst,
    v.id as venue_id,
    v.name as venue_name,
    v.lat as venue_lat,
    v.lon as venue_lon,
    v.address as venue_address,
    a.status as assignment_status,
    att.id as attendance_id,
    att.checkin_at,
    att.checkout_at,
    att.status as attendance_status,
    CASE
        WHEN att.checkin_at IS NOT NULL AND att.checkout_at IS NULL THEN 'working'
        WHEN att.checkout_at IS NOT NULL THEN 'completed'
        WHEN att.checkin_at IS NULL THEN 'pending'
        ELSE 'unknown'
    END as work_status,
    -- Calculate work hours
    CASE
        WHEN att.checkin_at IS NOT NULL AND att.checkout_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (att.checkout_at - att.checkin_at)) / 3600.0
        ELSE NULL
    END as work_hours,
    -- Include today's flag for filtering
    CASE
        WHEN DATE(s.start_at AT TIME ZONE 'Asia/Tokyo') = t.today_jst THEN true
        ELSE false
    END as is_today,
    CASE
        WHEN DATE(s.start_at AT TIME ZONE 'Asia/Tokyo') = t.yesterday_jst THEN true
        ELSE false
    END as is_yesterday,
    CASE
        WHEN DATE(s.start_at AT TIME ZONE 'Asia/Tokyo') = t.tomorrow_jst THEN true
        ELSE false
    END as is_tomorrow
FROM tokyo_today t
CROSS JOIN assignments a
JOIN staff st ON a.staff_id = st.id
JOIN shifts s ON a.shift_id = s.id
LEFT JOIN skills sk ON s.skill_id = sk.id
JOIN events e ON s.event_id = e.id
JOIN venues v ON e.venue_id = v.id
LEFT JOIN attendances att ON att.staff_id = a.staff_id AND att.shift_id = a.shift_id
WHERE
    -- Include shifts from yesterday to tomorrow (for flexibility)
    DATE(s.start_at AT TIME ZONE 'Asia/Tokyo') BETWEEN t.yesterday_jst AND t.tomorrow_jst;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_daily_assignments_pk ON v_daily_assignments(assignment_id);

-- Create additional indexes for common queries
CREATE INDEX idx_daily_assignments_staff_id ON v_daily_assignments(staff_id);
CREATE INDEX idx_daily_assignments_user_id ON v_daily_assignments(user_id);
CREATE INDEX idx_daily_assignments_shift_date ON v_daily_assignments(shift_date_jst);
CREATE INDEX idx_daily_assignments_is_today ON v_daily_assignments(is_today) WHERE is_today = true;
CREATE INDEX idx_daily_assignments_status ON v_daily_assignments(assignment_status);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_daily_assignments()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY v_daily_assignments;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON v_daily_assignments TO anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_daily_assignments() TO authenticated;

-- Function to get today's assignments for a specific user
CREATE OR REPLACE FUNCTION get_user_today_assignments(p_user_id UUID)
RETURNS TABLE (
    assignment_id UUID,
    shift_id UUID,
    shift_start_jst TIMESTAMPTZ,
    shift_end_jst TIMESTAMPTZ,
    event_name TEXT,
    venue_name TEXT,
    venue_address TEXT,
    assignment_status assignment_status,
    work_status TEXT,
    work_hours DOUBLE PRECISION
) AS $$
BEGIN
    -- First refresh the view if needed (optional, can be scheduled instead)
    -- PERFORM refresh_daily_assignments();

    RETURN QUERY
    SELECT
        v.assignment_id,
        v.shift_id,
        v.shift_start_jst,
        v.shift_end_jst,
        v.event_name,
        v.venue_name,
        v.venue_address,
        v.assignment_status,
        v.work_status,
        v.work_hours
    FROM v_daily_assignments v
    WHERE
        v.user_id = p_user_id
        AND v.is_today = true
    ORDER BY v.shift_start_jst ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get all today's assignments (for admin/manager)
CREATE OR REPLACE FUNCTION get_all_today_assignments()
RETURNS TABLE (
    assignment_id UUID,
    staff_id UUID,
    staff_name TEXT,
    shift_id UUID,
    shift_start_jst TIMESTAMPTZ,
    shift_end_jst TIMESTAMPTZ,
    event_name TEXT,
    venue_name TEXT,
    assignment_status assignment_status,
    work_status TEXT,
    work_hours DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.assignment_id,
        v.staff_id,
        v.staff_name,
        v.shift_id,
        v.shift_start_jst,
        v.shift_end_jst,
        v.event_name,
        v.venue_name,
        v.assignment_status,
        v.work_status,
        v.work_hours
    FROM v_daily_assignments v
    WHERE v.is_today = true
    ORDER BY v.venue_name, v.shift_start_jst, v.staff_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant permissions for functions
GRANT EXECUTE ON FUNCTION get_user_today_assignments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_today_assignments() TO authenticated;

-- Add comments
COMMENT ON MATERIALIZED VIEW v_daily_assignments IS 'Pre-computed daily assignments with all related data for performance optimization';
COMMENT ON FUNCTION refresh_daily_assignments() IS 'Refreshes the daily assignments materialized view';
COMMENT ON FUNCTION get_user_today_assignments(UUID) IS 'Gets today assignments for a specific user with JST timezone handling';
COMMENT ON FUNCTION get_all_today_assignments() IS 'Gets all today assignments for admin/manager views';

-- Schedule automatic refresh (requires pg_cron extension)
-- This should be run as a separate admin command after enabling pg_cron
-- SELECT cron.schedule('refresh-daily-assignments', '0 3 * * *', 'SELECT refresh_daily_assignments();');