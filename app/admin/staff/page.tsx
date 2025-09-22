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
      {/* Breadcrumb */}
      <nav className="flex mb-4 text-sm">
        <Link href="/admin" className="text-blue-600 hover:text-blue-800">
          ダッシュボード
        </Link>
        <span className="mx-2 text-gray-500">/</span>
        <span className="text-gray-700">スタッフ管理</span>
      </nav>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">👥 スタッフ管理</h1>
        <Link
          href="/admin/staff/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新規登録
        </Link>
      </div>

      {staffList.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          スタッフが登録されていません
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
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
                      <div className="flex gap-1">
                        <Link
                          href={`/admin/staff/${staff.id}`}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                          title="詳細"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        <Link
                          href={`/admin/staff/${staff.id}/edit`}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="編集"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        {staff.active && (
                          <button
                            onClick={() => handleDeactivate(staff.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="無効化"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {staffList.map((staff) => (
              <div
                key={staff.id}
                className={`bg-white rounded-lg shadow p-4 ${!staff.active ? 'opacity-50' : ''}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{staff.name}</h3>
                    <p className="text-sm text-gray-500">{staff.email || 'メールなし'}</p>
                    <p className="text-sm text-gray-500">{staff.phone || '電話番号なし'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      staff.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {staff.active ? '有効' : '無効'}
                    </span>
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
                  </div>
                </div>

                {/* Skills */}
                {staff.staff_skills && staff.staff_skills.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-600 mb-1">スキル:</p>
                    <div className="flex flex-wrap gap-1">
                      {staff.staff_skills.map((staffSkill) => (
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
                  </div>
                )}

                {/* Hourly Rate */}
                {staff.hourly_rate && (
                  <p className="text-sm text-gray-700 mb-3">
                    時給: <span className="font-semibold">¥{staff.hourly_rate.toLocaleString()}</span>
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-gray-200">
                  <Link
                    href={`/admin/staff/${staff.id}`}
                    className="flex-1 flex items-center justify-center px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    詳細
                  </Link>
                  <Link
                    href={`/admin/staff/${staff.id}/edit`}
                    className="flex-1 flex items-center justify-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    編集
                  </Link>
                  {staff.active && (
                    <button
                      onClick={() => handleDeactivate(staff.id)}
                      className="flex-1 flex items-center justify-center px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      無効化
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}