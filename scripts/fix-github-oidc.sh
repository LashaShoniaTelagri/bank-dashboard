#!/bin/bash

# Fix GitHub OIDC Trust Policy for TelAgri
# This script fixes common OIDC authentication issues

set -e

echo "🔍 Debugging and Fixing GitHub OIDC Authentication..."
echo ""

ACCOUNT_ID="183784642322"
ROLE_NAME="GitHubActionsRole" 
GITHUB_REPO="LashaShoniaTelagri/bank-dashboard"

echo "📋 Configuration:"
echo "   Account: $ACCOUNT_ID"
echo "   Role: $ROLE_NAME"
echo "   Repository: $GITHUB_REPO"
echo ""

# Step 1: Check if OIDC provider exists
echo "🔗 Step 1: Checking OIDC Provider..."
if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" >/dev/null 2>&1; then
    echo "✅ OIDC Provider exists"
else
    echo "❌ OIDC Provider missing - creating it..."
    aws iam create-open-id-connect-provider \
        --url https://token.actions.githubusercontent.com \
        --client-id-list sts.amazonaws.com \
        --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
        --thumbprint-list 1c58a3a8518e8759bf075b76b750d4f2df264fcd
    echo "✅ OIDC Provider created with updated thumbprints"
fi

echo ""

# Step 2: Create/Update Trust Policy with more permissive conditions for debugging
echo "📄 Step 2: Creating fixed trust policy..."

# More permissive trust policy for debugging
cat > /tmp/github-trust-policy-debug.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::183784642322:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:LashaShoniaTelagri/bank-dashboard:*"
          ]
        }
      }
    }
  ]
}
EOF

echo "✅ Trust policy created"

# Step 3: Update the role trust policy
echo "👤 Step 3: Updating role trust policy..."

aws iam update-assume-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-document file:///tmp/github-trust-policy-debug.json

echo "✅ Trust policy updated successfully"

echo ""

# Step 4: Verify the role exists and show its ARN
echo "🔍 Step 4: Verifying role..."
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text 2>/dev/null || echo "Error getting role")

if [[ "$ROLE_ARN" == arn:aws:iam::* ]]; then
    echo "✅ Role verified: $ROLE_ARN"
else
    echo "❌ Role verification failed: $ROLE_ARN"
    exit 1
fi

echo ""

# Step 5: Test the trust policy
echo "🧪 Step 5: Testing OIDC configuration..."

# List OIDC providers to confirm
echo "📋 Current OIDC Providers:"
aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[?contains(Arn, `token.actions.githubusercontent.com`)].Arn' --output text

echo ""

# Cleanup
rm -f /tmp/github-trust-policy-debug.json

echo "🎉 OIDC Configuration Updated!"
echo ""
echo "📋 Next Steps:"
echo "1. Make sure these GitHub Repository Variables are set:"
echo "   AWS_ROLE_ARN = $ROLE_ARN"
echo "   AWS_ACCOUNT_ID = $ACCOUNT_ID"
echo "   AWS_REGION = us-east-1"
echo "   CERTIFICATE_ARN = arn:aws:acm:us-east-1:$ACCOUNT_ID:certificate/01bf431a-ee0c-4003-bfa4-717daf70fa3b"
echo ""
echo "2. Verify your GitHub repository name is exactly: $GITHUB_REPO"
echo ""
echo "3. Try running the GitHub Action again"
echo ""
echo "🔍 Debug Tips:"
echo "- Check that your repository is public or the OIDC token has proper permissions"
echo "- Verify the repository name matches exactly (case-sensitive)"
echo "- Make sure the GitHub Action is running from the correct branch/ref"
echo ""
echo "✅ Ready to test GitHub Actions deployment!" 