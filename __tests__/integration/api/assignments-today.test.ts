import { NextRequest } from 'next/server'
import { GET as todayAssignmentsHandler } from '@/app/api/assignments/today/route'
import { mockSupabaseClient, resetSupabaseMocks, createSupabaseError } from '@/__tests__/utils/supabase-mock'

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}))

// Mock Next.js cookies
const mockCookies = {
  get: jest.fn(() => ({ value: 'mock-session-cookie' })),
  set: jest.fn(),
  remove: jest.fn(),
}

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => mockCookies),
}))

// Mock createServerClient
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => mockSupabaseClient),
}))

describe('/api/assignments/today', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    jest.clearAllMocks()
  })

  describe('GET /api/assignments/today', () => {
    it('should return today\'s assignments for authenticated user', async () => {
      // Arrange
      const mockUserId = 'user-123'
      const mockAssignments = [
        {
          assignment_id: 'assign-1',
          assignment_status: 'confirmed',
          shift_id: 'shift-1',
          shift_start_jst: '2025-01-24T10:00:00+09:00',
          shift_end_jst: '2025-01-24T18:00:00+09:00',
          event_name: 'HKT48劇場公演',
          venue_name: 'HKT48劇場',
          venue_address: '福岡・BOSS E・ZO FUKUOKA内',
          work_status: 'pending',
          work_hours: 8,
        },
        {
          assignment_id: 'assign-2',
          assignment_status: 'confirmed',
          shift_id: 'shift-2',
          shift_start_jst: '2025-01-24T19:00:00+09:00',
          shift_end_jst: '2025-01-24T21:00:00+09:00',
          event_name: '特別イベント',
          venue_name: 'HKT48劇場',
          venue_address: '福岡・BOSS E・ZO FUKUOKA内',
          work_status: 'pending',
          work_hours: 2,
        },
      ]

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: mockUserId,
            email: 'staff@example.com',
            user_metadata: {},
            app_metadata: { role: 'staff' }
          }
        },
        error: null,
      })

      // Mock RPC call to get_user_today_assignments
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: mockAssignments,
        error: null,
      })

      // Act
      const response = await todayAssignmentsHandler()
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toHaveProperty('assignments')
      expect(data.assignments).toHaveLength(2)

      // Verify the first assignment structure
      expect(data.assignments[0]).toEqual({
        id: 'assign-1',
        status: 'confirmed',
        shifts: {
          id: 'shift-1',
          start_at: '2025-01-24T10:00:00+09:00',
          end_at: '2025-01-24T18:00:00+09:00',
          events: {
            id: null,
            name: 'HKT48劇場公演',
            venues: {
              id: null,
              name: 'HKT48劇場',
              address: '福岡・BOSS E・ZO FUKUOKA内',
            },
          },
        },
        work_status: 'pending',
        work_hours: 8,
      })

      // Verify RPC was called with correct parameters
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_user_today_assignments', {
        p_user_id: mockUserId,
      })
    })

    it('should return empty array when no assignments found', async () => {
      // Arrange
      const mockUserId = 'user-123'

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: mockUserId,
            email: 'staff@example.com',
            user_metadata: {},
            app_metadata: { role: 'staff' }
          }
        },
        error: null,
      })

      // Mock RPC call returning empty array
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      })

      // Act
      const response = await todayAssignmentsHandler()
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toHaveProperty('assignments')
      expect(data.assignments).toEqual([])
    })

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange - Mock unauthenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: createSupabaseError('Not authenticated'),
      })

      // Act
      const response = await todayAssignmentsHandler()
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      const mockUserId = 'user-123'

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: mockUserId,
            email: 'staff@example.com',
            user_metadata: {},
            app_metadata: { role: 'staff' }
          }
        },
        error: null,
      })

      // Mock RPC call with error
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: createSupabaseError('Database connection failed'),
      })

      // Act
      const response = await todayAssignmentsHandler()
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Database connection failed')
    })

    it('should handle assignments with different statuses', async () => {
      // Arrange
      const mockUserId = 'user-123'
      const mockAssignments = [
        {
          assignment_id: 'assign-1',
          assignment_status: 'confirmed',
          shift_id: 'shift-1',
          shift_start_jst: '2025-01-24T10:00:00+09:00',
          shift_end_jst: '2025-01-24T12:00:00+09:00',
          event_name: '午前の部',
          venue_name: 'HKT48劇場',
          venue_address: '福岡・BOSS E・ZO FUKUOKA内',
          work_status: 'completed',
          work_hours: 2,
        },
        {
          assignment_id: 'assign-2',
          assignment_status: 'tentative',
          shift_id: 'shift-2',
          shift_start_jst: '2025-01-24T13:00:00+09:00',
          shift_end_jst: '2025-01-24T15:00:00+09:00',
          event_name: '午後の部',
          venue_name: 'HKT48劇場',
          venue_address: '福岡・BOSS E・ZO FUKUOKA内',
          work_status: 'in_progress',
          work_hours: 2,
        },
        {
          assignment_id: 'assign-3',
          assignment_status: 'cancelled',
          shift_id: 'shift-3',
          shift_start_jst: '2025-01-24T16:00:00+09:00',
          shift_end_jst: '2025-01-24T18:00:00+09:00',
          event_name: '夕方の部',
          venue_name: 'HKT48劇場',
          venue_address: '福岡・BOSS E・ZO FUKUOKA内',
          work_status: 'cancelled',
          work_hours: 0,
        },
      ]

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: mockUserId,
            email: 'staff@example.com',
            user_metadata: {},
            app_metadata: { role: 'staff' }
          }
        },
        error: null,
      })

      // Mock RPC call
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: mockAssignments,
        error: null,
      })

      // Act
      const response = await todayAssignmentsHandler()
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.assignments).toHaveLength(3)

      // Verify different statuses
      expect(data.assignments[0].status).toBe('confirmed')
      expect(data.assignments[0].work_status).toBe('completed')

      expect(data.assignments[1].status).toBe('tentative')
      expect(data.assignments[1].work_status).toBe('in_progress')

      expect(data.assignments[2].status).toBe('cancelled')
      expect(data.assignments[2].work_status).toBe('cancelled')
    })
  })
})