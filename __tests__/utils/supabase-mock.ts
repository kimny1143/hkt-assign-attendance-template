import { jest } from '@jest/globals'

// Mock Supabase client
export const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(() =>
      Promise.resolve({
        data: {
          user: {
            id: 'mock-user-id',
            email: 'test@example.com',
            user_metadata: {},
            app_metadata: { role: 'staff' },
          },
        },
        error: null,
      })
    ),
    signInWithPassword: jest.fn(() =>
      Promise.resolve({
        data: {
          user: {
            id: 'mock-user-id',
            email: 'test@example.com',
          },
          session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
          },
        },
        error: null,
      })
    ),
    signOut: jest.fn(() =>
      Promise.resolve({
        error: null,
      })
    ),
    onAuthStateChange: jest.fn((callback: (event: string, session: any) => void) => {
      // Simulate auth state change
      callback('SIGNED_IN', {
        user: {
          id: 'mock-user-id',
          email: 'test@example.com',
        },
      })
      return {
        data: { subscription: { unsubscribe: jest.fn() } },
      }
    }),
  },
  from: jest.fn((table: string) => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() =>
          Promise.resolve({
            data: getMockData(table)[0],
            error: null,
          })
        ),
        data: getMockData(table),
        error: null,
      })),
      match: jest.fn(() => ({
        single: jest.fn(() =>
          Promise.resolve({
            data: getMockData(table)[0],
            error: null,
          })
        ),
        data: getMockData(table),
        error: null,
      })),
      data: getMockData(table),
      error: null,
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() =>
        Promise.resolve({
          data: [{ ...getMockData(table)[0], id: 'new-id' }],
          error: null,
        })
      ),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() =>
          Promise.resolve({
            data: [getMockData(table)[0]],
            error: null,
          })
        ),
      })),
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() =>
        Promise.resolve({
          data: null,
          error: null,
        })
      ),
    })),
  })),
  rpc: jest.fn((functionName: string, params?: any) => {
    switch (functionName) {
      case 'attendance_punch':
        return Promise.resolve({
          data: {
            success: true,
            attendance_id: 'attendance-1',
            message: 'Punch successful',
          },
          error: null,
        })
      default:
        return Promise.resolve({
          data: null,
          error: { message: 'Function not found' },
        })
    }
  }),
}

// Mock data for different tables
function getMockData(table: string) {
  switch (table) {
    case 'staff':
      return [
        {
          id: 'staff-1',
          name: 'Test Staff 1',
          email: 'staff1@example.com',
          role: 'staff',
          created_at: '2025-01-20T00:00:00Z',
        },
        {
          id: 'staff-2',
          name: 'Test Staff 2',
          email: 'staff2@example.com',
          role: 'staff',
          created_at: '2025-01-20T00:00:00Z',
        },
      ]
    case 'skills':
      return [
        { id: 'skill-1', name: 'PA', description: 'PA機材操作' },
        { id: 'skill-2', name: '音源再生', description: '音源再生マニピュレーター' },
        { id: 'skill-3', name: '照明', description: '照明操作' },
        { id: 'skill-4', name: 'バックヤード', description: 'バックヤード業務' },
      ]
    case 'staff_skills':
      return [
        {
          id: 'staff-skill-1',
          staff_id: 'staff-1',
          skill_id: 'skill-1',
          proficiency: 4,
          certified: true,
        },
        {
          id: 'staff-skill-2',
          staff_id: 'staff-1',
          skill_id: 'skill-3',
          proficiency: 3,
          certified: false,
        },
      ]
    case 'venues':
      return [
        {
          id: 'venue-1',
          name: 'HKT48劇場',
          address: '福岡・BOSS E・ZO FUKUOKA内',
          latitude: 33.5904,
          longitude: 130.4017,
        },
      ]
    case 'events':
      return [
        {
          id: 'event-1',
          title: 'Test Event',
          venue_id: 'venue-1',
          event_date: '2025-01-21',
          start_time: '13:00:00',
          end_time: '21:00:00',
        },
      ]
    case 'shifts':
      return [
        {
          id: 'shift-1',
          event_id: 'event-1',
          skill_id: 'skill-1',
          start_time: '13:00:00',
          end_time: '21:00:00',
          required_count: 1,
        },
      ]
    case 'assignments':
      return [
        {
          id: 'assignment-1',
          shift_id: 'shift-1',
          staff_id: 'staff-1',
          status: 'confirmed',
          is_reserve: false,
        },
      ]
    case 'attendances':
      return [
        {
          id: 'attendance-1',
          assignment_id: 'assignment-1',
          check_in_time: '2025-01-21T13:00:00Z',
          check_out_time: null,
          location_lat: 33.5904,
          location_lng: 130.4017,
        },
      ]
    case 'qr_tokens':
      return [
        {
          id: 'qr-1',
          shift_id: 'shift-1',
          token: 'mock-qr-token',
          purpose: 'checkin',
          expires_at: '2025-01-21T23:59:59Z',
        },
      ]
    case 'staff_schedules':
      return [
        {
          id: 'schedule-1',
          staff_id: 'staff-1',
          week_start: '2025-01-20',
          monday: true,
          tuesday: true,
          wednesday: false,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false,
        },
      ]
    default:
      return []
  }
}

// Helper to reset all mocks
export const resetSupabaseMocks = () => {
  Object.values(mockSupabaseClient.auth).forEach((method) => {
    if (jest.isMockFunction(method)) {
      method.mockClear()
    }
  })

  if (jest.isMockFunction(mockSupabaseClient.from)) {
    mockSupabaseClient.from.mockClear()
  }

  if (jest.isMockFunction(mockSupabaseClient.rpc)) {
    mockSupabaseClient.rpc.mockClear()
  }
}

// Helper to create mock errors
export const createSupabaseError = (message: string, code?: string) => ({
  message,
  code,
  details: null,
  hint: null,
})

// Helper to mock specific auth states
export const mockAuthState = (user: any = null, session: any = null) => {
  mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
    data: { user },
    error: null,
  })
}