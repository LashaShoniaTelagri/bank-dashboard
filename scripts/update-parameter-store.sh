#!/bin/bash

# TelAgri Monitoring - Update AWS Parameter Store
# Script to update environment configuration in AWS Parameter Store
# Usage: ./scripts/update-parameter-store.sh <type> <environment> [env-file] [region]
# 
# Examples:
#   ./scripts/update-parameter-store.sh frontend dev
#   ./scripts/update-parameter-store.sh backend prod env.backend.prod
#   ./scripts/update-parameter-store.sh frontend dev .env.frontend.dev us-east-1

set -e

TYPE=${1:-frontend}  # frontend or backend
ENVIRONMENT=${2:-dev}
# Auto-detect environment file if not specified
if [ -n "$3" ]; then
    ENV_FILE="$3"
elif [ -f "env.backend.$ENVIRONMENT" ] && [ "$TYPE" = "backend" ]; then
    ENV_FILE="env.backend.$ENVIRONMENT"
elif [ -f ".env.$TYPE.$ENVIRONMENT" ]; then
    ENV_FILE=".env.$TYPE.$ENVIRONMENT"
elif [ -f "env.$TYPE.$ENVIRONMENT" ]; then
    ENV_FILE="env.$TYPE.$ENVIRONMENT"
elif [ -f ".env" ] && [ "$ENVIRONMENT" = "dev" ]; then
    ENV_FILE=".env"
else
    ENV_FILE="env.$TYPE.$ENVIRONMENT"
fi

AWS_REGION=${4:-us-east-1}
PARAMETER_NAME="/telagri/monitoring/$ENVIRONMENT/$TYPE/env"

echo "🚀 Updating AWS Parameter Store configuration"
echo "Type: $TYPE"
echo "Environment: $ENVIRONMENT"
echo "Source File: $ENV_FILE"
echo "Region: $AWS_REGION"
echo "Parameter Name: $PARAMETER_NAME"

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file not found: $ENV_FILE"
    echo "Please create the environment file first or specify a different file"
    exit 1
fi

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

echo "📋 Processing environment file: $ENV_FILE"

# Read the entire environment file content
ENV_CONTENT=$(cat "$ENV_FILE")

# Validate that the file contains environment variables
if ! echo "$ENV_CONTENT" | grep -q '^[A-Z_][A-Z0-9_]*='; then
    echo "⚠️ Warning: No environment variables found in $ENV_FILE"
    echo "Expected format: VARIABLE_NAME=value"
fi

echo "📝 Uploading environment configuration as single parameter..."

# Upload the entire file content as a single SecureString parameter
if aws ssm put-parameter \
    --name "$PARAMETER_NAME" \
    --value "$ENV_CONTENT" \
    --type "SecureString" \
    --overwrite \
    --description "Environment configuration for $ENVIRONMENT" \
    --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "✅ Environment configuration uploaded successfully!"
else
    echo "❌ Failed to upload environment configuration"
    exit 1
fi

echo ""
echo "📋 Upload Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Parameter Name: $PARAMETER_NAME"
echo "Parameter Type: SecureString (KMS encrypted)"
echo "Environment: $ENVIRONMENT"
echo "Variables Count: $(echo "$ENV_CONTENT" | grep -c '^[A-Z_][A-Z0-9_]*=' || echo "0")"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Variables included:"
echo "$ENV_CONTENT" | grep '^[A-Z_][A-Z0-9_]*=' | cut -d'=' -f1 | sed 's/^/  - /' || echo "  No variables found"
echo ""
echo "🔍 To verify, run:"
echo "  aws ssm get-parameter --name '$PARAMETER_NAME' --with-decryption --region $AWS_REGION"
echo ""
echo "🚀 To fetch in CI/CD, run:"
echo "  ./scripts/fetch-env-from-aws.sh $ENVIRONMENT $AWS_REGION"
echo ""
echo "📋 Update commands for all types:"
echo "  # Frontend: ./scripts/update-parameter-store.sh frontend $ENVIRONMENT"
echo "  # Backend:  ./scripts/update-parameter-store.sh backend $ENVIRONMENT"
echo ""
echo "🔧 Quick update commands:"
echo "  # Update dev backend:  ./scripts/update-parameter-store.sh backend dev"
echo "  # Update prod frontend: ./scripts/update-parameter-store.sh frontend prod"
