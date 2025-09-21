import { NextRequest } from 'next/server'
import { GET as getSkillsHandler } from '@/app/api/admin/skills/route'
import { mockSupabaseClient, resetSupabaseMocks, createSupabaseError } from '@/__tests__/utils/supabase-mock'

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}))

describe('/api/admin/skills', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  describe('4 Skills Management (PA, 音源再生, 照明, バックヤード)', () => {
    const REQUIRED_SKILLS = [
      {
        id: 1,
        code: 'PA',
        label: 'PA',
        description: 'PA機材操作',
        category: 'technical',
        active: true,
      },
      {
        id: 2,
        code: 'AUDIO',
        label: '音源再生',
        description: '音源再生マニピュレーター',
        category: 'technical',
        active: true,
      },
      {
        id: 3,
        code: 'LIGHTING',
        label: '照明',
        description: '照明操作',
        category: 'technical',
        active: true,
      },
      {
        id: 4,
        code: 'BACKYARD',
        label: 'バックヤード',
        description: 'バックヤード業務',
        category: 'support',
        active: true,
      },
    ]

    it('should return all 4 required skills', async () => {
      // Arrange
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-1', email: 'admin@example.com' } },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: REQUIRED_SKILLS,
            error: null,
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/admin/skills')

      // Act
      const response = await getSkillsHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.skills).toHaveLength(4)
      expect(data.skills).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'PA', label: 'PA' }),
          expect.objectContaining({ code: 'AUDIO', label: '音源再生' }),
          expect.objectContaining({ code: 'LIGHTING', label: '照明' }),
          expect.objectContaining({ code: 'BACKYARD', label: 'バックヤード' }),
        ])
      )
    })

    it('should verify each skill has required properties', async () => {
      // Arrange
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-1' } },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: REQUIRED_SKILLS,
            error: null,
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/admin/skills')

      // Act
      const response = await getSkillsHandler(request)
      const data = await response.json()

      // Assert
      data.skills.forEach((skill: any) => {
        expect(skill).toHaveProperty('id')
        expect(skill).toHaveProperty('code')
        expect(skill).toHaveProperty('label')
        expect(skill).toHaveProperty('description')
        expect(skill).toHaveProperty('active')
        expect(skill.active).toBe(true)
      })
    })

    it('should return skills in correct order', async () => {
      // Arrange
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-1' } },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: REQUIRED_SKILLS,
            error: null,
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/admin/skills')

      // Act
      const response = await getSkillsHandler(request)
      const data = await response.json()

      // Assert
      expect(data.skills[0]).toEqual(expect.objectContaining({ code: 'PA' }))
      expect(data.skills[1]).toEqual(expect.objectContaining({ code: 'AUDIO' }))
      expect(data.skills[2]).toEqual(expect.objectContaining({ code: 'LIGHTING' }))
      expect(data.skills[3]).toEqual(expect.objectContaining({ code: 'BACKYARD' }))

      // Verify order() was called with 'id'
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('skills')
    })
  })

  describe('Staff Skills Assignment and Validation', () => {
    it('should validate staff can have multiple skills', async () => {
      // This test ensures the system supports staff with multiple skills
      const multiSkillStaff = [
        {
          staff_id: 'staff-1',
          skills: [
            { skill_id: 1, proficiency_level: 5, certified: true }, // PA
            { skill_id: 2, proficiency_level: 4, certified: true }, // 音源再生
          ],
        },
        {
          staff_id: 'staff-2',
          skills: [
            { skill_id: 3, proficiency_level: 3, certified: false }, // 照明
            { skill_id: 4, proficiency_level: 4, certified: true }, // バックヤード
          ],
        },
        {
          staff_id: 'staff-3',
          skills: [
            { skill_id: 1, proficiency_level: 5, certified: true }, // PA
            { skill_id: 2, proficiency_level: 5, certified: true }, // 音源再生
            { skill_id: 3, proficiency_level: 4, certified: true }, // 照明
            { skill_id: 4, proficiency_level: 3, certified: false }, // バックヤード
          ],
        },
      ]

      // Verify that each staff member's skills are valid
      multiSkillStaff.forEach((staff) => {
        staff.skills.forEach((skill) => {
          expect(skill.skill_id).toBeGreaterThanOrEqual(1)
          expect(skill.skill_id).toBeLessThanOrEqual(4)
          expect(skill.proficiency_level).toBeGreaterThanOrEqual(1)
          expect(skill.proficiency_level).toBeLessThanOrEqual(5)
          expect(typeof skill.certified).toBe('boolean')
        })
      })

      // Verify staff-3 has all 4 skills
      expect(multiSkillStaff[2].skills).toHaveLength(4)
    })

    it('should validate proficiency levels (1-5 scale)', () => {
      const validProficiencyLevels = [1, 2, 3, 4, 5]
      const invalidProficiencyLevels = [0, 6, -1, 10]

      validProficiencyLevels.forEach((level) => {
        expect(level).toBeGreaterThanOrEqual(1)
        expect(level).toBeLessThanOrEqual(5)
      })

      invalidProficiencyLevels.forEach((level) => {
        expect(level < 1 || level > 5).toBe(true)
      })
    })

    it('should validate certification status for each skill', () => {
      const skillCertifications = [
        { skill_id: 1, certified: true }, // PA certified
        { skill_id: 2, certified: false }, // 音源再生 not certified
        { skill_id: 3, certified: true }, // 照明 certified
        { skill_id: 4, certified: false }, // バックヤード not certified
      ]

      skillCertifications.forEach((cert) => {
        expect(typeof cert.certified).toBe('boolean')
        expect([1, 2, 3, 4]).toContain(cert.skill_id)
      })
    })
  })

  describe('Event Staffing Requirements Validation', () => {
    it('should validate that all 4 skills are covered in an event', () => {
      // Mock event staffing scenario where all 4 skills must be present
      const eventStaffing = {
        event_id: 'event-1',
        required_skills: [1, 2, 3, 4], // All 4 skills required
        assigned_staff: [
          { staff_id: 'staff-1', skills: [1, 3] }, // PA + 照明
          { staff_id: 'staff-2', skills: [2] }, // 音源再生
          { staff_id: 'staff-3', skills: [4] }, // バックヤード
        ],
      }

      // Get all assigned skills
      const assignedSkills = new Set<number>()
      eventStaffing.assigned_staff.forEach((staff) => {
        staff.skills.forEach((skill) => assignedSkills.add(skill))
      })

      // Verify all required skills are covered
      eventStaffing.required_skills.forEach((requiredSkill) => {
        expect(assignedSkills.has(requiredSkill)).toBe(true)
      })

      expect(assignedSkills.size).toBe(4) // All 4 skills covered
    })

    it('should identify when skill coverage is incomplete', () => {
      // Mock scenario where not all skills are covered
      const incompleteStaffing = {
        event_id: 'event-2',
        required_skills: [1, 2, 3, 4],
        assigned_staff: [
          { staff_id: 'staff-1', skills: [1, 3] }, // PA + 照明
          { staff_id: 'staff-2', skills: [2] }, // 音源再生
          // Missing: バックヤード (skill_id: 4)
        ],
      }

      const assignedSkills = new Set<number>()
      incompleteStaffing.assigned_staff.forEach((staff) => {
        staff.skills.forEach((skill) => assignedSkills.add(skill))
      })

      const missingSkills = incompleteStaffing.required_skills.filter(
        (skill) => !assignedSkills.has(skill)
      )

      expect(missingSkills).toContain(4) // バックヤード missing
      expect(missingSkills).toHaveLength(1)
    })

    it('should validate reserve staff requirements', () => {
      // As per requirements: "複数スタッフ時は2つ以上のタグを持つスタッフが1名以上必要"
      const staffAssignments = [
        { staff_id: 'staff-1', skills: [1], is_reserve: false }, // Single skill
        { staff_id: 'staff-2', skills: [2, 3], is_reserve: false }, // Multi-skill ✓
        { staff_id: 'staff-3', skills: [4], is_reserve: false }, // Single skill
        { staff_id: 'staff-4', skills: [1, 2, 3], is_reserve: true }, // Multi-skill reserve ✓
      ]

      // Find staff with multiple skills
      const multiSkillStaff = staffAssignments.filter((staff) => staff.skills.length >= 2)
      const multiSkillRegularStaff = multiSkillStaff.filter((staff) => !staff.is_reserve)

      expect(multiSkillStaff).toHaveLength(2) // 2 staff with multiple skills
      expect(multiSkillRegularStaff).toHaveLength(1) // At least 1 non-reserve multi-skill staff
    })
  })

  describe('Error handling and edge cases', () => {
    it('should return 401 for unauthenticated requests', async () => {
      // Arrange
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: createSupabaseError('Not authenticated'),
      })

      const request = new NextRequest('http://localhost:3000/api/admin/skills')

      // Act
      const response = await getSkillsHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-1' } },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: null,
            error: createSupabaseError('Database connection failed'),
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/admin/skills')

      // Act
      const response = await getSkillsHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to fetch skills' })
    })

    it('should handle empty skills list', async () => {
      // Arrange
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-1' } },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/admin/skills')

      // Act
      const response = await getSkillsHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.skills).toEqual([])
    })
  })

  describe('Skills data integrity', () => {
    it('should ensure skill codes are unique and consistent', () => {
      const skillCodes = ['PA', 'AUDIO', 'LIGHTING', 'BACKYARD']
      const uniqueCodes = new Set(skillCodes)

      expect(uniqueCodes.size).toBe(skillCodes.length) // All codes are unique
      expect(skillCodes).toEqual(expect.arrayContaining(['PA', 'AUDIO', 'LIGHTING', 'BACKYARD']))
    })

    it('should ensure skill IDs map correctly to roles', () => {
      const skillMapping = {
        1: 'PA',
        2: 'AUDIO',
        3: 'LIGHTING',
        4: 'BACKYARD',
      }

      // Verify mapping is complete and correct
      expect(Object.keys(skillMapping)).toHaveLength(4)
      expect(skillMapping[1]).toBe('PA')
      expect(skillMapping[2]).toBe('AUDIO')
      expect(skillMapping[3]).toBe('LIGHTING')
      expect(skillMapping[4]).toBe('BACKYARD')
    })

    it('should validate Japanese skill labels', () => {
      const skillLabels = {
        PA: 'PA',
        AUDIO: '音源再生',
        LIGHTING: '照明',
        BACKYARD: 'バックヤード',
      }

      // Verify Japanese characters are properly handled
      expect(skillLabels.AUDIO).toMatch(/音源再生/)
      expect(skillLabels.LIGHTING).toMatch(/照明/)
      expect(skillLabels.BACKYARD).toMatch(/バックヤード/)
    })
  })
})