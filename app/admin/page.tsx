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
      <div className="bg-white border-b p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">ダッシュボード</h1>
          <p className="text-sm text-gray-600 mt-1">
            {user?.name} ({user?.role === 'admin' ? '管理者' : 'マネージャー'})
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* 会場管理 */}
          <button
            onClick={() => router.push('/admin/venues')}
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow text-center group">
            <div className="text-3xl mb-2">🏢</div>
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">会場管理</h3>
            <p className="text-xs text-gray-500 mt-1">登録・編集</p>
          </button>

          {/* 機材QR管理 */}
          <button
            onClick={() => router.push('/admin/equipment')}
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow text-center group">
            <div className="text-3xl mb-2">🏷️</div>
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">機材QR</h3>
            <p className="text-xs text-gray-500 mt-1">QRコード管理</p>
          </button>

          {/* イベント・シフト統合管理 */}
          <button
            onClick={() => router.push('/admin/events-integrated')}
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow text-center group border-2 border-blue-500 relative">
            <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">NEW</span>
            <div className="text-3xl mb-2">🎯</div>
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">イベント管理</h3>
            <p className="text-xs text-gray-500 mt-1">シフト統合型</p>
          </button>

          {/* スタッフ管理 */}
          <button
            onClick={() => router.push('/admin/staff')}
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow text-center group">
            <div className="text-3xl mb-2">👥</div>
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">スタッフ</h3>
            <p className="text-xs text-gray-500 mt-1">登録・編集</p>
          </button>

          {/* アサイン管理 */}
          <button
            onClick={() => router.push('/admin/assign')}
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow text-center group">
            <div className="text-3xl mb-2">📋</div>
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">アサイン</h3>
            <p className="text-xs text-gray-500 mt-1">シフト割当</p>
          </button>

          {/* 勤怠管理 */}
          <button
            onClick={() => router.push('/admin/attendance')}
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow text-center group">
            <div className="text-3xl mb-2">⏱️</div>
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">勤怠管理</h3>
            <p className="text-xs text-gray-500 mt-1">打刻確認</p>
          </button>
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
            <li className="text-blue-600 font-semibold">• 🆕 イベント・シフト統合管理（テンプレート機能付き）</li>
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