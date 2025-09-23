'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, Users, Calendar } from 'lucide-react';

type WorkSchedule = {
  id: string;
  event_id: string;
  start_at: string;
  end_at: string;
  required: number;
  created_at: string;
  name?: string;
};

type Event = {
  id: string;
  event_date: string;
  name?: string;
  open_time?: string;
  start_time?: string;
  end_time?: string;
  venues: { name: string };
  notes: string | null;
};

export default function WorkSchedulesPage() {
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    event_id: '',
    start_time: '',
    end_time: '',
    required: '1'
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [schedulesRes, eventsRes] = await Promise.all([
      supabase
        .from('shifts')  // 既存のshiftsテーブルを使用
        .select(`
          *,
          events!inner(
            event_date,
            name,
            open_time,
            start_time,
            end_time,
            notes,
            venues(name)
          )
        `)
        .order('start_at', { ascending: false }),
      supabase
        .from('events')
        .select('*, venues(name)')
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date')
    ]);

    if (schedulesRes.error) {
      console.error('Error fetching work schedules:', schedulesRes.error);
    } else {
      setWorkSchedules(schedulesRes.data || []);
    }

    if (eventsRes.error) {
      console.error('Error fetching events:', eventsRes.error);
    } else {
      setEvents(eventsRes.data || []);
    }

    setLoading(false);
  };

  // イベントごとに既存の業務枠があるかチェック
  const hasExistingSchedule = (eventId: string) => {
    return workSchedules.some(schedule => schedule.event_id === eventId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedEvent = events.find(e => e.id === formData.event_id);
    if (!selectedEvent) return;

    // 必要人数のバリデーション
    const requiredNum = parseInt(formData.required);
    if (requiredNum < 1 || requiredNum > 4) {
      alert('必要人数は1名以上4名以下で設定してください');
      return;
    }

    // イベントごとに1つの業務枠のみ
    if (!editingId && hasExistingSchedule(formData.event_id)) {
      alert('このイベントには既に業務枠が設定されています');
      return;
    }

    const scheduleData = {
      event_id: formData.event_id,
      start_at: `${selectedEvent.event_date}T${formData.start_time}:00+09:00`,  // JST指定
      end_at: `${selectedEvent.event_date}T${formData.end_time}:00+09:00`,      // JST指定
      required: requiredNum,
      skill_id: 1,  // 暫定的にスキルID1を設定（後で削除予定）
      name: `${selectedEvent.venues?.name} 業務枠`
    };

    if (editingId) {
      const { error } = await supabase
        .from('shifts')
        .update(scheduleData)
        .eq('id', editingId);

      if (error) {
        alert('更新エラー: ' + error.message);
      } else {
        setEditingId(null);
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from('shifts')
        .insert([scheduleData]);

      if (error) {
        alert('追加エラー: ' + error.message);
      } else {
        fetchData();
      }
    }

    setFormData({
      event_id: '',
      start_time: '',
      end_time: '',
      required: '1'
    });
  };

  const handleEdit = (schedule: any) => {
    setEditingId(schedule.id);
    // タイムゾーンを考慮した時刻取得
    const startDate = new Date(schedule.start_at);
    const endDate = new Date(schedule.end_at);

    // ローカル時刻として取得
    const startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    setFormData({
      event_id: schedule.event_id,
      start_time: startTime,
      end_time: endTime,
      required: schedule.required.toString()
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('削除してもよろしいですか？')) return;

    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', id);

    if (error) {
      alert('削除エラー: ' + error.message);
    } else {
      fetchData();
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const hours = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
    const minutes = Math.floor(((endDate.getTime() - startDate.getTime()) % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}時間${minutes > 0 ? `${minutes}分` : ''}`;
  };

  if (loading) return <div className="p-4">読み込み中...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* パンくずリスト */}
      <nav className="flex mb-4 text-sm">
        <a href="/admin" className="text-blue-600 hover:text-blue-800">
          ダッシュボード
        </a>
        <span className="mx-2 text-gray-500">/</span>
        <span className="text-gray-700">業務枠管理</span>
      </nav>

      <h1 className="text-2xl font-bold mb-6">📋 業務枠管理</h1>

      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h2 className="font-semibold text-blue-900 mb-2">業務枠とは</h2>
        <p className="text-sm text-blue-800">
          イベントごとの業務時間枠（スタッフ入場時刻〜バラシ完了時刻）を管理します。
          各イベントに1つの業務枠を設定し、必要人数は1〜4名の範囲で設定できます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              <Calendar className="inline w-4 h-4 mr-1" />
              イベント
            </label>
            <select
              value={formData.event_id}
              onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="">選択してください</option>
              {events.map(event => (
                <option
                  key={event.id}
                  value={event.id}
                  disabled={!editingId && hasExistingSchedule(event.id)}
                >
                  {event.event_date} - {event.venues?.name}
                  {event.name && ` / ${event.name}`}
                  {event.notes && ` (${event.notes})`}
                  {!editingId && hasExistingSchedule(event.id) && ' ✓設定済み'}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              各イベントには1つの業務枠のみ設定可能です
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              <Clock className="inline w-4 h-4 mr-1" />
              入場時刻
            </label>
            <input
              type="time"
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              スタッフ入場時刻
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              <Clock className="inline w-4 h-4 mr-1" />
              業務終了時刻
            </label>
            <input
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              バラシ完了予定時刻
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              <Users className="inline w-4 h-4 mr-1" />
              必要人数
            </label>
            <select
              value={formData.required}
              onChange={(e) => setFormData({ ...formData, required: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="1">1名</option>
              <option value="2">2名</option>
              <option value="3">3名</option>
              <option value="4">4名</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              最小1名、最大4名まで
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            {editingId ? '更新' : '追加'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setFormData({
                  event_id: '',
                  start_time: '',
                  end_time: '',
                  required: '1'
                });
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              キャンセル
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">イベント</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">入場時刻</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">終了時刻</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">業務時間</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">必要人数</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {workSchedules.map((schedule: any) => (
              <tr key={schedule.id}>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium">{schedule.events?.event_date}</div>
                  <div className="text-sm text-gray-500">
                    {schedule.events?.venues?.name}
                    {schedule.events?.name && ` / ${schedule.events.name}`}
                  </div>
                  {schedule.events?.notes && (
                    <div className="text-xs text-gray-400">{schedule.events.notes}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">{formatDateTime(schedule.start_at)}</td>
                <td className="px-4 py-3 text-sm">{formatDateTime(schedule.end_at)}</td>
                <td className="px-4 py-3 text-sm">
                  {calculateDuration(schedule.start_at, schedule.end_at)}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                    {schedule.required}名
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleEdit(schedule)}
                    className="text-blue-600 hover:text-blue-900 mr-2"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}