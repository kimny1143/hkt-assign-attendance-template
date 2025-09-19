import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    const supabase = await createClient()

    // 1. Auth でログイン試行
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError) {
      return NextResponse.json({
        step: 'auth',
        error: authError.message,
        success: false
      })
    }

    // 2. staff テーブルを確認（シンプルなクエリ）
    const { data: staffByUserId, error: error1 } = await supabase
      .from('staff')
      .select('*')
      .eq('user_id', authData.user!.id)
      .single()

    // 3. emailでも検索
    const { data: staffByEmail, error: error2 } = await supabase
      .from('staff')
      .select('*')
      .eq('email', email)
      .single()
    
    // 4. 全staffレコードを確認（デバッグ用）
    const { data: allStaff, error: error3 } = await supabase
      .from('staff')
      .select('id, email, user_id')
      .limit(10)
    
    // 5. user_rolesを別途確認
    let userRole = null
    if (staffByUserId) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('staff_id', staffByUserId.id)
        .single()
      userRole = roleData
    }

    return NextResponse.json({
      success: true,
      auth_user_id: authData.user!.id,
      auth_email: authData.user!.email,
      staff_by_user_id: staffByUserId,
      staff_by_email: staffByEmail,
      all_staff: allStaff,
      user_role: userRole,
      error1: error1?.message,
      error2: error2?.message,
      error3: error3?.message
    })

  } catch (error) {
    return NextResponse.json({
      step: 'exception',
      error: String(error),
      success: false
    })
  }
}