#!/bin/bash

# Test Runner for Notion Idea Server
# Handles both basic and Jest-based testing

echo "🧪 Notion Idea Server Test Runner"
echo "================================="

# Check if Node.js is working
echo "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    exit 1
fi

# Try to get Node version
if ! node --version &> /dev/null; then
    echo "❌ Node.js installation has issues (ICU library missing)"
    echo "To fix this issue:"
    echo "1. Try: brew reinstall node"
    echo "2. Or: brew reinstall icu4c"
    echo "3. Or: Use nvm to install a different Node version"
    exit 1
fi

echo "✅ Node.js is working: $(node --version)"

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Please run this script from the notion-idea-server directory"
    exit 1
fi

# Install dependencies if needed
if [[ ! -d "node_modules" ]]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run basic tests first
echo ""
echo "🟡 Running basic functionality tests..."
if node src/test/basic.test.js; then
    echo "✅ Basic tests passed"
else
    echo "❌ Basic tests failed"
    exit 1
fi

# Check if Jest dependencies are available
if npm list jest &> /dev/null; then
    echo ""
    echo "🟡 Running Jest-based tests..."
    npm run test:jest
else
    echo ""
    echo "⚠️  Jest not installed. To run advanced tests:"
    echo "npm install --save-dev @types/jest @types/supertest jest supertest ts-jest"
    echo "Then run: npm run test:jest"
fi

echo ""
echo "🎉 Test run complete!" 