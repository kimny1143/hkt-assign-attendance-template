#!/usr/bin/env node

const { spawn, execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Change to project directory
process.chdir(__dirname)

console.log('🧪 Test Validation Script')
console.log('Working directory:', process.cwd())
console.log('=========================')

// Helper function to run command with promise
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running: ${command} ${args.join(' ')}`)
    
    const process = spawn(command, args, {
      stdio: 'pipe',
      env: { ...process.env, CI: 'true' },
      ...options
    })
    
    let stdout = ''
    let stderr = ''
    
    process.stdout.on('data', (data) => {
      const output = data.toString()
      stdout += output
      console.log(output)
    })
    
    process.stderr.on('data', (data) => {
      const output = data.toString()
      stderr += output
      console.error(output)
    })
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code })
      } else {
        reject({ stdout, stderr, code, message: `Process exited with code ${code}` })
      }
    })
    
    process.on('error', (error) => {
      reject({ error, message: `Failed to start process: ${error.message}` })
    })
  })
}

// Check test structure
function checkTestStructure() {
  console.log('\n📁 Checking test structure...')
  
  const testDirs = ['__tests__/unit', '__tests__/integration', '__tests__/e2e']
  const results = {}
  
  testDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir, { recursive: true })
        .filter(file => file.endsWith('.test.ts') || file.endsWith('.test.tsx') || file.endsWith('.spec.ts'))
      results[dir] = files.length
      console.log(`✅ ${dir}: ${files.length} test files`)
    } else {
      results[dir] = 0
      console.log(`❌ ${dir}: Directory not found`)
    }
  })
  
  return results
}

// Main validation function
async function validateTests() {
  try {
    // Check test structure
    const structure = checkTestStructure()
    
    // Validate Jest configuration
    console.log('\n🔍 Validating Jest configuration...')
    try {
      execSync('npx jest --showConfig', { stdio: 'pipe' })
      console.log('✅ Jest configuration is valid')
    } catch (error) {
      console.error('❌ Jest configuration error:', error.message)
    }
    
    // Test individual test suites
    const testResults = {}
    
    // Unit tests
    if (structure['__tests__/unit'] > 0) {
      console.log('\n🧪 Running unit tests...')
      try {
        await runCommand('npm', ['run', 'test:unit', '--', '--verbose', '--passWithNoTests'])
        testResults.unit = 'PASSED'
        console.log('✅ Unit tests passed')
      } catch (error) {
        testResults.unit = 'FAILED'
        console.error('❌ Unit tests failed:', error.message)
      }
    } else {
      testResults.unit = 'SKIPPED (no tests)'
    }
    
    // Integration tests
    if (structure['__tests__/integration'] > 0) {
      console.log('\n🔗 Running integration tests...')
      try {
        await runCommand('npm', ['run', 'test:integration', '--', '--verbose', '--passWithNoTests'])
        testResults.integration = 'PASSED'
        console.log('✅ Integration tests passed')
      } catch (error) {
        testResults.integration = 'FAILED'
        console.error('❌ Integration tests failed:', error.message)
      }
    } else {
      testResults.integration = 'SKIPPED (no tests)'
    }
    
    // Check Playwright installation
    console.log('\n🎭 Checking Playwright setup...')
    try {
      execSync('npx playwright --version', { stdio: 'pipe' })
      console.log('✅ Playwright is installed')
      
      // List E2E tests
      await runCommand('npx', ['playwright', 'test', '--list'])
      testResults.e2e = 'CONFIGURED'
    } catch (error) {
      testResults.e2e = 'FAILED'
      console.error('❌ Playwright setup error:', error.message)
    }
    
    // Summary
    console.log('\n📊 Test Validation Summary')
    console.log('=========================')
    Object.entries(testResults).forEach(([suite, result]) => {
      const icon = result.includes('PASSED') ? '✅' : result.includes('FAILED') ? '❌' : '⚠️'
      console.log(`${icon} ${suite.toUpperCase()}: ${result}`)
    })
    
    // Check for common issues
    console.log('\n🔍 Common Issues Check')
    console.log('=====================')
    
    // Check for missing dependencies
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
      const devDeps = packageJson.devDependencies || {}
      
      const requiredDeps = ['jest', '@playwright/test', '@testing-library/jest-dom']
      requiredDeps.forEach(dep => {
        if (devDeps[dep]) {
          console.log(`✅ ${dep} is installed`)
        } else {
          console.log(`❌ ${dep} is missing`)
        }
      })
    } catch (error) {
      console.error('❌ Error checking dependencies:', error.message)
    }
    
    // Check environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ]
    
    requiredEnvVars.forEach(envVar => {
      if (process.env[envVar]) {
        console.log(`✅ ${envVar} is set`)
      } else {
        console.log(`⚠️ ${envVar} is not set (using default from jest.setup.js)`)
      }
    })
    
    console.log('\n✅ Test validation completed!')
    
  } catch (error) {
    console.error('\n❌ Test validation failed:', error)
    process.exit(1)
  }
}

// Run validation
validateTests()