import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET(req: NextRequest) {
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
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (staffError || !staff) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
  }

  // 本日のアサインメント取得
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const { data: assignments, error } = await supabase
    .from('assignments')
    .select(`
      id,
      confirmed,
      shifts (
        id,
        start_ts,
        end_ts,
        events (
          id,
          name,
          venues (
            id,
            name,
            address
          )
        )
      )
    `)
    .eq('staff_id', staff.id)
    .gte('shifts.start_ts', `${todayStr}T00:00:00`)
    .lte('shifts.start_ts', `${todayStr}T23:59:59`)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ assignments: assignments || [] })
}