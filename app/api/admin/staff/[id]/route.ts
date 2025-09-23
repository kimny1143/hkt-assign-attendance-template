import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const staffUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  hourly_rate: z.number().optional(),
  daily_rate: z.number().optional(),
  project_rate: z.number().optional(),
  active: z.boolean().optional(),
  skills: z.array(z.object({
    skill_id: z.number(),
    proficiency_level: z.number().min(1).max(5).default(3),
    certified: z.boolean().default(false)
  })).optional()
})

// GET: スタッフ詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スタッフ詳細を取得
    const { data: staff, error } = await supabase
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
        ),
        assignments (
          id,
          status,
          shifts (
            id,
            start_at,
            end_at,
            events (
              event_date,
              venues (
                name
              )
            )
          )
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
      }
      throw error
    }

    // データを整形
    const formattedStaff = {
      ...staff,
      skills: staff.staff_skills?.map((ss: any) => ({
        skill_id: ss.skill_id,
        skill_code: ss.skills?.code,
        skill_label: ss.skills?.label,
        proficiency_level: ss.proficiency_level,
        certified: ss.certified
      })) || [],
      role: staff.user_roles?.[0]?.role || 'staff',
      recent_assignments: staff.assignments?.slice(0, 10) || []
    }

    return NextResponse.json({ staff: formattedStaff })

  } catch (error) {
    console.error('Staff fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff' },
      { status: 500 }
    )
  }
}

// PUT: スタッフ情報更新
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validatedData = staffUpdateSchema.parse(body)

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

    // スタッフ情報を更新
    const { skills, ...staffData } = validatedData

    if (Object.keys(staffData).length > 0) {
      const { error: staffError } = await supabase
        .from('staff')
        .update(staffData)
        .eq('id', params.id)

      if (staffError) throw staffError
    }

    // スキルを更新（削除して再作成）
    if (skills !== undefined) {
      // 既存のスキルを削除
      const { error: deleteError } = await supabase
        .from('staff_skills')
        .delete()
        .eq('staff_id', params.id)

      if (deleteError) throw deleteError

      // 新しいスキルを追加
      if (skills.length > 0) {
        const staffSkills = skills.map(skill => ({
          staff_id: params.id,
          skill_id: skill.skill_id,
          proficiency_level: skill.proficiency_level,
          certified: skill.certified
        }))

        const { error: skillsError } = await supabase
          .from('staff_skills')
          .insert(staffSkills)

        if (skillsError) throw skillsError
      }
    }

    // 更新後のスタッフ情報を返す
    const { data: updatedStaff } = await supabase
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
      .eq('id', params.id)
      .single()

    return NextResponse.json({ staff: updatedStaff })

  } catch (error) {
    console.error('Staff update error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update staff' },
      { status: 500 }
    )
  }
}

// DELETE: スタッフ削除（非活性化）
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Only admin can delete staff' }, { status: 403 })
    }

    // スタッフを非活性化（物理削除はしない）
    const { error } = await supabase
      .from('staff')
      .update({ active: false })
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Staff delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete staff' },
      { status: 500 }
    )
  }
}