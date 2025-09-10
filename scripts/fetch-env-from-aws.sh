#!/bin/bash

# Script to fetch environment configuration from AWS Parameter Store
# Usage: ./scripts/fetch-env-from-aws.sh <environment> [region]

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-us-east-1}
FRONTEND_PARAMETER="/telagri/monitoring/$ENVIRONMENT/frontend/env"
BACKEND_PARAMETER="/telagri/monitoring/$ENVIRONMENT/backend/env"

echo "🔧 Fetching environment configuration from AWS Parameter Store"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "Frontend Parameter: $FRONTEND_PARAMETER"
echo "Backend Parameter: $BACKEND_PARAMETER"

# Check if AWS CLI is available
if ! command -v aws >/dev/null 2>&1; then
    echo "❌ AWS CLI not found. Please install AWS CLI first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "❌ AWS credentials not configured or invalid."
    echo "Please configure AWS credentials using:"
    echo "  aws configure"
    echo "  or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables"
    exit 1
fi

echo "✅ AWS credentials verified"

echo "📋 Fetching frontend environment configuration..."

# Get the frontend environment configuration (safe for builds)
FRONTEND_CONFIG=$(aws ssm get-parameter \
    --name "$FRONTEND_PARAMETER" \
    --with-decryption \
    --region "$AWS_REGION" \
    --query 'Parameter.Value' \
    --output text 2>/dev/null || echo "")

if [ -n "$FRONTEND_CONFIG" ]; then
    echo "✅ Found frontend configuration in AWS Parameter Store"
    
    # Create .env file with frontend variables only (safe for build)
    echo "# Frontend environment configuration fetched from AWS Parameter Store" > .env
    echo "# Environment: $ENVIRONMENT" >> .env
    echo "# Parameter: $FRONTEND_PARAMETER" >> .env
    echo "# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> .env
    echo "# NOTE: Only frontend (VITE_*) variables included for security" >> .env
    echo "" >> .env
    echo "$FRONTEND_CONFIG" >> .env
    
    echo "✅ Frontend environment file created: .env"
    echo "📋 Loaded frontend variables:"
    grep -E '^VITE_[A-Z_]+=' .env | cut -d'=' -f1 | sed 's/^/  - /' || echo "  No VITE_ variables found"
    
else
    echo "⚠️ No frontend configuration found in AWS Parameter Store"
    echo "Expected parameter: $FRONTEND_PARAMETER"
    echo ""
    echo "To create the parameter, use:"
    echo "  ./scripts/upload-env-to-aws.sh frontend $ENVIRONMENT env.frontend.$ENVIRONMENT $AWS_REGION"
    echo ""
    echo "Creating empty .env file to prevent build errors..."
    touch .env
fi

# Note about backend configuration
echo ""
echo "🔒 Backend configuration is stored separately at: $BACKEND_PARAMETER"
echo "   Backend variables are NOT included in frontend builds for security"
echo "   Access backend config in Supabase Edge Functions or server-side code only"

echo "🔍 Current .env file contents:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat .env 2>/dev/null || echo "(empty)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
