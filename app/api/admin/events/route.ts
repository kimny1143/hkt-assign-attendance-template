import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const eventSchema = z.object({
  venue_id: z.string().uuid(),
  event_date: z.string(), // YYYY-MM-DD
  open_time: z.string().optional(), // HH:MM
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  notes: z.string().optional()
})

// GET: イベント一覧取得
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // クエリパラメータで日付範囲を指定可能
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') || new Date().toISOString().split('T')[0]
    const to = searchParams.get('to') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // イベント一覧を取得
    const { data: events, error } = await supabase
      .from('events')
      .select(`
        *,
        venues (
          id,
          name,
          address,
          lat,
          lon
        ),
        shifts (
          id,
          skill_id,
          start_at,
          end_at,
          required,
          skills (
            code,
            label
          ),
          assignments (
            id,
            status,
            staff (
              id,
              name
            )
          )
        )
      `)
      .gte('event_date', from)
      .lte('event_date', to)
      .order('event_date', { ascending: true })

    if (error) throw error

    // データを整形
    const formattedEvents = events?.map(event => ({
      ...event,
      venue: event.venues,
      shifts: event.shifts?.map((shift: any) => ({
        ...shift,
        skill: shift.skills,
        confirmed_count: shift.assignments?.filter((a: any) => a.status === 'confirmed').length || 0,
        assignments: shift.assignments
      })) || []
    }))

    return NextResponse.json({ events: formattedEvents })

  } catch (error) {
    console.error('Events fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

// POST: 新規イベント作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = eventSchema.parse(body)

    const supabase = await createClient()

    // 認証・権限チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 管理者権限チェック
    const { data: currentStaff } = await supabase
      .from('staff')
      .select('user_roles!user_roles_staff_id_fkey(role)')
      .eq('user_id', user.id)
      .single()

    const role = currentStaff?.user_roles?.[0]?.role
    if (!role || (role !== 'admin' && role !== 'manager')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // イベントを作成
    const { data: newEvent, error } = await supabase
      .from('events')
      .insert(validatedData)
      .select(`
        *,
        venues (
          id,
          name,
          address
        )
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ event: newEvent }, { status: 201 })

  } catch (error) {
    console.error('Event creation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}