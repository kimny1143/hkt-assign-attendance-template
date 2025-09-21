import { NextRequest } from 'next/server'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { GET as meHandler } from '@/app/api/auth/me/route'
import { POST as logoutHandler } from '@/app/api/auth/logout/route'
import { mockSupabaseClient, resetSupabaseMocks, createSupabaseError } from '@/__tests__/utils/supabase-mock'

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}))

describe('/api/auth', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  describe('POST /api/auth/login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      const requestBody = {
        email: 'test@example.com',
        password: 'password123',
      }

      // Mock successful auth
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
          },
          session: {
            access_token: 'token',
            refresh_token: 'refresh',
          },
        },
        error: null,
      })

      // Mock staff lookup
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'staff-1',
                name: 'Test Staff',
              },
              error: null,
            }),
          }),
        }),
      })

      // Mock role lookup
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                role: 'admin',
              },
              error: null,
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })

      // Act
      const response = await loginHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toEqual({
        user: {
          id: 'staff-1',
          name: 'Test Staff',
          email: 'test@example.com',
          role: 'admin',
        },
        role: 'admin',
      })
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })

    it('should return 401 for invalid credentials', async () => {
      // Arrange
      const requestBody = {
        email: 'test@example.com',
        password: 'wrongpassword',
      }

      // Mock auth error
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: createSupabaseError('Invalid credentials', 'invalid_credentials'),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })

      // Act
      const response = await loginHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data).toEqual({
        error: 'メールアドレスまたはパスワードが正しくありません',
      })
    })

    it('should return 400 for invalid input data', async () => {
      // Arrange
      const requestBody = {
        email: 'invalid-email',
        password: '123', // Too short
      }

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })

      // Act
      const response = await loginHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data).toEqual({
        error: '入力データが正しくありません',
      })
    })

    it('should return 404 when staff record not found', async () => {
      // Arrange
      const requestBody = {
        email: 'test@example.com',
        password: 'password123',
      }

      // Mock successful auth but no staff record
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
          },
          session: {
            access_token: 'token',
            refresh_token: 'refresh',
          },
        },
        error: null,
      })

      // Mock staff lookup error
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: createSupabaseError('No staff record found'),
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })

      // Act
      const response = await loginHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(data).toEqual({
        error: 'ユーザー情報が見つかりません',
      })
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return current user info when authenticated', async () => {
      // Arrange
      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
          },
        },
        error: null,
      })

      // Mock staff lookup
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'staff-1',
                name: 'Test Staff',
              },
              error: null,
            }),
          }),
        }),
      })

      // Mock role lookup
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                role: 'staff',
              },
              error: null,
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/me')

      // Act
      const response = await meHandler()
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toEqual({
        user: {
          id: 'staff-1',
          name: 'Test Staff',
          email: 'test@example.com',
          role: 'staff',
        },
      })
    })

    it('should return 401 when not authenticated', async () => {
      // Arrange
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: createSupabaseError('Not authenticated'),
      })

      // Act
      const response = await meHandler()
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data).toEqual({
        error: '認証が必要です',
      })
    })

    it('should return default role when no role record found', async () => {
      // Arrange
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
          },
        },
        error: null,
      })

      // Mock staff lookup
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'staff-1',
                name: 'Test Staff',
              },
              error: null,
            }),
          }),
        }),
      })

      // Mock role lookup with no data
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: createSupabaseError('No role found'),
            }),
          }),
        }),
      })

      // Act
      const response = await meHandler()
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.user.role).toBe('staff') // Default role
    })
  })

  describe('Role-based access control', () => {
    const roles = ['admin', 'manager', 'staff']

    roles.forEach((role) => {
      it(`should handle ${role} role correctly`, async () => {
        // Arrange
        mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
          data: {
            user: {
              id: 'user-1',
              email: `${role}@example.com`,
            },
          },
          error: null,
        })

        mockSupabaseClient.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'staff-1',
                  name: `Test ${role}`,
                },
                error: null,
              }),
            }),
          }),
        })

        mockSupabaseClient.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { role },
                error: null,
              }),
            }),
          }),
        })

        // Act
        const response = await meHandler()
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.user.role).toBe(role)
      })
    })
  })
})