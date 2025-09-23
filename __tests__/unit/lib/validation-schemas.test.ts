import { z } from 'zod'

// Test validation schemas used in API routes
describe('API Validation Schemas', () => {
  describe('Attendance Punch Schema', () => {
    const punchSchema = z.object({
      equipment_qr: z.string().min(1),
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      purpose: z.enum(['checkin', 'checkout'])
    })

    it('should validate correct punch data', () => {
      const validData = {
        equipment_qr: 'QR-12345',
        lat: 33.5904,
        lon: 130.4017,
        purpose: 'checkin' as const
      }

      const result = punchSchema.safeParse(validData)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('should reject empty QR code', () => {
      const invalidData = {
        equipment_qr: '',
        lat: 33.5904,
        lon: 130.4017,
        purpose: 'checkin' as const
      }

      const result = punchSchema.safeParse(invalidData)
      
      expect(result.success).toBe(false)
    })

    it('should reject invalid latitude values', () => {
      const testCases = [91, -91, NaN, Infinity]
      
      testCases.forEach(invalidLat => {
        const invalidData = {
          equipment_qr: 'QR-12345',
          lat: invalidLat,
          lon: 130.4017,
          purpose: 'checkin' as const
        }

        const result = punchSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
      })
    })

    it('should reject invalid longitude values', () => {
      const testCases = [181, -181, NaN, Infinity]
      
      testCases.forEach(invalidLon => {
        const invalidData = {
          equipment_qr: 'QR-12345',
          lat: 33.5904,
          lon: invalidLon,
          purpose: 'checkin' as const
        }

        const result = punchSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
      })
    })

    it('should reject invalid purpose values', () => {
      const invalidPurposes = ['check-in', 'check-out', 'invalid', '', null]
      
      invalidPurposes.forEach(invalidPurpose => {
        const invalidData = {
          equipment_qr: 'QR-12345',
          lat: 33.5904,
          lon: 130.4017,
          purpose: invalidPurpose
        }

        const result = punchSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
      })
    })

    it('should accept both checkin and checkout purposes', () => {
      const purposes = ['checkin', 'checkout'] as const
      
      purposes.forEach(purpose => {
        const validData = {
          equipment_qr: 'QR-12345',
          lat: 33.5904,
          lon: 130.4017,
          purpose
        }

        const result = punchSchema.safeParse(validData)
        expect(result.success).toBe(true)
      })
    })
  })

  describe('Staff Creation Schema', () => {
    const staffSchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      hourly_rate: z.number().positive().optional(),
      skills: z.array(z.string()).default([])
    })

    it('should validate correct staff data', () => {
      const validData = {
        name: 'Test Staff',
        email: 'test@example.com',
        phone: '090-1234-5678',
        hourly_rate: 1500,
        skills: ['PA', '照明']
      }

      const result = staffSchema.safeParse(validData)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Test Staff')
        expect(result.data.email).toBe('test@example.com')
        expect(result.data.skills).toEqual(['PA', '照明'])
      }
    })

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        'test.example.com',
        ''
      ]

      invalidEmails.forEach(invalidEmail => {
        const invalidData = {
          name: 'Test Staff',
          email: invalidEmail,
          skills: []
        }

        const result = staffSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
      })
    })

    it('should reject empty name', () => {
      const invalidData = {
        name: '',
        email: 'test@example.com',
        skills: []
      }

      const result = staffSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject negative hourly rate', () => {
      const invalidData = {
        name: 'Test Staff',
        email: 'test@example.com',
        hourly_rate: -100,
        skills: []
      }

      const result = staffSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should default empty skills array', () => {
      const dataWithoutSkills = {
        name: 'Test Staff',
        email: 'test@example.com'
      }

      const result = staffSchema.safeParse(dataWithoutSkills)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.skills).toEqual([])
      }
    })
  })
})