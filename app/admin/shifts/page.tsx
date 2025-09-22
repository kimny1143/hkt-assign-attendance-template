'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type Shift = {
  id: string;
  event_id: string;
  skill_id: string;
  start_ts: string;
  end_ts: string;
  required: number;
  created_at: string;
};

type Event = {
  id: string;
  event_date: string;
  venues: { name: string };
  notes: string | null;
};

type Skill = {
  id: string;
  code: string;
  label: string;
};

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    event_id: '',
    skill_id: '',
    start_time: '',
    end_time: '',
    required: '1'
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [shiftsRes, eventsRes, skillsRes] = await Promise.all([
      supabase
        .from('shifts')
        .select(`
          *,
          events!inner(
            event_date,
            notes,
            venues(name)
          ),
          skills(code, label)
        `)
        .order('start_ts', { ascending: false }),
      supabase
        .from('events')
        .select('*, venues(name)')
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date'),
      supabase
        .from('skills')
        .select('*')
        .order('code')
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

    if (skillsRes.error) {
      console.error('Error fetching skills:', skillsRes.error);
    } else {
      setSkills(skillsRes.data || []);
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedEvent = events.find(e => e.id === formData.event_id);
    if (!selectedEvent) return;

    const shiftData = {
      event_id: formData.event_id,
      skill_id: formData.skill_id,
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
      skill_id: '',
      start_time: '',
      end_time: '',
      required: '1'
    });
  };

  const handleEdit = (shift: any) => {
    setEditingId(shift.id);
    const startTime = new Date(shift.start_ts).toTimeString().slice(0, 5);
    const endTime = new Date(shift.end_ts).toTimeString().slice(0, 5);

    setFormData({
      event_id: shift.event_id,
      skill_id: shift.skill_id,
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

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
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
              onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="">選択してください</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.event_date} - {event.venues?.name} {event.notes ? `(${event.notes})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">スキル</label>
            <select
              value={formData.skill_id}
              onChange={(e) => setFormData({ ...formData, skill_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="">選択してください</option>
              {skills.map(skill => (
                <option key={skill.id} value={skill.id}>
                  {skill.label} ({skill.code})
                </option>
              ))}
            </select>
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
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">必要人数</label>
            <input
              type="number"
              min="1"
              value={formData.required}
              onChange={(e) => setFormData({ ...formData, required: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
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
                  skill_id: '',
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">スキル</th>
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
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                    {shift.skills?.label || '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{formatDateTime(shift.start_ts)}</td>
                <td className="px-4 py-3 text-sm">{formatDateTime(shift.end_ts)}</td>
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
    </div>
  );
}