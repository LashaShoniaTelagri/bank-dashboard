#!/bin/bash

# TelAgri Monitoring - Create GitHub Actions OIDC Role
# This script creates the GitHub Actions OIDC role manually when CDK can't run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Configuration
AWS_ACCOUNT_ID="183784642322"
GITHUB_ORG="LashaShoniaTelagri"
GITHUB_REPO="bank-dashboard"
ROLE_NAME="GithubActionsRole"

print_status "Creating GitHub Actions OIDC Role for TelAgri Monitoring"
echo "Account ID: $AWS_ACCOUNT_ID"
echo "GitHub Org: $GITHUB_ORG"
echo "GitHub Repo: $GITHUB_REPO"
echo "Role Name: $ROLE_NAME"

# Check AWS CLI
if ! command -v aws >/dev/null 2>&1; then
    print_error "AWS CLI not found. Please install AWS CLI first."
    exit 1
fi

if ! aws sts get-caller-identity >/dev/null 2>&1; then
    print_error "AWS credentials not configured or invalid."
    echo "Please configure AWS credentials using: aws configure"
    exit 1
fi

# Step 1: Create OIDC Identity Provider (if it doesn't exist)
print_status "Creating GitHub OIDC Identity Provider..."

OIDC_PROVIDER_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_PROVIDER_ARN" >/dev/null 2>&1; then
    print_success "GitHub OIDC Provider already exists"
else
    print_status "Creating GitHub OIDC Provider..."
    
    # Get GitHub's OIDC thumbprint
    THUMBPRINT="6938fd4d98bab03faadb97b34396831e3780aea1"
    
    aws iam create-open-id-connect-provider \
        --url "https://token.actions.githubusercontent.com" \
        --client-id-list "sts.amazonaws.com" \
        --thumbprint-list "$THUMBPRINT" \
        --tags Key=Project,Value=TelAgri-Monitoring Key=ManagedBy,Value=Manual-Setup
    
    print_success "GitHub OIDC Provider created"
fi

# Step 2: Create Trust Policy
print_status "Creating trust policy..."

TRUST_POLICY=$(cat <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
                },
                "StringLike": {
                    "token.actions.githubusercontent.com:sub": "repo:${GITHUB_ORG}/${GITHUB_REPO}:*"
                }
            }
        }
    ]
}
EOF
)

# Step 3: Create the Role
print_status "Creating GitHub Actions Role..."

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    print_warning "Role $ROLE_NAME already exists, updating trust policy..."
    
    echo "$TRUST_POLICY" > /tmp/trust-policy.json
    aws iam update-assume-role-policy --role-name "$ROLE_NAME" --policy-document file:///tmp/trust-policy.json
    rm /tmp/trust-policy.json
    
    print_success "Role trust policy updated"
else
    print_status "Creating new role..."
    
    echo "$TRUST_POLICY" > /tmp/trust-policy.json
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/trust-policy.json \
        --description "GitHub Actions role for TelAgri Monitoring deployment" \
        --tags Key=Project,Value=TelAgri-Monitoring Key=ManagedBy,Value=Manual-Setup
    rm /tmp/trust-policy.json
    
    print_success "Role created"
fi

# Step 4: Attach necessary policies
print_status "Attaching policies to role..."

# Basic policies needed for CDK deployment
POLICIES=(
    "arn:aws:iam::aws:policy/AWSCloudFormationFullAccess"
    "arn:aws:iam::aws:policy/AmazonS3FullAccess"
    "arn:aws:iam::aws:policy/CloudFrontFullAccess"
    "arn:aws:iam::aws:policy/IAMFullAccess"
    "arn:aws:iam::aws:policy/AWSKeyManagementServicePowerUser"
)

for policy in "${POLICIES[@]}"; do
    print_status "Attaching policy: $(basename "$policy")"
    aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "$policy" || print_warning "Policy may already be attached"
done

# Step 5: Create inline policy for Parameter Store
print_status "Creating Parameter Store inline policy..."

PARAMETER_STORE_POLICY=$(cat <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ssm:GetParameter",
                "ssm:GetParameters",
                "ssm:GetParametersByPath",
                "ssm:PutParameter",
                "ssm:DeleteParameter"
            ],
            "Resource": [
                "arn:aws:ssm:*:${AWS_ACCOUNT_ID}:parameter/telagri/monitoring/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "kms:Decrypt",
                "kms:DescribeKey",
                "kms:GenerateDataKey",
                "kms:CreateKey",
                "kms:CreateAlias",
                "kms:ListAliases"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "wafv2:*"
            ],
            "Resource": "*"
        }
    ]
}
EOF
)

echo "$PARAMETER_STORE_POLICY" > /tmp/parameter-store-policy.json
aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name "ParameterStoreAccess" \
    --policy-document file:///tmp/parameter-store-policy.json
rm /tmp/parameter-store-policy.json

print_success "Parameter Store policy attached"

# Step 6: Verify role
print_status "Verifying role creation..."

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
print_success "Role created successfully!"
echo "Role ARN: $ROLE_ARN"

echo ""
print_success "🎉 GitHub Actions OIDC Role setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Your GitHub Actions should now be able to authenticate"
echo "2. The CDK deployment should work"
echo "3. CDK will take over management of this role going forward"
echo ""
echo "🔧 Role Details:"
echo "  Name: $ROLE_NAME"
echo "  ARN: $ROLE_ARN"
echo "  GitHub Repo: $GITHUB_ORG/$GITHUB_REPO"
