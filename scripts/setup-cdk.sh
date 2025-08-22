#!/bin/bash

# TelAgri CDK Setup Script
# This script sets up the CDK infrastructure for TelAgri Bank Dashboard

set -e  # Exit on any error

echo "🌾 Setting up TelAgri CDK Infrastructure..."
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. Current version: $(node --version)"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required. Please install npm first."
    exit 1
fi
echo "✅ npm $(npm --version)"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is required. Please install AWS CLI v2 first."
    echo "   Installation guide: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi
echo "✅ AWS CLI $(aws --version | cut -d' ' -f1)"

# Install global CDK if not present
if ! command -v cdk &> /dev/null; then
    echo "📦 Installing AWS CDK globally..."
    npm install -g aws-cdk
    echo "✅ AWS CDK installed: $(cdk --version)"
else
    echo "✅ AWS CDK $(cdk --version)"
fi

echo ""
echo "📦 Installing CDK dependencies..."

# Navigate to CDK directory and install dependencies
cd cdk
npm install

echo "✅ Dependencies installed successfully!"
echo ""

# Build CDK project
echo "🏗️ Building CDK project..."
npm run build
echo "✅ CDK project built successfully!"

echo ""
echo "🔧 CDK project setup completed!"
echo ""
echo "📋 Next Steps:"
echo "1. Configure your AWS credentials:"
echo "   aws configure"
echo ""
echo "2. Set environment variables (see GITHUB_SETUP.md):"
echo "   export AWS_ACCOUNT_ID='123456789012'"
echo "   export DOMAIN_NAME='bank-dev.telagri.com'"
echo "   export HOSTED_ZONE_ID='Z1234567890123'"
echo "   # ... and others"
echo ""
echo "3. Bootstrap CDK (first time only):"
echo "   cd cdk && cdk bootstrap"
echo ""
echo "4. Deploy infrastructure:"
echo "   cd cdk && npm run deploy"
echo ""
echo "5. Or use GitHub Actions for automated deployment!"
echo ""
echo "📚 For detailed setup instructions, see:"
echo "   - cdk/README.md"
echo "   - GITHUB_SETUP.md"
echo ""
echo "🎉 Ready to deploy TelAgri Bank Dashboard to AWS! 🚀" 