import { format, parseISO, isToday, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { toZonedTime, formatInTimeZone } from 'date-fns-tz'

// Test date utilities commonly used in the application
describe('Date Helper Functions', () => {
  const JAPAN_TIMEZONE = 'Asia/Tokyo'
  
  describe('Date Formatting', () => {
    it('should format date in Japanese locale', () => {
      const testDate = new Date('2025-01-21T15:30:00Z')
      
      const formattedDate = formatInTimeZone(testDate, JAPAN_TIMEZONE, 'yyyy-MM-dd HH:mm')
      
      expect(formattedDate).toBe('2025-01-22 00:30') // JST is UTC+9
    })

    it('should format time for display', () => {
      const testTime = '13:30:00'
      const testDate = parseISO(`2025-01-21T${testTime}`)
      
      const formattedTime = format(testDate, 'HH:mm')
      
      expect(formattedTime).toBe('13:30')
    })

    it('should handle different date formats', () => {
      const isoDate = '2025-01-21T15:30:00.000Z'
      const parsed = parseISO(isoDate)
      
      expect(parsed).toBeInstanceOf(Date)
      expect(parsed.getUTCFullYear()).toBe(2025)
      expect(parsed.getUTCMonth()).toBe(0) // January is 0
      expect(parsed.getUTCDate()).toBe(21)
    })
  })

  describe('Date Validation', () => {
    it('should check if date is today', () => {
      const today = new Date()
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      expect(isToday(today)).toBe(true)
      expect(isToday(tomorrow)).toBe(false)
    })

    it('should check if time is within working hours', () => {
      const workingStart = new Date('2025-01-21T13:00:00')
      const workingEnd = new Date('2025-01-21T21:00:00')
      
      const duringWork = new Date('2025-01-21T15:30:00')
      const beforeWork = new Date('2025-01-21T10:00:00')
      const afterWork = new Date('2025-01-21T22:00:00')
      
      const workingInterval = { start: workingStart, end: workingEnd }
      
      expect(isWithinInterval(duringWork, workingInterval)).toBe(true)
      expect(isWithinInterval(beforeWork, workingInterval)).toBe(false)
      expect(isWithinInterval(afterWork, workingInterval)).toBe(false)
    })
  })

  describe('Shift Time Calculation', () => {
    it('should calculate shift duration correctly', () => {
      const startTime = new Date('2025-01-21T13:00:00')
      const endTime = new Date('2025-01-21T21:00:00')
      
      const durationMs = endTime.getTime() - startTime.getTime()
      const durationHours = durationMs / (1000 * 60 * 60)
      
      expect(durationHours).toBe(8)
    })

    it('should handle overnight shifts', () => {
      const startTime = new Date('2025-01-21T22:00:00')
      const endTime = new Date('2025-01-22T06:00:00')
      
      const durationMs = endTime.getTime() - startTime.getTime()
      const durationHours = durationMs / (1000 * 60 * 60)
      
      expect(durationHours).toBe(8)
    })
  })

  describe('Date Range Generation', () => {
    it('should generate correct day boundaries', () => {
      const testDate = new Date('2025-01-21T15:30:00')
      
      const dayStart = startOfDay(testDate)
      const dayEnd = endOfDay(testDate)
      
      expect(dayStart.getHours()).toBe(0)
      expect(dayStart.getMinutes()).toBe(0)
      expect(dayStart.getSeconds()).toBe(0)
      
      expect(dayEnd.getHours()).toBe(23)
      expect(dayEnd.getMinutes()).toBe(59)
      expect(dayEnd.getSeconds()).toBe(59)
    })

    it('should handle timezone conversion correctly', () => {
      const utcDate = new Date('2025-01-21T15:00:00Z')
      const japanDate = toZonedTime(utcDate, JAPAN_TIMEZONE)
      
      // Should be 15:00 UTC = 00:00+1 JST (next day)
      expect(japanDate.getHours()).toBe(0)
      expect(japanDate.getDate()).toBe(22)
    })
  })

  describe('Attendance Time Validation', () => {
    it('should validate punch time is within reasonable range', () => {
      const now = new Date()
      const recentPunch = new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes ago
      const oldPunch = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
      
      const timeDiffMinutes = (now.getTime() - recentPunch.getTime()) / (1000 * 60)
      const oldTimeDiffHours = (now.getTime() - oldPunch.getTime()) / (1000 * 60 * 60)
      
      expect(timeDiffMinutes).toBeLessThan(10) // Recent punch should be within 10 minutes
      expect(oldTimeDiffHours).toBeGreaterThan(20) // Old punch should be more than 20 hours
    })

    it('should validate break time calculation', () => {
      const checkinTime = new Date('2025-01-21T13:00:00')
      const checkoutTime = new Date('2025-01-21T21:00:00')
      
      const workDurationMs = checkoutTime.getTime() - checkinTime.getTime()
      const workDurationHours = workDurationMs / (1000 * 60 * 60)
      
      // For 8-hour shifts, mandatory 60-minute break
      const breakTimeMinutes = workDurationHours >= 8 ? 60 : 0
      
      expect(breakTimeMinutes).toBe(60)
    })
  })
})