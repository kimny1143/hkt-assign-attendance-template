import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import { getCurrentJST, toSupabaseTimestamp } from '@/lib/utils/date'

// Haversine formula for GPS distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c // Distance in meters
}

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

  const cookieStore = cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set() {},
      remove() {}
    }
  })

  const { data: u, error: uerr } = await supabase.auth.getUser()
  if (uerr || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { equipment_qr, lat, lon, purpose } = parse.data

  // 機材情報から会場とシフトを特定
  const { data: equipment, error: eqError } = await supabase
    .from('equipment')
    .select(`
      id,
      venue_id,
      name,
      venues!inner (
        id,
        lat,
        lon
      )
    `)
    .eq('qr_code', equipment_qr)
    .eq('active', true)
    .single()

  if (eqError || !equipment) {
    return NextResponse.json({ error: 'Invalid QR code or equipment not found' }, { status: 400 })
  }

  // GPS距離検証（±300m）
  const venueData = Array.isArray(equipment.venues) ? equipment.venues[0] : equipment.venues
  const distance = calculateDistance(lat, lon, venueData.lat, venueData.lon)
  if (distance > 300) {
    return NextResponse.json({ error: `Too far from venue: ${Math.round(distance)}m` }, { status: 400 })
  }

  // 今日のシフトを取得（JST基準、機材がある会場のイベントから）
  const today = getCurrentJST('DATE')

  // JSTの日付をUTCに変換してフィルタリング
  const startOfDayJST = `${today}T00:00:00`
  const endOfDayJST = `${today}T23:59:59`
  const startOfDayUTC = toSupabaseTimestamp(startOfDayJST)
  const endOfDayUTC = toSupabaseTimestamp(endOfDayJST)

  const { data: shift, error: shiftError } = await supabase
    .from('shifts')
    .select(`
      id,
      events!inner(
        venue_id
      )
    `)
    .eq('events.venue_id', equipment.venue_id)
    .gte('start_at', startOfDayUTC)
    .lte('start_at', endOfDayUTC)
    .single()

  if (shiftError || !shift) {
    return NextResponse.json({ error: 'No shift found for today at this venue' }, { status: 400 })
  }

  // 打刻記録を作成/更新
  const { data, error } = await supabase.rpc('attendance_punch', {
    p_staff_uid: u.user.id,
    p_shift_id: shift.id,
    p_equipment_qr: equipment_qr,
    p_lat: lat,
    p_lon: lon,
    p_purpose: purpose
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, attendance: data })
}