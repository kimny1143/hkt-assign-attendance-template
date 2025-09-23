'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useJSTDate } from '@/hooks/useJSTDate'

interface Shift {
  id: string
  name: string
  start_at: string
  end_at: string
  required: number
  venue_name: string
  assignments: Assignment[]
}

interface Assignment {
  id: string
  staff_id: string
  staff_name: string
  status: string
}

interface Staff {
  id: string
  name: string
  skill_tags: string[]
  is_available: boolean
  has_all_skills: boolean
}

export default function AssignPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [availableStaff, setAvailableStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // useJSTDateフックから関数を取得
  const { formatTime } = useJSTDate()

  useEffect(() => {
    checkAuth()
    loadShifts()
  }, [selectedDate])

  const checkAuth = async () => {
    const res = await fetch('/api/auth/me')
    if (!res.ok) {
      router.push('/login')
    }
  }

  const loadShifts = async () => {
    console.log('Loading shifts for date:', selectedDate) // DEBUG
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/shifts?date=${selectedDate}`)
      console.log('Load shifts response status:', res.status) // DEBUG
      
      if (res.ok) {
        const data = await res.json()
        console.log('Shifts data:', data) // DEBUG
        setShifts(data.shifts || [])
        setAvailableStaff(data.availableStaff || [])
      } else {
        const error = await res.json()
        console.error('Load shifts error:', error) // DEBUG
        alert(`シフト読み込みエラー: ${error.error}`) // DEBUG
      }
    } catch (error) {
      console.error('Failed to load shifts:', error)
      alert(`ネットワークエラー: ${error}`) // DEBUG
    } finally {
      setLoading(false)
    }
  }

  const removeAssignment = async (assignmentId: string, shiftId: string) => {
    if (!confirm('このアサインメントを削除しますか？')) return
    
    try {
      const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        loadShifts() // リロード
      } else {
        const data = await res.json()
        alert(`削除エラー: ${data.error}`)
      }
    } catch (error) {
      alert(`ネットワークエラー: ${error}`)
    }
  }

  const assignStaff = async (shiftId: string, staffId: string) => {
    console.log('assignStaff called:', { shiftId, staffId }) // DEBUG
    
    try {
      const res = await fetch('/api/admin/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId, staffId })
      })
      
      console.log('Response status:', res.status) // DEBUG
      const data = await res.json()
      console.log('Response data:', data) // DEBUG
      
      if (res.ok) {
        alert('アサイン成功！') // DEBUG
        loadShifts() // リロード
      } else {
        alert(`エラー: ${data.error || 'アサインに失敗しました'}`) // DEBUG
      }
    } catch (error) {
      console.error('Failed to assign staff:', error)
      alert(`ネットワークエラー: ${error}`) // DEBUG
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* パンくずリスト */}
        <nav className="flex mb-4 text-sm">
          <a href="/admin" className="text-blue-600 hover:text-blue-800">
            ダッシュボード
          </a>
          <span className="mx-2 text-gray-500">/</span>
          <span className="text-gray-700">アサイン管理</span>
        </nav>

        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">📋 アサイン管理</h1>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm"
          />
        </div>

        {loading ? (
          <div className="text-center py-8">読み込み中...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* シフト一覧 */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-bold mb-4">シフト一覧</h2>
              
              {shifts.length === 0 ? (
                <div className="bg-white p-6 rounded-lg shadow">
                  <p className="text-gray-500">この日のシフトはありません</p>
                </div>
              ) : (
                shifts.map(shift => (
                  <div key={shift.id} className="bg-white p-6 rounded-lg shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{shift.name}</h3>
                        <p className="text-sm text-gray-600">
                          {shift.venue_name} | {shift.start_at} - {shift.end_at}
                        </p>
                        <p className="text-sm text-gray-600">
                          必要人数: {shift.required}名 / 現在: {shift.assignments.filter(a => a.status === 'confirmed').length}名
                        </p>
                      </div>
                    </div>

                    {/* アサイン済みスタッフ */}
                    <div className="space-y-2 mb-4">
                      {shift.assignments.map(assignment => (
                        <div key={assignment.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span>{assignment.staff_name}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              assignment.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                              assignment.status === 'candidate' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {assignment.status}
                            </span>
                            <button
                              onClick={() => removeAssignment(assignment.id, shift.id)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="削除"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 空きスロット */}
                    {(() => {
                      const confirmedCount = shift.assignments.filter(a => a.status === 'confirmed').length
                      const hasSpace = confirmedCount < shift.required
                      
                      if (!hasSpace) {
                        return (
                          <div className="border-t pt-4 text-center text-green-600">
                            ✅ 満員（{confirmedCount}/{shift.required}名）
                          </div>
                        )
                      }
                      
                      // 1名枠の場合は全スキル保有者のみ、複数枠の場合は全員表示
                      const filteredStaff = shift.required === 1
                        ? availableStaff.filter(staff => staff.has_all_skills)
                        : availableStaff

                      return (
                        <div className="border-t pt-4">
                          <div className="text-sm text-gray-500 mb-2">
                            あと{shift.required - confirmedCount}名必要
                            {shift.required === 1 && (
                              <span className="ml-2 text-xs text-orange-600">
                                (全スキル保有者のみ)
                              </span>
                            )}
                          </div>
                          {filteredStaff.length === 0 ? (
                            <div className="text-sm text-gray-400 p-2 bg-gray-50 rounded">
                              {shift.required === 1
                                ? '全スキル保有者がいません'
                                : '利用可能なスタッフがいません'}
                            </div>
                          ) : (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  assignStaff(shift.id, e.target.value)
                                  e.target.value = ''
                                }
                              }}
                              className="w-full p-2 border rounded"
                            >
                              <option value="">スタッフを選択...</option>
                              {filteredStaff.map(staff => (
                                <option key={staff.id} value={staff.id}>
                                  {staff.name}
                                  {staff.has_all_skills && ' ⭐'}
                                  {staff.skill_tags.length > 0 && ` (${staff.skill_tags.join(', ')})`}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                ))
              )}
            </div>

            {/* 利用可能スタッフ */}
            <div>
              <h2 className="text-xl font-bold mb-4">利用可能スタッフ</h2>
              <div className="bg-white p-4 rounded-lg shadow">
                {availableStaff.length === 0 ? (
                  <p className="text-gray-500">利用可能なスタッフがいません</p>
                ) : (
                  <div className="space-y-2">
                    {availableStaff.map(staff => (
                      <div key={staff.id} className="p-2 border rounded hover:bg-gray-50">
                        <div className="font-semibold">
                          {staff.name}
                          {staff.has_all_skills && (
                            <span className="ml-1 text-yellow-500" title="全スキル保有">⭐</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">
                          {staff.skill_tags.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}