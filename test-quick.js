// Quick test to verify unit tests are working
const { execSync } = require('child_process');
const path = require('path');

process.chdir(__dirname);

console.log('🧪 Running Quick Unit Test Check...');
console.log('Working directory:', process.cwd());

try {
  // List test files first
  console.log('\n📁 Test files found:');
  const output = execSync('find __tests__/unit -name "*.test.*" 2>/dev/null || echo "No unit tests found"', {
    encoding: 'utf8',
    timeout: 5000
  });
  console.log(output);
  
  // Try to run a single test file
  console.log('\n🚀 Running distance calculation test...');
  const testOutput = execSync('npx jest __tests__/unit/lib/distance-calculation.test.ts --verbose --no-coverage', {
    encoding: 'utf8',
    timeout: 30000
  });
  console.log(testOutput);
  
  console.log('\n✅ Unit tests are working!');
} catch (error) {
  console.error('\n❌ Error running tests:', error.message);
  if (error.stdout) console.log('STDOUT:', error.stdout);
  if (error.stderr) console.error('STDERR:', error.stderr);
  process.exit(1);
}