import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'

const schema = z.object({
  shift_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  qr_token: z.string().min(10),
  photo_url: z.string().url(),
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

  const { shift_id, lat, lon, qr_token, photo_url, purpose } = parse.data

  const { data, error } = await supabase.rpc('attendance_punch', {
    p_staff_uid: u.user.id,
    p_shift_id: shift_id,
    p_lat: lat,
    p_lon: lon,
    p_qr_token: qr_token,
    p_photo_url: photo_url,
    p_purpose: purpose
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, attendance: data })
}