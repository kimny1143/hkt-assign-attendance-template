'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setUser(data.user)
    } catch (error) {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-black text-white p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">HAAS 管理画面</h1>
            <p className="text-sm mt-1">
              {user?.name} ({user?.role === 'admin' ? '管理者' : 'マネージャー'})
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition"
          >
            ログアウト
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 会場管理 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">🏢 会場管理</h2>
            <p className="text-gray-600 mb-4">会場の登録・編集・削除</p>
            <button
              onClick={() => router.push('/admin/venues')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              管理画面へ
            </button>
          </div>

          {/* 機材QR管理 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">🏷️ 機材QR管理</h2>
            <p className="text-gray-600 mb-4">機材QRコードの登録・管理</p>
            <button
              onClick={() => router.push('/admin/equipment')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              管理画面へ
            </button>
          </div>

          {/* イベント管理 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">📅 イベント管理</h2>
            <p className="text-gray-600 mb-4">イベントの作成・編集</p>
            <button
              onClick={() => router.push('/admin/events')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              管理画面へ
            </button>
          </div>

          {/* シフト管理 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">🕐 シフト管理</h2>
            <p className="text-gray-600 mb-4">シフトの作成・必要人数設定</p>
            <button
              onClick={() => router.push('/admin/shifts')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              管理画面へ
            </button>
          </div>

          {/* スタッフ管理 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">👥 スタッフ管理</h2>
            <p className="text-gray-600 mb-4">スタッフの登録・編集・削除</p>
            <button
              onClick={() => router.push('/admin/staff')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              管理画面へ
            </button>
          </div>

          {/* アサイン管理 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">📋 アサイン管理</h2>
            <p className="text-gray-600 mb-4">スタッフのシフト割り当て</p>
            <button
              onClick={() => router.push('/admin/assign')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              アサイン画面へ
            </button>
          </div>

          {/* 勤怠管理 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">⏱️ 勤怠管理</h2>
            <p className="text-gray-600 mb-4">打刻状況の確認・管理</p>
            <button
              onClick={() => router.push('/admin/attendance')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              勤怠管理へ
            </button>
          </div>
        </div>

        {/* ステータス */}
        <div className="mt-8 bg-green-50 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-2">✅ 実装済み機能</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• 会場管理（住所、GPS座標、収容人数）</li>
            <li>• 機材QR管理（QRコード自動生成）</li>
            <li>• イベント管理（日程、時間設定）</li>
            <li>• シフト管理（スキル別必要人数）</li>
            <li>• スタッフ管理（基本情報、スキル設定）</li>
            <li>• アサイン管理（シフト割り当て）</li>
          </ul>
        </div>

        {/* 今後の実装予定 */}
        <div className="mt-4 bg-yellow-50 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-2">🚧 実装予定の機能</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• 勤怠レポート（CSV出力）</li>
            <li>• Slack通知機能（MVP）</li>
            <li>• LINE連携（次フェーズ）</li>
            <li>• freee給与計算連携</li>
            <li>• リアルタイムダッシュボード</li>
          </ul>
        </div>
      </div>
    </main>
  )
}