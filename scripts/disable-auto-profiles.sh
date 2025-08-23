#!/bin/bash

# TelAgri Bank Dashboard - Disable Auto Profile Creation
# This disables automatic profile creation for new signups

set -e

echo "🔧 Disabling automatic profile creation..."
echo ""

# Drop the trigger
supabase db execute -c "
-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
"

echo "✅ Automatic profile creation disabled!"
echo ""
echo "📋 What this means:"
echo "- New users will NOT get profiles automatically"
echo "- You must invite users through the admin dashboard"
echo "- This is the recommended approach for production"
echo ""
echo "💡 To re-enable this feature, run: bun run enable-auto-profiles" 