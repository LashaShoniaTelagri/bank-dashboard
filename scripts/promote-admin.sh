#!/bin/bash

# TelAgri Bank Dashboard - Promote User to Admin
# Usage: bun run promote-admin your@email.com

set -e

if [ $# -eq 0 ]; then
    echo "❌ Please provide an email address"
    echo "Usage: bun run promote-admin your@email.com"
    exit 1
fi

EMAIL="$1"

echo "👑 Promoting user to admin: $EMAIL"
echo ""

# Execute the promotion function
RESULT=$(supabase db execute --format csv -c "SELECT public.promote_user_to_admin('$EMAIL');" 2>&1)

if echo "$RESULT" | grep -q "SUCCESS:"; then
    echo "✅ $RESULT"
    echo ""
    echo "🎉 User $EMAIL is now an admin!"
    echo "They can now:"
    echo "- Access the admin dashboard"
    echo "- Manage banks and users"
    echo "- Invite other team members"
else
    echo "❌ Failed to promote user:"
    echo "$RESULT"
    echo ""
    echo "💡 Make sure:"
    echo "- The user has signed up and confirmed their email"
    echo "- You're connected to the correct database"
    echo "- The email address is correct"
    exit 1
fi 