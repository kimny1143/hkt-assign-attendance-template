import { jest } from '@jest/globals'

// Mock QR code scanner
export const mockQRScanner = {
  scan: jest.fn(),
  stop: jest.fn(),
  start: jest.fn(),
}

// Valid QR tokens for testing
export const VALID_QR_TOKENS = {
  checkin: 'qr-checkin-token-123',
  checkout: 'qr-checkout-token-456',
  expired: 'qr-expired-token-789',
  invalid: 'invalid-qr-token',
}

// Mock QR scanner success
export const mockQRScanSuccess = (token = VALID_QR_TOKENS.checkin) => {
  mockQRScanner.scan.mockResolvedValue({
    text: token,
    format: 'QR_CODE',
  })
}

// Mock QR scanner error
export const mockQRScanError = (error = 'Camera permission denied') => {
  mockQRScanner.scan.mockRejectedValue(new Error(error))
}

// Mock camera API for QR scanning
export const mockCameraAPI = {
  getUserMedia: jest.fn(),
}

// Setup successful camera access
export const mockCameraSuccess = () => {
  mockCameraAPI.getUserMedia.mockResolvedValue({
    getTracks: () => [
      {
        stop: jest.fn(),
        getSettings: () => ({
          width: 640,
          height: 480,
        }),
      },
    ],
    active: true,
  })
}

// Setup camera access denied
export const mockCameraError = (error = 'NotAllowedError') => {
  mockCameraAPI.getUserMedia.mockRejectedValue(
    new DOMException('Camera access denied', error)
  )
}

// Mock QR code validation
export const mockQRValidation = {
  validateToken: jest.fn(),
  isExpired: jest.fn(),
  getTokenPurpose: jest.fn(),
}

// Setup QR validation responses
export const mockQRValidationSuccess = (token: string, purpose: 'checkin' | 'checkout' = 'checkin') => {
  mockQRValidation.validateToken.mockResolvedValue({
    valid: true,
    shift_id: 'shift-1',
    purpose,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
  })

  mockQRValidation.isExpired.mockReturnValue(false)
  mockQRValidation.getTokenPurpose.mockReturnValue(purpose)
}

// Setup QR validation error
export const mockQRValidationError = (reason = 'Invalid token') => {
  mockQRValidation.validateToken.mockResolvedValue({
    valid: false,
    error: reason,
  })

  mockQRValidation.isExpired.mockReturnValue(true)
}

// Helper to generate mock QR data
export const generateMockQRData = (
  shiftId: string,
  purpose: 'checkin' | 'checkout',
  expiresInHours = 24
) => {
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
  return {
    token: `qr-${purpose}-${shiftId}-${Date.now()}`,
    shift_id: shiftId,
    purpose,
    expires_at: expiresAt.toISOString(),
    created_at: new Date().toISOString(),
  }
}

// Reset all QR-related mocks
export const resetQRMocks = () => {
  mockQRScanner.scan.mockClear()
  mockQRScanner.stop.mockClear()
  mockQRScanner.start.mockClear()
  mockCameraAPI.getUserMedia.mockClear()
  mockQRValidation.validateToken.mockClear()
  mockQRValidation.isExpired.mockClear()
  mockQRValidation.getTokenPurpose.mockClear()
}

// Setup global navigator mocks for QR/camera functionality
export const setupQRMocks = () => {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: mockCameraAPI,
    writable: true,
  })
}

// Mock barcode detector API (if available)
export const mockBarcodeDetector = {
  detect: jest.fn(),
}

export const mockBarcodeDetectorSuccess = (text = VALID_QR_TOKENS.checkin) => {
  mockBarcodeDetector.detect.mockResolvedValue([
    {
      rawValue: text,
      format: 'qr_code',
      boundingBox: {
        x: 100,
        y: 100,
        width: 200,
        height: 200,
      },
    },
  ])
}