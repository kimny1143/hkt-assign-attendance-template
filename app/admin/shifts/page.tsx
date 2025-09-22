'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, Calendar, Users, Edit, Trash2 } from 'lucide-react';

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
    start_time: '',
    end_time: '',
    required_lighting: '2',
    required_rigging: '2',
    required_carry: '4',
    required_driver: '1'
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

    // 各スキルのシフトデータを準備
    const shiftsToCreate = skills.map(skill => {
      let required = 1;
      if (skill.code === 'LIGHTING') required = parseInt(formData.required_lighting);
      else if (skill.code === 'RIGGING') required = parseInt(formData.required_rigging);
      else if (skill.code === 'CARRY') required = parseInt(formData.required_carry);
      else if (skill.code === 'DRIVER') required = parseInt(formData.required_driver);

      return {
        event_id: formData.event_id,
        skill_id: skill.id,
        start_ts: `${selectedEvent.event_date}T${formData.start_time}:00`,
        end_ts: `${selectedEvent.event_date}T${formData.end_time}:00`,
        required
      };
    });

    if (editingId) {
      // 編集モードの場合は、同じイベントの全シフトを更新
      alert('シフトの編集は個別に行ってください');
      setEditingId(null);
    } else {
      // 新規作成：4つのスキル全てのシフトを一括作成
      const { error } = await supabase
        .from('shifts')
        .insert(shiftsToCreate);

      if (error) {
        alert('追加エラー: ' + error.message);
      } else {
        alert('全スキルのシフトを作成しました');
        fetchData();
      }
    }

    setFormData({
      event_id: '',
      start_time: '',
      end_time: '',
      required_lighting: '2',
      required_rigging: '2',
      required_carry: '4',
      required_driver: '1'
    });
  };

  const handleEdit = async (shift: any) => {
    // 個別編集用のシンプルな更新処理
    const newRequired = prompt(`必要人数を入力してください (現在: ${shift.required}人):`, shift.required.toString());
    if (newRequired && !isNaN(parseInt(newRequired))) {
      const { error } = await supabase
        .from('shifts')
        .update({ required: parseInt(newRequired) })
        .eq('id', shift.id);

      if (error) {
        alert('更新エラー: ' + error.message);
      } else {
        fetchData();
      }
    }
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
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">必要人数（全スキル分を設定）</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="text-xs text-gray-600">🔦 照明</label>
                <input
                  type="number"
                  min="0"
                  value={formData.required_lighting}
                  onChange={(e) => setFormData({ ...formData, required_lighting: e.target.value })}
                  className="w-full px-2 py-1 border rounded-md text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">🔧 リガー</label>
                <input
                  type="number"
                  min="0"
                  value={formData.required_rigging}
                  onChange={(e) => setFormData({ ...formData, required_rigging: e.target.value })}
                  className="w-full px-2 py-1 border rounded-md text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">📦 搬入出</label>
                <input
                  type="number"
                  min="0"
                  value={formData.required_carry}
                  onChange={(e) => setFormData({ ...formData, required_carry: e.target.value })}
                  className="w-full px-2 py-1 border rounded-md text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">🚗 ドライバー</label>
                <input
                  type="number"
                  min="0"
                  value={formData.required_driver}
                  onChange={(e) => setFormData({ ...formData, required_driver: e.target.value })}
                  className="w-full px-2 py-1 border rounded-md text-sm"
                  required
                />
              </div>
            </div>
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
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            {editingId ? '更新' : '全スキルのシフトを作成'}
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
                  required_lighting: '2',
                  required_rigging: '2',
                  required_carry: '4',
                  required_driver: '1'
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
                <div className="mb-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                    {shift.skills?.label || '-'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">開始:</span> {formatDateTime(shift.start_ts)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 ml-4">
                    <span className="font-medium">終了:</span> {formatDateTime(shift.end_ts)}
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