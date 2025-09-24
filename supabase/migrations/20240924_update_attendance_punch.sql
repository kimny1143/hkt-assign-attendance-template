-- Temporarily update attendance_punch function to allow any assignment status for development
-- This relaxes the validation to allow attendance punch even without confirmed status

CREATE OR REPLACE FUNCTION "public"."attendance_punch"(
  "p_staff_uid" "uuid",
  "p_shift_id" "uuid",
  "p_equipment_qr" "text",
  "p_lat" double precision,
  "p_lon" double precision,
  "p_purpose" "text"
) RETURNS json
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
  v_staff_id UUID;
  v_attendance_id UUID;
  v_result JSON;
BEGIN
  -- Get staff_id from user_id
  SELECT id INTO v_staff_id FROM staff WHERE user_id = p_staff_uid;

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Staff record not found for user %', p_staff_uid;
  END IF;

  -- Check assignment (relaxed for development - any status is OK)
  IF NOT EXISTS (
    SELECT 1 FROM assignments
    WHERE staff_id = v_staff_id AND shift_id = p_shift_id
    -- Removed: AND status = 'confirmed'
  ) THEN
    -- If no assignment exists at all, create one with 'confirmed' status
    INSERT INTO assignments (staff_id, shift_id, status, created_at)
    VALUES (v_staff_id, p_shift_id, 'confirmed', NOW());
  END IF;

  -- Get existing attendance
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
      RAISE EXCEPTION 'Cannot checkout without checking in first';
    END IF;

    UPDATE attendances
    SET
      checkout_at = NOW(),
      check_out_lat = p_lat,
      check_out_lon = p_lon,
      check_out_equipment_qr = p_equipment_qr
    WHERE id = v_attendance_id;
  ELSE
    RAISE EXCEPTION 'Invalid purpose: %', p_purpose;
  END IF;

  -- Return updated attendance record
  SELECT json_build_object(
    'id', id,
    'staff_id', staff_id,
    'shift_id', shift_id,
    'checkin_at', checkin_at,
    'checkout_at', checkout_at,
    'status', status
  ) INTO v_result
  FROM attendances
  WHERE id = v_attendance_id;

  RETURN v_result;
END;
$$;

-- Add comment explaining this is for development
COMMENT ON FUNCTION "public"."attendance_punch" IS 'Attendance punch function with relaxed validation for development. Creates assignment if missing.';