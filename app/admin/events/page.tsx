'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Calendar, Clock, MapPin, Edit, Trash2 } from 'lucide-react';

type Event = {
  id: string;
  venue_id: string;
  event_date: string;
  open_time: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  created_at: string;
};

type Venue = {
  id: string;
  name: string;
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    venue_id: '',
    event_date: '',
    open_time: '',
    start_time: '',
    end_time: '',
    notes: ''
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [eventsRes, venuesRes] = await Promise.all([
      supabase
        .from('events')
        .select('*, venues(name)')
        .order('event_date', { ascending: false }),
      supabase
        .from('venues')
        .select('id, name')
        .order('name')
    ]);

    if (eventsRes.error) {
      console.error('Error fetching events:', eventsRes.error);
    } else {
      setEvents(eventsRes.data || []);
    }

    if (venuesRes.error) {
      console.error('Error fetching venues:', venuesRes.error);
    } else {
      setVenues(venuesRes.data || []);
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const eventData = {
      venue_id: formData.venue_id,
      event_date: formData.event_date,
      open_time: formData.open_time,
      start_time: formData.start_time,
      end_time: formData.end_time,
      notes: formData.notes || null
    };

    if (editingId) {
      const { error } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', editingId);

      if (error) {
        alert('更新エラー: ' + error.message);
      } else {
        setEditingId(null);
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from('events')
        .insert([eventData]);

      if (error) {
        alert('追加エラー: ' + error.message);
      } else {
        fetchData();
      }
    }

    setFormData({
      venue_id: '',
      event_date: '',
      open_time: '',
      start_time: '',
      end_time: '',
      notes: ''
    });
  };

  const handleEdit = (event: Event) => {
    setEditingId(event.id);
    setFormData({
      venue_id: event.venue_id,
      event_date: event.event_date,
      open_time: event.open_time,
      start_time: event.start_time,
      end_time: event.end_time,
      notes: event.notes || ''
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('削除してもよろしいですか？関連するシフトも削除されます。')) return;

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      alert('削除エラー: ' + error.message);
    } else {
      fetchData();
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
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
        <span className="text-gray-700">イベント管理</span>
      </nav>

      <h1 className="text-2xl font-bold mb-6">📅 イベント管理</h1>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">会場</label>
            <select
              value={formData.venue_id}
              onChange={(e) => setFormData({ ...formData, venue_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="">選択してください</option>
              {venues.map(venue => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">開催日</label>
            <input
              type="date"
              value={formData.event_date}
              onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">開場時間</label>
            <input
              type="time"
              value={formData.open_time}
              onChange={(e) => setFormData({ ...formData, open_time: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">開演時間</label>
            <input
              type="time"
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">終演時間</label>
            <input
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">備考</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="イベント名など"
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
                  venue_id: '',
                  event_date: '',
                  open_time: '',
                  start_time: '',
                  end_time: '',
                  notes: ''
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">開催日</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">会場</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">備考</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {events.map((event: any) => (
              <tr key={event.id}>
                <td className="px-4 py-3 font-medium">{formatDate(event.event_date)}</td>
                <td className="px-4 py-3">{event.venues?.name || '-'}</td>
                <td className="px-4 py-3 text-sm">
                  開場 {event.open_time || '-'} / 開演 {event.start_time || '-'} / 終演 {event.end_time || '-'}
                </td>
                <td className="px-4 py-3 text-sm">{event.notes || '-'}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleEdit(event)}
                    className="text-blue-600 hover:text-blue-900 mr-2"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(event.id)}
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
        {events.map((event: any) => (
          <div key={event.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h3 className="font-semibold text-lg">{formatDate(event.event_date)}</h3>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <p className="text-sm text-gray-600">{event.venues?.name || '会場未設定'}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">開場:</span> {event.open_time || '-'}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 ml-4">
                    <span className="font-medium">開演:</span> {event.start_time || '-'} | <span className="font-medium">終演:</span> {event.end_time || '-'}
                  </p>
                  {event.notes && (
                    <p className="text-xs text-gray-500 ml-4">
                      <span className="font-medium">備考:</span> {event.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(event)}
                className="flex-1 flex items-center justify-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                <Edit className="w-4 h-4 mr-1" />
                編集
              </button>
              <button
                onClick={() => handleDelete(event.id)}
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