import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    const supabase = await createClient()

    // Supabase Auth でログイン
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'メールアドレスまたはパスワードが正しくありません' },
        { status: 401 }
      )
    }

    // スタッフ情報を取得
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id, name')
      .eq('user_id', authData.user.id)
      .single()

    if (staffError || !staffData) {
      console.error('Staff record not found for user:', authData.user.id)
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

    const role = roleData?.role || 'staff'

    return NextResponse.json({
      user: {
        id: staffData.id,
        name: staffData.name,
        email: authData.user.email,
        role: role
      },
      role: role
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '入力データが正しくありません' },
        { status: 400 }
      )
    }

    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}