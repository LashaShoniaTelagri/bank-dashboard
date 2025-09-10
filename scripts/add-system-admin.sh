#!/bin/bash

# Script to add a system administrator to TelAgri Monitoring
# This script creates a user in Supabase Auth and assigns admin role
# Usage: ./scripts/add-system-admin.sh [email] [password] [environment]

set -e

# Configuration
ADMIN_EMAIL=${1:-"lasha@telagri.com"}
ADMIN_PASSWORD=${2:-""}
ENVIRONMENT=${3:-"dev"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 TelAgri Monitoring - System Admin Setup${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""
echo -e "📧 Admin Email: ${GREEN}${ADMIN_EMAIL}${NC}"
echo -e "🌍 Environment: ${GREEN}${ENVIRONMENT}${NC}"
echo ""

# Validate inputs
if [ -z "$ADMIN_EMAIL" ]; then
    echo -e "${RED}❌ Error: Admin email is required${NC}"
    echo "Usage: $0 <email> [password] [environment]"
    exit 1
fi

# Prompt for password if not provided
if [ -z "$ADMIN_PASSWORD" ]; then
    echo -e "${YELLOW}🔑 Please enter a secure password for the admin account:${NC}"
    read -s ADMIN_PASSWORD
    echo ""
    
    if [ -z "$ADMIN_PASSWORD" ]; then
        echo -e "${RED}❌ Error: Password cannot be empty${NC}"
        exit 1
    fi
    
    if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
        echo -e "${RED}❌ Error: Password must be at least 8 characters long${NC}"
        exit 1
    fi
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Error: Supabase CLI is not installed${NC}"
    echo "Please install it with: npm install -g supabase"
    exit 1
fi

# Check if we're in the correct directory
if [ ! -f "supabase/config.toml" ]; then
    echo -e "${RED}❌ Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Link to the correct Supabase project
echo -e "${BLUE}🔗 Linking to Supabase project...${NC}"
if [ "$ENVIRONMENT" = "prod" ]; then
    PROJECT_ID="jhelkawgkjohvzsusrnw"
else
    PROJECT_ID="imncjxfppzikerifyukk"
fi

# Create temporary SQL file for admin creation
TEMP_SQL=$(mktemp)
cat > "$TEMP_SQL" << EOF
-- TelAgri Monitoring: System Admin Creation
-- Email: ${ADMIN_EMAIL}
-- Environment: ${ENVIRONMENT}
-- Generated: $(date)

-- Step 1: Create user in auth.users (if not exists)
DO \$\$
DECLARE
    user_uuid uuid;
    existing_user_id uuid;
BEGIN
    -- Check if user already exists
    SELECT id INTO existing_user_id 
    FROM auth.users 
    WHERE email = '${ADMIN_EMAIL}';
    
    IF existing_user_id IS NOT NULL THEN
        RAISE NOTICE '👤 User already exists with ID: %', existing_user_id;
        user_uuid := existing_user_id;
    ELSE
        -- Generate new UUID for user
        user_uuid := gen_random_uuid();
        
        -- Insert into auth.users
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            role,
            aud,
            confirmation_token,
            email_change_token_new,
            recovery_token
        ) VALUES (
            user_uuid,
            '00000000-0000-0000-0000-000000000000',
            '${ADMIN_EMAIL}',
            crypt('${ADMIN_PASSWORD}', gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            'authenticated',
            'authenticated',
            '',
            '',
            ''
        );
        
        RAISE NOTICE '✅ Created new user with ID: %', user_uuid;
    END IF;
    
    -- Step 2: Create or update profile with admin role
    INSERT INTO public.profiles (user_id, role, bank_id, created_at)
    VALUES (user_uuid, 'admin', NULL, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        role = 'admin',
        bank_id = NULL,
        created_at = COALESCE(profiles.created_at, NOW());
    
    RAISE NOTICE '🔐 Admin profile created/updated for user: %', user_uuid;
    
    -- Step 3: Verify the setup
    PERFORM 1 FROM public.profiles p 
    JOIN auth.users u ON p.user_id = u.id 
    WHERE u.email = '${ADMIN_EMAIL}' AND p.role = 'admin';
    
    IF FOUND THEN
        RAISE NOTICE '✅ System admin setup completed successfully!';
        RAISE NOTICE '📧 Email: ${ADMIN_EMAIL}';
        RAISE NOTICE '🔑 Role: admin';
        RAISE NOTICE '🏦 Bank: NULL (system admin)';
    ELSE
        RAISE EXCEPTION '❌ Failed to verify admin setup';
    END IF;
END
\$\$;

-- Step 4: Display admin user info
SELECT 
    u.id as user_id,
    u.email,
    p.role,
    p.bank_id,
    u.created_at,
    u.email_confirmed_at IS NOT NULL as email_confirmed
FROM auth.users u
JOIN public.profiles p ON u.id = p.user_id
WHERE u.email = '${ADMIN_EMAIL}';
EOF

echo -e "${BLUE}📝 Executing admin creation SQL...${NC}"
echo ""

# Execute the SQL
if supabase db push --db-url "postgresql://postgres:$(echo $SUPABASE_DB_PASSWORD)@db.${PROJECT_ID}.supabase.co:5432/postgres" --file "$TEMP_SQL"; then
    echo ""
    echo -e "${GREEN}🎉 SUCCESS: System admin created successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Admin Account Details:${NC}"
    echo -e "   📧 Email: ${GREEN}${ADMIN_EMAIL}${NC}"
    echo -e "   🔑 Role: ${GREEN}admin${NC}"
    echo -e "   🏦 Bank: ${GREEN}NULL (system admin)${NC}"
    echo -e "   🌍 Environment: ${GREEN}${ENVIRONMENT}${NC}"
    echo ""
    echo -e "${YELLOW}🔐 Next Steps:${NC}"
    echo -e "   1. Visit your TelAgri Monitoring dashboard"
    echo -e "   2. Sign in with: ${GREEN}${ADMIN_EMAIL}${NC}"
    echo -e "   3. Use the password you provided"
    echo -e "   4. You should have full admin access to all features"
    echo ""
    echo -e "${BLUE}🛡️  Security Note:${NC}"
    echo -e "   • Change your password after first login"
    echo -e "   • Enable 2FA for enhanced security"
    echo -e "   • This admin account has full system access"
    echo ""
else
    echo ""
    echo -e "${RED}❌ FAILED: Could not create system admin${NC}"
    echo -e "${YELLOW}💡 Troubleshooting:${NC}"
    echo -e "   1. Check your Supabase connection"
    echo -e "   2. Verify SUPABASE_DB_PASSWORD is set"
    echo -e "   3. Ensure you have database admin permissions"
    echo -e "   4. Check the Supabase project ID is correct"
    exit 1
fi

# Clean up
rm -f "$TEMP_SQL"

echo -e "${GREEN}✅ Admin setup completed successfully!${NC}"
