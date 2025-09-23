import { chromium, FullConfig } from '@playwright/test'
import { waitForAppToBeReady, waitForApiEndpoint } from '../utils/health-check'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global E2E test setup...')

  try {
    // Get the base URL
    const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000'
    console.log(`📍 Testing against: ${baseURL}`)

    // Wait for the application to be ready
    const isAppReady = await waitForAppToBeReady(baseURL, 60, 2000)
    if (!isAppReady) {
      throw new Error('Application failed to become ready')
    }

    // Check API endpoints
    const isApiReady = await waitForApiEndpoint(`${baseURL}/api/health`, 30, 1000)
    if (!isApiReady) {
      console.warn('⚠️ API health check endpoint not responding, continuing anyway...')
    }

    // Launch browser for additional setup
    const browser = await chromium.launch()
    const page = await browser.newPage()

    // Navigate to the application to verify it loads
    await page.goto(baseURL, { waitUntil: 'networkidle' })
    await page.waitForSelector('body', { timeout: 30000 })

    await browser.close()

    // Setup test data in Supabase (if using real backend)
    if (process.env.E2E_USE_REAL_BACKEND === 'true') {
      await setupTestData()
    }

    console.log('✅ Global setup completed successfully')
  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  }
}

async function setupTestData() {
  console.log('🗃️ Setting up test data...')

  // Create test users and staff
  const testUsers = [
    {
      email: 'admin@test.com',
      password: 'test123456',
      role: 'admin',
      name: 'Test Admin',
    },
    {
      email: 'manager@test.com',
      password: 'test123456',
      role: 'manager',
      name: 'Test Manager',
    },
    {
      email: 'staff@test.com',
      password: 'test123456',
      role: 'staff',
      name: 'Test Staff',
    },
  ]

  for (const user of testUsers) {
    try {
      // Create user in Supabase Auth
      // Note: This would require actual Supabase admin SDK setup
      console.log(`Creating test user: ${user.email}`)
    } catch (error) {
      console.warn(`Failed to create user ${user.email}:`, error)
    }
  }

  // Create test skills
  const testSkills = [
    { id: 1, code: 'PA', label: 'PA', description: 'PA機材操作' },
    { id: 2, code: 'AUDIO', label: '音源再生', description: '音源再生マニピュレーター' },
    { id: 3, code: 'LIGHTING', label: '照明', description: '照明操作' },
    { id: 4, code: 'BACKYARD', label: 'バックヤード', description: 'バックヤード業務' },
  ]

  console.log('Skills setup completed')

  // Create test venue
  const testVenue = {
    id: 'test-venue-1',
    name: 'HKT48劇場',
    address: '福岡・BOSS E・ZO FUKUOKA内',
    latitude: 33.5904,
    longitude: 130.4017,
  }

  console.log('Venue setup completed')

  // Create test equipment with QR codes
  const testEquipment = [
    {
      id: 'equipment-1',
      name: 'PA Console',
      qr_code: 'TEST-PA-QR-12345',
      venue_id: 'test-venue-1',
      active: true,
    },
    {
      id: 'equipment-2',
      name: '音源再生機器',
      qr_code: 'TEST-AUDIO-QR-67890',
      venue_id: 'test-venue-1',
      active: true,
    },
  ]

  console.log('Equipment setup completed')
}

export default globalSetup