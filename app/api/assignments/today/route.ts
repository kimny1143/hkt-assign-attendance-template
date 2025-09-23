import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getCurrentJST } from '@/lib/utils/date'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {}
      }
    }
  )

  // 認証確認
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // スタッフ情報取得
  console.log('Fetching staff for user_id:', user.id)
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (staffError || !staff) {
    console.error('Staff not found:', staffError)
    return NextResponse.json({ error: 'Staff not found', details: staffError?.message }, { status: 404 })
  }
  console.log('Found staff:', staff)

  // 本日のアサインメント取得（JST基準）
  const todayStr = getCurrentJST('DATE')

  // まず本日のシフトを取得
  console.log('Fetching today shifts for date:', todayStr)
  const { data: todayShifts, error: shiftError } = await supabase
    .from('shifts')
    .select('id')
    .gte('start_at', `${todayStr}T00:00:00`)
    .lte('start_at', `${todayStr}T23:59:59`)

  if (shiftError) {
    console.error('Shift fetch error:', shiftError)
    return NextResponse.json({ error: shiftError.message }, { status: 500 })
  }
  console.log('Found shifts:', todayShifts)

  const shiftIds = todayShifts?.map(s => s.id) || []

  if (shiftIds.length === 0) {
    return NextResponse.json({ assignments: [] })
  }

  // アサインメント取得
  console.log('Fetching assignments for staff:', staff.id, 'shifts:', shiftIds)
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select(`
      id,
      status,
      shifts!inner (
        id,
        start_at,
        end_at,
        events!inner (
          id,
          name,
          venues!inner (
            id,
            name,
            address
          )
        )
      )
    `)
    .eq('staff_id', staff.id)
    .in('shift_id', shiftIds)

  if (error) {
    console.error('Assignment fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log('Found assignments:', assignments)

  return NextResponse.json({ assignments: assignments || [] })
  } catch (error: any) {
    console.error('Error in /api/assignments/today:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error?.message || 'Unknown error',
      stack: error?.stack
    }, { status: 500 })
  }
}