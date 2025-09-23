/**
 * Health check utility for E2E tests
 * Ensures the application is fully ready before running tests
 */

export async function waitForAppToBeReady(url: string, maxRetries = 30, retryDelay = 1000): Promise<boolean> {
  console.log(`🔍 Checking if app is ready at ${url}...`)

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html',
        },
      })

      if (response.ok) {
        console.log(`✅ App is ready at ${url}`)
        return true
      }

      console.log(`⏳ Attempt ${i + 1}/${maxRetries}: App not ready (status: ${response.status})`)
    } catch (error) {
      console.log(`⏳ Attempt ${i + 1}/${maxRetries}: App not ready (${error.message})`)
    }

    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }

  console.error(`❌ App failed to become ready after ${maxRetries} attempts`)
  return false
}

export async function waitForApiEndpoint(url: string, maxRetries = 10, retryDelay = 1000): Promise<boolean> {
  console.log(`🔍 Checking API endpoint: ${url}...`)

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })

      // API might return 404 or other status, but if it responds, the server is up
      if (response.status < 500) {
        console.log(`✅ API endpoint responding at ${url}`)
        return true
      }

      console.log(`⏳ Attempt ${i + 1}/${maxRetries}: API endpoint not ready (status: ${response.status})`)
    } catch (error) {
      console.log(`⏳ Attempt ${i + 1}/${maxRetries}: API endpoint not ready (${error.message})`)
    }

    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }

  console.error(`❌ API endpoint failed to become ready after ${maxRetries} attempts`)
  return false
}