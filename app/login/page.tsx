'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'ログインに失敗しました')
        return
      }

      // ロール別にリダイレクト
      if (data.role === 'admin' || data.role === 'manager') {
        router.push('/admin')
      } else {
        router.push('/punch')
      }
    } catch (err) {
      setError('ネットワークエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // テスト用クイックログイン
  const quickLogin = (email: string, password: string) => {
    setEmail(email)
    setPassword(password)
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-black text-white p-6 rounded-t-lg">
          <h1 className="text-3xl font-bold text-center">HAAS</h1>
          <p className="text-center text-sm mt-2">First sound, First crew</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-b-lg shadow-lg p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 focus:outline-none"
              placeholder="email@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 focus:outline-none"
              placeholder="パスワード"
              required
            />
          </div>

          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg font-bold transition ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>

          {/* 開発用クイックログイン */}
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 mb-3">🔧 開発用クイックログイン</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => quickLogin('admin@haas.test', 'admin123')}
                className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
              >
                👑 管理者 (admin@haas.test)
              </button>
              <button
                type="button"
                onClick={() => quickLogin('manager@haas.test', 'manager123')}
                className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
              >
                📊 マネージャー (manager@haas.test)
              </button>
              <button
                type="button"
                onClick={() => quickLogin('staff1@haas.test', 'staff123')}
                className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
              >
                👷 スタッフ (staff1@haas.test)
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  )
}