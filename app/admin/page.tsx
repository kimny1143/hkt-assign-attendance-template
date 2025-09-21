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
          {/* イベント管理 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">📅 イベント管理</h2>
            <p className="text-gray-600 mb-4">イベントとシフトの作成・編集</p>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
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

          {/* 勤怠レポート */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">📊 勤怠レポート</h2>
            <p className="text-gray-600 mb-4">出退勤記録の確認・CSV出力</p>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              レポート表示
            </button>
          </div>

          {/* 機材QR管理 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">🏷️ 機材QR管理</h2>
            <p className="text-gray-600 mb-4">機材QRコードの登録・印刷</p>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              QR管理画面へ
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

          {/* 設定 */}
          {user?.role === 'admin' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">⚙️ システム設定</h2>
              <p className="text-gray-600 mb-4">会場・LINE連携の設定</p>
              <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                設定画面へ
              </button>
            </div>
          )}
        </div>

        {/* 今後の実装予定 */}
        <div className="mt-8 bg-yellow-50 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-2">🚧 実装予定の機能</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• 各管理画面の詳細実装</li>
            <li>• LINE連携による通知機能</li>
            <li>• freee給与計算連携</li>
            <li>• リアルタイムダッシュボード</li>
          </ul>
        </div>
      </div>
    </main>
  )
}