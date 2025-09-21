import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const dayScheduleSchema = z.object({
  available: z.boolean(),
  time_from: z.string().optional(),
  time_to: z.string().optional()
})

const scheduleSchema = z.object({
  week_start_date: z.string(), // YYYY-MM-DD (must be Monday)
  monday: dayScheduleSchema,
  tuesday: dayScheduleSchema,
  wednesday: dayScheduleSchema,
  thursday: dayScheduleSchema,
  friday: dayScheduleSchema,
  saturday: dayScheduleSchema,
  sunday: dayScheduleSchema,
  notes: z.string().optional()
})

// GET: 自分のスケジュール取得
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スタッフIDを取得
    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    // クエリパラメータから週の開始日を取得
    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get('week_start')

    let query = supabase
      .from('staff_schedules')
      .select('*')
      .eq('staff_id', staff.id)
      .order('week_start_date', { ascending: false })

    if (weekStart) {
      query = query.eq('week_start_date', weekStart)
    } else {
      query = query.limit(4) // 最新4週間分
    }

    const { data: schedules, error } = await query

    if (error) throw error

    return NextResponse.json({ schedules })

  } catch (error) {
    console.error('Schedule fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    )
  }
}

// POST: スケジュール登録・更新
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = scheduleSchema.parse(body)

    const supabase = await createClient()

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スタッフIDを取得
    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    // 月曜日チェック
    const weekStartDate = new Date(validatedData.week_start_date)
    if (weekStartDate.getDay() !== 1) {
      return NextResponse.json(
        { error: '週の開始日は月曜日である必要があります' },
        { status: 400 }
      )
    }

    // 週の終了日を計算
    const weekEndDate = new Date(weekStartDate)
    weekEndDate.setDate(weekEndDate.getDate() + 6)

    // スケジュールデータを準備
    const scheduleData = {
      staff_id: staff.id,
      week_start_date: validatedData.week_start_date,
      week_end_date: weekEndDate.toISOString().split('T')[0],
      monday: validatedData.monday,
      tuesday: validatedData.tuesday,
      wednesday: validatedData.wednesday,
      thursday: validatedData.thursday,
      friday: validatedData.friday,
      saturday: validatedData.saturday,
      sunday: validatedData.sunday,
      notes: validatedData.notes
    }

    // UPSERT（存在する場合は更新、なければ作成）
    const { data: schedule, error } = await supabase
      .from('staff_schedules')
      .upsert(scheduleData, {
        onConflict: 'staff_id,week_start_date'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ schedule }, { status: 201 })

  } catch (error) {
    console.error('Schedule creation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid schedule data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create schedule' },
      { status: 500 }
    )
  }
}

// PUT: スケジュールを翌週にコピー
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const currentWeekStart = searchParams.get('current_week')

    if (!currentWeekStart) {
      return NextResponse.json(
        { error: 'current_week parameter is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スタッフIDを取得
    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    // copy_schedule_to_next_week関数を呼び出し
    const { data, error } = await supabase
      .rpc('copy_schedule_to_next_week', {
        p_staff_id: staff.id,
        p_current_week_start: currentWeekStart
      })

    if (error) throw error

    return NextResponse.json({
      success: true,
      new_schedule_id: data
    })

  } catch (error) {
    console.error('Schedule copy error:', error)
    return NextResponse.json(
      { error: 'Failed to copy schedule' },
      { status: 500 }
    )
  }
}