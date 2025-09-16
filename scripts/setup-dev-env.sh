#!/bin/bash
# Setup development environment variables

echo "🔧 Setting up development environment..."

# Copy frontend environment variables to .env
if [ -f "env.frontend.dev" ]; then
    cp env.frontend.dev .env
    echo "✅ Copied env.frontend.dev to .env"
else
    echo "❌ env.frontend.dev not found"
    exit 1
fi

# Verify required variables are set
echo ""
echo "🔍 Verifying environment variables..."

# Check if .env file has required variables
if grep -q "VITE_SUPABASE_URL=https://jhelkawgkjohvzsusrnw.supabase.co" .env; then
    echo "✅ VITE_SUPABASE_URL is set to DEV project"
else
    echo "❌ VITE_SUPABASE_URL is missing or incorrect"
fi

if grep -q "VITE_SUPABASE_ANON_KEY=" .env; then
    echo "✅ VITE_SUPABASE_ANON_KEY is set"
else
    echo "❌ VITE_SUPABASE_ANON_KEY is missing"
fi

echo ""
echo "🎯 Environment setup complete!"
echo "📋 Next steps:"
echo "   1. Run: npm run dev"
echo "   2. Test authentication with lasha@telagri.com"
echo ""
