import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
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

    // 権限チェック
    const { data: staffData } = await supabase
      .from('staff')
      .select('user_roles!user_roles_staff_id_fkey(role)')
      .eq('user_id', user.id)
      .single()

    const role = staffData?.user_roles?.[0]?.role
    if (!role || (role !== 'admin' && role !== 'manager')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // アサインメント削除
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Delete error:', error)
      return NextResponse.json(
        { error: 'Failed to delete assignment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}