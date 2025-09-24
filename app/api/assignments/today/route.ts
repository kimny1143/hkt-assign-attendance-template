import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()

    // 認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use the optimized function to get today's assignments
    const { data: assignments, error } = await supabase.rpc('get_user_today_assignments', {
      p_user_id: user.id
    })

    if (error) {
      console.error('Error fetching assignments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform the data to match the expected format
    const formattedAssignments = (assignments || []).map((a: any) => ({
      id: a.assignment_id,
      status: a.assignment_status,
      shifts: {
        id: a.shift_id,
        start_at: a.shift_start_jst,
        end_at: a.shift_end_jst,
        events: {
          id: null, // Not included in the view for simplicity
          name: a.event_name,
          venues: {
            id: null, // Not included in the view for simplicity
            name: a.venue_name,
            address: a.venue_address
          }
        }
      },
      work_status: a.work_status,
      work_hours: a.work_hours
    }))

    return NextResponse.json({ assignments: formattedAssignments })
  } catch (error: any) {
    console.error('Error in /api/assignments/today:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}