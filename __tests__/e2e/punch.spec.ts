import { test, expect, Page, BrowserContext } from '@playwright/test'

test.describe('Attendance Punch System', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant geolocation permission
    await context.grantPermissions(['geolocation'])

    // Set geolocation to HKT48 Theater coordinates
    await context.setGeolocation({ latitude: 33.5904, longitude: 130.4017 })

    // Login as staff before each test
    await loginAsStaff(page)
  })

  test('should show punch page with QR scanner', async ({ page }) => {
    await page.goto('/punch')

    // Check if punch page elements are visible
    await expect(page.locator('[data-testid="punch-page"]')).toBeVisible()
    await expect(page.locator('h1')).toContainText('勤怠打刻')
    await expect(page.locator('[data-testid="qr-scanner"]')).toBeVisible()
    await expect(page.locator('[data-testid="location-status"]')).toBeVisible()
  })

  test('should detect location within range', async ({ page }) => {
    await page.goto('/punch')

    // Wait for location detection
    await page.waitForSelector('[data-testid="location-status"]')

    // Should show location is within range
    await expect(page.locator('[data-testid="location-status"]')).toContainText('位置確認済み')
    await expect(page.locator('[data-testid="location-icon"]')).toHaveClass(/success|green/)
  })

  test('should reject punch when out of range', async ({ page, context }) => {
    // Set location out of range (>300m from theater)
    await context.setGeolocation({ latitude: 33.5954, longitude: 130.4017 })

    await page.goto('/punch')

    // Wait for location detection
    await page.waitForSelector('[data-testid="location-status"]')

    // Should show location is out of range
    await expect(page.locator('[data-testid="location-status"]')).toContainText('会場から離れています')
    await expect(page.locator('[data-testid="location-icon"]')).toHaveClass(/error|red/)

    // QR scanner should be disabled
    await expect(page.locator('[data-testid="qr-scanner"]')).toHaveAttribute('disabled')
  })

  test('should successfully punch in with valid QR code', async ({ page }) => {
    await page.goto('/punch')

    // Wait for location confirmation
    await expect(page.locator('[data-testid="location-status"]')).toContainText('位置確認済み')

    // Mock QR code scan
    await mockQRCodeScan(page, 'TEST-PA-QR-12345')

    // Select check-in action
    await page.click('[data-testid="checkin-button"]')

    // Should show confirmation dialog
    await expect(page.locator('[data-testid="punch-confirmation"]')).toBeVisible()
    await expect(page.locator('[data-testid="punch-details"]')).toContainText('チェックイン')
    await expect(page.locator('[data-testid="equipment-name"]')).toContainText('PA Console')

    // Confirm punch
    await page.click('[data-testid="confirm-punch"]')

    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('チェックインが完了しました')
    await expect(page.locator('[data-testid="attendance-status"]')).toContainText('出勤中')
  })

  test('should successfully punch out with valid QR code', async ({ page }) => {
    // First, perform check-in
    await performCheckIn(page)

    // Now perform check-out
    await page.goto('/punch')

    // Wait for location confirmation
    await expect(page.locator('[data-testid="location-status"]')).toContainText('位置確認済み')

    // Mock QR code scan for checkout
    await mockQRCodeScan(page, 'TEST-PA-QR-12345')

    // Select check-out action
    await page.click('[data-testid="checkout-button"]')

    // Should show checkout confirmation
    await expect(page.locator('[data-testid="punch-confirmation"]')).toBeVisible()
    await expect(page.locator('[data-testid="punch-details"]')).toContainText('チェックアウト')

    // Confirm punch
    await page.click('[data-testid="confirm-punch"]')

    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('チェックアウトが完了しました')
    await expect(page.locator('[data-testid="attendance-status"]')).toContainText('退勤済み')
  })

  test('should reject invalid QR code', async ({ page }) => {
    await page.goto('/punch')

    // Wait for location confirmation
    await expect(page.locator('[data-testid="location-status"]')).toContainText('位置確認済み')

    // Mock invalid QR code scan
    await mockQRCodeScan(page, 'INVALID-QR-CODE')

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('無効なQRコードです')
    await expect(page.locator('[data-testid="qr-status"]')).toHaveClass(/error|red/)
  })

  test('should handle camera permission denied', async ({ page, context }) => {
    // Deny camera permission
    await context.grantPermissions([])

    await page.goto('/punch')

    // Try to start QR scanner
    await page.click('[data-testid="start-scanner"]')

    // Should show camera permission error
    await expect(page.locator('[data-testid="camera-error"]')).toContainText('カメラの使用が許可されていません')
    await expect(page.locator('[data-testid="manual-input-option"]')).toBeVisible()
  })

  test('should allow manual QR code input as fallback', async ({ page }) => {
    await page.goto('/punch')

    // Wait for location confirmation
    await expect(page.locator('[data-testid="location-status"]')).toContainText('位置確認済み')

    // Click manual input option
    await page.click('[data-testid="manual-input-option"]')

    // Should show manual input field
    await expect(page.locator('[data-testid="manual-qr-input"]')).toBeVisible()

    // Enter QR code manually
    await page.fill('[data-testid="manual-qr-input"]', 'TEST-PA-QR-12345')
    await page.click('[data-testid="verify-qr"]')

    // Should verify QR code
    await expect(page.locator('[data-testid="qr-verified"]')).toContainText('QRコード確認済み')

    // Can now proceed with punch
    await page.click('[data-testid="checkin-button"]')
    await page.click('[data-testid="confirm-punch"]')

    // Should succeed
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should show attendance history', async ({ page }) => {
    await page.goto('/punch')

    // Check if attendance history section is visible
    await expect(page.locator('[data-testid="attendance-history"]')).toBeVisible()
    await expect(page.locator('[data-testid="history-title"]')).toContainText('打刻履歴')

    // Should show recent attendance records
    const historyItems = page.locator('[data-testid="history-item"]')
    const count = await historyItems.count()

    if (count > 0) {
      // Check first history item structure
      await expect(historyItems.first().locator('[data-testid="history-date"]')).toBeVisible()
      await expect(historyItems.first().locator('[data-testid="history-action"]')).toBeVisible()
      await expect(historyItems.first().locator('[data-testid="history-equipment"]')).toBeVisible()
    }
  })

  test('should handle geolocation timeout', async ({ page, context }) => {
    // Mock geolocation timeout
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (success: PositionCallback, error: PositionErrorCallback, options?: PositionOptions) => {
            setTimeout(() => {
              error({
                code: 3, // TIMEOUT
                message: 'Geolocation timeout',
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3,
              } as GeolocationPositionError)
            }, 100)
          }
        }
      })
    })

    await page.goto('/punch')

    // Should show location error
    await expect(page.locator('[data-testid="location-error"]')).toContainText('位置情報の取得がタイムアウトしました')
    await expect(page.locator('[data-testid="retry-location"]')).toBeVisible()
  })

  test('should retry location detection', async ({ page }) => {
    // Mock initial location failure
    await page.addInitScript(() => {
      let attempts = 0
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (success: PositionCallback, error: PositionErrorCallback, options?: PositionOptions) => {
            attempts++
            if (attempts === 1) {
              error({
                code: 2, // POSITION_UNAVAILABLE
                message: 'Position unavailable',
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3,
              } as GeolocationPositionError)
            } else {
              success({
                coords: {
                  latitude: 33.5904,
                  longitude: 130.4017,
                  accuracy: 10,
                  altitude: null,
                  altitudeAccuracy: null,
                  heading: null,
                  speed: null,
                  toJSON: () => ({}),
                } as GeolocationCoordinates,
                timestamp: Date.now(),
                toJSON: () => ({}),
              } as GeolocationPosition)
            }
          }
        }
      })
    })

    await page.goto('/punch')

    // Should show location error initially
    await expect(page.locator('[data-testid="location-error"]')).toBeVisible()

    // Click retry button
    await page.click('[data-testid="retry-location"]')

    // Should succeed on retry
    await expect(page.locator('[data-testid="location-status"]')).toContainText('位置確認済み')
  })

  test('should validate working hours', async ({ page }) => {
    // Mock time outside working hours (before 13:00)
    await page.addInitScript(() => {
      Date.now = () => new Date('2025-01-21T10:00:00Z').getTime()
    })

    await page.goto('/punch')

    // Should show working hours warning
    await expect(page.locator('[data-testid="hours-warning"]')).toContainText('営業時間外です')
    await expect(page.locator('[data-testid="working-hours-info"]')).toContainText('13:00〜21:00')
  })

  test('should show break time information', async ({ page }) => {
    await page.goto('/punch')

    // Check if break time info is displayed
    await expect(page.locator('[data-testid="break-info"]')).toContainText('休憩時間: 60分')
    await expect(page.locator('[data-testid="labor-law-info"]')).toContainText('労働基準法に準拠')
  })

  test('should handle double punch prevention', async ({ page }) => {
    // Perform check-in first
    await performCheckIn(page)

    // Try to check-in again immediately
    await page.goto('/punch')
    await expect(page.locator('[data-testid="location-status"]')).toContainText('位置確認済み')
    await mockQRCodeScan(page, 'TEST-PA-QR-12345')

    // Check-in button should be disabled
    await expect(page.locator('[data-testid="checkin-button"]')).toBeDisabled()

    // Should show status message
    await expect(page.locator('[data-testid="status-message"]')).toContainText('既にチェックイン済みです')

    // Only checkout should be available
    await expect(page.locator('[data-testid="checkout-button"]')).toBeEnabled()
  })
})

// Helper functions
async function loginAsStaff(page: Page) {
  await page.goto('/login')
  await page.fill('[data-testid="email-input"]', 'staff@test.com')
  await page.fill('[data-testid="password-input"]', 'test123456')
  await page.click('[data-testid="login-button"]')
  await expect(page).toHaveURL(/.*\/staff/)
}

async function mockQRCodeScan(page: Page, qrCode: string) {
  // Mock QR code scanner result
  await page.evaluate((code) => {
    window.dispatchEvent(new CustomEvent('qr-scan-result', {
      detail: { text: code }
    }))
  }, qrCode)
}

async function performCheckIn(page: Page) {
  await page.goto('/punch')
  await expect(page.locator('[data-testid="location-status"]')).toContainText('位置確認済み')
  await mockQRCodeScan(page, 'TEST-PA-QR-12345')
  await page.click('[data-testid="checkin-button"]')
  await page.click('[data-testid="confirm-punch"]')
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
}