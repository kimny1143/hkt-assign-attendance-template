'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Staff {
  id: string
  name: string
  email: string | null
  phone: string | null
  active: boolean
  code: string | null
  hourly_rate: number | null
  daily_rate: number | null
  user_roles?: { role: string }[]
  staff_skills?: {
    skill_id: number
    proficiency_level: number
    certified: boolean
    skills: {
      id: number
      code: string
      label: string
    }
  }[]
}

export default function StaffListPage() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      const { StaffRepository } = await import('@/lib/repositories/staffRepository')
      const staffRepo = new StaffRepository()
      const data = await staffRepo.getAll()
      setStaffList(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivate = async (staffId: string) => {
    if (!confirm('本当にこのスタッフを無効化しますか？')) return

    try {
      const { StaffRepository } = await import('@/lib/repositories/staffRepository')
      const staffRepo = new StaffRepository()
      await staffRepo.deactivate(staffId)
      await fetchStaff()
    } catch (err) {
      alert('スタッフの無効化に失敗しました: ' + (err instanceof Error ? err.message : 'エラーが発生しました'))
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">読み込み中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600">エラー: {error}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">スタッフ管理</h1>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            戻る
          </Link>
          <Link
            href="/admin/staff/new"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            新規登録
          </Link>
        </div>
      </div>

      {staffList.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          スタッフが登録されていません
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  名前
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  メール
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  電話番号
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  スキル
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  権限
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  時給
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {staffList.map((staff) => (
                <tr key={staff.id} className={!staff.active ? 'opacity-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{staff.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{staff.email || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{staff.phone || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {staff.staff_skills?.map((staffSkill) => (
                        <span
                          key={staffSkill.skill_id}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {staffSkill.skills.label}
                          {staffSkill.certified && ' ⭐'}
                          <span className="ml-1 text-xs opacity-75">
                            Lv{staffSkill.proficiency_level}
                          </span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {staff.user_roles && staff.user_roles.length > 0 ? (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        staff.user_roles[0].role === 'admin' ? 'bg-red-100 text-red-800' :
                        staff.user_roles[0].role === 'manager' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {staff.user_roles[0].role}
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        staff
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {staff.hourly_rate ? `¥${staff.hourly_rate.toLocaleString()}` : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      staff.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {staff.active ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/staff/${staff.id}`}
                        className="text-indigo-600 hover:text-indigo-900 text-sm"
                      >
                        詳細
                      </Link>
                      <Link
                        href={`/admin/staff/${staff.id}/edit`}
                        className="text-blue-600 hover:text-blue-900 text-sm"
                      >
                        編集
                      </Link>
                      {staff.active && (
                        <button
                          onClick={() => handleDeactivate(staff.id)}
                          className="text-red-600 hover:text-red-900 text-sm"
                        >
                          無効化
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}