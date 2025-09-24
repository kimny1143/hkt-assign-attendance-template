# イベント・シフト統合実装ガイド

## 概要

このガイドは、HAASシステムにおけるイベントとシフト管理の統合に関する詳細な実装手順を提供します。コード例、マイグレーションスクリプト、開発者向けのステップバイステップの手順が含まれています。

## 前提条件

- Node.js 18以上
- PostGIS拡張を含むPostgreSQL
- 設定済みのSupabaseプロジェクト
- HAASコードベースへのアクセス

## 目次

1. [データベースマイグレーション](#1-データベースマイグレーション)
2. [API実装](#2-api実装)
3. [サービス層](#3-サービス層)
4. [フロントエンドコンポーネント](#4-フロントエンドコンポーネント)
5. [テスト戦略](#5-テスト戦略)
6. [デプロイメントガイド](#6-デプロイメントガイド)

---

## 1. データベースマイグレーション

### 1.1 テンプレートテーブルの作成

新しいマイグレーションファイルを作成: `supabase/migrations/20250127_event_shift_templates.sql`

```sql
-- ============================================
-- イベント・シフトテンプレートシステムマイグレーション
-- バージョン: 1.0.0
-- 日付: 2025-01-27
-- ============================================

BEGIN;

-- イベントテンプレートテーブルの作成
CREATE TABLE IF NOT EXISTS public.event_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('concert', 'theater', 'corporate', 'custom')),
    default_settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.staff(id)
);

-- シフトテンプレートテーブルの作成
CREATE TABLE IF NOT EXISTS public.shift_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_template_id UUID REFERENCES public.event_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    offset_start_minutes INTEGER NOT NULL, -- イベント開始時刻からの相対分数
    duration_minutes INTEGER NOT NULL,
    required_staff INTEGER DEFAULT 2,
    skill_id INTEGER REFERENCES public.skills(id),
    default_config JSONB DEFAULT '{}', -- ロール固有の設定を格納
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 既存テーブルへのテンプレート参照追加
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.event_templates(id),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

ALTER TABLE public.shifts
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.shift_templates(id),
ADD COLUMN IF NOT EXISTS shift_config JSONB DEFAULT '{}';

-- パフォーマンスのためのインデックス作成
CREATE INDEX IF NOT EXISTS idx_events_template_id ON public.events(template_id);
CREATE INDEX IF NOT EXISTS idx_shifts_template_id ON public.shifts(template_id);
CREATE INDEX IF NOT EXISTS idx_event_templates_active ON public.event_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_shift_templates_event_template ON public.shift_templates(event_template_id);

-- テンプレート用の監査トリガー作成
CREATE TRIGGER update_event_templates_updated_at
    BEFORE UPDATE ON public.event_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_qr_tokens_updated_at();

-- デフォルトテンプレートの挿入
INSERT INTO public.event_templates (name, description, category, default_settings) VALUES
('標準コンサート', 'セットアップ、本番、撤収を含む標準的なコンサート', 'concert',
 '{"default_venue_type": "hall", "typical_duration": 4}'::jsonb),
('シアター公演', '長めのセットアップ時間を持つ演劇公演', 'theater',
 '{"default_venue_type": "theater", "typical_duration": 5}'::jsonb),
('企業イベント', 'AV要件を持つビジネスイベント', 'corporate',
 '{"default_venue_type": "conference", "typical_duration": 3}'::jsonb),
('シンプルイベント', '最小限の構成のイベント', 'custom',
 '{"default_venue_type": "any", "typical_duration": 3}'::jsonb);

-- 標準コンサートのシフトテンプレート挿入
WITH concert_template AS (
    SELECT id FROM public.event_templates WHERE name = '標準コンサート' LIMIT 1
)
INSERT INTO public.shift_templates (event_template_id, name, offset_start_minutes, duration_minutes, required_staff, sort_order)
SELECT
    ct.id,
    template.name,
    template.offset_start_minutes,
    template.duration_minutes,
    template.required_staff,
    template.sort_order
FROM concert_template ct,
(VALUES
    ('セットアップ・リハーサル', -120, 60, 2, 1),
    ('本番サポート', -60, 240, 3, 2),
    ('撤収・片付け', 180, 60, 2, 3)
) AS template(name, offset_start_minutes, duration_minutes, required_staff, sort_order);

-- シアター公演のシフトテンプレート挿入
WITH theater_template AS (
    SELECT id FROM public.event_templates WHERE name = 'シアター公演' LIMIT 1
)
INSERT INTO public.shift_templates (event_template_id, name, offset_start_minutes, duration_minutes, required_staff, sort_order)
SELECT
    tt.id,
    template.name,
    template.offset_start_minutes,
    template.duration_minutes,
    template.required_staff,
    template.sort_order
FROM theater_template tt,
(VALUES
    ('舞台設営', -180, 120, 3, 1),
    ('公演サポート', -60, 180, 2, 2),
    ('片付け', 120, 45, 1, 3)
) AS template(name, offset_start_minutes, duration_minutes, required_staff, sort_order);

-- イベントにテンプレートを適用する関数の作成
CREATE OR REPLACE FUNCTION public.apply_event_template(
    p_event_id UUID,
    p_template_id UUID
) RETURNS SETOF public.shifts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event RECORD;
    v_shift_template RECORD;
    v_start_timestamp TIMESTAMP WITH TIME ZONE;
    v_end_timestamp TIMESTAMP WITH TIME ZONE;
BEGIN
    -- イベント情報の取得
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found: %', p_event_id;
    END IF;

    -- シフトテンプレートのループ処理
    FOR v_shift_template IN
        SELECT *
        FROM public.shift_templates
        WHERE event_template_id = p_template_id
        ORDER BY sort_order
    LOOP
        -- タイムスタンプの計算
        v_start_timestamp := (v_event.event_date + v_event.start_time::time)::timestamp
                           + (v_shift_template.offset_start_minutes || ' minutes')::interval;
        v_end_timestamp := v_start_timestamp + (v_shift_template.duration_minutes || ' minutes')::interval;

        -- シフトの作成
        INSERT INTO public.shifts (
            event_id,
            name,
            start_at,
            end_at,
            required,
            skill_id,
            template_id,
            shift_config
        ) VALUES (
            p_event_id,
            v_shift_template.name,
            v_start_timestamp,
            v_end_timestamp,
            v_shift_template.required_staff,
            v_shift_template.skill_id,
            v_shift_template.id,
            v_shift_template.default_config
        );
    END LOOP;

    -- 作成したシフトを返す
    RETURN QUERY
    SELECT * FROM public.shifts
    WHERE event_id = p_event_id;
END;
$$;

-- RLSポリシーの作成
ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

-- テンプレート閲覧ポリシー（全ユーザー）
CREATE POLICY "Templates are viewable by authenticated users"
    ON public.event_templates FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Shift templates are viewable by authenticated users"
    ON public.shift_templates FOR SELECT
    TO authenticated
    USING (true);

-- テンプレート管理ポリシー（管理者のみ）
CREATE POLICY "Templates are manageable by admins"
    ON public.event_templates FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'manager')
        )
    );

COMMIT;
```

### 1.2 マイグレーションの実行

```bash
# Supabase CLIを使用した場合
supabase db push

# または、Supabaseダッシュボードから直接実行
# SQL Editor > New Query > 上記のSQLを貼り付け > Run
```

---

## 2. API実装

### 2.1 統合イベント作成エンドポイント

`app/api/admin/events/integrated/route.ts`:

```typescript
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
  })),
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

    // トランザクション処理
    const { data: createdEvent, error: txError } = await supabase.rpc(
      'create_event_with_shifts',
      {
        p_event: validatedData.event,
        p_shifts: validatedData.shifts,
      }
    );

    if (txError) {
      console.error('Transaction error:', txError);
      return NextResponse.json(
        { error: 'イベント作成に失敗しました', details: txError.message },
        { status: 500 }
      );
    }

    // 監査ログ記録
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'EVENT_CREATED_WITH_SHIFTS',
      table_name: 'events',
      record_id: createdEvent.event_id,
      changes: {
        event_id: createdEvent.event_id,
        shift_count: createdEvent.shift_count,
        template_used: validatedData.event.template_id || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: createdEvent,
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

    const body = await request.json();

    // トランザクション内でイベントとシフトを更新
    const { data, error } = await supabase.rpc('update_event_with_shifts', {
      p_event_id: eventId,
      p_event_updates: body.event || {},
      p_shift_changes: body.shifts || {},
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json(
      { error: 'イベント更新に失敗しました' },
      { status: 500 }
    );
  }
}
```

### 2.2 テンプレート管理エンドポイント

`app/api/admin/templates/route.ts`:

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// テンプレート一覧取得
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const includeInactive = searchParams.get('includeInactive') === 'true';

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
          skills (
            id,
            name,
            code
          )
        )
      `)
      .order('usage_count', { ascending: false });

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
    const body = await request.json();

    // 権限チェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || userRole.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    // テンプレート作成
    const { data: template, error: templateError } = await supabase
      .from('event_templates')
      .insert({
        name: body.name,
        description: body.description,
        category: body.category || 'custom',
        default_settings: body.default_settings || {},
        created_by: user.id,
      })
      .select()
      .single();

    if (templateError) {
      throw templateError;
    }

    // シフトテンプレート作成
    if (body.shift_templates && body.shift_templates.length > 0) {
      const shiftTemplates = body.shift_templates.map((shift: any, index: number) => ({
        event_template_id: template.id,
        name: shift.name,
        offset_start_minutes: shift.offset_start_minutes,
        duration_minutes: shift.duration_minutes,
        required_staff: shift.required_staff || 2,
        skill_id: shift.skill_id,
        default_config: shift.default_config || {},
        sort_order: index,
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

    return NextResponse.json({
      success: true,
      data: template,
    });

  } catch (error) {
    console.error('Template creation error:', error);
    return NextResponse.json(
      { error: 'テンプレート作成に失敗しました' },
      { status: 500 }
    );
  }
}
```

---

## 3. サービス層

### 3.1 イベント・シフトサービス

`lib/services/event-shift.service.ts`:

```typescript
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export class EventShiftService {
  private supabase;

  constructor() {
    this.supabase = createServerComponentClient({ cookies });
  }

  /**
   * イベントとシフトを同時に作成
   */
  async createWithShifts(data: {
    event: EventData;
    shifts: ShiftData[];
    useTemplate?: string;
  }) {
    try {
      // テンプレート使用の場合
      if (data.useTemplate) {
        const { data: result, error } = await this.supabase.rpc(
          'create_event_from_template',
          {
            p_event_data: data.event,
            p_template_id: data.useTemplate,
          }
        );

        if (error) throw error;
        return result;
      }

      // 手動でシフトを作成
      const { data: result, error } = await this.supabase.rpc(
        'create_event_with_shifts',
        {
          p_event: data.event,
          p_shifts: data.shifts,
        }
      );

      if (error) throw error;
      return result;

    } catch (error) {
      console.error('EventShiftService error:', error);
      throw new Error('イベント作成に失敗しました');
    }
  }

  /**
   * イベント詳細とシフトを取得
   */
  async getEventWithShifts(eventId: string) {
    const { data, error } = await this.supabase
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

    if (error) throw error;
    return data;
  }

  /**
   * シフト要件の検証
   */
  async validateShiftRequirements(eventId: string): Promise<ValidationResult> {
    const { data: shifts, error } = await this.supabase
      .from('shifts')
      .select('*, skills(*)')
      .eq('event_id', eventId);

    if (error) throw error;

    // 4つのスキルすべてがカバーされているか確認
    const requiredSkills = ['PA', 'Sound', 'Lighting', 'Backstage'];
    const coveredSkills = new Set(
      shifts
        .filter(s => s.skills)
        .map(s => s.skills.code)
    );

    const missingSkills = requiredSkills.filter(skill => !coveredSkills.has(skill));

    return {
      isValid: missingSkills.length === 0,
      missingSkills,
      message: missingSkills.length > 0
        ? `次のスキルが不足しています: ${missingSkills.join(', ')}`
        : 'すべてのスキル要件を満たしています',
    };
  }

  /**
   * テンプレートからシフトパターンを生成
   */
  generateShiftsFromTemplate(
    eventDate: string,
    eventTime: string,
    template: EventTemplate
  ): ShiftData[] {
    const baseTime = new Date(`${eventDate}T${eventTime}`);

    return template.shift_templates.map(shift => {
      const startTime = new Date(baseTime.getTime() + shift.offset_start_minutes * 60000);
      const endTime = new Date(startTime.getTime() + shift.duration_minutes * 60000);

      return {
        name: shift.name,
        start_time: startTime.toTimeString().slice(0, 5),
        end_time: endTime.toTimeString().slice(0, 5),
        required: shift.required_staff,
        skill_id: shift.skill_id,
      };
    });
  }
}
```

### 3.2 テンプレートサービス

`lib/services/template.service.ts`:

```typescript
export class TemplateService {
  private supabase;
  private cache = new Map<string, CachedTemplate>();
  private CACHE_TTL = 3600000; // 1時間

  constructor() {
    this.supabase = createServerComponentClient({ cookies });
  }

  /**
   * テンプレートを取得（キャッシュ付き）
   */
  async getTemplate(templateId: string): Promise<EventTemplate> {
    // キャッシュチェック
    if (this.cache.has(templateId)) {
      const cached = this.cache.get(templateId)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    // DBから取得
    const { data, error } = await this.supabase
      .from('event_templates')
      .select(`
        *,
        shift_templates (*)
      `)
      .eq('id', templateId)
      .single();

    if (error) throw error;

    // キャッシュ更新
    this.cache.set(templateId, {
      data,
      timestamp: Date.now(),
    });

    // 使用回数をインクリメント
    await this.incrementUsageCount(templateId);

    return data;
  }

  /**
   * カテゴリ別テンプレート取得
   */
  async getTemplatesByCategory(category: string) {
    const { data, error } = await this.supabase
      .from('event_templates')
      .select(`
        *,
        shift_templates (
          id,
          name,
          offset_start_minutes,
          duration_minutes,
          required_staff
        )
      `)
      .eq('category', category)
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * 使用回数をインクリメント
   */
  private async incrementUsageCount(templateId: string) {
    await this.supabase.rpc('increment_template_usage', {
      p_template_id: templateId,
    });
  }

  /**
   * カスタムテンプレートを作成
   */
  async createCustomTemplate(
    name: string,
    eventId: string,
    userId: string
  ): Promise<string> {
    // 既存イベントからテンプレートを作成
    const { data, error } = await this.supabase.rpc(
      'create_template_from_event',
      {
        p_event_id: eventId,
        p_template_name: name,
        p_created_by: userId,
      }
    );

    if (error) throw error;
    return data;
  }
}
```

---

## 4. フロントエンドコンポーネント

### 4.1 統合イベント作成フォーム

`app/admin/events-integrated/components/EventForm.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, MapPin } from 'lucide-react';

export function EventForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [venues, setVenues] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [eventData, setEventData] = useState({
    venue_id: '',
    event_date: '',
    open_time: '',
    start_time: '',
    end_time: '',
    notes: '',
    template_id: '',
  });

  const [shifts, setShifts] = useState<ShiftData[]>([]);

  // 会場とテンプレート読み込み
  useEffect(() => {
    fetchVenues();
    fetchTemplates();
  }, []);

  const fetchVenues = async () => {
    const response = await fetch('/api/admin/venues');
    const data = await response.json();
    setVenues(data);
  };

  const fetchTemplates = async () => {
    const response = await fetch('/api/admin/templates');
    const data = await response.json();
    setTemplates(data);
  };

  // テンプレート選択時の処理
  const handleTemplateSelect = async (templateId: string) => {
    if (!templateId) {
      setShifts([]);
      return;
    }

    const template = templates.find(t => t.id === templateId);
    if (template && eventData.start_time) {
      // テンプレートからシフトを生成
      const generatedShifts = generateShiftsFromTemplate(
        eventData.event_date,
        eventData.start_time,
        template
      );
      setShifts(generatedShifts);
    }
  };

  // イベント作成送信
  const handleSubmit = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/admin/events/integrated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: eventData,
          shifts: shifts,
        }),
      });

      if (!response.ok) {
        throw new Error('イベント作成に失敗しました');
      }

      const result = await response.json();

      // 成功通知
      alert('イベントが正常に作成されました');
      router.push(`/admin/events/${result.data.event_id}`);

    } catch (error) {
      console.error('Submit error:', error);
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* ステップインジケーター */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">基本情報</div>
          </div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">シフト設定</div>
          </div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">確認</div>
          </div>
        </div>
      </div>

      {/* ステップ1: 基本情報 */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">イベント基本情報</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                会場 <span className="text-red-500">*</span>
              </label>
              <select
                value={eventData.venue_id}
                onChange={(e) => setEventData({...eventData, venue_id: e.target.value})}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                <option value="">選択してください</option>
                {venues.map(venue => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                開催日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={eventData.event_date}
                onChange={(e) => setEventData({...eventData, event_date: e.target.value})}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                開場時間 <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={eventData.open_time}
                onChange={(e) => setEventData({...eventData, open_time: e.target.value})}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                開始時間 <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={eventData.start_time}
                onChange={(e) => setEventData({...eventData, start_time: e.target.value})}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                終了時間 <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={eventData.end_time}
                onChange={(e) => setEventData({...eventData, end_time: e.target.value})}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                テンプレート（オプション）
              </label>
              <select
                value={eventData.template_id}
                onChange={(e) => {
                  setEventData({...eventData, template_id: e.target.value});
                  handleTemplateSelect(e.target.value);
                }}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">テンプレートなし</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} - {template.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              備考
            </label>
            <textarea
              value={eventData.notes}
              onChange={(e) => setEventData({...eventData, notes: e.target.value})}
              className="w-full border rounded-lg px-3 py-2"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
              disabled={!eventData.venue_id || !eventData.event_date}
            >
              次へ: シフト設定
            </button>
          </div>
        </div>
      )}

      {/* ステップ2: シフト設定 */}
      {step === 2 && (
        <ShiftBuilder
          shifts={shifts}
          onShiftsChange={setShifts}
          eventData={eventData}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {/* ステップ3: 確認 */}
      {step === 3 && (
        <EventPreview
          eventData={eventData}
          shifts={shifts}
          venues={venues}
          onBack={() => setStep(2)}
          onSubmit={handleSubmit}
          loading={loading}
        />
      )}
    </div>
  );
}
```

### 4.2 シフトビルダーコンポーネント

`app/admin/events-integrated/components/ShiftBuilder.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Plus, Trash2, Clock } from 'lucide-react';

interface ShiftBuilderProps {
  shifts: ShiftData[];
  onShiftsChange: (shifts: ShiftData[]) => void;
  eventData: EventData;
  onBack: () => void;
  onNext: () => void;
}

export function ShiftBuilder({
  shifts,
  onShiftsChange,
  eventData,
  onBack,
  onNext
}: ShiftBuilderProps) {
  const [skills, setSkills] = useState<Skill[]>([]);

  // シフト追加
  const addShift = () => {
    const newShift: ShiftData = {
      name: '',
      start_time: eventData.open_time || '09:00',
      end_time: eventData.end_time || '18:00',
      required: 2,
      skill_id: null,
    };
    onShiftsChange([...shifts, newShift]);
  };

  // シフト削除
  const removeShift = (index: number) => {
    onShiftsChange(shifts.filter((_, i) => i !== index));
  };

  // シフト更新
  const updateShift = (index: number, updates: Partial<ShiftData>) => {
    const updated = [...shifts];
    updated[index] = { ...updated[index], ...updates };
    onShiftsChange(updated);
  };

  // タイムライン表示用の計算
  const calculateTimelinePosition = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const dayStart = 6 * 60; // 6:00 AM
    const dayEnd = 24 * 60; // Midnight
    const position = ((totalMinutes - dayStart) / (dayEnd - dayStart)) * 100;
    return Math.max(0, Math.min(100, position));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">シフト設定</h2>

      {/* タイムラインビュー */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">タイムライン</h3>
        <div className="relative h-20 bg-white rounded border">
          {/* 時間軸 */}
          <div className="absolute top-0 left-0 w-full h-4 border-b flex">
            {[6, 9, 12, 15, 18, 21, 24].map(hour => (
              <div key={hour} className="flex-1 text-xs text-gray-500 text-center">
                {hour}:00
              </div>
            ))}
          </div>

          {/* シフトバー */}
          <div className="absolute top-6 left-0 w-full h-12">
            {shifts.map((shift, index) => {
              const start = calculateTimelinePosition(shift.start_time);
              const end = calculateTimelinePosition(shift.end_time);
              const width = end - start;

              return (
                <div
                  key={index}
                  className="absolute h-8 bg-blue-400 rounded text-white text-xs px-1 overflow-hidden"
                  style={{
                    left: `${start}%`,
                    width: `${width}%`,
                    top: `${(index % 2) * 20}px`,
                  }}
                  title={shift.name || `シフト${index + 1}`}
                >
                  {shift.name || `シフト${index + 1}`}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* シフトリスト */}
      <div className="space-y-4">
        {shifts.map((shift, index) => (
          <div key={index} className="border rounded-lg p-4">
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  シフト名
                </label>
                <input
                  type="text"
                  value={shift.name}
                  onChange={(e) => updateShift(index, { name: e.target.value })}
                  className="w-full border rounded px-2 py-1"
                  placeholder="例: セットアップ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  開始時間
                </label>
                <input
                  type="time"
                  value={shift.start_time}
                  onChange={(e) => updateShift(index, { start_time: e.target.value })}
                  className="w-full border rounded px-2 py-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  終了時間
                </label>
                <input
                  type="time"
                  value={shift.end_time}
                  onChange={(e) => updateShift(index, { end_time: e.target.value })}
                  className="w-full border rounded px-2 py-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  必要人数
                </label>
                <input
                  type="number"
                  value={shift.required}
                  onChange={(e) => updateShift(index, { required: parseInt(e.target.value) })}
                  className="w-full border rounded px-2 py-1"
                  min="1"
                  max="10"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => removeShift(index)}
                  className="bg-red-500 text-white p-2 rounded hover:bg-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* シフト追加ボタン */}
      <button
        onClick={addShift}
        className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
      >
        <Plus className="w-4 h-4" />
        シフトを追加
      </button>

      {/* ナビゲーションボタン */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
        >
          戻る
        </button>
        <button
          onClick={onNext}
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
          disabled={shifts.length === 0}
        >
          次へ: 確認
        </button>
      </div>
    </div>
  );
}
```

---

## 5. テスト戦略

### 5.1 ユニットテスト

`__tests__/services/event-shift.service.test.ts`:

```typescript
import { EventShiftService } from '@/lib/services/event-shift.service';

describe('EventShiftService', () => {
  let service: EventShiftService;

  beforeEach(() => {
    service = new EventShiftService();
  });

  describe('createWithShifts', () => {
    it('イベントとシフトを正常に作成する', async () => {
      const eventData = {
        venue_id: 'test-venue-id',
        event_date: '2025-02-01',
        open_time: '18:00',
        start_time: '19:00',
        end_time: '21:00',
      };

      const shifts = [
        {
          name: 'セットアップ',
          start_time: '17:00',
          end_time: '18:30',
          required: 2,
        },
      ];

      const result = await service.createWithShifts({
        event: eventData,
        shifts,
      });

      expect(result).toBeDefined();
      expect(result.event_id).toBeDefined();
      expect(result.shift_count).toBe(1);
    });

    it('テンプレートからイベントを作成する', async () => {
      const result = await service.createWithShifts({
        event: {
          venue_id: 'test-venue-id',
          event_date: '2025-02-01',
          open_time: '18:00',
          start_time: '19:00',
          end_time: '21:00',
        },
        shifts: [],
        useTemplate: 'template-id',
      });

      expect(result).toBeDefined();
      expect(result.shift_count).toBeGreaterThan(0);
    });
  });

  describe('validateShiftRequirements', () => {
    it('すべてのスキルがカバーされている場合、検証が成功する', async () => {
      const result = await service.validateShiftRequirements('event-id');

      expect(result.isValid).toBe(true);
      expect(result.missingSkills).toHaveLength(0);
    });

    it('スキルが不足している場合、検証が失敗する', async () => {
      const result = await service.validateShiftRequirements('event-id-incomplete');

      expect(result.isValid).toBe(false);
      expect(result.missingSkills).toContain('Lighting');
    });
  });
});
```

### 5.2 統合テスト

`__tests__/api/events-integrated.test.ts`:

```typescript
import { createMocks } from 'node-mocks-http';
import { POST } from '@/app/api/admin/events/integrated/route';

describe('POST /api/admin/events/integrated', () => {
  it('正しいデータでイベントを作成できる', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        event: {
          venue_id: 'venue-123',
          event_date: '2025-02-01',
          open_time: '18:00',
          start_time: '19:00',
          end_time: '21:00',
        },
        shifts: [
          {
            name: 'メインシフト',
            start_time: '18:30',
            end_time: '21:30',
            required: 3,
          },
        ],
      },
    });

    await POST(req);

    expect(res._getStatusCode()).toBe(200);
    const jsonData = JSON.parse(res._getData());
    expect(jsonData.success).toBe(true);
    expect(jsonData.data.event_id).toBeDefined();
  });

  it('不正なデータの場合、400エラーを返す', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        event: {
          // venue_idが欠けている
          event_date: '2025-02-01',
        },
        shifts: [],
      },
    });

    await POST(req);

    expect(res._getStatusCode()).toBe(400);
    const jsonData = JSON.parse(res._getData());
    expect(jsonData.error).toBeDefined();
  });
});
```

---

## 6. デプロイメントガイド

### 6.1 環境変数設定

`.env.production`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App Settings
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

### 6.2 デプロイメントステップ

```bash
# 1. 依存関係のインストール
npm ci --production

# 2. ビルド
npm run build

# 3. マイグレーション実行
supabase db push --db-url $DATABASE_URL

# 4. 環境変数設定（Vercel/Netlify等）
# ダッシュボードから設定

# 5. デプロイ
npm run deploy
```

### 6.3 ヘルスチェック

`app/api/health/route.ts`:

```typescript
export async function GET() {
  try {
    // DBコネクションチェック
    const supabase = createRouteHandlerClient({ cookies });
    const { error } = await supabase.from('events').select('id').limit(1);

    if (error) throw error;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
```

### 6.4 監視設定

```yaml
# monitoring-config.yaml
checks:
  - name: API Health
    url: https://your-domain.com/api/health
    interval: 60s
    timeout: 10s

  - name: Database Connection
    type: postgres
    connection: $DATABASE_URL
    query: SELECT 1

alerts:
  - type: slack
    webhook: $SLACK_WEBHOOK_URL
    conditions:
      - status != 200
      - response_time > 5000ms
```

---

## まとめ

このガイドでは、イベント・シフト統合機能の完全な実装方法を説明しました。主なポイント：

1. **データベース設計**: テンプレートシステムを含む拡張可能なスキーマ
2. **API実装**: トランザクション処理による整合性の保証
3. **サービス層**: ビジネスロジックの適切な分離
4. **UI/UX**: ウィザード形式の直感的なインターフェース
5. **テスト**: 包括的なテストカバレッジ
6. **デプロイ**: 本番環境への安全なデプロイプロセス

追加のサポートが必要な場合は、プロジェクトのドキュメントを参照するか、チームにお問い合わせください。