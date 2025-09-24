'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useJSTDate } from '@/hooks/useJSTDate';
import { Calendar, Clock, MapPin, Users, Save, AlertCircle, FileText, Plus, Trash2 } from 'lucide-react';

// 型定義
interface Venue {
  id: string;
  name: string;
  address?: string;
}

interface EventTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  default_duration_hours: number;
  shift_templates: ShiftTemplate[];
}

interface ShiftTemplate {
  id: string;
  name: string;
  offset_start_minutes: number;
  duration_minutes: number;
  required_staff: number;
  skill_id?: number;
  is_critical: boolean;
  priority: number;
  skills?: {
    id: number;
    name: string;
    code: string;
  };
}

interface EventFormData {
  venue_id: string;
  event_date: string;
  open_time: string;
  start_time: string;
  end_time: string;
  notes: string;
  template_id?: string;
}

interface ShiftFormData {
  id?: string;
  name: string;
  start_time: string;
  end_time: string;
  required: number;
  skill_id?: number;
}

interface IntegratedFormData {
  event: EventFormData;
  shifts: ShiftFormData[];
  use_template: boolean;
}

export default function EventsIntegratedPage() {
  const [activeTab, setActiveTab] = useState<'basic' | 'shifts' | 'preview'>('basic');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EventTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { toSupabaseTimestamp, formatDate, formatTime } = useJSTDate();

  const [formData, setFormData] = useState<IntegratedFormData>({
    event: {
      venue_id: '',
      event_date: '',
      open_time: '18:00',
      start_time: '19:00',
      end_time: '21:00',
      notes: '',
      template_id: ''
    },
    shifts: [],
    use_template: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const supabase = createClient();

  useEffect(() => {
    fetchVenues();
    fetchTemplates();
  }, []);

  const fetchVenues = async () => {
    const { data } = await supabase
      .from('venues')
      .select('*')
      .order('name');

    if (data) {
      setVenues(data);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/admin/templates');
      const data = await response.json();
      if (Array.isArray(data)) {
        setTemplates(data);
      }
    } catch (error) {
      console.error('テンプレート取得エラー:', error);
    }
  };

  // テンプレート適用
  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    setSelectedTemplate(template);
    setFormData(prev => ({
      ...prev,
      event: { ...prev.event, template_id: templateId },
      use_template: true
    }));

    // テンプレートからシフトを生成
    if (formData.event.event_date && formData.event.start_time) {
      const baseTime = new Date(`${formData.event.event_date}T${formData.event.start_time}:00`);

      const newShifts: ShiftFormData[] = template.shift_templates.map(shift => {
        const startTime = new Date(baseTime.getTime() + shift.offset_start_minutes * 60000);
        const endTime = new Date(startTime.getTime() + shift.duration_minutes * 60000);

        return {
          name: shift.name,
          start_time: `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`,
          end_time: `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`,
          required: shift.required_staff,
          skill_id: shift.skill_id
        };
      });

      setFormData(prev => ({ ...prev, shifts: newShifts }));
    } else {
      alert('イベント日と開始時間を設定してからテンプレートを選択してください');
    }
  };

  // シフト追加
  const addShift = () => {
    const newShift: ShiftFormData = {
      name: '',
      start_time: '17:00',
      end_time: '22:00',
      required: 2
    };

    setFormData(prev => ({
      ...prev,
      shifts: [...prev.shifts, newShift],
      use_template: false
    }));
    setSelectedTemplate(null);
  };

  // シフト削除
  const removeShift = (index: number) => {
    setFormData(prev => ({
      ...prev,
      shifts: prev.shifts.filter((_, i) => i !== index)
    }));
  };

  // シフト更新
  const updateShift = (index: number, field: keyof ShiftFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      shifts: prev.shifts.map((shift, i) =>
        i === index ? { ...shift, [field]: value } : shift
      )
    }));
  };

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.event.venue_id) {
      newErrors.venue = '会場を選択してください';
    }
    if (!formData.event.event_date) {
      newErrors.date = 'イベント日を選択してください';
    }
    if (formData.shifts.length === 0 && !formData.use_template) {
      newErrors.shifts = 'シフトを最低1つ設定するか、テンプレートを選択してください';
    }

    // 時間の整合性チェック
    formData.shifts.forEach((shift, index) => {
      if (shift.start_time >= shift.end_time) {
        newErrors[`shift_${index}`] = '終了時刻は開始時刻より後にしてください';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 保存処理（新しいAPIを使用）
  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const requestBody = {
        event: formData.event,
        shifts: formData.use_template ? undefined : formData.shifts,
        use_template: formData.use_template
      };
      console.log('Sending request body:', requestBody);

      const response = await fetch('/api/admin/events/integrated', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '保存に失敗しました');
      }

      alert(result.message || 'イベントとシフトを作成しました');

      // フォームリセット
      setFormData({
        event: {
          venue_id: '',
          event_date: '',
          open_time: '18:00',
          start_time: '19:00',
          end_time: '21:00',
          notes: '',
          template_id: ''
        },
        shifts: [],
        use_template: false
      });
      setSelectedTemplate(null);
      setActiveTab('basic');

    } catch (error: any) {
      console.error('Save error:', error);
      alert(error.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* パンくずリスト */}
      <nav className="flex mb-4 text-sm">
        <a href="/admin" className="text-blue-600 hover:text-blue-800">
          ダッシュボード
        </a>
        <span className="mx-2 text-gray-500">/</span>
        <span className="text-gray-700">イベント・シフト統合管理</span>
      </nav>

      <h1 className="text-2xl font-bold mb-6">📅 イベント・シフト統合管理</h1>

      {/* タブナビゲーション */}
      <div className="bg-white rounded-lg shadow-lg">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'basic'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            1. 基本情報
          </button>
          <button
            onClick={() => setActiveTab('shifts')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'shifts'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            disabled={!formData.event.event_date}
          >
            2. シフト設定
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'preview'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            disabled={formData.shifts.length === 0 && !formData.use_template}
          >
            3. 確認・保存
          </button>
        </div>

        <div className="p-6">
          {/* 基本情報タブ */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <MapPin className="inline w-4 h-4 mr-1" />
                    会場
                  </label>
                  <select
                    value={formData.event.venue_id}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      event: { ...prev.event, venue_id: e.target.value }
                    }))}
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.venue ? 'border-red-500' : ''
                    }`}
                    required
                  >
                    <option value="">選択してください</option>
                    {venues.map(venue => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name}
                      </option>
                    ))}
                  </select>
                  {errors.venue && (
                    <p className="text-red-500 text-xs mt-1">{errors.venue}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    イベント日
                  </label>
                  <input
                    type="date"
                    value={formData.event.event_date}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      event: { ...prev.event, event_date: e.target.value }
                    }))}
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.date ? 'border-red-500' : ''
                    }`}
                    required
                  />
                  {errors.date && (
                    <p className="text-red-500 text-xs mt-1">{errors.date}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Clock className="inline w-4 h-4 mr-1" />
                    開場時間
                  </label>
                  <input
                    type="time"
                    value={formData.event.open_time}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      event: { ...prev.event, open_time: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Clock className="inline w-4 h-4 mr-1" />
                    開演時間
                  </label>
                  <input
                    type="time"
                    value={formData.event.start_time}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      event: { ...prev.event, start_time: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Clock className="inline w-4 h-4 mr-1" />
                    終演時間
                  </label>
                  <input
                    type="time"
                    value={formData.event.end_time}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      event: { ...prev.event, end_time: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    備考
                  </label>
                  <input
                    type="text"
                    value={formData.event.notes}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      event: { ...prev.event, notes: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="例: 特別公演"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setActiveTab('shifts')}
                  disabled={!formData.event.venue_id || !formData.event.event_date}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  次へ：シフト設定
                </button>
              </div>
            </div>
          )}

          {/* シフト設定タブ */}
          {activeTab === 'shifts' && (
            <div className="space-y-6">
              {/* テンプレート選択 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-3">
                  <FileText className="inline w-4 h-4 mr-1" />
                  テンプレートから選択
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {templates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template.id)}
                      className={`p-3 text-left border rounded-lg hover:bg-white transition ${
                        formData.event.template_id === template.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      <div className="font-medium">{template.name}</div>
                      {template.description && (
                        <div className="text-sm text-gray-600 mt-1">{template.description}</div>
                      )}
                      <div className="text-xs text-gray-500 mt-2">
                        シフト数: {template.shift_templates.length}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex justify-center">
                  <button
                    onClick={addShift}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    カスタムシフトを追加
                  </button>
                </div>
              </div>

              {/* シフトリスト */}
              {errors.shifts && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  {errors.shifts}
                </div>
              )}

              {selectedTemplate && (
                <div className="bg-blue-50 border border-blue-300 p-3 rounded-md">
                  <p className="text-sm text-blue-800">
                    テンプレート「{selectedTemplate.name}」を適用中
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {formData.shifts.map((shift, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">シフト名</label>
                        <input
                          type="text"
                          value={shift.name}
                          onChange={(e) => updateShift(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                          placeholder="例: 準備"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">開始時刻</label>
                        <input
                          type="time"
                          value={shift.start_time}
                          onChange={(e) => updateShift(index, 'start_time', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md ${
                            errors[`shift_${index}`] ? 'border-red-500' : ''
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">終了時刻</label>
                        <input
                          type="time"
                          value={shift.end_time}
                          onChange={(e) => updateShift(index, 'end_time', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md ${
                            errors[`shift_${index}`] ? 'border-red-500' : ''
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">必要人数</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={shift.required}
                            onChange={(e) => updateShift(index, 'required', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                          <button
                            onClick={() => removeShift(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {errors[`shift_${index}`] && (
                      <p className="text-red-500 text-xs mt-1">{errors[`shift_${index}`]}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setActiveTab('basic')}
                  className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  戻る
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  disabled={formData.shifts.length === 0 && !formData.use_template}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  次へ：確認
                </button>
              </div>
            </div>
          )}

          {/* 確認・保存タブ */}
          {activeTab === 'preview' && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-bold mb-4">イベント情報</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-600">会場</dt>
                    <dd className="font-medium">
                      {venues.find(v => v.id === formData.event.venue_id)?.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-600">日付</dt>
                    <dd className="font-medium">{formData.event.event_date}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-600">時間</dt>
                    <dd className="font-medium">
                      {formData.event.open_time} 開場 / {formData.event.start_time} 開演 / {formData.event.end_time} 終演
                    </dd>
                  </div>
                  {formData.event.notes && (
                    <div>
                      <dt className="text-sm text-gray-600">備考</dt>
                      <dd className="font-medium">{formData.event.notes}</dd>
                    </div>
                  )}
                  {selectedTemplate && (
                    <div>
                      <dt className="text-sm text-gray-600">使用テンプレート</dt>
                      <dd className="font-medium">{selectedTemplate.name}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold">シフト設定</h3>
                {formData.use_template && selectedTemplate ? (
                  <div className="bg-blue-50 border border-blue-300 p-4 rounded-lg">
                    <p className="text-sm text-blue-800 mb-3">
                      テンプレート「{selectedTemplate.name}」から自動生成されます
                    </p>
                    {formData.shifts.map((shift, index) => (
                      <div key={index} className="bg-white border p-4 rounded-lg mb-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{shift.name || `シフト ${index + 1}`}</p>
                            <p className="text-sm text-gray-600">
                              {shift.start_time} - {shift.end_time}
                            </p>
                          </div>
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-1 text-gray-500" />
                            <span className="font-medium">{shift.required}名</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  formData.shifts.map((shift, index) => (
                    <div key={index} className="bg-white border p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{shift.name || `シフト ${index + 1}`}</p>
                          <p className="text-sm text-gray-600">
                            {shift.start_time} - {shift.end_time}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-1 text-gray-500" />
                          <span className="font-medium">{shift.required}名</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div className="text-sm text-gray-600 mt-2">
                  合計必要人数: {formData.shifts.reduce((sum, s) => sum + s.required, 0)}名
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t">
                <button
                  onClick={() => setActiveTab('shifts')}
                  className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  戻る
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {saving ? (
                    <>処理中...</>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      保存して公開
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}