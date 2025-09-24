import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { getCurrentJST } from '@/lib/utils/date'

const schema = z.object({
  equipment_qr: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  purpose: z.enum(['checkin', 'checkout'])
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parse = schema.safeParse(body)
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 })

  const supabase = await createClient()

  const { data: u, error: uerr } = await supabase.auth.getUser()
  if (uerr || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { equipment_qr, lat, lon, purpose } = parse.data

  // Get equipment and venue info
  const { data: equipment, error: eqError } = await supabase
    .from('equipment')
    .select('id, venue_id, name')
    .match({ qr_code: equipment_qr, active: true })
    .single()

  if (eqError || !equipment) {
    return NextResponse.json({ error: 'Invalid QR code or equipment not found' }, { status: 400 })
  }

  // Find today's shifts at this venue using PostGIS function
  const today = getCurrentJST('DATE')
  const { data: shifts, error: shiftError } = await supabase.rpc('find_shifts_by_location_and_date', {
    p_lat: lat,
    p_lon: lon,
    p_date: today,
    p_max_distance_meters: 500
  })

  if (shiftError || !shifts || shifts.length === 0) {
    return NextResponse.json({ error: 'No shift found for today at this location' }, { status: 400 })
  }

  // Use the closest shift
  const shift = shifts[0]

  // Check if shift exists
  if (!shift || !shift.shift_id) {
    return NextResponse.json({ error: 'No valid shift found' }, { status: 400 })
  }

  // Process attendance punch using the new integrated function
  const { data, error } = await supabase.rpc('process_attendance_punch', {
    p_staff_uid: u.user.id,
    p_shift_id: shift.shift_id,
    p_equipment_qr: equipment_qr,
    p_lat: lat,
    p_lon: lon,
    p_purpose: purpose
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Check if the function returned an error
  if (data && !data.success) {
    return NextResponse.json({ error: data.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, attendance: data })
}