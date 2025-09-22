import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const shiftSchema = z.object({
  event_id: z.string().uuid(),
  skill_id: z.number(),
  start_ts: z.string(), // ISO 8601 datetime
  end_ts: z.string(),
  required: z.number().min(1).default(1)
})

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
    const { data: allStaff, error: staffError } = await supabase
      .from('staff')
      .select(`
        id,
        name,
        staff_skills (
          skill_id,
          skills (
            id,
            code,
            label
          )
        )
      `)
      .eq('active', true)

    if (staffError) {
      console.error('Staff query error:', staffError)
    }
    console.log('All staff data:', JSON.stringify(allStaff?.[0], null, 2)) // デバッグ用に1人目のデータを表示

    // アサイン済みのスタッフIDを抽出
    const assignedStaffIds = new Set()
    shifts?.forEach(shift => {
      shift.assignments?.forEach(assignment => {
        if (assignment.status === 'confirmed') {
          assignedStaffIds.add(assignment.staff_id)
        }
      })
    })

    // 必要な全スキルのIDを取得（照明、音響、配信、リギング）
    const { data: allSkills } = await supabase
      .from('skills')
      .select('id, code')

    console.log('All skills from DB:', allSkills) // デバッグ

    const requiredSkillCodes = ['pa', 'sound_operator', 'lighting', 'backstage']
    const requiredSkillIds = allSkills
      ?.filter(skill => requiredSkillCodes.includes(skill.code))
      .map(skill => skill.id) || []

    console.log('Required skill IDs:', requiredSkillIds) // デバッグ

    // 利用可能なスタッフをフィルタとスキルタグ整形
    const availableStaff = allStaff?.filter(staff => !assignedStaffIds.has(staff.id))
      .map((staff: any) => {
        // スタッフのスキル情報を整形
        const staffSkills = staff.staff_skills || []
        const skillIds: number[] = []
        const skillLabels: string[] = []

        staffSkills.forEach((ss: any) => {
          if (ss.skills) {
            skillIds.push(ss.skills.id)
            skillLabels.push(ss.skills.label || ss.skills.code)
          }
        })

        const hasAllSkills = requiredSkillIds.length > 0 &&
                           requiredSkillIds.every(skillId => skillIds.includes(skillId))

        // デバッグログ
        console.log(`Staff ${staff.name}:`, {
          skillIds,
          requiredSkillIds,
          hasAllSkills
        })

        return {
          id: staff.id,
          name: staff.name,
          skill_tags: skillLabels,
          is_available: true, // 将来的に就業可能日程チェックを実装
          has_all_skills: hasAllSkills // 全スキル保有フラグ
        }
      }) || []

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
      availableStaff,
      requiredSkillIds // フロントエンドでのフィルタリング用
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: 新規シフト作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = shiftSchema.parse(body)

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

    // 時間の妥当性チェック
    if (new Date(validatedData.end_ts) <= new Date(validatedData.start_ts)) {
      return NextResponse.json(
        { error: '終了時刻は開始時刻より後である必要があります' },
        { status: 400 }
      )
    }

    // シフトを作成
    const { data: newShift, error } = await supabase
      .from('shifts')
      .insert(validatedData)
      .select(`
        *,
        skills (
          code,
          label
        ),
        events (
          event_date,
          venues (
            name
          )
        )
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ shift: newShift }, { status: 201 })

  } catch (error) {
    console.error('Shift creation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create shift' },
      { status: 500 }
    )
  }
}