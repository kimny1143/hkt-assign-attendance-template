'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useJSTDate } from '@/hooks/useJSTDate';
import { Calendar, Clock, MapPin, Users, Save, AlertCircle } from 'lucide-react';

// 型定義
interface Venue {
  id: string;
  name: string;
  address?: string;
}

interface EventFormData {
  venue_id: string;
  event_date: string;
  open_time: string;
  start_time: string;
  end_time: string;
  notes: string;
}

interface ShiftFormData {
  id?: string;
  name: string;
  start_time: string;
  end_time: string;
  required: number;
}

interface IntegratedFormData {
  event: EventFormData;
  shifts: ShiftFormData[];
}

// シフトテンプレート
const shiftTemplates = {
  standard: {
    name: '標準イベント',
    shifts: [
      { name: '準備・リハ', offsetStart: -120, duration: 60, required: 2 },
      { name: '本番', offsetStart: -60, duration: 240, required: 3 },
      { name: '撤収', offsetStart: 180, duration: 60, required: 2 }
    ]
  },
  simple: {
    name: 'シンプル',
    shifts: [
      { name: '全日', offsetStart: -60, duration: 300, required: 2 }
    ]
  }
};

export default function EventsIntegratedPage() {
  const [activeTab, setActiveTab] = useState<'basic' | 'shifts' | 'preview'>('basic');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { toSupabaseTimestamp, formatDate, formatTime } = useJSTDate();

  const [formData, setFormData] = useState<IntegratedFormData>({
    event: {
      venue_id: '',
      event_date: '',
      open_time: '18:00',
      start_time: '19:00',
      end_time: '21:00',
      notes: ''
    },
    shifts: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const supabase = createClient();

  useEffect(() => {
    fetchVenues();
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

  // シフトテンプレート適用
  const applyTemplate = (templateKey: keyof typeof shiftTemplates) => {
    const template = shiftTemplates[templateKey];
    const baseTime = formData.event.start_time || '19:00';
    const [baseHour, baseMin] = baseTime.split(':').map(Number);

    const newShifts: ShiftFormData[] = template.shifts.map(shift => {
      const startHour = baseHour + Math.floor(shift.offsetStart / 60);
      const startMin = baseMin + (shift.offsetStart % 60);
      const endHour = startHour + Math.floor(shift.duration / 60);
      const endMin = startMin + (shift.duration % 60);

      return {
        name: shift.name,
        start_time: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
        end_time: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
        required: shift.required
      };
    });

    setFormData(prev => ({ ...prev, shifts: newShifts }));
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
      shifts: [...prev.shifts, newShift]
    }));
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
    if (formData.shifts.length === 0) {
      newErrors.shifts = 'シフトを最低1つ設定してください';
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

  // 保存処理
  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      // イベント作成
      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert([{
          venue_id: formData.event.venue_id,
          event_date: formData.event.event_date,
          open_time: formData.event.open_time,
          start_time: formData.event.start_time,
          end_time: formData.event.end_time,
          notes: formData.event.notes
        }])
        .select()
        .single();

      if (eventError) throw eventError;

      // シフト作成
      const shiftsData = formData.shifts.map(shift => ({
        event_id: newEvent.id,
        name: shift.name || `${formData.event.event_date} シフト`,
        start_at: toSupabaseTimestamp(`${formData.event.event_date}T${shift.start_time}:00`),
        end_at: toSupabaseTimestamp(`${formData.event.event_date}T${shift.end_time}:00`),
        required: shift.required
      }));

      const { error: shiftsError } = await supabase
        .from('shifts')
        .insert(shiftsData);

      if (shiftsError) throw shiftsError;

      alert('イベントとシフトを作成しました');

      // フォームリセット
      setFormData({
        event: {
          venue_id: '',
          event_date: '',
          open_time: '18:00',
          start_time: '19:00',
          end_time: '21:00',
          notes: ''
        },
        shifts: []
      });
      setActiveTab('basic');

    } catch (error) {
      console.error('Save error:', error);
      alert('保存に失敗しました');
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
            disabled={formData.shifts.length === 0}
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
                <h3 className="font-medium mb-3">シフトテンプレート</h3>
                <div className="flex gap-2">
                  {Object.entries(shiftTemplates).map(([key, template]) => (
                    <button
                      key={key}
                      onClick={() => applyTemplate(key as keyof typeof shiftTemplates)}
                      className="px-4 py-2 bg-white border rounded-md hover:bg-gray-50"
                    >
                      {template.name}
                    </button>
                  ))}
                  <button
                    onClick={addShift}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    カスタム追加
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
                            削除
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
                  disabled={formData.shifts.length === 0}
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
                </dl>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold">シフト設定</h3>
                {formData.shifts.map((shift, index) => (
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
                ))}
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