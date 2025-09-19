import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // その日のシフトを取得
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select(`
        id,
        name,
        start_ts,
        end_ts,
        required,
        events!inner(
          venue_id,
          venues(name)
        ),
        assignments(
          id,
          status,
          staff_id,
          staff!assignments_staff_id_fkey(name)
        )
      `)
      .gte('start_ts', `${date}T00:00:00`)
      .lte('start_ts', `${date}T23:59:59`)

    if (shiftsError) {
      console.error('Shifts error:', shiftsError)
      return NextResponse.json({ error: shiftsError.message }, { status: 500 })
    }

    // その日にまだアサインされていないスタッフを取得
    const { data: allStaff } = await supabase
      .from('staff')
      .select('id, name, skill_tags')
      .eq('active', true)

    // アサイン済みのスタッフIDを抽出
    const assignedStaffIds = new Set()
    shifts?.forEach(shift => {
      shift.assignments?.forEach(assignment => {
        if (assignment.status === 'confirmed') {
          assignedStaffIds.add(assignment.staff_id)
        }
      })
    })

    // 利用可能なスタッフをフィルタ
    const availableStaff = allStaff?.filter(staff => !assignedStaffIds.has(staff.id)) || []

    // データを整形（デバッグログ付き）
    console.log('Raw shifts data:', JSON.stringify(shifts?.[0], null, 2)) // DEBUG
    
    const formattedShifts = shifts?.map((shift: any) => {
      // eventsがオブジェクトか配列か確認
      const venueName = shift.events?.venues?.name ||
                        (Array.isArray(shift.events) && shift.events[0]?.venues?.name) ||
                        '会場未設定'
      
      // タイムゾーン変換（UTC → JST）
      const startDate = new Date(shift.start_ts)
      const endDate = new Date(shift.end_ts)
      
      return {
        id: shift.id,
        name: shift.name || '照明・リギング作業',
        start_ts: startDate.toLocaleTimeString('ja-JP', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Asia/Tokyo'  // 明示的に日本時間を指定
        }),
        end_ts: endDate.toLocaleTimeString('ja-JP', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Asia/Tokyo'  // 明示的に日本時間を指定
        }),
        required: shift.required,
        venue_name: venueName,
        assignments: shift.assignments?.map((a: any) => ({
          id: a.id,
          staff_id: a.staff_id,
          staff_name: a.staff?.name || (Array.isArray(a.staff) && a.staff[0]?.name) || '不明',
          status: a.status
        })) || []
      }
    }) || []

    return NextResponse.json({
      shifts: formattedShifts,
      availableStaff
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}