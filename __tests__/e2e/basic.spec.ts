import { test, expect } from '@playwright/test'

test.describe('Basic Application Tests', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/')

    // Check that page loads without errors
    await expect(page).toHaveTitle(/HAAS/)

    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login/)
  })

  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login')

    // Check login page elements
    await expect(page.locator('h1')).toContainText('HAAS')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should show error for invalid login', async ({ page }) => {
    await page.goto('/login')

    // Try to login with invalid credentials
    await page.fill('input[type="email"]', 'invalid@test.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error message
    await page.waitForSelector('.bg-red-100', { timeout: 5000 })
    await expect(page.locator('.bg-red-100')).toBeVisible()
  })
})