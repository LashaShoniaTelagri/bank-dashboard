#!/bin/bash

# Script to set up AWS Parameter Store infrastructure for TelAgri Bank Dashboard via CDK
# Usage: ./scripts/setup-aws-parameter-store.sh [region] [environment] [github-org] [github-repo]

set -e

AWS_REGION=${1:-us-east-1}
ENVIRONMENT=${2:-dev}
GITHUB_ORG=${3:-your-github-org}
GITHUB_REPO=${4:-telagri-bank-dashboard}

echo "🚀 Setting up AWS Parameter Store infrastructure via CDK"
echo "Region: $AWS_REGION"
echo "Environment: $ENVIRONMENT"
echo "GitHub Org: $GITHUB_ORG"
echo "GitHub Repo: $GITHUB_REPO"

# Check if AWS CLI is available
if ! command -v aws >/dev/null 2>&1; then
    echo "❌ AWS CLI not found. Please install AWS CLI first."
    exit 1
fi

# Check if CDK directory exists
if [ ! -d "cdk" ]; then
    echo "❌ CDK directory not found. Please run this script from the project root directory."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "❌ AWS credentials not configured or invalid."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "✅ AWS credentials valid for account: $ACCOUNT_ID"

echo ""
echo "🏗️ Deploying CDK stack with Parameter Store resources..."
echo "This will create:"
echo "  - KMS Key for parameter encryption"
echo "  - GitHub Actions IAM Role with Parameter Store access"
echo "  - Frontend and Backend environment parameters (with placeholders)"
echo "  - All existing infrastructure (S3, CloudFront, WAF, etc.)"
echo ""

# Navigate to CDK directory
cd cdk

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing CDK dependencies..."
    npm install
fi

# Ensure CDK bootstrap
echo "🔧 Ensuring CDK bootstrap..."
npx cdk bootstrap aws://$ACCOUNT_ID/$AWS_REGION --force

# Build CDK
echo "🏗️ Building CDK..."
npm run build

# Deploy the stack
echo "🚀 Deploying CDK stack..."
export AWS_REGION="$AWS_REGION"
export ENVIRONMENT="$ENVIRONMENT"

# Set required environment variables for CDK
export DOMAIN_NAME="dashboard${ENVIRONMENT:+-$ENVIRONMENT}.telagri.com"
export CERTIFICATE_ARN="arn:aws:acm:us-east-1:$ACCOUNT_ID:certificate/your-certificate-id"
export AWS_ACCOUNT_ID="$ACCOUNT_ID"

npm run deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ CDK stack deployed successfully!"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Update your real environment variables in Parameter Store:"
    echo "   ./scripts/upload-env-to-aws.sh frontend $ENVIRONMENT env.frontend.$ENVIRONMENT $AWS_REGION"
    echo "   ./scripts/upload-env-to-aws.sh backend $ENVIRONMENT env.backend.$ENVIRONMENT $AWS_REGION"
    echo ""
    echo "2. Update GitHub repository variables:"
    echo "   - AWS_ACCOUNT_ID: $ACCOUNT_ID"
    echo "   - Add the GitHub Actions role ARN from CDK outputs"
    echo ""
    echo "3. Test the setup:"
    echo "   ./scripts/test-env-setup.sh $ENVIRONMENT $AWS_REGION"
    echo ""
    echo "🔍 CDK Outputs contain the Parameter Store resource details."
else
    echo "❌ CDK deployment failed"
    exit 1
fi

cd ..