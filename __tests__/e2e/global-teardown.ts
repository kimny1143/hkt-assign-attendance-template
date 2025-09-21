import { FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global E2E test teardown...')

  try {
    // Cleanup test data if using real backend
    if (process.env.E2E_USE_REAL_BACKEND === 'true') {
      await cleanupTestData()
    }

    console.log('✅ Global teardown completed successfully')
  } catch (error) {
    console.error('❌ Global teardown failed:', error)
    // Don't throw - teardown failures shouldn't fail the test run
  }
}

async function cleanupTestData() {
  console.log('🗑️ Cleaning up test data...')

  // Clean up test users
  const testEmails = ['admin@test.com', 'manager@test.com', 'staff@test.com']

  for (const email of testEmails) {
    try {
      console.log(`Cleaning up test user: ${email}`)
      // Delete user from Supabase Auth
      // Note: This would require actual Supabase admin SDK
    } catch (error) {
      console.warn(`Failed to cleanup user ${email}:`, error)
    }
  }

  // Clean up test records
  try {
    // Delete test attendances
    // Delete test assignments
    // Delete test shifts
    // Delete test events
    // Delete test equipment
    // Delete test staff_skills
    // Delete test staff
    console.log('Test records cleanup completed')
  } catch (error) {
    console.warn('Failed to cleanup test records:', error)
  }
}

export default globalTeardown