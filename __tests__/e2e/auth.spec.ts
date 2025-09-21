import { test, expect, Page } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/')
  })

  test('should redirect to login page when not authenticated', async ({ page }) => {
    // Try to access admin page without authentication
    await page.goto('/admin')

    // Should be redirected to login
    await expect(page).toHaveURL(/.*\/login/)
    await expect(page.locator('h1')).toContainText('ログイン')
  })

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login')

    // Fill in login form
    await page.fill('[data-testid="email-input"]', 'admin@test.com')
    await page.fill('[data-testid="password-input"]', 'test123456')

    // Submit login
    await page.click('[data-testid="login-button"]')

    // Should redirect to admin dashboard
    await expect(page).toHaveURL(/.*\/admin/)
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    // Fill in invalid credentials
    await page.fill('[data-testid="email-input"]', 'invalid@test.com')
    await page.fill('[data-testid="password-input"]', 'wrongpassword')

    // Submit login
    await page.click('[data-testid="login-button"]')

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('メールアドレスまたはパスワードが正しくありません')
  })

  test('should logout successfully', async ({ page }) => {
    // Login first
    await loginAsAdmin(page)

    // Click logout button
    await page.click('[data-testid="logout-button"]')

    // Should redirect to login page
    await expect(page).toHaveURL(/.*\/login/)
  })

  test('should maintain session on page refresh', async ({ page }) => {
    // Login first
    await loginAsAdmin(page)

    // Refresh the page
    await page.reload()

    // Should still be authenticated
    await expect(page).toHaveURL(/.*\/admin/)
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible()
  })

  test('should handle session expiry gracefully', async ({ page }) => {
    // Login first
    await loginAsAdmin(page)

    // Mock session expiry by clearing cookies
    await page.context().clearCookies()

    // Try to navigate to protected page
    await page.goto('/admin/staff')

    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login/)
  })
})

test.describe('Role-based Access Control', () => {
  test('admin should access all pages', async ({ page }) => {
    await loginAsAdmin(page)

    // Test admin pages
    const adminPages = [
      '/admin',
      '/admin/staff',
      '/admin/staff/new',
    ]

    for (const adminPage of adminPages) {
      await page.goto(adminPage)
      await expect(page).not.toHaveURL(/.*\/login/)
      await expect(page.locator('body')).not.toContainText('403')
      await expect(page.locator('body')).not.toContainText('Forbidden')
    }
  })

  test('manager should access limited pages', async ({ page }) => {
    await loginAsManager(page)

    // Test allowed pages
    const allowedPages = [
      '/admin',
      '/admin/staff',
    ]

    for (const allowedPage of allowedPages) {
      await page.goto(allowedPage)
      await expect(page).not.toHaveURL(/.*\/login/)
    }

    // Test restricted pages
    const restrictedPages = [
      '/admin/staff/new', // Only admin can create staff
    ]

    for (const restrictedPage of restrictedPages) {
      await page.goto(restrictedPage)
      // Should show 403 or redirect
      const hasError = await page.locator('body').textContent()
      expect(hasError).toMatch(/(403|Forbidden|Access Denied)/i)
    }
  })

  test('staff should only access staff pages', async ({ page }) => {
    await loginAsStaff(page)

    // Should be able to access staff pages
    await page.goto('/staff')
    await expect(page).not.toHaveURL(/.*\/login/)

    // Should not access admin pages
    await page.goto('/admin')
    const hasError = await page.locator('body').textContent()
    expect(hasError).toMatch(/(403|Forbidden|Access Denied)/i)
  })
})

test.describe('Form Validation', () => {
  test('should validate email format', async ({ page }) => {
    await page.goto('/login')

    // Test invalid email formats
    const invalidEmails = ['invalid-email', 'test@', '@test.com', 'test.com']

    for (const email of invalidEmails) {
      await page.fill('[data-testid="email-input"]', email)
      await page.fill('[data-testid="password-input"]', 'password123')
      await page.click('[data-testid="login-button"]')

      // Should show validation error
      const errorMessage = await page.locator('[data-testid="email-error"]').textContent()
      expect(errorMessage).toBeTruthy()
    }
  })

  test('should validate password requirements', async ({ page }) => {
    await page.goto('/login')

    // Test short password
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', '123')
    await page.click('[data-testid="login-button"]')

    // Should show password validation error
    const errorMessage = await page.locator('[data-testid="password-error"]').textContent()
    expect(errorMessage).toMatch(/6文字以上/i)
  })

  test('should prevent form submission with empty fields', async ({ page }) => {
    await page.goto('/login')

    // Try to submit empty form
    await page.click('[data-testid="login-button"]')

    // Form should not be submitted
    await expect(page).toHaveURL(/.*\/login/)

    // Should show validation errors
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible()
  })
})

// Helper functions
async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('[data-testid="email-input"]', 'admin@test.com')
  await page.fill('[data-testid="password-input"]', 'test123456')
  await page.click('[data-testid="login-button"]')
  await expect(page).toHaveURL(/.*\/admin/)
}

async function loginAsManager(page: Page) {
  await page.goto('/login')
  await page.fill('[data-testid="email-input"]', 'manager@test.com')
  await page.fill('[data-testid="password-input"]', 'test123456')
  await page.click('[data-testid="login-button"]')
  await expect(page).toHaveURL(/.*\/admin/)
}

async function loginAsStaff(page: Page) {
  await page.goto('/login')
  await page.fill('[data-testid="email-input"]', 'staff@test.com')
  await page.fill('[data-testid="password-input"]', 'test123456')
  await page.click('[data-testid="login-button"]')
  await expect(page).toHaveURL(/.*\/staff/)
}