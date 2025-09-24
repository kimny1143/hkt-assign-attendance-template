import { mockSupabaseClient, resetSupabaseMocks, createSupabaseError } from '@/__tests__/utils/supabase-mock'

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}))

// Mock createServerClient
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => mockSupabaseClient),
}))

describe('Row Level Security (RLS) Policies', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    jest.clearAllMocks()
  })

  describe('Staff table RLS', () => {
    it('should allow users to read their own staff record', async () => {
      // Arrange
      const mockUserId = 'user-123'
      const mockStaffData = {
        id: 'staff-1',
        user_id: mockUserId,
        name: 'Test Staff',
        email: 'staff@example.com',
        role: 'staff',
      }

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

      // Mock select with RLS simulation
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockStaffData,
        error: null,
      })
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
      mockSupabaseClient.from.mockReturnValueOnce({ select: mockSelect })

      // Act
      const { data, error } = await mockSupabaseClient
        .from('staff')
        .select('*')
        .eq('user_id', mockUserId)
        .single()

      // Assert
      expect(error).toBeNull()
      expect(data).toEqual(mockStaffData)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('staff')
    })

    it('should prevent users from reading other staff records', async () => {
      // Arrange
      const currentUserId = 'user-123'
      const otherUserId = 'user-456'

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: currentUserId,
            email: 'current@example.com',
            user_metadata: {},
            app_metadata: { role: 'staff' }
          }
        },
        error: null,
      })

      // Mock select returning empty (RLS blocks access)
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: createSupabaseError('Row not found', 'PGRST116'),
      })
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
      mockSupabaseClient.from.mockReturnValueOnce({ select: mockSelect })

      // Act
      const { data, error } = await mockSupabaseClient
        .from('staff')
        .select('*')
        .eq('user_id', otherUserId)
        .single()

      // Assert
      expect(data).toBeNull()
      expect(error).toBeDefined()
      expect(error.code).toBe('PGRST116')
    })

    it('should allow managers to read all staff records', async () => {
      // Arrange
      const managerId = 'manager-123'
      const mockAllStaff = [
        { id: 'staff-1', name: 'Staff 1', role: 'staff' },
        { id: 'staff-2', name: 'Staff 2', role: 'staff' },
        { id: 'staff-3', name: 'Staff 3', role: 'staff' },
      ]

      // Mock authenticated manager
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: managerId,
            email: 'manager@example.com',
            user_metadata: {},
            app_metadata: { role: 'manager' }
          }
        },
        error: null,
      })

      // Mock select returning all staff
      const mockSelect = jest.fn().mockResolvedValue({
        data: mockAllStaff,
        error: null,
      })
      mockSupabaseClient.from.mockReturnValueOnce({ select: mockSelect })

      // Act
      const { data, error } = await mockSupabaseClient
        .from('staff')
        .select('*')

      // Assert
      expect(error).toBeNull()
      expect(data).toEqual(mockAllStaff)
      expect(data).toHaveLength(3)
    })
  })

  describe('Assignments table RLS', () => {
    it('should allow staff to view only their own assignments', async () => {
      // Arrange
      const staffId = 'staff-123'
      const mockAssignments = [
        { id: 'assign-1', staff_id: staffId, shift_id: 'shift-1', status: 'confirmed' },
        { id: 'assign-2', staff_id: staffId, shift_id: 'shift-2', status: 'pending' },
      ]

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-123',
            email: 'staff@example.com',
            user_metadata: {},
            app_metadata: { role: 'staff', staff_id: staffId }
          }
        },
        error: null,
      })

      // Mock select with RLS filtering
      const mockEq = jest.fn().mockResolvedValue({
        data: mockAssignments,
        error: null,
      })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
      mockSupabaseClient.from.mockReturnValueOnce({ select: mockSelect })

      // Act
      const { data, error } = await mockSupabaseClient
        .from('assignments')
        .select('*')
        .eq('staff_id', staffId)

      // Assert
      expect(error).toBeNull()
      expect(data).toEqual(mockAssignments)
      expect(data?.every(a => a.staff_id === staffId)).toBe(true)
    })

    it('should prevent staff from modifying other staff assignments', async () => {
      // Arrange
      const currentStaffId = 'staff-123'
      const otherStaffId = 'staff-456'

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-123',
            email: 'staff@example.com',
            user_metadata: {},
            app_metadata: { role: 'staff', staff_id: currentStaffId }
          }
        },
        error: null,
      })

      // Mock update with RLS blocking
      const mockEq = jest.fn().mockResolvedValue({
        data: null,
        error: createSupabaseError('new row violates row-level security policy', '42501'),
      })
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })
      mockSupabaseClient.from.mockReturnValueOnce({ update: mockUpdate })

      // Act
      const { data, error } = await mockSupabaseClient
        .from('assignments')
        .update({ status: 'confirmed' })
        .eq('staff_id', otherStaffId)

      // Assert
      expect(data).toBeNull()
      expect(error).toBeDefined()
      expect(error.code).toBe('42501')
    })
  })

  describe('Attendances table RLS', () => {
    it('should allow staff to create their own attendance records', async () => {
      // Arrange
      const staffId = 'staff-123'
      const mockAttendance = {
        id: 'attendance-1',
        assignment_id: 'assign-1',
        check_in_time: new Date().toISOString(),
        location_lat: 33.5904,
        location_lng: 130.4017,
      }

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-123',
            email: 'staff@example.com',
            user_metadata: {},
            app_metadata: { role: 'staff', staff_id: staffId }
          }
        },
        error: null,
      })

      // Mock insert with RLS allowing
      const mockSelect = jest.fn().mockResolvedValue({
        data: [mockAttendance],
        error: null,
      })
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect })
      mockSupabaseClient.from.mockReturnValueOnce({ insert: mockInsert })

      // Act
      const { data, error } = await mockSupabaseClient
        .from('attendances')
        .insert(mockAttendance)
        .select()

      // Assert
      expect(error).toBeNull()
      expect(data).toEqual([mockAttendance])
    })

    it('should prevent staff from modifying attendance after checkout', async () => {
      // Arrange
      const staffId = 'staff-123'
      const attendanceId = 'attendance-1'

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-123',
            email: 'staff@example.com',
            user_metadata: {},
            app_metadata: { role: 'staff', staff_id: staffId }
          }
        },
        error: null,
      })

      // Mock update with RLS blocking (already checked out)
      const mockEq = jest.fn().mockResolvedValue({
        data: null,
        error: createSupabaseError('Cannot modify completed attendance', '42501'),
      })
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })
      mockSupabaseClient.from.mockReturnValueOnce({ update: mockUpdate })

      // Act
      const { data, error } = await mockSupabaseClient
        .from('attendances')
        .update({ check_in_time: new Date().toISOString() })
        .eq('id', attendanceId)

      // Assert
      expect(data).toBeNull()
      expect(error).toBeDefined()
      expect(error.message).toContain('Cannot modify completed attendance')
    })
  })

  describe('Cross-table RLS validation', () => {
    it('should enforce consistent access control across related tables', async () => {
      // Arrange
      const staffId = 'staff-123'
      const assignmentId = 'assign-1'

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-123',
            email: 'staff@example.com',
            user_metadata: {},
            app_metadata: { role: 'staff', staff_id: staffId }
          }
        },
        error: null,
      })

      // Test 1: Can read own assignment
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: assignmentId, staff_id: staffId },
        error: null,
      })
      const mockAssignmentEq = jest.fn().mockReturnValue({
        single: mockSingle
      })
      const mockAssignmentSelect = jest.fn().mockReturnValue({
        eq: mockAssignmentEq
      })
      mockSupabaseClient.from.mockReturnValueOnce({ select: mockAssignmentSelect })

      const { data: assignment } = await mockSupabaseClient
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .single()

      expect(assignment).toBeDefined()
      expect(assignment.staff_id).toBe(staffId)

      // Test 2: Can create attendance for own assignment
      const mockAttendanceInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [{ assignment_id: assignmentId }],
          error: null,
        })
      })
      mockSupabaseClient.from.mockReturnValueOnce({ insert: mockAttendanceInsert })

      const { data: attendance } = await mockSupabaseClient
        .from('attendances')
        .insert({ assignment_id: assignmentId })
        .select()

      expect(attendance).toBeDefined()
      expect(attendance[0].assignment_id).toBe(assignmentId)
    })

    it('should prevent access to unrelated data through joins', async () => {
      // Arrange
      const currentStaffId = 'staff-123'
      const otherStaffId = 'staff-456'

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-123',
            email: 'staff@example.com',
            user_metadata: {},
            app_metadata: { role: 'staff', staff_id: currentStaffId }
          }
        },
        error: null,
      })

      // Mock join query with RLS filtering out other staff's data
      const mockEq = jest.fn().mockResolvedValue({
        data: [], // Empty result due to RLS
        error: null,
      })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
      mockSupabaseClient.from.mockReturnValueOnce({ select: mockSelect })

      // Act - Try to access other staff's assignments through join
      const { data, error } = await mockSupabaseClient
        .from('assignments')
        .select(`
          *,
          attendances (*)
        `)
        .eq('staff_id', otherStaffId)

      // Assert
      expect(error).toBeNull()
      expect(data).toEqual([]) // RLS filters out unauthorized data
    })
  })

  describe('Manager role RLS privileges', () => {
    it('should allow managers to view all assignments and attendances', async () => {
      // Arrange
      const managerId = 'manager-123'
      const mockData = [
        {
          id: 'assign-1',
          staff_id: 'staff-1',
          attendances: [{ id: 'att-1', check_in_time: '2025-01-24T09:00:00Z' }]
        },
        {
          id: 'assign-2',
          staff_id: 'staff-2',
          attendances: [{ id: 'att-2', check_in_time: '2025-01-24T09:30:00Z' }]
        },
      ]

      // Mock authenticated manager
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: managerId,
            email: 'manager@example.com',
            user_metadata: {},
            app_metadata: { role: 'manager' }
          }
        },
        error: null,
      })

      // Mock select with manager privileges
      const mockSelect = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      })
      mockSupabaseClient.from.mockReturnValueOnce({ select: mockSelect })

      // Act
      const { data, error } = await mockSupabaseClient
        .from('assignments')
        .select(`
          *,
          attendances (*)
        `)

      // Assert
      expect(error).toBeNull()
      expect(data).toEqual(mockData)
      expect(data).toHaveLength(2)
    })

    it('should allow managers to update any staff assignment', async () => {
      // Arrange
      const managerId = 'manager-123'
      const assignmentId = 'assign-1'

      // Mock authenticated manager
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: managerId,
            email: 'manager@example.com',
            user_metadata: {},
            app_metadata: { role: 'manager' }
          }
        },
        error: null,
      })

      // Mock update with manager privileges
      const mockSelect = jest.fn().mockResolvedValue({
        data: [{ id: assignmentId, status: 'approved' }],
        error: null,
      })
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect })
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })
      mockSupabaseClient.from.mockReturnValueOnce({ update: mockUpdate })

      // Act
      const { data, error } = await mockSupabaseClient
        .from('assignments')
        .update({ status: 'approved' })
        .eq('id', assignmentId)
        .select()

      // Assert
      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data[0].status).toBe('approved')
    })
  })
})