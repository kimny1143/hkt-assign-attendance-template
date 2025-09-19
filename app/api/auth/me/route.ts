import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // 現在のユーザーを取得
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    // スタッフ情報を取得
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id, name')
      .eq('user_id', user.id)
      .single()

    if (staffError || !staffData) {
      return NextResponse.json(
        { error: 'ユーザー情報が見つかりません' },
        { status: 404 }
      )
    }

    // ロールを別途取得
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('staff_id', staffData.id)
      .single()

    return NextResponse.json({
      user: {
        id: staffData.id,
        name: staffData.name,
        email: user.email,
        role: roleData?.role || 'staff'
      }
    })

  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}