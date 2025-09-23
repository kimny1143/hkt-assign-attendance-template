/**
 * Haversine formula for GPS distance calculation
 * Calculates the distance between two GPS coordinates in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3 // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c // Distance in meters
}

/**
 * Check if a coordinate is within a specified range from a center point
 * @param testLat Latitude to test
 * @param testLon Longitude to test
 * @param centerLat Center point latitude
 * @param centerLon Center point longitude
 * @param rangeInMeters Maximum allowed distance in meters
 * @returns true if within range (inclusive), false otherwise
 */
export function isWithinRange(
  testLat: number,
  testLon: number,
  centerLat: number,
  centerLon: number,
  rangeInMeters: number
): boolean {
  const distance = calculateDistance(testLat, testLon, centerLat, centerLon)
  return distance <= rangeInMeters // <= for inclusive boundary
}