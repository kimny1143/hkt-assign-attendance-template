'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface TodayAssignment {
  id: string
  shifts: {
    id: string
    start_ts: string
    end_ts: string
    events: {
      name: string
      venues: {
        name: string
        address: string
      }
    }
  }
}

export default function PunchPage() {
  const [equipmentQr, setEquipmentQr] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [scannerActive, setScannerActive] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [todayAssignments, setTodayAssignments] = useState<TodayAssignment[]>([])
  const router = useRouter()

  // 認証チェックとGPS自動取得
  useEffect(() => {
    checkAuth()
    grabGPS()
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

      // 本日のアサインメントを取得
      await fetchTodayAssignments(data.user.id)
    } catch (error) {
      router.push('/login')
    }
  }

  const fetchTodayAssignments = async (userId: string) => {
    try {
      const res = await fetch('/api/assignments/today')
      if (res.ok) {
        const data = await res.json()
        setTodayAssignments(data.assignments || [])
      }
    } catch (error) {
      console.error('Failed to fetch assignments:', error)
    }
  }

  const grabGPS = async () => {
    try {
      if (!navigator.geolocation) {
        throw new Error('GPS非対応のブラウザです')
      }
      
      // HTTPでのアクセスかチェック
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setMessage('⚠️ HTTPSでアクセスするか、位置情報の許可を確認してください')
        console.warn('GPS may not work properly over HTTP. Consider using HTTPS or localhost.')
      }

      setMessage('📍 位置情報を取得中...')

      // GPS取得のオプションを調整
      const gpsOptions: PositionOptions = {
        enableHighAccuracy: true,  // 高精度モードを有効化
        timeout: 30000,  // タイムアウトを30秒に延長
        maximumAge: 0  // キャッシュを使わず最新の位置を取得
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude
          })
          setMessage(`📍 位置情報取得完了 (精度: ${Math.round(pos.coords.accuracy)}m)`)
        },
        (err) => {
          console.error('GPS Error:', err)
          let errorMessage = 'GPS取得エラー'

          switch(err.code) {
            case err.PERMISSION_DENIED:
              errorMessage = '位置情報の使用が拒否されました。\n\n【iOS設定方法】\n• 設定 → プライバシーとセキュリティ → 位置情報サービス → Chrome → 許可\n• Chromeでサイト再読み込み\n\n【Android設定方法】\n• Chrome設定 → サイト設定 → 位置情報 → 許可'
              break
            case err.POSITION_UNAVAILABLE:
              errorMessage = '位置情報が取得できません。\n\n【確認事項】\n• 位置情報サービスがONか確認\n• Wi-Fi/モバイルデータがONか確認'
              break
            case err.TIMEOUT:
              errorMessage = 'タイムアウトしました。\n\n【対処法】\n• 屋外や窓際で再試行\n• Wi-FiをONにして再試行'
              break
            default:
              errorMessage = err.message
          }

          setMessage(`⚠️ ${errorMessage}`)

          // デバッグ用：手動で位置を設定できるオプション
          if (window.confirm('GPS取得に失敗しました。テスト用の位置情報を使用しますか？\n\n※本番運用時はGPS取得が必須です')) {
            // 八王子駅の座標をセット
            setCoords({
              lat: 35.6555,
              lon: 139.3389
            })
            setMessage('📍 テスト位置（八王子駅）を使用中')
          }
        },
        gpsOptions
      )
    } catch (error) {
      setMessage(`⚠️ ${error}`)
      console.error('GPS initialization error:', error)
    }
  }

  // QRコードスキャン（カメラ使用）
  const startQrScan = async () => {
    try {
      // 実際の実装では、QRスキャナーライブラリ（例：html5-qrcode）を使用
      // ここではデモ用に手動入力
      setScannerActive(true)
      setMessage('📷 QRコードをスキャンしてください')
    } catch (error) {
      setMessage(`⚠️ カメラアクセスエラー`)
    }
  }

  // 打刻処理
  const submit = async (purpose: 'checkin' | 'checkout') => {
    if (!equipmentQr) {
      setMessage('⚠️ QRコードをスキャンしてください')
      return
    }
    
    if (!coords) {
      setMessage('⚠️ GPS情報を取得中です...')
      await grabGPS()
      return
    }

    setLoading(true)
    setMessage('🔄 打刻処理中...')

    try {
      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipment_qr: equipmentQr,
          lat: coords.lat,
          lon: coords.lon,
          purpose
        })
      })

      const json = await res.json()
      
      if (!res.ok) {
        setMessage(`❌ ${json.error || '打刻エラー'}`)
      } else {
        setMessage(
          purpose === 'checkin' 
            ? '✅ 出勤打刻完了！' 
            : '✅ 退勤打刻完了！'
        )
        // 成功後、QRコードをクリア
        setTimeout(() => {
          setEquipmentQr('')
          setMessage('')
        }, 3000)
      }
    } catch (error) {
      setMessage(`❌ ネットワークエラー: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        {/* ヘッダー */}
        <div className="bg-black text-white p-4 rounded-t-lg">
          <h1 className="text-2xl font-bold text-center">HAAS</h1>
          <p className="text-center text-sm mt-1">打刻システム</p>
          {user && (
            <p className="text-center text-xs mt-2 text-gray-300">
              {user.name} でログイン中
            </p>
          )}
        </div>

        <div className="bg-white rounded-b-lg shadow-lg p-6 space-y-6">
          {/* 本日のワークスケジュール */}
          {todayAssignments.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">📅 本日のワークスケジュール</h3>
              {todayAssignments.map((assignment) => (
                <div key={assignment.id} className="text-sm space-y-1">
                  <div className="font-medium">{assignment.shifts.events.name}</div>
                  <div className="text-gray-600">
                    📍 {assignment.shifts.events.venues.name}
                  </div>
                  <div className="text-gray-500">
                    {new Date(assignment.shifts.start_ts).toLocaleTimeString('ja-JP', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    〜
                    {new Date(assignment.shifts.end_ts).toLocaleTimeString('ja-JP', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* GPS状態 */}
          <div className="bg-gray-100 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">📍 GPS状態</span>
              <button 
                onClick={grabGPS}
                className="text-blue-600 text-sm hover:underline"
              >
                再取得
              </button>
            </div>
            {coords ? (
              <div className="text-sm">
                <div>緯度: {coords.lat.toFixed(6)}</div>
                <div>経度: {coords.lon.toFixed(6)}</div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">取得中...</div>
            )}
          </div>

          {/* QRコードスキャン */}
          <div className="space-y-3">
            <label className="block font-semibold">🏷️ 機材QRコード</label>
            
            {!scannerActive ? (
              <button
                onClick={startQrScan}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
              >
                📷 QRコードをスキャン
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  className="w-full border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="QRコードを入力（例: MARINE-A-LIGHT-001）"
                  value={equipmentQr}
                  onChange={(e) => setEquipmentQr(e.target.value)}
                />
                <button
                  onClick={() => setScannerActive(false)}
                  className="text-sm text-gray-600 hover:underline"
                >
                  キャンセル
                </button>
              </div>
            )}
            
            {equipmentQr && (
              <div className="bg-green-50 p-3 rounded-lg">
                <span className="text-green-700 text-sm">
                  ✅ QR: {equipmentQr}
                </span>
              </div>
            )}
          </div>

          {/* メッセージ表示 */}
          {message && (
            <div className={`p-3 rounded-lg text-center ${
              message.includes('✅') ? 'bg-green-100 text-green-700' :
              message.includes('❌') ? 'bg-red-100 text-red-700' :
              message.includes('⚠️') ? 'bg-yellow-100 text-yellow-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {message}
            </div>
          )}

          {/* 打刻ボタン */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => submit('checkin')}
              disabled={loading || !equipmentQr}
              className={`py-4 rounded-lg font-bold transition ${
                loading || !equipmentQr
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              出勤
            </button>
            <button
              onClick={() => submit('checkout')}
              disabled={loading || !equipmentQr}
              className={`py-4 rounded-lg font-bold transition ${
                loading || !equipmentQr
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              退勤
            </button>
          </div>

          {/* テスト用QRコード一覧 */}
          <details className="mt-6">
            <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
              📝 テスト用QRコード
            </summary>
            <div className="mt-2 text-xs space-y-1 bg-gray-50 p-3 rounded">
              <div className="font-semibold text-gray-700">東京テスト会場:</div>
              <div>HACHIOJI-LIGHT-001 (JR八王子駅テスト)</div>
              <div className="mt-2 font-semibold text-gray-700">福岡会場:</div>
              <div>MARINE-A-LIGHT-001 (マリンメッセ照明)</div>
              <div>SUNPALACE-LIGHT-001 (サンパレス照明)</div>
              <div>ZEPP-LIGHT-001 (Zepp照明)</div>
              <div>KOKUSAI-LIGHT-001 (国際センター照明)</div>
            </div>
          </details>

          {/* ログアウトボタン */}
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' })
              router.push('/login')
            }}
            className="w-full text-center text-sm text-gray-600 hover:text-red-600 mt-4"
          >
            ログアウト
          </button>
        </div>
      </div>
    </main>
  )
}// Force rebuild: 2025年 9月22日 月曜日 21時24分08秒 JST
