-- ============================================
-- Fix attendance_punch function
-- Date: 2025-01-20
-- Purpose: Fix the attendance_punch_v2 function to match actual schema
-- ============================================

-- Drop the incorrect function
DROP FUNCTION IF EXISTS attendance_punch_v2;

-- Create the correct function with matching column names
CREATE OR REPLACE FUNCTION public.attendance_punch(
  p_staff_uid UUID,
  p_shift_id UUID,
  p_equipment_qr TEXT,
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_purpose TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff_id UUID;
  v_attendance_id UUID;
  v_result JSON;
BEGIN
  -- Get staff_id from user_id
  SELECT id INTO v_staff_id
  FROM staff
  WHERE user_id = p_staff_uid;

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Staff record not found for user %', p_staff_uid;
  END IF;

  -- Check assignment exists and is confirmed
  IF NOT EXISTS (
    SELECT 1 FROM assignments
    WHERE staff_id = v_staff_id
      AND shift_id = p_shift_id
      AND status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'No confirmed assignment found for this shift';
  END IF;

  -- Check for existing attendance record
  SELECT id INTO v_attendance_id
  FROM attendances
  WHERE staff_id = v_staff_id
    AND shift_id = p_shift_id;

  IF p_purpose = 'checkin' THEN
    -- Check-in logic
    IF v_attendance_id IS NOT NULL AND (
      SELECT check_in_ts FROM attendances WHERE id = v_attendance_id
    ) IS NOT NULL THEN
      RAISE EXCEPTION 'Already checked in for this shift';
    END IF;

    IF v_attendance_id IS NULL THEN
      -- Create new attendance record
      INSERT INTO attendances (
        staff_id,
        shift_id,
        check_in_ts,
        check_in_lat,
        check_in_lon,
        check_in_equipment_qr,
        status
      ) VALUES (
        v_staff_id,
        p_shift_id,
        NOW(),
        p_lat,
        p_lon,
        p_equipment_qr,
        'pending'
      )
      RETURNING id INTO v_attendance_id;
    ELSE
      -- Update existing record
      UPDATE attendances
      SET
        check_in_ts = NOW(),
        check_in_lat = p_lat,
        check_in_lon = p_lon,
        check_in_equipment_qr = p_equipment_qr,
        updated_at = NOW()
      WHERE id = v_attendance_id;
    END IF;

    v_result := json_build_object(
      'attendance_id', v_attendance_id,
      'purpose', 'checkin',
      'timestamp', NOW(),
      'status', 'success'
    );

  ELSIF p_purpose = 'checkout' THEN
    -- Check-out logic
    IF v_attendance_id IS NULL THEN
      RAISE EXCEPTION 'No attendance record found for this shift';
    END IF;

    -- Check if already checked in
    IF (SELECT check_in_ts FROM attendances WHERE id = v_attendance_id) IS NULL THEN
      RAISE EXCEPTION 'Must check in before checking out';
    END IF;

    -- Check if already checked out
    IF (SELECT check_out_ts FROM attendances WHERE id = v_attendance_id) IS NOT NULL THEN
      RAISE EXCEPTION 'Already checked out for this shift';
    END IF;

    UPDATE attendances
    SET
      check_out_ts = NOW(),
      check_out_lat = p_lat,
      check_out_lon = p_lon,
      check_out_equipment_qr = p_equipment_qr,
      updated_at = NOW()
    WHERE id = v_attendance_id;

    v_result := json_build_object(
      'attendance_id', v_attendance_id,
      'purpose', 'checkout',
      'timestamp', NOW(),
      'status', 'success'
    );

  ELSE
    RAISE EXCEPTION 'Invalid purpose: %. Must be "checkin" or "checkout"', p_purpose;
  END IF;

  RETURN v_result;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.attendance_punch IS '打刻処理用関数: QRコードとGPS位置情報を使用してスタッフの出退勤を記録';

-- ============================================
-- Migration Complete
-- Next step: Update API route to call 'attendance_punch' instead of 'attendance_punch_v2'
-- ============================================