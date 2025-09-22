'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import QRCode from 'react-qr-code';

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
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedQR, setSelectedQR] = useState<{ code: string; name: string } | null>(null);
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
    <div className="container mx-auto px-4 py-8">
      {/* パンくずリスト */}
      <nav className="flex mb-4 text-sm">
        <a href="/admin" className="text-blue-600 hover:text-blue-800">
          ダッシュボード
        </a>
        <span className="mx-2 text-gray-500">/</span>
        <span className="text-gray-700">機材QR管理</span>
      </nav>

      <h1 className="text-2xl font-bold mb-6">🏷️ 機材QR管理</h1>

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
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setSelectedQR({ code: item.qr_code, name: item.name });
                        setShowQRModal(true);
                      }}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                      title="QRコード表示"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h2m-6 0h2" />
                        <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none" />
                        <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none" />
                        <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                      title="編集"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="削除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* QRコードモーダル */}
      {showQRModal && selectedQR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{selectedQR.name}</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-white p-4 flex justify-center">
              <QRCode
                size={256}
                value={selectedQR.code}
                level="H"
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
            </div>

            <div className="mt-4 p-2 bg-gray-100 rounded text-center">
              <code className="text-sm font-mono">{selectedQR.code}</code>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>${selectedQR.name} - QRコード</title>
                          <style>
                            body {
                              display: flex;
                              flex-direction: column;
                              align-items: center;
                              justify-content: center;
                              height: 100vh;
                              margin: 0;
                              font-family: system-ui, -apple-system, sans-serif;
                            }
                            h2 { margin-bottom: 20px; }
                            .code {
                              margin-top: 20px;
                              padding: 10px;
                              background: #f3f4f6;
                              border-radius: 4px;
                              font-family: monospace;
                            }
                          </style>
                        </head>
                        <body>
                          <h2>${selectedQR.name}</h2>
                          <div id="qr"></div>
                          <div class="code">${selectedQR.code}</div>
                          <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
                          <script>
                            const qr = qrcode(0, 'H');
                            qr.addData('${selectedQR.code}');
                            qr.make();
                            document.getElementById('qr').innerHTML = qr.createImgTag(8);
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                    setTimeout(() => {
                      printWindow.print();
                    }, 500);
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                印刷
              </button>
              <button
                onClick={() => setShowQRModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}