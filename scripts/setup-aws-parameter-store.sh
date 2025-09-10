#!/bin/bash

# Script to set up AWS Parameter Store infrastructure for TelAgri Bank Dashboard
# Usage: ./scripts/setup-aws-parameter-store.sh [region] [github-org] [github-repo]

set -e

AWS_REGION=${1:-us-east-1}
GITHUB_ORG=${2:-your-github-org}
GITHUB_REPO=${3:-telagri-bank-dashboard}
STACK_NAME="telagri-bank-dashboard-parameter-store"

echo "🚀 Setting up AWS Parameter Store infrastructure"
echo "Region: $AWS_REGION"
echo "GitHub Org: $GITHUB_ORG"
echo "GitHub Repo: $GITHUB_REPO"
echo "Stack Name: $STACK_NAME"

# Check if AWS CLI is available
if ! command -v aws >/dev/null 2>&1; then
    echo "❌ AWS CLI not found. Please install AWS CLI first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "❌ AWS credentials not configured or invalid."
    exit 1
fi

echo "✅ AWS credentials verified"

# Check if GitHub OIDC provider exists
echo "🔍 Checking GitHub OIDC provider..."
if ! aws iam get-open-id-connect-provider \
    --open-id-connect-provider-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):oidc-provider/token.actions.githubusercontent.com" \
    >/dev/null 2>&1; then
    
    echo "📦 Creating GitHub OIDC provider..."
    aws iam create-open-id-connect-provider \
        --url "https://token.actions.githubusercontent.com" \
        --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" \
        --client-id-list "sts.amazonaws.com"
    echo "✅ GitHub OIDC provider created"
else
    echo "✅ GitHub OIDC provider already exists"
fi

# Deploy CloudFormation stack
echo "📦 Deploying Parameter Store CloudFormation stack..."
aws cloudformation deploy \
    --template-file aws/parameter-store-setup.yaml \
    --stack-name "$STACK_NAME" \
    --parameter-overrides \
        GitHubOrg="$GITHUB_ORG" \
        GitHubRepo="$GITHUB_REPO" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION"

if [ $? -eq 0 ]; then
    echo "✅ CloudFormation stack deployed successfully"
else
    echo "❌ Failed to deploy CloudFormation stack"
    exit 1
fi

# Get stack outputs
echo "📋 Getting stack outputs..."
GITHUB_ROLE_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`GitHubActionsRoleArn`].OutputValue' \
    --output text)

KMS_KEY_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`KMSKeyId`].OutputValue' \
    --output text)

echo ""
echo "✅ AWS Parameter Store infrastructure setup complete!"
echo ""
echo "📋 Configuration Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "GitHub Actions Role ARN: $GITHUB_ROLE_ARN"
echo "KMS Key ID: $KMS_KEY_ID"
echo "Parameter Prefix: /telagri/monitoring/{env}/{frontend|backend}/env"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔧 Next Steps:"
echo "1. Update your GitHub repository variables:"
echo "   - AWS_ACCOUNT_ID: $(aws sts get-caller-identity --query Account --output text)"
echo "   - Add this to: Settings → Secrets and variables → Actions → Variables"
echo ""
echo "2. Upload your environment configurations:"
echo "   # Frontend configurations (safe for builds)"
echo "   ./scripts/upload-env-to-aws.sh frontend dev env.frontend.dev $AWS_REGION"
echo "   ./scripts/upload-env-to-aws.sh frontend staging env.frontend.staging $AWS_REGION"
echo "   ./scripts/upload-env-to-aws.sh frontend prod env.frontend.prod $AWS_REGION"
echo ""
echo "   # Backend configurations (server-side only)"
echo "   ./scripts/upload-env-to-aws.sh backend dev env.backend.dev $AWS_REGION"
echo "   ./scripts/upload-env-to-aws.sh backend staging env.backend.staging $AWS_REGION"
echo "   ./scripts/upload-env-to-aws.sh backend prod env.backend.prod $AWS_REGION"
echo ""
echo "3. Test the setup:"
echo "   ./scripts/fetch-env-from-aws.sh dev $AWS_REGION"
echo ""
echo "🔍 To view parameters:"
echo "   aws ssm get-parameters-by-path --path '/telagri/monitoring/' --recursive --region $AWS_REGION"
echo ""
echo "🔍 To view specific configurations:"
echo "   # Frontend: aws ssm get-parameter --name '/telagri/monitoring/dev/frontend/env' --with-decryption --region $AWS_REGION"
echo "   # Backend:  aws ssm get-parameter --name '/telagri/monitoring/dev/backend/env' --with-decryption --region $AWS_REGION"
