import { NextRequest } from 'next/server'
import { GET as getStaffHandler, POST as createStaffHandler } from '@/app/api/admin/staff/route'
import { GET as getStaffByIdHandler, PUT as updateStaffHandler, DELETE as deleteStaffHandler } from '@/app/api/admin/staff/[id]/route'
import { mockSupabaseClient, resetSupabaseMocks, createSupabaseError } from '@/__tests__/utils/supabase-mock'

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}))

describe('/api/admin/staff CRUD operations', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  describe('GET /api/admin/staff', () => {
    it('should fetch staff list with skills and roles', async () => {
      // Arrange
      const mockStaffData = [
        {
          id: 'staff-1',
          name: 'Test Staff 1',
          email: 'staff1@example.com',
          phone: '090-1234-5678',
          active: true,
          staff_skills: [
            {
              skill_id: 1,
              proficiency_level: 4,
              certified: true,
              skills: {
                id: 1,
                code: 'PA',
                label: 'PA',
                description: 'PA機材操作',
              },
            },
            {
              skill_id: 3,
              proficiency_level: 3,
              certified: false,
              skills: {
                id: 3,
                code: 'LIGHTING',
                label: '照明',
                description: '照明操作',
              },
            },
          ],
          user_roles: [{ role: 'staff' }],
        },
        {
          id: 'staff-2',
          name: 'Test Staff 2',
          email: 'staff2@example.com',
          active: true,
          staff_skills: [
            {
              skill_id: 2,
              proficiency_level: 5,
              certified: true,
              skills: {
                id: 2,
                code: 'AUDIO',
                label: '音源再生',
                description: '音源再生マニピュレーター',
              },
            },
          ],
          user_roles: [{ role: 'admin' }],
        },
      ]

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-1', email: 'admin@example.com' } },
        error: null,
      })

      // Mock staff list query
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockStaffData,
            error: null,
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/admin/staff')

      // Act
      const response = await getStaffHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.staff).toHaveLength(2)
      expect(data.staff[0]).toEqual({
        id: 'staff-1',
        name: 'Test Staff 1',
        email: 'staff1@example.com',
        phone: '090-1234-5678',
        active: true,
        staff_skills: expect.any(Array),
        user_roles: [{ role: 'staff' }],
        skills: [
          {
            skill_id: 1,
            skill_code: 'PA',
            skill_label: 'PA',
            proficiency_level: 4,
            certified: true,
          },
          {
            skill_id: 3,
            skill_code: 'LIGHTING',
            skill_label: '照明',
            proficiency_level: 3,
            certified: false,
          },
        ],
        role: 'staff',
      })
    })

    it('should return 401 when not authenticated', async () => {
      // Arrange
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: createSupabaseError('Not authenticated'),
      })

      const request = new NextRequest('http://localhost:3000/api/admin/staff')

      // Act
      const response = await getStaffHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    it('should handle empty staff list', async () => {
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

      const request = new NextRequest('http://localhost:3000/api/admin/staff')

      // Act
      const response = await getStaffHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.staff).toEqual([])
    })
  })

  describe('POST /api/admin/staff', () => {
    it('should create new staff with skills (admin role)', async () => {
      // Arrange
      const newStaffData = {
        name: 'New Test Staff',
        email: 'newstaff@example.com',
        phone: '090-9876-5432',
        hourly_rate: 1500,
        active: true,
        skills: [
          {
            skill_id: 1,
            proficiency_level: 4,
            certified: true,
          },
          {
            skill_id: 2,
            proficiency_level: 3,
            certified: false,
          },
        ],
      }

      // Mock authenticated admin user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'admin-user-1' } },
        error: null,
      })

      // Mock admin role check
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                user_roles: [{ role: 'admin' }],
              },
              error: null,
            }),
          }),
        }),
      })

      // Mock staff creation
      const createdStaff = {
        id: 'new-staff-id',
        name: 'New Test Staff',
        email: 'newstaff@example.com',
        phone: '090-9876-5432',
        hourly_rate: 1500,
        active: true,
      }

      mockSupabaseClient.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: createdStaff,
              error: null,
            }),
          }),
        }),
      })

      // Mock skills insertion
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      })

      // Mock return staff with skills
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                ...createdStaff,
                staff_skills: [
                  {
                    skill_id: 1,
                    proficiency_level: 4,
                    certified: true,
                    skills: { id: 1, code: 'PA', label: 'PA' },
                  },
                ],
              },
              error: null,
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify(newStaffData),
      })

      // Act
      const response = await createStaffHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data.staff).toEqual(
        expect.objectContaining({
          id: 'new-staff-id',
          name: 'New Test Staff',
          email: 'newstaff@example.com',
          staff_skills: expect.any(Array),
        })
      )
    })

    it('should return 403 for non-admin/manager users', async () => {
      // Arrange
      const newStaffData = {
        name: 'New Test Staff',
        email: 'newstaff@example.com',
      }

      // Mock authenticated staff user (not admin/manager)
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'staff-user-1' } },
        error: null,
      })

      // Mock staff role check
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                user_roles: [{ role: 'staff' }],
              },
              error: null,
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify(newStaffData),
      })

      // Act
      const response = await createStaffHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(403)
      expect(data).toEqual({ error: 'Permission denied' })
    })

    it('should return 400 for invalid input data', async () => {
      // Arrange
      const invalidData = {
        name: '', // Empty name should fail validation
        email: 'invalid-email', // Invalid email format
      }

      // Mock authenticated admin user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'admin-user-1' } },
        error: null,
      })

      const request = new NextRequest('http://localhost:3000/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      })

      // Act
      const response = await createStaffHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data).toEqual(
        expect.objectContaining({
          error: 'Invalid request data',
          details: expect.any(Array),
        })
      )
    })

    it('should handle manager role permissions', async () => {
      // Arrange
      const newStaffData = {
        name: 'Manager Created Staff',
        email: 'manager-created@example.com',
      }

      // Mock authenticated manager user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'manager-user-1' } },
        error: null,
      })

      // Mock manager role check
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                user_roles: [{ role: 'manager' }],
              },
              error: null,
            }),
          }),
        }),
      })

      // Mock staff creation
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'manager-staff-id',
                name: 'Manager Created Staff',
                email: 'manager-created@example.com',
              },
              error: null,
            }),
          }),
        }),
      })

      // Mock return staff
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'manager-staff-id',
                name: 'Manager Created Staff',
                email: 'manager-created@example.com',
                staff_skills: [],
              },
              error: null,
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify(newStaffData),
      })

      // Act
      const response = await createStaffHandler(request)

      // Assert
      expect(response.status).toBe(201)
    })
  })

  describe('Skills management in staff operations', () => {
    it('should handle staff with multiple skills correctly', async () => {
      // Arrange
      const staffWithMultipleSkills = {
        name: 'Multi-Skill Staff',
        email: 'multiskill@example.com',
        skills: [
          { skill_id: 1, proficiency_level: 5, certified: true }, // PA
          { skill_id: 2, proficiency_level: 4, certified: true }, // 音源再生
          { skill_id: 3, proficiency_level: 3, certified: false }, // 照明
          { skill_id: 4, proficiency_level: 2, certified: false }, // バックヤード
        ],
      }

      // Mock authenticated admin
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'admin-user-1' } },
        error: null,
      })

      // Mock admin role check
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { user_roles: [{ role: 'admin' }] },
              error: null,
            }),
          }),
        }),
      })

      // Mock staff creation
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'multi-skill-staff-id', ...staffWithMultipleSkills },
              error: null,
            }),
          }),
        }),
      })

      // Mock skills insertion
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      })

      // Mock return with skills
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'multi-skill-staff-id',
                name: 'Multi-Skill Staff',
                staff_skills: staffWithMultipleSkills.skills.map((skill, index) => ({
                  ...skill,
                  skills: {
                    id: skill.skill_id,
                    code: ['PA', 'AUDIO', 'LIGHTING', 'BACKYARD'][index],
                    label: ['PA', '音源再生', '照明', 'バックヤード'][index],
                  },
                })),
              },
              error: null,
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify(staffWithMultipleSkills),
      })

      // Act
      const response = await createStaffHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data.staff.staff_skills).toHaveLength(4)

      // Verify skill insertion was called with correct data
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('staff_skills')
    })

    it('should validate skill proficiency levels (1-5)', async () => {
      // Arrange
      const invalidSkillData = {
        name: 'Test Staff',
        email: 'test@example.com',
        skills: [
          { skill_id: 1, proficiency_level: 6, certified: true }, // Invalid: > 5
          { skill_id: 2, proficiency_level: 0, certified: false }, // Invalid: < 1
        ],
      }

      const request = new NextRequest('http://localhost:3000/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify(invalidSkillData),
      })

      // Act
      const response = await createStaffHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request data')
      expect(data.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.arrayContaining(['skills', 0, 'proficiency_level']),
          }),
          expect.objectContaining({
            path: expect.arrayContaining(['skills', 1, 'proficiency_level']),
          }),
        ])
      )
    })
  })
})