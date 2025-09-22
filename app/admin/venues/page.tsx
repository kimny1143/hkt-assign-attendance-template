'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MapPin, Navigation, Search } from 'lucide-react';

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
  const [gpsLoading, setGpsLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

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

  // 現在位置を取得
  const getCurrentPosition = () => {
    setGpsLoading(true);
    if (!navigator.geolocation) {
      alert('お使いのブラウザは位置情報取得に対応していません');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData({
          ...formData,
          lat: position.coords.latitude.toFixed(6),
          lon: position.coords.longitude.toFixed(6)
        });
        setGpsLoading(false);
      },
      (error) => {
        alert('位置情報の取得に失敗しました: ' + error.message);
        setGpsLoading(false);
      }
    );
  };

  // 住所から座標を取得（複数のAPIを試行）
  const geocodeAddress = async () => {
    if (!formData.address) {
      alert('住所を入力してください');
      return;
    }

    setGeocoding(true);
    try {
      // まず日本語の住所をそのまま検索
      let response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.address + ' Japan')}&accept-language=ja&limit=1`
      );
      let data = await response.json();

      // データが見つからない場合は、住所を簡略化して再検索
      if (!data || data.length === 0) {
        // 番地を除去して再検索（例：「渋谷区道玄坂2-1」→「渋谷区道玄坂」）
        const simplifiedAddress = formData.address.replace(/[\d\-－丁目番地号]/g, '').trim();
        console.log('簡略化した住所で再検索:', simplifiedAddress);

        response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simplifiedAddress + ' Japan')}&accept-language=ja&limit=1`
        );
        data = await response.json();
      }

      if (data && data.length > 0) {
        console.log('取得した座標データ:', data[0]);
        setFormData({
          ...formData,
          lat: parseFloat(data[0].lat).toFixed(6),
          lon: parseFloat(data[0].lon).toFixed(6)
        });
        // 取得した住所を表示（確認用）
        if (data[0].display_name) {
          console.log('マッチした住所:', data[0].display_name);
        }
      } else {
        // 代替案：国土地理院APIを使用
        console.log('国土地理院APIを試行中...');
        const gsiResponse = await fetch(
          `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(formData.address)}`
        );
        const gsiData = await gsiResponse.json();

        if (gsiData && gsiData.length > 0) {
          const [lon, lat] = gsiData[0].geometry.coordinates;
          setFormData({
            ...formData,
            lat: lat.toFixed(6),
            lon: lon.toFixed(6)
          });
        } else {
          alert('住所から座標を取得できませんでした。\n住所を確認するか、手動で緯度経度を入力してください。');
        }
      }
    } catch (error) {
      console.error('ジオコーディングエラー:', error);
      alert('ジオコーディングエラー: ' + error);
    } finally {
      setGeocoding(false);
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
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">住所</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="flex-1 px-3 py-2 border rounded-md"
                placeholder="例: 東京都渋谷区道玄坂2-1"
              />
              <button
                type="button"
                onClick={geocodeAddress}
                disabled={geocoding}
                className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
              >
                <Search className="w-4 h-4" />
                {geocoding ? '検索中...' : '座標取得'}
              </button>
            </div>
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
              placeholder="35.658581"
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
              placeholder="139.698742"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={getCurrentPosition}
              disabled={gpsLoading}
              className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              {gpsLoading ? '取得中...' : '現在位置を取得'}
            </button>
            <p className="text-xs text-gray-500 mt-1">
              ブラウザの位置情報を使用して現在地の座標を取得します
            </p>
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
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    {venue.lat.toFixed(4)}, {venue.lon.toFixed(4)}
                  </div>
                </td>
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