'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Skill {
  id: number
  code: string
  label: string
  description: string
}

interface SkillAssignment {
  skill_id: number
  proficiency_level: number
  certified: boolean
}

export default function NewStaffPage() {
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    hourly_rate: '',
    daily_rate: '',
    project_rate: '',
    skills: [] as SkillAssignment[]
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchSkills()
  }, [])

  const fetchSkills = async () => {
    try {
      const response = await fetch('/api/admin/skills')
      if (response.ok) {
        const data = await response.json()
        setAvailableSkills(data.skills || [])
      }
    } catch (err) {
      console.error('Failed to fetch skills:', err)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSkillToggle = (skillId: number) => {
    setFormData(prev => {
      const existingSkill = prev.skills.find(s => s.skill_id === skillId)

      if (existingSkill) {
        // Remove skill
        return {
          ...prev,
          skills: prev.skills.filter(s => s.skill_id !== skillId)
        }
      } else {
        // Add skill
        return {
          ...prev,
          skills: [...prev.skills, {
            skill_id: skillId,
            proficiency_level: 3,
            certified: false
          }]
        }
      }
    })
  }

  const handleSkillLevelChange = (skillId: number, level: number) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.map(s =>
        s.skill_id === skillId ? { ...s, proficiency_level: level } : s
      )
    }))
  }

  const handleSkillCertifiedChange = (skillId: number, certified: boolean) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.map(s =>
        s.skill_id === skillId ? { ...s, certified } : s
      )
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const submitData = {
        ...formData,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : undefined,
        daily_rate: formData.daily_rate ? parseFloat(formData.daily_rate) : undefined,
        project_rate: formData.project_rate ? parseFloat(formData.project_rate) : undefined
      }

      const response = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      })

      if (response.ok) {
        router.push('/admin/staff')
      } else {
        const data = await response.json()
        setError(data.error || 'スタッフの作成に失敗しました')
      }
    } catch (err) {
      setError('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">スタッフ新規登録</h1>
        <Link
          href="/admin/staff"
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          戻る
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded shadow">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            名前 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              電話番号
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            住所
          </label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              時給
            </label>
            <input
              type="number"
              name="hourly_rate"
              value={formData.hourly_rate}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="1500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              日給
            </label>
            <input
              type="number"
              name="daily_rate"
              value={formData.daily_rate}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="12000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              プロジェクト単価
            </label>
            <input
              type="number"
              name="project_rate"
              value={formData.project_rate}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="50000"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            スキル
          </label>
          <div className="space-y-4 border border-gray-200 rounded-md p-4">
            {availableSkills.map((skill) => {
              const assigned = formData.skills.find(s => s.skill_id === skill.id)
              return (
                <div key={skill.id} className="flex items-center space-x-4 p-2 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={!!assigned}
                    onChange={() => handleSkillToggle(skill.id)}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />

                  <div className="flex-1">
                    <label className="font-medium">{skill.label}</label>
                    <div className="text-sm text-gray-500">{skill.description}</div>
                  </div>

                  {assigned && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500">習熟度</label>
                        <select
                          value={assigned.proficiency_level}
                          onChange={(e) => handleSkillLevelChange(skill.id, parseInt(e.target.value))}
                          className="mt-1 block w-24 border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value={1}>Lv1</option>
                          <option value={2}>Lv2</option>
                          <option value={3}>Lv3</option>
                          <option value={4}>Lv4</option>
                          <option value={5}>Lv5</option>
                        </select>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={assigned.certified}
                          onChange={(e) => handleSkillCertifiedChange(skill.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <label className="ml-2 text-sm">認定済み</label>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <Link
            href="/admin/staff"
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            キャンセル
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '作成中...' : '作成'}
          </button>
        </div>
      </form>
    </div>
  )
}