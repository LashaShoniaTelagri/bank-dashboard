#!/bin/bash

# TelAgri GitHub Actions OIDC Role Setup
# This script creates the necessary AWS IAM role for GitHub Actions deployment

set -e  # Exit on any error

echo "🔐 Setting up GitHub Actions OIDC Role for TelAgri..."
echo ""

# Configuration
ACCOUNT_ID="183784642322"
ROLE_NAME="GitHubActionsRole"
GITHUB_REPO="LashaShoniaTelagri/bank-dashboard"

echo "📋 Configuration:"
echo "   AWS Account: $ACCOUNT_ID"
echo "   Role Name: $ROLE_NAME"
echo "   GitHub Repository: $GITHUB_REPO"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI not configured. Run 'aws configure' first."
    exit 1
fi

CURRENT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
if [ "$CURRENT_ACCOUNT" != "$ACCOUNT_ID" ]; then
    echo "⚠️  Warning: Current AWS account ($CURRENT_ACCOUNT) doesn't match expected account ($ACCOUNT_ID)"
    echo "   Make sure you're in the correct AWS account."
fi

echo "✅ AWS CLI configured for account: $CURRENT_ACCOUNT"
echo ""

# Step 1: Create OIDC Identity Provider
echo "🔗 Step 1: Creating GitHub OIDC Identity Provider..."

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" &> /dev/null; then
    echo "✅ OIDC Provider already exists"
else
    aws iam create-open-id-connect-provider \
        --url https://token.actions.githubusercontent.com \
        --client-id-list sts.amazonaws.com \
        --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
    echo "✅ OIDC Provider created successfully"
fi

echo ""

# Step 2: Create Trust Policy
echo "📄 Step 2: Creating trust policy for GitHub Actions..."

cat > /tmp/github-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:$GITHUB_REPO:*"
        }
      }
    }
  ]
}
EOF

echo "✅ Trust policy created"

# Step 3: Create IAM Role
echo "👤 Step 3: Creating IAM role..."

if aws iam get-role --role-name "$ROLE_NAME" &> /dev/null; then
    echo "⚠️  Role $ROLE_NAME already exists. Updating trust policy..."
    aws iam update-assume-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-document file:///tmp/github-trust-policy.json
    echo "✅ Trust policy updated"
else
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/github-trust-policy.json \
        --description "GitHub Actions role for TelAgri Bank Dashboard deployment"
    echo "✅ Role created successfully"
fi

echo ""

# Step 4: Attach Permissions Policy
echo "🔑 Step 4: Attaching deployment permissions..."

# For now, using AdministratorAccess for simplicity
# In production, you should create a more restrictive policy
aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

echo "✅ Permissions attached (AdministratorAccess)"

echo ""

# Cleanup
rm -f /tmp/github-trust-policy.json

# Step 5: Display Results
echo "🎉 Setup Complete!"
echo ""
echo "📋 Role Details:"
echo "   Role ARN: arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"
echo "   OIDC Provider: arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
echo ""
echo "🔄 Next Steps:"
echo "1. Add this GitHub Repository Variable:"
echo "   AWS_ROLE_ARN = arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"
echo ""
echo "2. Add other required variables:"
echo "   AWS_ACCOUNT_ID = $ACCOUNT_ID"
echo "   AWS_REGION = us-east-1"
echo "   CERTIFICATE_ARN = arn:aws:acm:us-east-1:$ACCOUNT_ID:certificate/01bf431a-ee0c-4003-bfa4-717daf70fa3b"
echo ""
echo "3. Commit and push your code to trigger deployment!"
echo ""
echo "🔍 Test the role:"
echo "   aws sts assume-role --role-arn arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME --role-session-name test"
echo ""
echo "🚀 Ready for GitHub Actions deployment!" 