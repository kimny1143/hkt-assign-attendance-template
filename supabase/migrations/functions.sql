-- ストアドファンクション定義

-- 物理QRコードによる打刻処理
CREATE OR REPLACE FUNCTION public.attendance_punch_v2(
  p_staff_uid uuid,
  p_shift_id uuid,
  p_equipment_qr text,
  p_lat double precision,
  p_lon double precision,
  p_purpose text
) RETURNS jsonb AS $$
DECLARE
  v_attendance_id uuid;
BEGIN
  -- 打刻記録を更新または作成
  IF p_purpose = 'checkin' THEN
    INSERT INTO attendances (
      staff_id, shift_id, 
      check_in_ts, check_in_lat, check_in_lon, check_in_equipment_qr
    ) VALUES (
      p_staff_uid, p_shift_id,
      now(), p_lat, p_lon, p_equipment_qr
    )
    ON CONFLICT (staff_id, shift_id) 
    DO UPDATE SET
      check_in_ts = now(),
      check_in_lat = p_lat,
      check_in_lon = p_lon,
      check_in_equipment_qr = p_equipment_qr,
      updated_at = now()
    RETURNING id INTO v_attendance_id;
  ELSE -- checkout
    UPDATE attendances SET
      check_out_ts = now(),
      check_out_lat = p_lat,
      check_out_lon = p_lon,
      check_out_equipment_qr = p_equipment_qr,
      updated_at = now()
    WHERE staff_id = p_staff_uid AND shift_id = p_shift_id
    RETURNING id INTO v_attendance_id;
  END IF;

  RETURN jsonb_build_object(
    'attendance_id', v_attendance_id,
    'purpose', p_purpose,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_equipment_qr_code ON public.equipment(qr_code);
CREATE INDEX IF NOT EXISTS idx_equipment_venue_id ON public.equipment(venue_id);
CREATE INDEX IF NOT EXISTS idx_attendances_staff_shift ON public.attendances(staff_id, shift_id);

-- コメント追加
COMMENT ON FUNCTION public.attendance_punch_v2 IS '物理QRコード（機材）とGPS位置情報による打刻処理';
COMMENT ON TABLE public.equipment IS '会場機材情報（物理QRコード管理）';
COMMENT ON TABLE public.user_roles IS 'ユーザー権限管理（admin/manager/staff）';