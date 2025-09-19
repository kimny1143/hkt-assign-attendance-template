import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const assignSchema = z.object({
  shiftId: z.string().uuid(),
  staffId: z.string().uuid()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Assign request body:', body) // DEBUG
    const { shiftId, staffId } = assignSchema.parse(body)

    const supabase = await createClient()

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 権限チェック（admin or manager）
    // user_roles_staff_id_fkeyを明示的に指定
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id, user_roles!user_roles_staff_id_fkey(role)')
      .eq('user_id', user.id)
      .single()

    console.log('Staff data for permission check:', staffData, staffError) // DEBUG

    const role = staffData?.user_roles?.[0]?.role
    console.log('User role:', role) // DEBUG
    
    if (!role || (role !== 'admin' && role !== 'manager')) {
      console.log('Permission denied for role:', role) // DEBUG
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // シフトの必要人数を確認
    const { data: shiftData } = await supabase
      .from('shifts')
      .select('required, assignments(status)')
      .eq('id', shiftId)
      .single()

    if (shiftData) {
      const confirmedCount = shiftData.assignments?.filter(
        (a: any) => a.status === 'confirmed'
      ).length || 0
      
      console.log(`Shift requires ${shiftData.required}, currently has ${confirmedCount} confirmed`) // DEBUG
      
      if (confirmedCount >= shiftData.required) {
        return NextResponse.json(
          { error: `既に必要人数（${shiftData.required}名）に達しています` },
          { status: 400 }
        )
      }
    }

    // 重複チェック
    const { data: existing } = await supabase
      .from('assignments')
      .select('id')
      .eq('shift_id', shiftId)
      .eq('staff_id', staffId)
      .single()

    if (existing) {
      // 既存のアサインメントを更新
      const { error } = await supabase
        .from('assignments')
        .update({ 
          status: 'confirmed',
          accepted_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      if (error) throw error
    } else {
      // 新規アサインメント作成
      const { error } = await supabase
        .from('assignments')
        .insert({
          shift_id: shiftId,
          staff_id: staffId,
          status: 'confirmed',
          accepted_at: new Date().toISOString()
        })

      if (error) throw error
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Assign error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to assign staff' },
      { status: 500 }
    )
  }
}