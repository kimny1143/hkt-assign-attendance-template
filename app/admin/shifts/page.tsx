'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, Calendar, Users, Edit, Trash2 } from 'lucide-react';

type Shift = {
  id: string;
  event_id: string;
  name: string;
  start_ts: string;
  end_ts: string;
  required: number;
  created_at: string;
};

type Event = {
  id: string;
  event_date: string;
  open_time: string;
  start_time: string;
  end_time: string;
  venues: { name: string };
  notes: string | null;
};

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    event_id: '',
    name: '',
    start_time: '',
    end_time: '',
    required: '2'
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [shiftsRes, eventsRes] = await Promise.all([
      supabase
        .from('shifts')
        .select(`
          *,
          events!inner(
            event_date,
            notes,
            venues(name)
          )
        `)
        .order('start_ts', { ascending: false }),
      supabase
        .from('events')
        .select('*, venues(name)')
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date')
    ]);

    if (shiftsRes.error) {
      console.error('Error fetching shifts:', shiftsRes.error);
    } else {
      setShifts(shiftsRes.data || []);
    }

    if (eventsRes.error) {
      console.error('Error fetching events:', eventsRes.error);
    } else {
      setEvents(eventsRes.data || []);
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedEvent = events.find(e => e.id === formData.event_id);
    if (!selectedEvent) return;

    // イベント時間の範囲チェック（スタッフは前後の準備・片付けがあるため）
    if (selectedEvent.open_time && formData.start_time > selectedEvent.open_time) {
      alert(`シフト開始時間はイベント開場時間（${selectedEvent.open_time}）より前に設定してください（準備のため）`);
      return;
    }
    if (selectedEvent.end_time && formData.end_time < selectedEvent.end_time) {
      alert(`シフト終了時間はイベント終了時間（${selectedEvent.end_time}）より後に設定してください（片付けのため）`);
      return;
    }

    const shiftData = {
      event_id: formData.event_id,
      name: formData.name || `${selectedEvent.event_date} シフト`,
      start_ts: `${selectedEvent.event_date}T${formData.start_time}:00`,
      end_ts: `${selectedEvent.event_date}T${formData.end_time}:00`,
      required: parseInt(formData.required)
    };

    if (editingId) {
      const { error } = await supabase
        .from('shifts')
        .update(shiftData)
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
        .insert([shiftData]);

      if (error) {
        alert('追加エラー: ' + error.message);
      } else {
        fetchData();
      }
    }

    setFormData({
      event_id: '',
      name: '',
      start_time: '',
      end_time: '',
      required: '2'
    });
  };

  const handleEdit = (shift: any) => {
    setEditingId(shift.id);
    const startTime = new Date(shift.start_ts).toTimeString().slice(0, 5);
    const endTime = new Date(shift.end_ts).toTimeString().slice(0, 5);

    setFormData({
      event_id: shift.event_id,
      name: shift.name || '',
      start_time: startTime,
      end_time: endTime,
      required: shift.required.toString()
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

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
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
        <span className="text-gray-700">シフト管理</span>
      </nav>

      <h1 className="text-2xl font-bold mb-6">🕐 シフト管理</h1>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">イベント</label>
            <select
              value={formData.event_id}
              onChange={(e) => {
                const selectedEvent = events.find(ev => ev.id === e.target.value);
                if (selectedEvent) {
                  // イベントの時間に基づいてデフォルト値を設定（準備・片付け時間を考慮）
                  const openTime = selectedEvent.open_time || '13:00';
                  const endTime = selectedEvent.end_time || '21:00';

                  // 開場1時間前から開始、終了1時間後まで（時刻の境界を考慮）
                  let defaultStartTime = '12:00';
                  let defaultEndTime = '22:00';

                  if (openTime) {
                    const [openHour, openMin] = openTime.split(':');
                    const startHour = Math.max(0, parseInt(openHour) - 1); // 0時未満にならないように
                    defaultStartTime = `${startHour.toString().padStart(2, '0')}:${openMin}`;
                  }

                  if (endTime) {
                    const [endHour, endMin] = endTime.split(':');
                    const finishHour = Math.min(23, parseInt(endHour) + 1); // 23時を超えないように
                    defaultEndTime = `${finishHour.toString().padStart(2, '0')}:${endMin}`;
                  }

                  setFormData({
                    ...formData,
                    event_id: e.target.value,
                    start_time: defaultStartTime,
                    end_time: defaultEndTime
                  });
                } else {
                  setFormData({ ...formData, event_id: e.target.value });
                }
              }}
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="">選択してください</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.event_date} - {event.venues?.name}
                  {event.open_time && event.end_time && ` (${event.open_time}〜${event.end_time})`}
                  {event.notes ? ` ${event.notes}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">シフト名（任意）</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="例: 昼シフト、夜シフト"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">開始時間</label>
            <input
              type="time"
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
            {formData.event_id && (() => {
              const event = events.find(e => e.id === formData.event_id);
              return event?.open_time ? (
                <p className="text-xs text-gray-500 mt-1">イベント開場: {event.open_time}</p>
              ) : null;
            })()}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">終了時間</label>
            <input
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
            {formData.event_id && (() => {
              const event = events.find(e => e.id === formData.event_id);
              return event?.end_time ? (
                <p className="text-xs text-gray-500 mt-1">イベント終了: {event.end_time}</p>
              ) : null;
            })()}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">必要人数</label>
            <input
              type="number"
              min="1"
              max="4"
              value={formData.required}
              onChange={(e) => setFormData({ ...formData, required: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              ※ アサインされたスタッフのスキルで全4スキル（PA、音源再生、照明、バックヤード）をカバーする必要があります
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            {editingId ? '更新' : 'シフト作成'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setFormData({
                  event_id: '',
                  name: '',
                  start_time: '',
                  end_time: '',
                  required: '2'
                });
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              キャンセル
            </button>
          )}
        </div>
      </form>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">イベント</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">シフト名</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">開始</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">終了</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">必要人数</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {shifts.map((shift: any) => (
              <tr key={shift.id}>
                <td className="px-4 py-3 text-sm">
                  {shift.events?.event_date} {shift.events?.venues?.name}
                  {shift.events?.notes && <span className="text-gray-500"> ({shift.events.notes})</span>}
                </td>
                <td className="px-4 py-3 text-sm">
                  {shift.name || '-'}
                </td>
                <td className="px-4 py-3 text-sm">{formatTime(shift.start_ts)}</td>
                <td className="px-4 py-3 text-sm">{formatTime(shift.end_ts)}</td>
                <td className="px-4 py-3 text-center">{shift.required}人</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleEdit(shift)}
                    className="text-blue-600 hover:text-blue-900 mr-2"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(shift.id)}
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

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {shifts.map((shift: any) => (
          <div key={shift.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h3 className="font-semibold">{shift.events?.event_date}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  {shift.events?.venues?.name}
                  {shift.events?.notes && <span className="text-gray-500"> ({shift.events.notes})</span>}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  {shift.name || 'シフト'}
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">開始:</span> {formatTime(shift.start_ts)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 ml-4">
                    <span className="font-medium">終了:</span> {formatTime(shift.end_ts)}
                  </p>
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-gray-400" />
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">必要人数:</span> {shift.required}人
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(shift)}
                className="flex-1 flex items-center justify-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                <Edit className="w-4 h-4 mr-1" />
                編集
              </button>
              <button
                onClick={() => handleDelete(shift.id)}
                className="flex-1 flex items-center justify-center px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}