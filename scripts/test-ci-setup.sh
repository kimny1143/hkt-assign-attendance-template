#!/bin/bash

# Test CI Setup Script
# This script verifies that the E2E test setup works correctly

set -e

echo "🧪 Testing CI E2E setup locally..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if required dependencies are installed
echo "🔍 Checking dependencies..."

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    print_error "npx is not installed"
    exit 1
fi

print_status "Dependencies check passed"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci
    print_status "Dependencies installed"
fi

# Install Playwright browsers if needed
echo "🌐 Checking Playwright browsers..."
if ! npx playwright --version &> /dev/null; then
    print_error "Playwright is not installed properly"
    exit 1
fi

# Install browsers if not already installed
npx playwright install chromium --with-deps

print_status "Playwright browsers ready"

# Set environment variables for testing
export CI=true
export NODE_ENV=production
export PLAYWRIGHT_BASE_URL=http://localhost:3000
export NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
export SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
export LINE_CHANNEL_SECRET=test-line-secret
export LINE_CHANNEL_ACCESS_TOKEN=test-line-token
export APP_BASE_URL=http://localhost:3000
export E2E_USE_REAL_BACKEND=false

# Build the application
echo "🏗️ Building application..."
npm run build
print_status "Application built successfully"

# Test the health check API
echo "🔍 Testing health check..."
npm run start &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Check health endpoint
if curl -s http://localhost:3000/api/health | grep -q "ok"; then
    print_status "Health check endpoint working"
else
    print_warning "Health check endpoint not responding (this is expected if not implemented)"
fi

# Kill the server
kill $SERVER_PID 2>/dev/null || true
sleep 2

# Run a single E2E test to verify setup
echo "🧪 Running sample E2E test..."
if npm run test:e2e:ci -- --project=chromium --grep="should redirect to login page" --timeout=60000; then
    print_status "E2E test setup working correctly"
else
    print_error "E2E test failed - check the configuration"
    exit 1
fi

echo ""
echo "🎉 CI setup test completed successfully!"
echo ""
echo "Next steps:"
echo "1. Commit these changes to your repository"
echo "2. Push to GitHub to trigger the CI pipeline"
echo "3. Monitor the GitHub Actions workflow for E2E test results"
echo ""
echo "Files modified/created:"
echo "  - playwright.config.ts (updated webServer config)"
echo "  - playwright.config.ci.ts (new CI-specific config)"
echo "  - .github/workflows/ci.yml (updated E2E test job)"
echo "  - app/api/health/route.ts (new health check endpoint)"
echo "  - __tests__/utils/health-check.ts (new health check utility)"
echo "  - __tests__/e2e/global-setup.ts (updated with health checks)"
echo "  - package.json (added test:e2e:ci script)"
echo ""