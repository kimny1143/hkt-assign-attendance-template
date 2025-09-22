'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type Venue = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  capacity: number | null;
  created_at: string;
};

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    lat: '',
    lon: '',
    capacity: ''
  });

  const supabase = createClient();

  useEffect(() => {
    fetchVenues();
  }, []);

  const fetchVenues = async () => {
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching venues:', error);
    } else {
      setVenues(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const venueData = {
      name: formData.name,
      address: formData.address,
      lat: parseFloat(formData.lat),
      lon: parseFloat(formData.lon),
      capacity: formData.capacity ? parseInt(formData.capacity) : null
    };

    if (editingId) {
      const { error } = await supabase
        .from('venues')
        .update(venueData)
        .eq('id', editingId);

      if (error) {
        alert('更新エラー: ' + error.message);
      } else {
        setEditingId(null);
        fetchVenues();
      }
    } else {
      const { error } = await supabase
        .from('venues')
        .insert([venueData]);

      if (error) {
        alert('追加エラー: ' + error.message);
      } else {
        fetchVenues();
      }
    }

    setFormData({ name: '', address: '', lat: '', lon: '', capacity: '' });
  };

  const handleEdit = (venue: Venue) => {
    setEditingId(venue.id);
    setFormData({
      name: venue.name,
      address: venue.address,
      lat: venue.lat.toString(),
      lon: venue.lon.toString(),
      capacity: venue.capacity?.toString() || ''
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('削除してもよろしいですか？')) return;

    const { error } = await supabase
      .from('venues')
      .delete()
      .eq('id', id);

    if (error) {
      alert('削除エラー: ' + error.message);
    } else {
      fetchVenues();
    }
  };

  if (loading) return <div className="p-4">読み込み中...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">会場管理</h1>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">会場名</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">住所</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">緯度</label>
            <input
              type="number"
              step="0.000001"
              value={formData.lat}
              onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">経度</label>
            <input
              type="number"
              step="0.000001"
              value={formData.lon}
              onChange={(e) => setFormData({ ...formData, lon: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">収容人数</label>
            <input
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
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
                setFormData({ name: '', address: '', lat: '', lon: '', capacity: '' });
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">会場名</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">住所</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">緯度/経度</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">収容人数</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {venues.map((venue) => (
              <tr key={venue.id}>
                <td className="px-4 py-3">{venue.name}</td>
                <td className="px-4 py-3 text-sm">{venue.address}</td>
                <td className="px-4 py-3 text-sm">{venue.lat}, {venue.lon}</td>
                <td className="px-4 py-3">{venue.capacity || '-'}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleEdit(venue)}
                    className="text-blue-600 hover:text-blue-900 mr-2"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(venue.id)}
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