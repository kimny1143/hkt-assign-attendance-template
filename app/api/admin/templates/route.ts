import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// テンプレート作成スキーマ
const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.enum(['concert', 'theater', 'corporate', 'wedding', 'festival', 'general']).optional(),
  default_duration_hours: z.number().min(1).max(24).optional(),
  default_setup_time_minutes: z.number().min(0).max(480).optional(),
  default_breakdown_time_minutes: z.number().min(0).max(480).optional(),
  notes: z.string().optional(),
  shift_templates: z.array(z.object({
    name: z.string(),
    offset_start_minutes: z.number(),
    duration_minutes: z.number().min(15).max(720),
    required_staff: z.number().min(1).max(20),
    skill_id: z.number().optional(),
    is_critical: z.boolean().optional(),
    priority: z.number().optional(),
  })).optional(),
});

// テンプレート一覧取得
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const templateId = searchParams.get('id');

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // 特定のテンプレートを取得
    if (templateId) {
      const { data: template, error } = await supabase
        .from('event_templates')
        .select(`
          *,
          shift_templates (
            *,
            skills (
              id,
              name,
              code
            )
          )
        `)
        .eq('id', templateId)
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'テンプレートが見つかりません' },
          { status: 404 }
        );
      }

      return NextResponse.json(template);
    }

    // テンプレート一覧を取得
    let query = supabase
      .from('event_templates')
      .select(`
        *,
        shift_templates (
          id,
          name,
          offset_start_minutes,
          duration_minutes,
          required_staff,
          skill_id,
          is_critical,
          priority,
          skills (
            id,
            name,
            code
          )
        )
      `)
      .order('name');

    if (category) {
      query = query.eq('category', category);
    }

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: templates, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json(templates);

  } catch (error) {
    console.error('Template fetch error:', error);
    return NextResponse.json(
      { error: 'テンプレートの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// テンプレート作成
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

    if (!userRole || userRole.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    // リクエストボディの検証
    const body = await request.json();
    const validatedData = CreateTemplateSchema.parse(body);

    // テンプレート作成
    const { data: template, error: templateError } = await supabase
      .from('event_templates')
      .insert({
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category || 'general',
        default_duration_hours: validatedData.default_duration_hours || 8,
        default_setup_time_minutes: validatedData.default_setup_time_minutes || 120,
        default_breakdown_time_minutes: validatedData.default_breakdown_time_minutes || 90,
        notes: validatedData.notes,
        created_by: user.id,
      })
      .select()
      .single();

    if (templateError) {
      throw templateError;
    }

    // シフトテンプレート作成
    if (validatedData.shift_templates && validatedData.shift_templates.length > 0) {
      const shiftTemplates = validatedData.shift_templates.map((shift) => ({
        event_template_id: template.id,
        name: shift.name,
        offset_start_minutes: shift.offset_start_minutes,
        duration_minutes: shift.duration_minutes,
        required_staff: shift.required_staff,
        skill_id: shift.skill_id,
        is_critical: shift.is_critical || false,
        priority: shift.priority || 0,
      }));

      const { error: shiftError } = await supabase
        .from('shift_templates')
        .insert(shiftTemplates);

      if (shiftError) {
        // ロールバック（テンプレート削除）
        await supabase.from('event_templates').delete().eq('id', template.id);
        throw shiftError;
      }
    }

    // 監査ログ記録
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'TEMPLATE_CREATED',
      table_name: 'event_templates',
      record_id: template.id,
      changes: {
        template_id: template.id,
        shift_count: validatedData.shift_templates?.length || 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: template,
      message: 'テンプレートを作成しました',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'リクエストデータが不正です', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Template creation error:', error);
    return NextResponse.json(
      { error: 'テンプレート作成に失敗しました' },
      { status: 500 }
    );
  }
}

// テンプレート更新
export async function PUT(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json({ error: 'テンプレートIDが必要です' }, { status: 400 });
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

    if (!userRole || userRole.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const body = await request.json();

    // テンプレート更新
    const { error: updateError } = await supabase
      .from('event_templates')
      .update({
        name: body.name,
        description: body.description,
        category: body.category,
        default_duration_hours: body.default_duration_hours,
        default_setup_time_minutes: body.default_setup_time_minutes,
        default_breakdown_time_minutes: body.default_breakdown_time_minutes,
        notes: body.notes,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId);

    if (updateError) {
      throw updateError;
    }

    // シフトテンプレートの更新（完全置き換え）
    if (body.shift_templates !== undefined) {
      // 既存のシフトテンプレートを削除
      await supabase
        .from('shift_templates')
        .delete()
        .eq('event_template_id', templateId);

      // 新しいシフトテンプレートを挿入
      if (body.shift_templates.length > 0) {
        const shiftTemplates = body.shift_templates.map((shift: any) => ({
          event_template_id: templateId,
          name: shift.name,
          offset_start_minutes: shift.offset_start_minutes,
          duration_minutes: shift.duration_minutes,
          required_staff: shift.required_staff,
          skill_id: shift.skill_id,
          is_critical: shift.is_critical || false,
          priority: shift.priority || 0,
        }));

        const { error: shiftError } = await supabase
          .from('shift_templates')
          .insert(shiftTemplates);

        if (shiftError) {
          throw shiftError;
        }
      }
    }

    // 監査ログ記録
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'TEMPLATE_UPDATED',
      table_name: 'event_templates',
      record_id: templateId,
      changes: body,
    });

    return NextResponse.json({
      success: true,
      message: 'テンプレートを更新しました',
    });

  } catch (error) {
    console.error('Template update error:', error);
    return NextResponse.json(
      { error: 'テンプレート更新に失敗しました' },
      { status: 500 }
    );
  }
}

// テンプレート削除
export async function DELETE(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json({ error: 'テンプレートIDが必要です' }, { status: 400 });
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

    if (!userRole || userRole.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    // テンプレートを削除（シフトテンプレートは CASCADE で自動削除）
    const { error: deleteError } = await supabase
      .from('event_templates')
      .delete()
      .eq('id', templateId);

    if (deleteError) {
      throw deleteError;
    }

    // 監査ログ記録
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'TEMPLATE_DELETED',
      table_name: 'event_templates',
      record_id: templateId,
      changes: { deleted_at: new Date().toISOString() },
    });

    return NextResponse.json({
      success: true,
      message: 'テンプレートを削除しました',
    });

  } catch (error) {
    console.error('Template delete error:', error);
    return NextResponse.json(
      { error: 'テンプレート削除に失敗しました' },
      { status: 500 }
    );
  }
}