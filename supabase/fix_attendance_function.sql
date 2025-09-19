-- 既存の関数を削除
DROP FUNCTION IF EXISTS attendance_punch_v2(UUID, UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT);

-- 正しいカラム名で関数を再作成
CREATE FUNCTION attendance_punch_v2(
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
  -- staff_idを取得
  SELECT id INTO v_staff_id
  FROM staff
  WHERE user_id = p_staff_uid;

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Staff record not found for user %', p_staff_uid;
  END IF;

  -- アサインメントの確認
  IF NOT EXISTS (
    SELECT 1 FROM assignments
    WHERE staff_id = v_staff_id
      AND shift_id = p_shift_id
      AND status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'No confirmed assignment found for this shift';
  END IF;

  -- 既存の出勤記録を確認
  SELECT id INTO v_attendance_id
  FROM attendances
  WHERE staff_id = v_staff_id
    AND shift_id = p_shift_id
    AND DATE(check_in_ts) = CURRENT_DATE;

  IF p_purpose = 'checkin' THEN
    -- 出勤打刻
    IF v_attendance_id IS NOT NULL THEN
      RAISE EXCEPTION 'Already checked in for today';
    END IF;

    INSERT INTO attendances (
      staff_id,
      shift_id,
      check_in_ts,
      check_in_lat,
      check_in_lon,
      check_in_equipment_qr
    ) VALUES (
      v_staff_id,
      p_shift_id,
      NOW(),
      p_lat,
      p_lon,
      p_equipment_qr
    )
    RETURNING id INTO v_attendance_id;

    v_result := json_build_object(
      'attendance_id', v_attendance_id,
      'purpose', 'checkin',
      'timestamp', NOW()
    );

  ELSIF p_purpose = 'checkout' THEN
    -- 退勤打刻
    IF v_attendance_id IS NULL THEN
      RAISE EXCEPTION 'No check-in record found for today';
    END IF;

    UPDATE attendances
    SET 
      check_out_ts = NOW(),
      check_out_lat = p_lat,
      check_out_lon = p_lon,
      check_out_equipment_qr = p_equipment_qr
    WHERE id = v_attendance_id
      AND check_out_ts IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Already checked out';
    END IF;

    v_result := json_build_object(
      'attendance_id', v_attendance_id,
      'purpose', 'checkout',
      'timestamp', NOW()
    );

  ELSE
    RAISE EXCEPTION 'Invalid purpose: %', p_purpose;
  END IF;

  RETURN v_result;
END;
$$;