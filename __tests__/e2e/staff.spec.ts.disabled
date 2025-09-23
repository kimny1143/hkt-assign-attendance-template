import { test, expect, Page } from '@playwright/test'

test.describe('Staff Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin before each test
    await loginAsAdmin(page)
  })

  test('should display staff list', async ({ page }) => {
    await page.goto('/admin/staff')

    // Check if staff list is displayed
    await expect(page.locator('[data-testid="staff-list"]')).toBeVisible()
    await expect(page.locator('h1')).toContainText('スタッフ管理')

    // Check if staff table headers are present
    await expect(page.locator('th:has-text("名前")')).toBeVisible()
    await expect(page.locator('th:has-text("メール")')).toBeVisible()
    await expect(page.locator('th:has-text("スキル")')).toBeVisible()
    await expect(page.locator('th:has-text("ステータス")')).toBeVisible()
  })

  test('should create new staff member', async ({ page }) => {
    await page.goto('/admin/staff/new')

    // Fill in staff form
    await page.fill('[data-testid="staff-name"]', 'テストスタッフ')
    await page.fill('[data-testid="staff-email"]', 'newstaff@test.com')
    await page.fill('[data-testid="staff-phone"]', '090-1234-5678')
    await page.fill('[data-testid="hourly-rate"]', '1500')

    // Select skills
    await page.check('[data-testid="skill-PA"]')
    await page.check('[data-testid="skill-照明"]')

    // Set proficiency levels
    await page.selectOption('[data-testid="proficiency-PA"]', '4')
    await page.selectOption('[data-testid="proficiency-照明"]', '3')

    // Set certification status
    await page.check('[data-testid="certified-PA"]')

    // Submit form
    await page.click('[data-testid="submit-button"]')

    // Should redirect to staff list
    await expect(page).toHaveURL(/.*\/admin\/staff$/)

    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('スタッフが作成されました')

    // Verify new staff appears in list
    await expect(page.locator('[data-testid="staff-list"]')).toContainText('テストスタッフ')
  })

  test('should validate required fields in staff form', async ({ page }) => {
    await page.goto('/admin/staff/new')

    // Try to submit empty form
    await page.click('[data-testid="submit-button"]')

    // Should show validation errors
    await expect(page.locator('[data-testid="name-error"]')).toContainText('名前は必須です')
    await expect(page.locator('[data-testid="email-error"]')).toContainText('メールアドレスは必須です')
  })

  test('should edit existing staff member', async ({ page }) => {
    await page.goto('/admin/staff')

    // Click edit button for first staff member
    await page.click('[data-testid="edit-staff"]:first-child')

    // Should navigate to edit page
    await expect(page).toHaveURL(/.*\/admin\/staff\/.*\/edit/)

    // Update staff information
    await page.fill('[data-testid="staff-name"]', '更新されたスタッフ')
    await page.fill('[data-testid="hourly-rate"]', '1800')

    // Add new skill
    await page.check('[data-testid="skill-音源再生"]')
    await page.selectOption('[data-testid="proficiency-音源再生"]', '5')
    await page.check('[data-testid="certified-音源再生"]')

    // Submit update
    await page.click('[data-testid="update-button"]')

    // Should redirect back to staff list
    await expect(page).toHaveURL(/.*\/admin\/staff$/)

    // Should show updated information
    await expect(page.locator('[data-testid="staff-list"]')).toContainText('更新されたスタッフ')
  })

  test('should delete staff member', async ({ page }) => {
    await page.goto('/admin/staff')

    // Get initial staff count
    const initialCount = await page.locator('[data-testid="staff-row"]').count()

    // Click delete button for last staff member
    await page.click('[data-testid="delete-staff"]:last-child')

    // Confirm deletion in modal
    await expect(page.locator('[data-testid="delete-modal"]')).toBeVisible()
    await page.click('[data-testid="confirm-delete"]')

    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('スタッフが削除されました')

    // Staff count should decrease
    const finalCount = await page.locator('[data-testid="staff-row"]').count()
    expect(finalCount).toBe(initialCount - 1)
  })

  test('should filter staff by skills', async ({ page }) => {
    await page.goto('/admin/staff')

    // Apply skill filter
    await page.selectOption('[data-testid="skill-filter"]', 'PA')

    // Should show only staff with PA skill
    const staffRows = page.locator('[data-testid="staff-row"]')
    const count = await staffRows.count()

    for (let i = 0; i < count; i++) {
      const skillsCell = staffRows.nth(i).locator('[data-testid="staff-skills"]')
      await expect(skillsCell).toContainText('PA')
    }
  })

  test('should search staff by name', async ({ page }) => {
    await page.goto('/admin/staff')

    // Enter search term
    await page.fill('[data-testid="search-input"]', 'テスト')

    // Should filter results
    const staffRows = page.locator('[data-testid="staff-row"]')
    const count = await staffRows.count()

    for (let i = 0; i < count; i++) {
      const nameCell = staffRows.nth(i).locator('[data-testid="staff-name"]')
      await expect(nameCell).toContainText('テスト')
    }
  })

  test('should display staff details', async ({ page }) => {
    await page.goto('/admin/staff')

    // Click on first staff member name
    await page.click('[data-testid="staff-name"]:first-child')

    // Should navigate to staff details page
    await expect(page).toHaveURL(/.*\/admin\/staff\/.*$/)

    // Should display staff information
    await expect(page.locator('[data-testid="staff-details"]')).toBeVisible()
    await expect(page.locator('[data-testid="staff-skills-section"]')).toBeVisible()
    await expect(page.locator('[data-testid="attendance-history"]')).toBeVisible()
  })

  test('should handle skills management correctly', async ({ page }) => {
    await page.goto('/admin/staff/new')

    // Test that all 4 required skills are available
    const requiredSkills = ['PA', '音源再生', '照明', 'バックヤード']

    for (const skill of requiredSkills) {
      await expect(page.locator(`[data-testid="skill-${skill}"]`)).toBeVisible()
    }

    // Test proficiency level validation (1-5)
    await page.check('[data-testid="skill-PA"]')

    // Try invalid proficiency level
    await page.selectOption('[data-testid="proficiency-PA"]', '6')
    await page.click('[data-testid="submit-button"]')

    // Should show validation error
    await expect(page.locator('[data-testid="proficiency-error"]')).toContainText('1から5の範囲で入力してください')
  })

  test('should validate multi-skill requirements', async ({ page }) => {
    await page.goto('/admin/staff/new')

    // Fill basic information
    await page.fill('[data-testid="staff-name"]', 'マルチスキルスタッフ')
    await page.fill('[data-testid="staff-email"]', 'multiskill@test.com')

    // Select multiple skills
    await page.check('[data-testid="skill-PA"]')
    await page.check('[data-testid="skill-音源再生"]')
    await page.check('[data-testid="skill-照明"]')

    // Set proficiency levels
    await page.selectOption('[data-testid="proficiency-PA"]', '5')
    await page.selectOption('[data-testid="proficiency-音源再生"]', '4')
    await page.selectOption('[data-testid="proficiency-照明"]', '3')

    // Set certifications
    await page.check('[data-testid="certified-PA"]')
    await page.check('[data-testid="certified-音源再生"]')

    // Submit form
    await page.click('[data-testid="submit-button"]')

    // Should succeed
    await expect(page).toHaveURL(/.*\/admin\/staff$/)
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should handle staff deactivation/activation', async ({ page }) => {
    await page.goto('/admin/staff')

    // Click on active staff member
    await page.click('[data-testid="staff-status"]:first-child')

    // Should show deactivation confirmation
    await expect(page.locator('[data-testid="status-modal"]')).toBeVisible()
    await page.click('[data-testid="confirm-deactivate"]')

    // Should show updated status
    await expect(page.locator('[data-testid="staff-row"]:first-child')).toContainText('非アクティブ')

    // Reactivate
    await page.click('[data-testid="staff-status"]:first-child')
    await page.click('[data-testid="confirm-activate"]')

    // Should show active status
    await expect(page.locator('[data-testid="staff-row"]:first-child')).toContainText('アクティブ')
  })
})

// Helper function
async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('[data-testid="email-input"]', 'admin@test.com')
  await page.fill('[data-testid="password-input"]', 'test123456')
  await page.click('[data-testid="login-button"]')
  await expect(page).toHaveURL(/.*\/admin/)
}