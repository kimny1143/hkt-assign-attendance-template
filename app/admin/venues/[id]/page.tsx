'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Edit, MapPin, Package, Plus, Trash2 } from 'lucide-react';

interface Venue {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lon: number | null;
  capacity: number | null;
  created_at: string;
}

interface Equipment {
  id: string;
  venue_id: string;
  name: string;
  qr_code: string;
  equipment_type: 'light' | 'sound' | 'other';
  location_hint?: string;
  active: boolean;
  created_at: string;
}

export default function VenueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [newEquipment, setNewEquipment] = useState({
    name: '',
    qr_code: '',
    equipment_type: 'other' as 'light' | 'sound' | 'other',
    location_hint: ''
  });

  const supabase = createClient();

  useEffect(() => {
    fetchVenueAndEquipment();
  }, [params.id]);

  const fetchVenueAndEquipment = async () => {
    try {
      // 会場情報取得
      const { data: venueData, error: venueError } = await supabase
        .from('venues')
        .select('*')
        .eq('id', params.id)
        .single();

      if (venueError) throw venueError;
      setVenue(venueData);

      // 機材情報取得
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('equipment')
        .select('*')
        .eq('venue_id', params.id)
        .order('created_at', { ascending: false });

      if (equipmentError) throw equipmentError;
      setEquipment(equipmentData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEquipment = async () => {
    if (!newEquipment.name || !newEquipment.qr_code) {
      alert('機材名とQRコードは必須です');
      return;
    }

    try {
      const { error } = await supabase
        .from('equipment')
        .insert([{
          venue_id: params.id,
          name: newEquipment.name,
          qr_code: newEquipment.qr_code,
          equipment_type: newEquipment.equipment_type,
          location_hint: newEquipment.location_hint || null,
          active: true
        }]);

      if (error) throw error;

      await fetchVenueAndEquipment();
      setNewEquipment({
        name: '',
        qr_code: '',
        equipment_type: 'other',
        location_hint: ''
      });
      setShowAddEquipment(false);
    } catch (error) {
      console.error('Error adding equipment:', error);
      alert('機材の登録に失敗しました');
    }
  };

  const handleDeleteEquipment = async (equipmentId: string) => {
    if (!confirm('この機材を削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', equipmentId);

      if (error) throw error;
      await fetchVenueAndEquipment();
    } catch (error) {
      console.error('Error deleting equipment:', error);
      alert('機材の削除に失敗しました');
    }
  };

  const handleToggleActive = async (equipmentId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('equipment')
        .update({ active: !currentStatus })
        .eq('id', equipmentId);

      if (error) throw error;
      await fetchVenueAndEquipment();
    } catch (error) {
      console.error('Error updating equipment:', error);
      alert('機材の状態更新に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600">会場が見つかりません</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/venues"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </Link>
          <h1 className="text-2xl font-bold">会場詳細</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 会場情報 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            会場情報
          </h2>
          <dl className="space-y-2">
            <div className="flex">
              <dt className="w-24 font-medium text-gray-600">名称:</dt>
              <dd className="flex-1">{venue.name}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 font-medium text-gray-600">住所:</dt>
              <dd className="flex-1">{venue.address}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 font-medium text-gray-600">収容人数:</dt>
              <dd className="flex-1">{venue.capacity || '-'}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 font-medium text-gray-600">GPS:</dt>
              <dd className="flex-1">
                {venue.lat && venue.lon ? `${venue.lat}, ${venue.lon}` : '未設定'}
              </dd>
            </div>
          </dl>
        </div>

        {/* 機材リスト */}
        <div className="bg-white p-6 rounded-lg shadow md:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Package className="w-5 h-5" />
              機材一覧
            </h2>
            <button
              onClick={() => setShowAddEquipment(!showAddEquipment)}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              追加
            </button>
          </div>

          {/* 機材追加フォーム */}
          {showAddEquipment && (
            <div className="mb-4 p-4 border rounded-lg bg-gray-50">
              <div className="grid grid-cols-1 gap-3">
                <input
                  type="text"
                  placeholder="機材名 *"
                  value={newEquipment.name}
                  onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })}
                  className="px-3 py-2 border rounded"
                />
                <input
                  type="text"
                  placeholder="QRコード *"
                  value={newEquipment.qr_code}
                  onChange={(e) => setNewEquipment({ ...newEquipment, qr_code: e.target.value })}
                  className="px-3 py-2 border rounded"
                />
                <select
                  value={newEquipment.equipment_type}
                  onChange={(e) => setNewEquipment({ ...newEquipment, equipment_type: e.target.value as 'light' | 'sound' | 'other' })}
                  className="px-3 py-2 border rounded"
                >
                  <option value="light">照明</option>
                  <option value="sound">音響</option>
                  <option value="other">その他</option>
                </select>
                <input
                  type="text"
                  placeholder="設置場所のヒント（任意）"
                  value={newEquipment.location_hint}
                  onChange={(e) => setNewEquipment({ ...newEquipment, location_hint: e.target.value })}
                  className="px-3 py-2 border rounded"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddEquipment}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    登録
                  </button>
                  <button
                    onClick={() => {
                      setShowAddEquipment(false);
                      setNewEquipment({
                        name: '',
                        qr_code: '',
                        equipment_type: 'other',
                        location_hint: ''
                      });
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 機材リスト */}
          <div className="space-y-2">
            {equipment.length === 0 ? (
              <p className="text-gray-500">機材が登録されていません</p>
            ) : (
              equipment.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 border rounded-lg ${item.active ? '' : 'opacity-50'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-gray-600">
                        QR: {item.qr_code}
                        {item.location_hint && ` | 場所: ${item.location_hint}`}
                      </div>
                      <div className="text-xs mt-1">
                        <span className={`px-2 py-1 rounded-full ${
                          item.equipment_type === 'light' ? 'bg-yellow-100 text-yellow-800' :
                          item.equipment_type === 'sound' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.equipment_type === 'light' ? '照明' :
                           item.equipment_type === 'sound' ? '音響' : 'その他'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleActive(item.id, item.active)}
                        className={`text-sm px-2 py-1 rounded ${
                          item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {item.active ? '有効' : '無効'}
                      </button>
                      <button
                        onClick={() => handleDeleteEquipment(item.id)}
                        className="text-red-600 hover:text-red-800"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}