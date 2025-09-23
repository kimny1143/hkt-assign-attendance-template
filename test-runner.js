#!/usr/bin/env node

const { spawn } = require('child_process')
const path = require('path')

// Change to project directory
process.chdir(__dirname)

console.log('🧪 Running Unit Tests...')
console.log('Working directory:', process.cwd())

// Run unit tests
const testProcess = spawn('npm', ['test', '--', '--testPathPattern=__tests__/unit', '--verbose'], {
  stdio: 'pipe',
  env: { ...process.env, CI: 'true' }
})

testProcess.stdout.on('data', (data) => {
  console.log(data.toString())
})

testProcess.stderr.on('data', (data) => {
  console.error(data.toString())
})

testProcess.on('close', (code) => {
  console.log(`\n✅ Test process exited with code: ${code}`)
  if (code === 0) {
    console.log('🎉 All unit tests passed!')
  } else {
    console.log('❌ Some tests failed or there were errors')
  }
  process.exit(code)
})

testProcess.on('error', (error) => {
  console.error('Failed to start test process:', error)
  process.exit(1)
})