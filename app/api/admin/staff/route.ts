import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// スタッフ作成/更新用のスキーマ
const staffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  hourly_rate: z.number().optional(),
  daily_rate: z.number().optional(),
  project_rate: z.number().optional(),
  active: z.boolean().default(true),
  skills: z.array(z.object({
    skill_id: z.number(),
    proficiency_level: z.number().min(1).max(5).default(3),
    certified: z.boolean().default(false)
  })).optional()
})

// GET: スタッフ一覧取得
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スタッフ一覧を取得（スキル情報付き）
    const { data: staffList, error } = await supabase
      .from('staff')
      .select(`
        *,
        staff_skills (
          skill_id,
          proficiency_level,
          certified,
          skills (
            id,
            code,
            label,
            description
          )
        ),
        user_roles (
          role
        )
      `)
      .order('name')

    if (error) throw error

    // データを整形
    const formattedStaff = staffList?.map(staff => ({
      ...staff,
      skills: staff.staff_skills?.map((ss: any) => ({
        skill_id: ss.skill_id,
        skill_code: ss.skills?.code,
        skill_label: ss.skills?.label,
        proficiency_level: ss.proficiency_level,
        certified: ss.certified
      })) || [],
      role: staff.user_roles?.[0]?.role || 'staff'
    }))

    return NextResponse.json({ staff: formattedStaff })

  } catch (error) {
    console.error('Staff fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff' },
      { status: 500 }
    )
  }
}

// POST: 新規スタッフ作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = staffSchema.parse(body)

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

    // トランザクション的に処理
    const { skills, ...staffData } = validatedData

    // スタッフを作成
    const { data: newStaff, error: staffError } = await supabase
      .from('staff')
      .insert(staffData)
      .select()
      .single()

    if (staffError) throw staffError

    // スキルを関連付け
    if (skills && skills.length > 0) {
      const staffSkills = skills.map(skill => ({
        staff_id: newStaff.id,
        skill_id: skill.skill_id,
        proficiency_level: skill.proficiency_level,
        certified: skill.certified
      }))

      const { error: skillsError } = await supabase
        .from('staff_skills')
        .insert(staffSkills)

      if (skillsError) throw skillsError
    }

    // 作成したスタッフ情報を返す
    const { data: createdStaff } = await supabase
      .from('staff')
      .select(`
        *,
        staff_skills (
          skill_id,
          proficiency_level,
          certified,
          skills (
            id,
            code,
            label
          )
        )
      `)
      .eq('id', newStaff.id)
      .single()

    return NextResponse.json({ staff: createdStaff }, { status: 201 })

  } catch (error) {
    console.error('Staff creation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create staff' },
      { status: 500 }
    )
  }
}