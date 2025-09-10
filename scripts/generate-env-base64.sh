#!/bin/bash

# Script to generate base64 encoded environment files for GitHub Secrets
# Usage: ./scripts/generate-env-base64.sh <environment>

set -e

ENVIRONMENT=${1:-dev}
ENV_FILE="env.${ENVIRONMENT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔧 Generating base64 encoded environment file for: $ENVIRONMENT"

# Check if environment file exists
if [ ! -f "$PROJECT_ROOT/$ENV_FILE" ]; then
    echo "❌ Environment file not found: $ENV_FILE"
    echo "📝 Creating template file..."
    
    # Create environment-specific file from template
    cp "$PROJECT_ROOT/env.template" "$PROJECT_ROOT/$ENV_FILE"
    
    echo "✅ Created $ENV_FILE from template"
    echo "📋 Please edit $ENV_FILE with your environment-specific values"
    echo ""
    echo "Example values for $ENVIRONMENT environment:"
    case "$ENVIRONMENT" in
        "dev")
            echo "  VITE_SUPABASE_URL=https://your-project.supabase.co"
            echo "  VITE_SUPABASE_ANON_KEY=your-anon-key"
            echo "  VITE_CALENDLY_URL=https://calendly.com/your-dev-account"
            echo "  VITE_APP_ENVIRONMENT=development"
            ;;
        "staging")
            echo "  VITE_SUPABASE_URL=https://your-staging-project.supabase.co"
            echo "  VITE_SUPABASE_ANON_KEY=your-staging-anon-key"
            echo "  VITE_CALENDLY_URL=https://calendly.com/your-staging-account"
            echo "  VITE_APP_ENVIRONMENT=staging"
            ;;
        "prod")
            echo "  VITE_SUPABASE_URL=https://your-prod-project.supabase.co"
            echo "  VITE_SUPABASE_ANON_KEY=your-prod-anon-key"
            echo "  VITE_CALENDLY_URL=https://calendly.com/your-prod-account"
            echo "  VITE_APP_ENVIRONMENT=production"
            ;;
    esac
    echo ""
    echo "After editing, run this script again to generate the base64 string."
    exit 0
fi

# Generate base64 encoded string
echo "📦 Encoding $ENV_FILE to base64..."
BASE64_STRING=$(base64 -i "$PROJECT_ROOT/$ENV_FILE")

echo ""
echo "✅ Base64 encoded environment configuration:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$BASE64_STRING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 GitHub Secret Configuration:"
echo "  Secret Name: ENV_${ENVIRONMENT^^}_BASE64"
echo "  Secret Value: (copy the base64 string above)"
echo ""
echo "🔗 To add this secret to GitHub:"
echo "  1. Go to: https://github.com/your-org/your-repo/settings/secrets/actions"
echo "  2. Click 'New repository secret'"
echo "  3. Name: ENV_${ENVIRONMENT^^}_BASE64"
echo "  4. Value: (paste the base64 string)"
echo "  5. Click 'Add secret'"
echo ""
echo "🔍 Environment file contents (for verification):"
echo "$(cat "$PROJECT_ROOT/$ENV_FILE")"

