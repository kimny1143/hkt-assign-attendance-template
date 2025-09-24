import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// リクエストスキーマ定義
const CreateIntegratedEventSchema = z.object({
  event: z.object({
    venue_id: z.string().uuid(),
    event_date: z.string(),
    open_time: z.string(),
    start_time: z.string(),
    end_time: z.string(),
    notes: z.string().optional(),
    template_id: z.string().uuid().optional(),
  }),
  shifts: z.array(z.object({
    name: z.string().optional(),
    start_time: z.string(),
    end_time: z.string(),
    required: z.number().min(1).max(10),
    skill_id: z.number().optional(),
  })).optional(),
  use_template: z.boolean().optional(),
});

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // 管理者権限チェック
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || !['admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ error: '権限が不足しています' }, { status: 403 });
    }

    // リクエストボディの検証
    const body = await request.json();
    const validatedData = CreateIntegratedEventSchema.parse(body);

    // テンプレート使用の場合
    if (validatedData.use_template && validatedData.event.template_id) {
      const { data: result, error: templateError } = await supabase.rpc(
        'create_event_from_template',
        {
          p_template_id: validatedData.event.template_id,
          p_venue_id: validatedData.event.venue_id,
          p_event_date: validatedData.event.event_date,
          p_start_time: validatedData.event.start_time,
          p_event_name: validatedData.event.notes || null,
        }
      );

      if (templateError) {
        console.error('Template creation error:', templateError);
        return NextResponse.json(
          { error: 'テンプレートからのイベント作成に失敗しました', details: templateError.message },
          { status: 500 }
        );
      }

      // 監査ログ記録
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'EVENT_CREATED_FROM_TEMPLATE',
        table_name: 'events',
        record_id: result.event_id,
        changes: {
          event_id: result.event_id,
          shifts_created: result.shifts_created,
          template_used: validatedData.event.template_id,
        },
      });

      return NextResponse.json({
        success: true,
        data: result,
        message: 'テンプレートからイベントを作成しました',
      });
    }

    // 手動でイベントとシフトを作成
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        venue_id: validatedData.event.venue_id,
        event_date: validatedData.event.event_date,
        open_time: validatedData.event.open_time,
        start_time: validatedData.event.start_time,
        end_time: validatedData.event.end_time,
        notes: validatedData.event.notes,
      })
      .select()
      .single();

    if (eventError) {
      console.error('Event creation error:', eventError);
      return NextResponse.json(
        { error: 'イベント作成に失敗しました', details: eventError.message },
        { status: 500 }
      );
    }

    // シフトの作成（提供されている場合）
    let createdShifts = [];
    if (validatedData.shifts && validatedData.shifts.length > 0) {
      const shiftsToCreate = validatedData.shifts.map(shift => ({
        event_id: event.id,
        name: shift.name || '',
        start_at: `${validatedData.event.event_date}T${shift.start_time}:00+09:00`,
        end_at: `${validatedData.event.event_date}T${shift.end_time}:00+09:00`,
        required: shift.required,
        skill_id: shift.skill_id,
      }));

      const { data: shifts, error: shiftsError } = await supabase
        .from('shifts')
        .insert(shiftsToCreate)
        .select();

      if (shiftsError) {
        // ロールバック（イベント削除）
        await supabase.from('events').delete().eq('id', event.id);

        console.error('Shifts creation error:', shiftsError);
        return NextResponse.json(
          { error: 'シフト作成に失敗しました', details: shiftsError.message },
          { status: 500 }
        );
      }

      createdShifts = shifts;
    }

    // 監査ログ記録
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'EVENT_CREATED_WITH_SHIFTS',
      table_name: 'events',
      record_id: event.id,
      changes: {
        event_id: event.id,
        shift_count: createdShifts.length,
        template_used: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        event,
        shifts: createdShifts,
      },
      message: 'イベントとシフトを作成しました',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'リクエストデータが不正です', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// イベント更新エンドポイント
export async function PUT(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');

    if (!eventId) {
      return NextResponse.json({ error: 'イベントIDが必要です' }, { status: 400 });
    }

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // 管理者権限チェック
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || !['admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ error: '権限が不足しています' }, { status: 403 });
    }

    const body = await request.json();

    // イベント更新
    if (body.event) {
      const { error: updateError } = await supabase
        .from('events')
        .update(body.event)
        .eq('id', eventId);

      if (updateError) {
        throw updateError;
      }
    }

    // シフト変更処理
    if (body.shifts) {
      // 新規作成
      if (body.shifts.create && body.shifts.create.length > 0) {
        const shiftsToCreate = body.shifts.create.map((shift: any) => ({
          event_id: eventId,
          ...shift,
        }));

        const { error: createError } = await supabase
          .from('shifts')
          .insert(shiftsToCreate);

        if (createError) {
          throw createError;
        }
      }

      // 更新
      if (body.shifts.update && body.shifts.update.length > 0) {
        for (const shift of body.shifts.update) {
          const { id, ...updateData } = shift;
          const { error: updateError } = await supabase
            .from('shifts')
            .update(updateData)
            .eq('id', id);

          if (updateError) {
            throw updateError;
          }
        }
      }

      // 削除
      if (body.shifts.delete && body.shifts.delete.length > 0) {
        const { error: deleteError } = await supabase
          .from('shifts')
          .delete()
          .in('id', body.shifts.delete);

        if (deleteError) {
          throw deleteError;
        }
      }
    }

    // 監査ログ記録
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'EVENT_UPDATED_WITH_SHIFTS',
      table_name: 'events',
      record_id: eventId,
      changes: body,
    });

    return NextResponse.json({
      success: true,
      message: 'イベントとシフトを更新しました'
    });

  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json(
      { error: 'イベント更新に失敗しました' },
      { status: 500 }
    );
  }
}

// イベントとシフトの取得
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    if (eventId) {
      // 特定のイベントとシフトを取得
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select(`
          *,
          venues (
            id,
            name,
            address,
            location
          ),
          shifts (
            *,
            skills (
              id,
              name,
              code
            ),
            assignments (
              *,
              staff (
                id,
                full_name,
                email
              )
            )
          )
        `)
        .eq('id', eventId)
        .single();

      if (eventError) {
        return NextResponse.json(
          { error: 'イベントが見つかりません' },
          { status: 404 }
        );
      }

      return NextResponse.json(event);
    } else {
      // 全イベントのリスト取得
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          venues (
            id,
            name
          ),
          shifts!inner (
            id
          )
        `)
        .order('event_date', { ascending: false });

      if (eventsError) {
        throw eventsError;
      }

      // シフト数を集計
      const eventsWithShiftCount = events.map(event => ({
        ...event,
        shift_count: event.shifts?.length || 0,
      }));

      return NextResponse.json(eventsWithShiftCount);
    }
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'データ取得に失敗しました' },
      { status: 500 }
    );
  }
}