import { NextRequest } from 'next/server'
import { POST as punchHandler } from '@/app/api/attendance/punch/route'
import { mockSupabaseClient, resetSupabaseMocks, createSupabaseError } from '@/__tests__/utils/supabase-mock'
import {
  HKT48_THEATER_COORDS,
  WITHIN_RANGE_COORDS,
  OUT_OF_RANGE_COORDS,
  calculateDistance,
  isWithinRange,
} from '@/__tests__/utils/location-mock'

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

describe('/api/attendance/punch', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    jest.clearAllMocks()
  })

  describe('GPS + QR Code Validation', () => {
    it('should successfully punch when GPS is within range and QR is valid', async () => {
      // Arrange
      const validPunchData = {
        equipment_qr: 'VALID-QR-12345',
        lat: WITHIN_RANGE_COORDS.latitude,
        lon: WITHIN_RANGE_COORDS.longitude,
        purpose: 'checkin' as const,
      }

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'staff-user-1', email: 'staff@example.com' } },
        error: null,
      })

      // Mock equipment lookup with venue coordinates
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'equipment-1',
                  venue_id: 'venue-1',
                  name: 'PA Console',
                  venues: {
                    id: 'venue-1',
                    lat: HKT48_THEATER_COORDS.latitude,
                    lon: HKT48_THEATER_COORDS.longitude,
                  },
                },
                error: null,
              }),
            }),
          }),
        }),
      })

      // Mock shift lookup for today
      const today = new Date().toISOString().split('T')[0]
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'shift-1',
                    events: { venue_id: 'venue-1' },
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      })

      // Mock attendance_punch RPC
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: {
          attendance_id: 'attendance-1',
          action: 'checkin',
          timestamp: new Date().toISOString(),
        },
        error: null,
      })

      const request = new NextRequest('http://localhost:3000/api/attendance/punch', {
        method: 'POST',
        body: JSON.stringify(validPunchData),
      })

      // Act
      const response = await punchHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toEqual({
        ok: true,
        attendance: {
          attendance_id: 'attendance-1',
          action: 'checkin',
          timestamp: expect.any(String),
        },
      })

      // Verify RPC was called with correct parameters
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('attendance_punch', {
        p_staff_uid: 'staff-user-1',
        p_shift_id: 'shift-1',
        p_equipment_qr: 'VALID-QR-12345',
        p_lat: WITHIN_RANGE_COORDS.latitude,
        p_lon: WITHIN_RANGE_COORDS.longitude,
        p_purpose: 'checkin',
      })
    })

    it('should reject punch when GPS is out of range (>300m)', async () => {
      // Arrange
      const outOfRangePunchData = {
        equipment_qr: 'VALID-QR-12345',
        lat: OUT_OF_RANGE_COORDS.latitude,
        lon: OUT_OF_RANGE_COORDS.longitude,
        purpose: 'checkin' as const,
      }

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'staff-user-1' } },
        error: null,
      })

      // Mock equipment lookup
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'equipment-1',
                  venue_id: 'venue-1',
                  name: 'PA Console',
                  venues: {
                    id: 'venue-1',
                    lat: HKT48_THEATER_COORDS.latitude,
                    lon: HKT48_THEATER_COORDS.longitude,
                  },
                },
                error: null,
              }),
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/attendance/punch', {
        method: 'POST',
        body: JSON.stringify(outOfRangePunchData),
      })

      // Act
      const response = await punchHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toMatch(/Too far from venue: \d+m/)

      // Verify distance calculation
      const distance = calculateDistance(
        OUT_OF_RANGE_COORDS.latitude,
        OUT_OF_RANGE_COORDS.longitude,
        HKT48_THEATER_COORDS.latitude,
        HKT48_THEATER_COORDS.longitude
      )
      expect(distance).toBeGreaterThan(300)
    })

    it('should reject punch with invalid QR code', async () => {
      // Arrange
      const invalidQRData = {
        equipment_qr: 'INVALID-QR-99999',
        lat: WITHIN_RANGE_COORDS.latitude,
        lon: WITHIN_RANGE_COORDS.longitude,
        purpose: 'checkin' as const,
      }

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'staff-user-1' } },
        error: null,
      })

      // Mock equipment lookup returning no data
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: createSupabaseError('Equipment not found'),
              }),
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/attendance/punch', {
        method: 'POST',
        body: JSON.stringify(invalidQRData),
      })

      // Act
      const response = await punchHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid QR code or equipment not found')
    })

    it('should reject punch when no shift found for today', async () => {
      // Arrange
      const punchData = {
        equipment_qr: 'VALID-QR-12345',
        lat: WITHIN_RANGE_COORDS.latitude,
        lon: WITHIN_RANGE_COORDS.longitude,
        purpose: 'checkin' as const,
      }

      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'staff-user-1' } },
        error: null,
      })

      // Mock equipment lookup
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'equipment-1',
                  venue_id: 'venue-1',
                  venues: HKT48_THEATER_COORDS,
                },
                error: null,
              }),
            }),
          }),
        }),
      })

      // Mock shift lookup returning no data
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: createSupabaseError('No shift found'),
                }),
              }),
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/attendance/punch', {
        method: 'POST',
        body: JSON.stringify(punchData),
      })

      // Act
      const response = await punchHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('No shift found for today at this venue')
    })
  })

  describe('Check-in and Check-out scenarios', () => {
    it('should handle check-in punch successfully', async () => {
      // Arrange - setup valid checkin scenario
      const checkinData = {
        equipment_qr: 'CHECKIN-QR-12345',
        lat: WITHIN_RANGE_COORDS.latitude,
        lon: WITHIN_RANGE_COORDS.longitude,
        purpose: 'checkin' as const,
      }

      await setupValidPunchScenario('checkin')

      const request = new NextRequest('http://localhost:3000/api/attendance/punch', {
        method: 'POST',
        body: JSON.stringify(checkinData),
      })

      // Act
      const response = await punchHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'attendance_punch',
        expect.objectContaining({
          p_purpose: 'checkin',
        })
      )
    })

    it('should handle check-out punch successfully', async () => {
      // Arrange - setup valid checkout scenario
      const checkoutData = {
        equipment_qr: 'CHECKOUT-QR-12345',
        lat: WITHIN_RANGE_COORDS.latitude,
        lon: WITHIN_RANGE_COORDS.longitude,
        purpose: 'checkout' as const,
      }

      await setupValidPunchScenario('checkout')

      const request = new NextRequest('http://localhost:3000/api/attendance/punch', {
        method: 'POST',
        body: JSON.stringify(checkoutData),
      })

      // Act
      const response = await punchHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'attendance_punch',
        expect.objectContaining({
          p_purpose: 'checkout',
        })
      )
    })
  })

  describe('Input validation', () => {
    it('should return 400 for invalid input data', async () => {
      // Arrange
      const invalidInputs = [
        { equipment_qr: '', lat: 90, lon: 180, purpose: 'checkin' }, // Empty QR
        { equipment_qr: 'QR123', lat: 91, lon: 180, purpose: 'checkin' }, // Invalid lat
        { equipment_qr: 'QR123', lat: 90, lon: 181, purpose: 'checkin' }, // Invalid lon
        { equipment_qr: 'QR123', lat: 90, lon: 180, purpose: 'invalid' }, // Invalid purpose
      ]

      for (const invalidData of invalidInputs) {
        const request = new NextRequest('http://localhost:3000/api/attendance/punch', {
          method: 'POST',
          body: JSON.stringify(invalidData),
        })

        // Act
        const response = await punchHandler(request)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(data.error).toBeDefined()
      }
    })

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange
      const punchData = {
        equipment_qr: 'QR123',
        lat: WITHIN_RANGE_COORDS.latitude,
        lon: WITHIN_RANGE_COORDS.longitude,
        purpose: 'checkin' as const,
      }

      // Mock unauthenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: createSupabaseError('Not authenticated'),
      })

      const request = new NextRequest('http://localhost:3000/api/attendance/punch', {
        method: 'POST',
        body: JSON.stringify(punchData),
      })

      // Act
      const response = await punchHandler(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('unauthorized')
    })
  })

  describe('GPS distance calculation accuracy', () => {
    it('should accurately calculate distance using Haversine formula', () => {
      // Test known distance calculations
      const testCases = [
        {
          from: HKT48_THEATER_COORDS,
          to: WITHIN_RANGE_COORDS,
          expectedRange: [200, 250], // Approximately 220m
        },
        {
          from: HKT48_THEATER_COORDS,
          to: OUT_OF_RANGE_COORDS,
          expectedRange: [540, 580], // Approximately 550m
        },
      ]

      testCases.forEach(({ from, to, expectedRange }) => {
        const distance = calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude)
        expect(distance).toBeGreaterThanOrEqual(expectedRange[0])
        expect(distance).toBeLessThanOrEqual(expectedRange[1])
      })
    })

    it('should correctly validate within 300m range', () => {
      // Test isWithinRange helper
      expect(
        isWithinRange(
          WITHIN_RANGE_COORDS.latitude,
          WITHIN_RANGE_COORDS.longitude,
          HKT48_THEATER_COORDS.latitude,
          HKT48_THEATER_COORDS.longitude,
          300
        )
      ).toBe(true)

      expect(
        isWithinRange(
          OUT_OF_RANGE_COORDS.latitude,
          OUT_OF_RANGE_COORDS.longitude,
          HKT48_THEATER_COORDS.latitude,
          HKT48_THEATER_COORDS.longitude,
          300
        )
      ).toBe(false)
    })

    it('should handle edge case at exactly 300m boundary', async () => {
      // Calculate coordinates exactly 300m away
      const exactly300mCoords = {
        latitude: HKT48_THEATER_COORDS.latitude + 0.0027, // Approximately 300m north
        longitude: HKT48_THEATER_COORDS.longitude,
      }

      const distance = calculateDistance(
        exactly300mCoords.latitude,
        exactly300mCoords.longitude,
        HKT48_THEATER_COORDS.latitude,
        HKT48_THEATER_COORDS.longitude
      )

      // Should be very close to 300m (within 10m tolerance for calculation precision)
      expect(distance).toBeGreaterThan(290)
      expect(distance).toBeLessThan(310)
    })
  })

  // Helper function to setup valid punch scenario
  async function setupValidPunchScenario(purpose: 'checkin' | 'checkout') {
    // Mock authenticated user
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'staff-user-1' } },
      error: null,
    })

    // Mock equipment lookup
    mockSupabaseClient.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'equipment-1',
                venue_id: 'venue-1',
                venues: HKT48_THEATER_COORDS,
              },
              error: null,
            }),
          }),
        }),
      }),
    })

    // Mock shift lookup
    mockSupabaseClient.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'shift-1', events: { venue_id: 'venue-1' } },
                error: null,
              }),
            }),
          }),
        }),
      }),
    })

    // Mock attendance_punch RPC
    mockSupabaseClient.rpc.mockResolvedValueOnce({
      data: {
        attendance_id: 'attendance-1',
        action: purpose,
        timestamp: new Date().toISOString(),
      },
      error: null,
    })
  }
})