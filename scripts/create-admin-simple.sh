#!/bin/bash

# Simple script to create admin user SQL for TelAgri Monitoring
# This generates SQL that you can copy-paste into Supabase SQL Editor

set -e

# Configuration
ADMIN_EMAIL="lasha@telagri.com"
ENVIRONMENT=${1:-"dev"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 TelAgri Monitoring - Generate Admin SQL${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""
echo -e "📧 Admin Email: ${GREEN}${ADMIN_EMAIL}${NC}"
echo -e "🌍 Environment: ${GREEN}${ENVIRONMENT}${NC}"
echo ""

# Prompt for password
echo -e "${YELLOW}🔑 Please enter a secure password for ${ADMIN_EMAIL}:${NC}"
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

# Generate SQL
ADMIN_SQL_FILE="scripts/generated-admin-${ENVIRONMENT}.sql"

cat > "$ADMIN_SQL_FILE" << EOF
-- TelAgri Monitoring: Create System Admin User
-- Generated: $(date)
-- Email: ${ADMIN_EMAIL}
-- Environment: ${ENVIRONMENT}
-- 
-- INSTRUCTIONS:
-- 1. Copy this entire SQL script
-- 2. Go to your Supabase Dashboard
-- 3. Navigate to SQL Editor
-- 4. Paste and run this script

DO \$\$
DECLARE
    admin_user_id uuid;
    existing_user_id uuid;
    admin_email text := '${ADMIN_EMAIL}';
    admin_password text := '${ADMIN_PASSWORD}';
BEGIN
    RAISE NOTICE '🔐 Creating system admin for TelAgri Monitoring';
    RAISE NOTICE 'Email: %', admin_email;
    RAISE NOTICE 'Environment: ${ENVIRONMENT}';
    RAISE NOTICE '';
    
    -- Check if user already exists in auth.users
    SELECT id INTO existing_user_id 
    FROM auth.users 
    WHERE email = admin_email;
    
    IF existing_user_id IS NOT NULL THEN
        RAISE NOTICE '👤 User already exists with ID: %', existing_user_id;
        admin_user_id := existing_user_id;
        
        -- Update password and confirm email for existing user
        UPDATE auth.users 
        SET 
            encrypted_password = crypt(admin_password, gen_salt('bf')),
            updated_at = NOW(),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            confirmation_token = '',
            email_change_token_new = '',
            recovery_token = ''
        WHERE id = existing_user_id;
        
        RAISE NOTICE '🔄 Updated password and confirmed email for existing user';
    ELSE
        -- Create new user
        admin_user_id := gen_random_uuid();
        
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
            admin_user_id,
            '00000000-0000-0000-0000-000000000000',
            admin_email,
            crypt(admin_password, gen_salt('bf')),
            NOW(), -- Email confirmed immediately
            NOW(),
            NOW(),
            'authenticated',
            'authenticated',
            '', -- No confirmation needed
            '',
            ''
        );
        
        RAISE NOTICE '✨ Created new user % with ID: %', admin_email, admin_user_id;
    END IF;
    
    -- Create or update profile with admin role
    INSERT INTO public.profiles (user_id, role, bank_id, created_at)
    VALUES (admin_user_id, 'admin', NULL, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        role = 'admin',
        bank_id = NULL;
    
    RAISE NOTICE '👑 Admin profile created/updated for user: %', admin_user_id;
    
    -- Verify the setup
    IF EXISTS (
        SELECT 1 FROM public.profiles p 
        JOIN auth.users u ON p.user_id = u.id 
        WHERE u.email = admin_email AND p.role = 'admin'
    ) THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 SUCCESS: System admin setup completed!';
        RAISE NOTICE '📧 Email: %', admin_email;
        RAISE NOTICE '🛡️  Role: System Administrator';
        RAISE NOTICE '🏦 Bank Access: All Banks (NULL bank_id)';
        RAISE NOTICE '✅ Email Confirmed: YES';
        RAISE NOTICE '';
        RAISE NOTICE '🚀 You can now login to TelAgri Monitoring with:';
        RAISE NOTICE '   Email: %', admin_email;
        RAISE NOTICE '   Password: [the password you entered]';
    ELSE
        RAISE EXCEPTION '❌ Failed to verify admin setup';
    END IF;
    
    -- Final success messages
    RAISE NOTICE '';
    RAISE NOTICE '✅ Admin creation completed successfully!';
    RAISE NOTICE '🎯 Next steps:';
    RAISE NOTICE '   1. Login to your TelAgri Monitoring dashboard';
    RAISE NOTICE '   2. Use email: ${ADMIN_EMAIL}';
    RAISE NOTICE '   3. Use the password you provided';
    RAISE NOTICE '   4. You will have full system administrator access';
END
\$\$;

-- Display the created admin user details
SELECT 
    '📋 Admin User Details' as info,
    u.id as user_id,
    u.email,
    p.role,
    p.bank_id,
    u.created_at,
    u.email_confirmed_at IS NOT NULL as email_confirmed,
    CASE 
        WHEN p.role = 'admin' AND p.bank_id IS NULL THEN 'System Administrator'
        WHEN p.role = 'admin' THEN 'Bank Administrator'
        WHEN p.role = 'bank_viewer' THEN 'Bank Viewer'
        ELSE 'Unknown Role'
    END as role_description
FROM auth.users u
JOIN public.profiles p ON u.id = p.user_id
WHERE u.email = '${ADMIN_EMAIL}';

-- Verify admin permissions
SELECT 
    '🔐 Permission Verification' as info,
    'Admin can manage all resources' as permission,
    EXISTS(
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = (SELECT id FROM auth.users WHERE email = '${ADMIN_EMAIL}')
        AND p.role = 'admin'
    ) as has_permission;
EOF

echo -e "${GREEN}✅ SQL script generated successfully!${NC}"
echo ""
echo -e "${BLUE}📄 Generated file: ${GREEN}${ADMIN_SQL_FILE}${NC}"
echo ""
echo -e "${YELLOW}🎯 Next Steps:${NC}"
echo "1. Open your Supabase Dashboard"
echo "2. Go to SQL Editor"
echo "3. Copy and paste the contents of: ${ADMIN_SQL_FILE}"
echo "4. Click 'Run' to execute the SQL"
echo ""
echo -e "${BLUE}🔗 Quick Access:${NC}"
if [ "$ENVIRONMENT" = "prod" ]; then
    echo "   Production: https://supabase.com/dashboard/project/jhelkawgkjohvzsusrnw/sql"
else
    echo "   Development: https://supabase.com/dashboard/project/imncjxfppzikerifyukk/sql"
fi
echo ""
echo -e "${GREEN}📋 Your admin login will be:${NC}"
echo -e "   📧 Email: ${GREEN}${ADMIN_EMAIL}${NC}"
echo -e "   🔑 Password: ${GREEN}[the password you entered]${NC}"
echo ""

# Display the SQL content for easy copying
echo -e "${YELLOW}📄 SQL Content (copy this to Supabase SQL Editor):${NC}"
echo -e "${BLUE}================================================${NC}"
cat "$ADMIN_SQL_FILE"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${GREEN}✅ Ready to create your admin account!${NC}"
