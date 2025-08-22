#!/bin/bash

# TelAgri AWS Setup Validation Script
# This script validates AWS configuration and permissions for CDK deployment

set -e  # Exit on any error

echo "🔍 TelAgri AWS Setup Validation"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Success/failure counters
SUCCESS=0
FAILURES=0

# Function to print success
success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((SUCCESS++))
}

# Function to print failure
failure() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILURES++))
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print info
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo "📋 Required Environment Variables:"
echo "=================================="

# Check required environment variables
REQUIRED_VARS=(
    "AWS_ACCOUNT_ID"
    "AWS_REGION"
    "DOMAIN_NAME"
    "HOSTED_ZONE_ID"
    "CERTIFICATE_ARN"
    "CROSS_ACCOUNT_ROLE_ARN"
    "ROOT_ACCOUNT_ID"
    "ENVIRONMENT"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        failure "$var is not set"
    else
        success "$var is set: ${!var}"
    fi
done

echo ""
echo "🔐 AWS Authentication:"
echo "====================="

# Check AWS CLI authentication
if aws sts get-caller-identity &> /dev/null; then
    CALLER_ID=$(aws sts get-caller-identity --output json)
    ACCOUNT=$(echo $CALLER_ID | jq -r '.Account')
    USER_ARN=$(echo $CALLER_ID | jq -r '.Arn')
    success "AWS CLI authenticated as: $USER_ARN"
    success "Current AWS Account: $ACCOUNT"
    
    # Verify account matches environment variable
    if [ "$ACCOUNT" = "${AWS_ACCOUNT_ID:-}" ]; then
        success "Account ID matches AWS_ACCOUNT_ID environment variable"
    else
        warning "Account ID ($ACCOUNT) does not match AWS_ACCOUNT_ID (${AWS_ACCOUNT_ID:-not set})"
    fi
else
    failure "AWS CLI not authenticated. Run 'aws configure' first."
fi

echo ""
echo "🎯 AWS Region:"
echo "============="

# Check current region
CURRENT_REGION=$(aws configure get region || echo "not set")
if [ "$CURRENT_REGION" = "${AWS_REGION:-us-east-1}" ]; then
    success "Current region ($CURRENT_REGION) matches AWS_REGION"
else
    warning "Current region ($CURRENT_REGION) does not match AWS_REGION (${AWS_REGION:-us-east-1})"
fi

echo ""
echo "📜 SSL Certificate:"
echo "=================="

# Check SSL certificate
if [ -n "$CERTIFICATE_ARN" ]; then
    if aws acm describe-certificate --certificate-arn "$CERTIFICATE_ARN" --region us-east-1 &> /dev/null; then
        CERT_STATUS=$(aws acm describe-certificate --certificate-arn "$CERTIFICATE_ARN" --region us-east-1 --query 'Certificate.Status' --output text)
        CERT_DOMAIN=$(aws acm describe-certificate --certificate-arn "$CERTIFICATE_ARN" --region us-east-1 --query 'Certificate.DomainName' --output text)
        
        if [ "$CERT_STATUS" = "ISSUED" ]; then
            success "SSL certificate is valid and issued for domain: $CERT_DOMAIN"
        else
            failure "SSL certificate status is: $CERT_STATUS (should be ISSUED)"
        fi
    else
        failure "Cannot access SSL certificate: $CERTIFICATE_ARN"
        info "Make sure the certificate exists in us-east-1 region"
    fi
else
    warning "CERTIFICATE_ARN not set - skipping certificate validation"
fi

echo ""
echo "🌐 Route 53 Setup:"
echo "=================="

# Check Route 53 hosted zone
if [ -n "$HOSTED_ZONE_ID" ]; then
    # Try to access hosted zone directly first
    if aws route53 get-hosted-zone --id "$HOSTED_ZONE_ID" &> /dev/null; then
        ZONE_NAME=$(aws route53 get-hosted-zone --id "$HOSTED_ZONE_ID" --query 'HostedZone.Name' --output text | sed 's/\.$//')
        success "Route 53 hosted zone accessible: $ZONE_NAME"
        
        # Check if domain matches
        if [ -n "$DOMAIN_NAME" ] && [[ "$DOMAIN_NAME" == *"$ZONE_NAME" ]]; then
            success "Domain ($DOMAIN_NAME) matches hosted zone ($ZONE_NAME)"
        else
            warning "Domain ($DOMAIN_NAME) may not match hosted zone ($ZONE_NAME)"
        fi
    else
        warning "Cannot access hosted zone directly. Checking cross-account role..."
        
        # Try cross-account role assumption
        if [ -n "$CROSS_ACCOUNT_ROLE_ARN" ]; then
            if aws sts assume-role --role-arn "$CROSS_ACCOUNT_ROLE_ARN" --role-session-name "validation-test" &> /dev/null; then
                success "Can assume cross-account role: $CROSS_ACCOUNT_ROLE_ARN"
                info "Route 53 access should work through cross-account role"
            else
                failure "Cannot assume cross-account role: $CROSS_ACCOUNT_ROLE_ARN"
            fi
        else
            failure "CROSS_ACCOUNT_ROLE_ARN not set and cannot access hosted zone directly"
        fi
    fi
else
    warning "HOSTED_ZONE_ID not set - skipping Route 53 validation"
fi

echo ""
echo "🏗️ CDK Bootstrap:"
echo "=================="

# Check CDK bootstrap
if cdk doctor &> /dev/null; then
    success "CDK is properly configured"
else
    warning "CDK may not be properly configured. Run 'cdk doctor' for details"
fi

# Check if environment is bootstrapped
BOOTSTRAP_STACK_NAME="CDKToolkit"
if aws cloudformation describe-stacks --stack-name "$BOOTSTRAP_STACK_NAME" &> /dev/null; then
    success "CDK environment is bootstrapped"
else
    warning "CDK environment is not bootstrapped. Run 'cdk bootstrap' first"
fi

echo ""
echo "📊 IAM Permissions Check:"
echo "========================="

# Check basic permissions
PERMISSIONS_TO_CHECK=(
    "cloudformation:ListStacks"
    "s3:ListAllMyBuckets"
    "cloudfront:ListDistributions"
    "wafv2:ListWebACLs"
    "acm:ListCertificates"
)

for permission in "${PERMISSIONS_TO_CHECK[@]}"; do
    SERVICE=$(echo $permission | cut -d':' -f1)
    ACTION=$(echo $permission | cut -d':' -f2)
    
    case $SERVICE in
        "cloudformation")
            if aws cloudformation list-stacks --max-items 1 &> /dev/null; then
                success "CloudFormation permissions: OK"
            else
                failure "CloudFormation permissions: DENIED"
            fi
            ;;
        "s3")
            if aws s3 ls &> /dev/null; then
                success "S3 permissions: OK"
            else
                failure "S3 permissions: DENIED"
            fi
            ;;
        "cloudfront")
            if aws cloudfront list-distributions --max-items 1 &> /dev/null; then
                success "CloudFront permissions: OK"
            else
                failure "CloudFront permissions: DENIED"
            fi
            ;;
        "wafv2")
            if aws wafv2 list-web-acls --scope CLOUDFRONT --max-items 1 &> /dev/null; then
                success "WAF permissions: OK"
            else
                warning "WAF permissions: DENIED (may be due to no existing WAF resources)"
            fi
            ;;
        "acm")
            if aws acm list-certificates --region us-east-1 --max-items 1 &> /dev/null; then
                success "ACM permissions: OK"
            else
                failure "ACM permissions: DENIED"
            fi
            ;;
    esac
done

echo ""
echo "📈 Summary:"
echo "==========="

echo -e "${GREEN}✅ Successful checks: $SUCCESS${NC}"
if [ $FAILURES -gt 0 ]; then
    echo -e "${RED}❌ Failed checks: $FAILURES${NC}"
fi

echo ""
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Your AWS setup is ready for TelAgri deployment.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run: cd cdk && npm run deploy"
    echo "2. Or push to GitHub to trigger automated deployment"
else
    echo -e "${RED}⚠️  Some checks failed. Please fix the issues above before deploying.${NC}"
    echo ""
    echo "Common fixes:"
    echo "1. Set missing environment variables"
    echo "2. Configure AWS credentials: aws configure"
    echo "3. Bootstrap CDK: cd cdk && cdk bootstrap"
    echo "4. Check IAM permissions for your AWS user/role"
    exit 1
fi 