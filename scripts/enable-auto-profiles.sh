#!/bin/bash

# TelAgri Bank Dashboard - Enable Auto Profile Creation
# This enables automatic profile creation for all new user signups

set -e

echo "🔧 Enabling automatic profile creation for new signups..."
echo ""

# Create the trigger
supabase db execute -c "
-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for auto-profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
"

echo "✅ Automatic profile creation enabled!"
echo ""
echo "📋 How it works:"
echo "- First user to sign up becomes admin automatically"
echo "- Subsequent users get bank_viewer profiles"
echo "- Admins can later promote users or assign them to banks"
echo ""
echo "💡 To disable this feature later, run: bun run disable-auto-profiles" 