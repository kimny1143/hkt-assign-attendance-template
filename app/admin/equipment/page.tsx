'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type Equipment = {
  id: string;
  venue_id: string;
  name: string;
  qr_code: string;
  equipment_type: string;
  location_hint: string | null;
  active: boolean;
  created_at: string;
};

type Venue = {
  id: string;
  name: string;
};

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    venue_id: '',
    name: '',
    qr_code: '',
    equipment_type: 'lighting',
    location_hint: '',
    active: true
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [equipmentRes, venuesRes] = await Promise.all([
      supabase
        .from('equipment')
        .select('*, venues(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('venues')
        .select('id, name')
        .order('name')
    ]);

    if (equipmentRes.error) {
      console.error('Error fetching equipment:', equipmentRes.error);
    } else {
      setEquipment(equipmentRes.data || []);
    }

    if (venuesRes.error) {
      console.error('Error fetching venues:', venuesRes.error);
    } else {
      setVenues(venuesRes.data || []);
    }

    setLoading(false);
  };

  const generateQRCode = () => {
    const venue = venues.find(v => v.id === formData.venue_id);
    if (venue) {
      const prefix = venue.name.replace(/[^A-Z]/g, '').substring(0, 6).toUpperCase();
      const type = formData.equipment_type.toUpperCase();
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      setFormData({ ...formData, qr_code: `${prefix}-${type}-${random}` });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const equipmentData = {
      venue_id: formData.venue_id,
      name: formData.name,
      qr_code: formData.qr_code,
      equipment_type: formData.equipment_type,
      location_hint: formData.location_hint || null,
      active: formData.active
    };

    if (editingId) {
      const { error } = await supabase
        .from('equipment')
        .update(equipmentData)
        .eq('id', editingId);

      if (error) {
        alert('更新エラー: ' + error.message);
      } else {
        setEditingId(null);
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from('equipment')
        .insert([equipmentData]);

      if (error) {
        alert('追加エラー: ' + error.message);
      } else {
        fetchData();
      }
    }

    setFormData({
      venue_id: '',
      name: '',
      qr_code: '',
      equipment_type: 'lighting',
      location_hint: '',
      active: true
    });
  };

  const handleEdit = (item: Equipment) => {
    setEditingId(item.id);
    setFormData({
      venue_id: item.venue_id,
      name: item.name,
      qr_code: item.qr_code,
      equipment_type: item.equipment_type,
      location_hint: item.location_hint || '',
      active: item.active
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('削除してもよろしいですか？')) return;

    const { error } = await supabase
      .from('equipment')
      .delete()
      .eq('id', id);

    if (error) {
      alert('削除エラー: ' + error.message);
    } else {
      fetchData();
    }
  };

  if (loading) return <div className="p-4">読み込み中...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">機材管理</h1>

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
            <label className="block text-sm font-medium mb-1">機材名</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">QRコード</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.qr_code}
                onChange={(e) => setFormData({ ...formData, qr_code: e.target.value })}
                className="flex-1 px-3 py-2 border rounded-md"
                required
              />
              <button
                type="button"
                onClick={generateQRCode}
                className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                disabled={!formData.venue_id}
              >
                生成
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">機材タイプ</label>
            <select
              value={formData.equipment_type}
              onChange={(e) => setFormData({ ...formData, equipment_type: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="lighting">照明</option>
              <option value="sound">音響</option>
              <option value="backstage">バックステージ</option>
              <option value="other">その他</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">設置場所ヒント</label>
            <input
              type="text"
              value={formData.location_hint}
              onChange={(e) => setFormData({ ...formData, location_hint: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="例：ステージ左袖"
            />
          </div>
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium">有効</span>
            </label>
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
                  name: '',
                  qr_code: '',
                  equipment_type: 'lighting',
                  location_hint: '',
                  active: true
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">会場</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">機材名</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">QRコード</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">タイプ</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">設置場所</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {equipment.map((item: any) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-sm">{item.venues?.name || '-'}</td>
                <td className="px-4 py-3">{item.name}</td>
                <td className="px-4 py-3 font-mono text-sm">{item.qr_code}</td>
                <td className="px-4 py-3 text-sm">{item.equipment_type}</td>
                <td className="px-4 py-3 text-sm">{item.location_hint || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {item.active ? '有効' : '無効'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleEdit(item)}
                    className="text-blue-600 hover:text-blue-900 mr-2"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
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