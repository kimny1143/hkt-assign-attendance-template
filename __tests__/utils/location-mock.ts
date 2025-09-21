import { jest } from '@jest/globals'

// HKT48劇場の座標
export const HKT48_THEATER_COORDS = {
  latitude: 33.5904,
  longitude: 130.4017,
}

// 300m圏内の座標（テスト用）
export const WITHIN_RANGE_COORDS = {
  latitude: 33.5924, // 約220m北
  longitude: 130.4017,
}

// 300m圏外の座標（テスト用）
export const OUT_OF_RANGE_COORDS = {
  latitude: 33.5954, // 約550m北
  longitude: 130.4017,
}

// Mock geolocation API
export const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}

// Setup successful geolocation mock
export const mockGeolocationSuccess = (coords = HKT48_THEATER_COORDS) => {
  mockGeolocation.getCurrentPosition.mockImplementation((success) => {
    success({
      coords: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    })
  })
}

// Setup geolocation error mock
export const mockGeolocationError = (code = 1, message = 'User denied Geolocation') => {
  mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
    error({
      code,
      message,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    })
  })
}

// Helper to calculate distance between two points (Haversine formula)
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

// Test helper to verify if coordinates are within range
export const isWithinRange = (
  userLat: number,
  userLng: number,
  venueLat: number,
  venueLng: number,
  range = 300
): boolean => {
  const distance = calculateDistance(userLat, userLng, venueLat, venueLng)
  return distance <= range
}

// Reset geolocation mocks
export const resetGeolocationMocks = () => {
  mockGeolocation.getCurrentPosition.mockClear()
  mockGeolocation.watchPosition.mockClear()
  mockGeolocation.clearWatch.mockClear()
}

// Setup global geolocation mock
export const setupGeolocationMock = () => {
  Object.defineProperty(global.navigator, 'geolocation', {
    value: mockGeolocation,
    writable: true,
  })
}