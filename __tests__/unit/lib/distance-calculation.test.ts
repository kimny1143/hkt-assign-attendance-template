import { calculateDistance, isWithinRange } from '@/__tests__/utils/location-mock'

describe('Distance Calculation Functions', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two GPS coordinates accurately', () => {
      // HKT48 Theater coordinates
      const lat1 = 33.5904
      const lon1 = 130.4017
      
      // Point approximately 220m away
      const lat2 = 33.5924
      const lon2 = 130.4017
      
      const distance = calculateDistance(lat1, lon1, lat2, lon2)
      
      // Should be approximately 220m (±10m tolerance for precision)
      expect(distance).toBeGreaterThan(210)
      expect(distance).toBeLessThan(230)
    })

    it('should return 0 for identical coordinates', () => {
      const lat = 33.5904
      const lon = 130.4017
      
      const distance = calculateDistance(lat, lon, lat, lon)
      
      expect(distance).toBe(0)
    })

    it('should handle large distances correctly', () => {
      // Tokyo to Fukuoka (approximately 880km)
      const tokyoLat = 35.6762
      const tokyoLon = 139.6503
      const fukuokaLat = 33.5904
      const fukuokaLon = 130.4017
      
      const distance = calculateDistance(tokyoLat, tokyoLon, fukuokaLat, fukuokaLon)
      
      // Should be roughly 880,000m (±50km tolerance)
      expect(distance).toBeGreaterThan(830000)
      expect(distance).toBeLessThan(930000)
    })

    it('should handle negative coordinates', () => {
      const lat1 = -33.8688
      const lon1 = 151.2093
      const lat2 = -33.8698
      const lon2 = 151.2103
      
      const distance = calculateDistance(lat1, lon1, lat2, lon2)
      
      expect(distance).toBeGreaterThan(0)
      expect(distance).toBeLessThan(200) // Should be a small distance
    })
  })

  describe('isWithinRange', () => {
    const centerLat = 33.5904
    const centerLon = 130.4017

    it('should return true for coordinates within range', () => {
      // Point 200m away (within 300m range)
      const testLat = 33.5922
      const testLon = 130.4017
      
      const result = isWithinRange(testLat, testLon, centerLat, centerLon, 300)
      
      expect(result).toBe(true)
    })

    it('should return false for coordinates outside range', () => {
      // Point 500m away (outside 300m range)
      const testLat = 33.5949
      const testLon = 130.4017
      
      const result = isWithinRange(testLat, testLon, centerLat, centerLon, 300)
      
      expect(result).toBe(false)
    })

    it('should handle edge case at exactly the range boundary', () => {
      // Point approximately 299.9m away (just under 300m)
      const testLat = 33.59309
      const testLon = 130.4017

      const result = isWithinRange(testLat, testLon, centerLat, centerLon, 300)

      // At the boundary, should return true (inclusive)
      expect(result).toBe(true)
    })

    it('should return true for identical coordinates', () => {
      const result = isWithinRange(centerLat, centerLon, centerLat, centerLon, 300)
      
      expect(result).toBe(true)
    })

    it('should handle different range values', () => {
      const testLat = 33.5922
      const testLon = 130.4017
      
      // Should be within 500m but not within 100m
      expect(isWithinRange(testLat, testLon, centerLat, centerLon, 500)).toBe(true)
      expect(isWithinRange(testLat, testLon, centerLat, centerLon, 100)).toBe(false)
    })
  })
})