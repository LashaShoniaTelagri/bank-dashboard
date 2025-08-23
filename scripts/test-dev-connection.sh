#!/bin/bash

# TelAgri Bank Dashboard - Test Development Connection Script
# This script helps test your development Supabase project connection

set -e

echo "🔍 TelAgri Bank Dashboard - Test Development Connection"
echo "======================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get development project details
echo "📋 Please provide your development Supabase project details:"
echo ""
echo "💡 Note: Get your database password from:"
echo "   https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/database"
echo ""

read -p "🔗 Development Project ID: " DEV_PROJECT_ID
if [ -z "$DEV_PROJECT_ID" ]; then
  echo -e "${RED}❌ Project ID is required${NC}"
  exit 1
fi

read -p "🔑 Development Project DB Password: " -s DEV_DB_PASSWORD
if [ -z "$DEV_DB_PASSWORD" ]; then
  echo ""
  echo -e "${RED}❌ Database password is required${NC}"
  exit 1
fi

echo ""
echo "🔧 Testing connection to development project..."

# Construct database URL using direct connection format
echo "🔗 Using direct database connection format..."
DEV_DB_URL="postgresql://postgres:${DEV_DB_PASSWORD}@db.${DEV_PROJECT_ID}.supabase.co:5432/postgres"

echo "🔗 Testing direct database connection..."

# Test connection with a simple query
if psql "$DEV_DB_URL" -c "SELECT version();" 2>/dev/null; then
  echo -e "${GREEN}✅ Direct database connection successful!${NC}"
else
  echo -e "${RED}❌ Direct database connection failed${NC}"
  echo ""
  echo "💡 Troubleshooting steps:"
  echo "1. Verify your project ID: $DEV_PROJECT_ID"
  echo "2. Get the correct database password from:"
  echo "   https://supabase.com/dashboard/project/$DEV_PROJECT_ID/settings/database"
  echo "3. Make sure you're using the 'Database password', not your account password"
  echo "4. If the password was recently reset, wait a few minutes for it to propagate"
  exit 1
fi

echo ""
echo "🔗 Testing Supabase CLI connection..."

# Test supabase migration list
if supabase migration list --db-url "$DEV_DB_URL" >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Supabase CLI connection successful!${NC}"
else
  echo -e "${YELLOW}⚠️ Supabase CLI connection had issues, but this is often normal${NC}"
fi

echo ""
echo "🔗 Testing project linking..."

# Test project linking
if supabase link --project-ref "$DEV_PROJECT_ID" --password "$DEV_DB_PASSWORD" 2>/dev/null; then
  echo -e "${GREEN}✅ Project linking successful!${NC}"
  
  # Test function deployment capability
  echo ""
  echo "🔗 Testing Edge Functions support..."
  if supabase functions list >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Edge Functions support working!${NC}"
  else
    echo -e "${YELLOW}⚠️ Edge Functions may need additional setup${NC}"
  fi
  
else
  echo -e "${YELLOW}⚠️ Project linking had issues, but database connection works${NC}"
  echo "This is normal - the setup script uses direct database connections"
fi

echo ""
echo -e "${GREEN}🎉 Connection test completed!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. If all tests passed, run: bun run setup:dev"
echo "2. If there were issues, verify your credentials and try again"
echo "3. Make sure you're using the database password, not your Supabase account password" 