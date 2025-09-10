#!/bin/bash

# Script to test the environment configuration setup
# Usage: ./scripts/test-env-setup.sh [environment] [region]

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-us-east-1}

echo "🧪 Testing environment configuration setup"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"

# Test 1: Check if AWS CLI is available
echo ""
echo "🔍 Test 1: AWS CLI availability"
if command -v aws >/dev/null 2>&1; then
    echo "✅ AWS CLI is available: $(aws --version)"
else
    echo "❌ AWS CLI not found"
    exit 1
fi

# Test 2: Check AWS credentials
echo ""
echo "🔍 Test 2: AWS credentials"
if aws sts get-caller-identity >/dev/null 2>&1; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo "✅ AWS credentials valid for account: $ACCOUNT_ID"
else
    echo "❌ AWS credentials invalid or not configured"
    exit 1
fi

# Test 3: Check if parameters exist
echo ""
echo "🔍 Test 3: Parameter existence"
FRONTEND_PARAM="/telagri/monitoring/$ENVIRONMENT/frontend/env"
BACKEND_PARAM="/telagri/monitoring/$ENVIRONMENT/backend/env"

# Check frontend parameter
if aws ssm get-parameter --name "$FRONTEND_PARAM" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "✅ Frontend parameter exists: $FRONTEND_PARAM"
else
    echo "❌ Frontend parameter missing: $FRONTEND_PARAM"
    echo "   Run: ./scripts/upload-env-to-aws.sh frontend $ENVIRONMENT env.frontend.$ENVIRONMENT $AWS_REGION"
fi

# Check backend parameter
if aws ssm get-parameter --name "$BACKEND_PARAM" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "✅ Backend parameter exists: $BACKEND_PARAM"
else
    echo "⚠️ Backend parameter missing: $BACKEND_PARAM"
    echo "   Run: ./scripts/upload-env-to-aws.sh backend $ENVIRONMENT env.backend.$ENVIRONMENT $AWS_REGION"
fi

# Test 4: Test fetch script
echo ""
echo "🔍 Test 4: Environment fetch test"
if ./scripts/fetch-env-from-aws.sh "$ENVIRONMENT" "$AWS_REGION" >/dev/null 2>&1; then
    if [ -f ".env" ]; then
        VITE_COUNT=$(grep -c '^VITE_' .env || echo "0")
        echo "✅ Environment fetch successful - found $VITE_COUNT VITE_ variables"
        
        # Show first few variables (without values for security)
        echo "📋 Sample variables:"
        grep '^VITE_' .env | head -3 | cut -d'=' -f1 | sed 's/^/   - /'
    else
        echo "❌ Environment fetch failed - no .env file created"
    fi
else
    echo "❌ Environment fetch script failed"
fi

# Test 5: Check for sensitive data in .env
echo ""
echo "🔍 Test 5: Security validation"
if [ -f ".env" ]; then
    # Check for backend secrets that shouldn't be in frontend .env
    SENSITIVE_VARS=$(grep -E '^(SENDGRID_|SUPABASE_SERVICE_|JWT_|SECRET_|PASSWORD)' .env || echo "")
    if [ -n "$SENSITIVE_VARS" ]; then
        echo "❌ SECURITY ISSUE: Sensitive backend variables found in .env:"
        echo "$SENSITIVE_VARS"
        echo "   These should only be in backend parameters!"
    else
        echo "✅ No sensitive backend variables found in frontend .env"
    fi
    
    # Clean up test .env file
    rm -f .env
fi

echo ""
echo "🎯 Test Summary Complete"
echo "If all tests pass, your environment configuration is ready for GitHub Actions!"
