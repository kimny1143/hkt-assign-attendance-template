-- ============================================
-- PostGIS Distance Calculation Functions
-- ============================================
-- This migration moves distance calculation from API layer to DB layer
-- using PostGIS functions for improved accuracy and performance
-- ============================================

-- Function to check attendance location with PostGIS
CREATE OR REPLACE FUNCTION check_attendance_location(
    p_lat DOUBLE PRECISION,
    p_lon DOUBLE PRECISION,
    p_venue_id UUID,
    p_max_distance_meters INTEGER DEFAULT 300
) RETURNS TABLE (
    is_valid BOOLEAN,
    distance_meters DOUBLE PRECISION,
    venue_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN ST_Distance(
                ST_MakePoint(v.lon, v.lat)::geography,
                ST_MakePoint(p_lon, p_lat)::geography
            ) <= p_max_distance_meters THEN true
            ELSE false
        END as is_valid,
        ST_Distance(
            ST_MakePoint(v.lon, v.lat)::geography,
            ST_MakePoint(p_lon, p_lat)::geography
        ) as distance_meters,
        v.name as venue_name
    FROM venues v
    WHERE v.id = p_venue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add spatial index for better performance (if not exists)
-- Note: Creating index on expression requires computed column or different approach
-- For now, create separate indexes on lat/lon columns
CREATE INDEX IF NOT EXISTS idx_venues_lat ON venues (lat);
CREATE INDEX IF NOT EXISTS idx_venues_lon ON venues (lon);

-- Integrated attendance punch function with PostGIS validation
CREATE OR REPLACE FUNCTION process_attendance_punch(
    p_staff_uid UUID,
    p_shift_id UUID,
    p_equipment_qr TEXT,
    p_lat DOUBLE PRECISION,
    p_lon DOUBLE PRECISION,
    p_purpose TEXT
) RETURNS JSON AS $$
DECLARE
    v_venue_id UUID;
    v_location_check RECORD;
    v_staff_id UUID;
    v_attendance_id UUID;
    v_result JSON;
BEGIN
    -- Get staff_id from user_id
    SELECT id INTO v_staff_id FROM staff WHERE user_id = p_staff_uid;

    IF v_staff_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Staff record not found');
    END IF;

    -- Validate equipment QR code
    IF NOT EXISTS (
        SELECT 1 FROM equipment
        WHERE qr_code = p_equipment_qr
        AND active = true
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Invalid QR code or equipment not found');
    END IF;

    -- Get venue ID from shift
    SELECT v.id INTO v_venue_id
    FROM shifts s
    JOIN events e ON s.event_id = e.id
    JOIN venues v ON e.venue_id = v.id
    WHERE s.id = p_shift_id;

    IF v_venue_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Shift or venue not found');
    END IF;

    -- Validate location using PostGIS
    SELECT * INTO v_location_check
    FROM check_attendance_location(p_lat, p_lon, v_venue_id, 300);

    IF NOT v_location_check.is_valid THEN
        RETURN json_build_object(
            'success', false,
            'error', format('Location too far: %s meters from %s',
                           v_location_check.distance_meters::INTEGER,
                           v_location_check.venue_name)
        );
    END IF;

    -- Check/create assignment (relaxed for development)
    IF NOT EXISTS (
        SELECT 1 FROM assignments
        WHERE staff_id = v_staff_id AND shift_id = p_shift_id
    ) THEN
        INSERT INTO assignments (staff_id, shift_id, status, created_at)
        VALUES (v_staff_id, p_shift_id, 'confirmed', NOW());
    END IF;

    -- Process attendance punch
    SELECT id INTO v_attendance_id
    FROM attendances
    WHERE staff_id = v_staff_id AND shift_id = p_shift_id;

    IF p_purpose = 'checkin' THEN
        IF v_attendance_id IS NULL THEN
            -- Create new attendance record
            INSERT INTO attendances (
                staff_id,
                shift_id,
                check_in_equipment_qr,
                checkin_at,
                check_in_lat,
                check_in_lon,
                status
            ) VALUES (
                v_staff_id,
                p_shift_id,
                p_equipment_qr,
                NOW(),
                p_lat,
                p_lon,
                'pending'
            )
            RETURNING id INTO v_attendance_id;
        ELSE
            -- Update existing record
            UPDATE attendances
            SET
                checkin_at = NOW(),
                check_in_lat = p_lat,
                check_in_lon = p_lon,
                check_in_equipment_qr = p_equipment_qr
            WHERE id = v_attendance_id;
        END IF;
    ELSIF p_purpose = 'checkout' THEN
        IF v_attendance_id IS NULL THEN
            RETURN json_build_object('success', false, 'error', 'Cannot checkout without checking in first');
        END IF;

        UPDATE attendances
        SET
            checkout_at = NOW(),
            check_out_lat = p_lat,
            check_out_lon = p_lon,
            check_out_equipment_qr = p_equipment_qr
        WHERE id = v_attendance_id;
    ELSE
        RETURN json_build_object('success', false, 'error', format('Invalid purpose: %s', p_purpose));
    END IF;

    -- Return success with attendance data
    SELECT json_build_object(
        'success', true,
        'id', id,
        'staff_id', staff_id,
        'shift_id', shift_id,
        'checkin_at', checkin_at,
        'checkout_at', checkout_at,
        'status', status,
        'distance_meters', v_location_check.distance_meters
    ) INTO v_result
    FROM attendances
    WHERE id = v_attendance_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to find shifts by venue and date with PostGIS
CREATE OR REPLACE FUNCTION find_shifts_by_location_and_date(
    p_lat DOUBLE PRECISION,
    p_lon DOUBLE PRECISION,
    p_date DATE,
    p_max_distance_meters INTEGER DEFAULT 500
) RETURNS TABLE (
    shift_id UUID,
    event_name TEXT,
    venue_name TEXT,
    distance_meters DOUBLE PRECISION,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id as shift_id,
        e.name as event_name,
        v.name as venue_name,
        ST_Distance(
            ST_MakePoint(v.lon, v.lat)::geography,
            ST_MakePoint(p_lon, p_lat)::geography
        ) as distance_meters,
        s.start_at,
        s.end_at
    FROM shifts s
    JOIN events e ON s.event_id = e.id
    JOIN venues v ON e.venue_id = v.id
    WHERE
        DATE(s.start_at AT TIME ZONE 'Asia/Tokyo') = p_date
        AND ST_Distance(
            ST_MakePoint(v.lon, v.lat)::geography,
            ST_MakePoint(p_lon, p_lat)::geography
        ) <= p_max_distance_meters
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_attendance_location TO anon, authenticated;
GRANT EXECUTE ON FUNCTION process_attendance_punch TO anon, authenticated;
GRANT EXECUTE ON FUNCTION find_shifts_by_location_and_date TO anon, authenticated;

-- Add comments
COMMENT ON FUNCTION check_attendance_location IS 'Validates GPS location against venue location using PostGIS';
COMMENT ON FUNCTION process_attendance_punch IS 'Processes attendance punch with integrated PostGIS validation';
COMMENT ON FUNCTION find_shifts_by_location_and_date IS 'Finds nearby shifts for a given date using PostGIS';