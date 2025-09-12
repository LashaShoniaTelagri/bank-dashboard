#!/bin/bash

# Simple script to create a system admin user in TelAgri Monitoring
# Usage: ./scripts/create-admin-user.sh [environment]

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

echo -e "${BLUE}🔐 TelAgri Monitoring - Create System Admin${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""
echo -e "📧 Admin Email: ${GREEN}${ADMIN_EMAIL}${NC}"
echo -e "🌍 Environment: ${GREEN}${ENVIRONMENT}${NC}"
echo ""

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

# Create SQL file for admin creation
ADMIN_SQL="scripts/temp_admin_setup.sql"
cat > "$ADMIN_SQL" << EOF
-- Create system admin user for TelAgri Monitoring
-- This script handles both auth.users and public.profiles

DO \$\$
DECLARE
    admin_user_id uuid;
    existing_user_id uuid;
    hashed_password text;
BEGIN
    -- Check if user already exists in auth.users
    SELECT id INTO existing_user_id 
    FROM auth.users 
    WHERE email = '${ADMIN_EMAIL}';
    
    IF existing_user_id IS NOT NULL THEN
        RAISE NOTICE 'User % already exists with ID: %', '${ADMIN_EMAIL}', existing_user_id;
        admin_user_id := existing_user_id;
        
        -- Update password for existing user
        UPDATE auth.users 
        SET 
            encrypted_password = crypt('${ADMIN_PASSWORD}', gen_salt('bf')),
            updated_at = NOW(),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW())
        WHERE id = existing_user_id;
        
        RAISE NOTICE 'Updated password for existing user';
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
            aud
        ) VALUES (
            admin_user_id,
            '00000000-0000-0000-0000-000000000000',
            '${ADMIN_EMAIL}',
            crypt('${ADMIN_PASSWORD}', gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            'authenticated',
            'authenticated'
        );
        
        RAISE NOTICE 'Created new user % with ID: %', '${ADMIN_EMAIL}', admin_user_id;
    END IF;
    
    -- Create or update profile with admin role
    INSERT INTO public.profiles (user_id, role, bank_id, created_at)
    VALUES (admin_user_id, 'admin', NULL, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        role = 'admin',
        bank_id = NULL;
    
    RAISE NOTICE 'Admin profile created/updated for user: %', admin_user_id;
    
    -- Verify the setup
    IF EXISTS (
        SELECT 1 FROM public.profiles p 
        JOIN auth.users u ON p.user_id = u.id 
        WHERE u.email = '${ADMIN_EMAIL}' AND p.role = 'admin'
    ) THEN
        RAISE NOTICE '✅ SUCCESS: System admin setup completed!';
        RAISE NOTICE 'Email: %', '${ADMIN_EMAIL}';
        RAISE NOTICE 'Role: admin';
        RAISE NOTICE 'Bank: NULL (system admin)';
    ELSE
        RAISE EXCEPTION 'Failed to verify admin setup';
    END IF;
END
\$\$;

-- Display the created admin user
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

echo -e "${BLUE}📝 Creating admin user in database...${NC}"

# Ask user where to run the command
echo -e "${YELLOW}🎯 Where do you want to create the admin user?${NC}"
echo "1) Cloud Supabase (Remote Database)"
echo "2) Local Supabase (Local Development)"
echo ""
read -p "Enter your choice (1 or 2): " DB_CHOICE

case $DB_CHOICE in
    1)
        echo -e "${BLUE}🌐 Using Cloud Supabase...${NC}"
        
        # Get project details
        if [ "$ENVIRONMENT" = "prod" ]; then
            PROJECT_REF="jhelkawgkjohvzsusrnw"
        else
            PROJECT_REF="imncjxfppzikerifyukk"
        fi
        
        echo -e "${YELLOW}🔑 Please enter your Supabase database password:${NC}"
        read -s DB_PASSWORD
        echo ""
        
        if [ -z "$DB_PASSWORD" ]; then
            echo -e "${RED}❌ Error: Database password is required${NC}"
            exit 1
        fi
        
        # Execute SQL using psql through Supabase connection
        DB_URL="postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"
        
        if command -v psql &> /dev/null; then
            if PGPASSWORD="$DB_PASSWORD" psql "$DB_URL" -f "$ADMIN_SQL"; then
                SUCCESS=true
            else
                SUCCESS=false
            fi
        else
            echo -e "${YELLOW}⚠️  psql not found, trying alternative method...${NC}"
            # Alternative: use curl to execute via Supabase API (if available)
            echo -e "${RED}❌ psql is required for cloud database access${NC}"
            echo "Please install PostgreSQL client: brew install postgresql"
            exit 1
        fi
        ;;
    2)
        echo -e "${BLUE}🏠 Using Local Supabase...${NC}"
        
        # Check if local Supabase is running
        if ! supabase status &> /dev/null; then
            echo -e "${RED}❌ Error: Local Supabase is not running${NC}"
            echo "Please start it with: supabase start"
            exit 1
        fi
        
        # Execute SQL on local database
        if supabase db reset --linked=false && cat "$ADMIN_SQL" | supabase db push --linked=false; then
            SUCCESS=true
        else
            # Try alternative method for local
            if psql "postgresql://postgres:postgres@localhost:54322/postgres" -f "$ADMIN_SQL"; then
                SUCCESS=true
            else
                SUCCESS=false
            fi
        fi
        ;;
    *)
        echo -e "${RED}❌ Invalid choice. Please run the script again.${NC}"
        exit 1
        ;;
esac

if [ "$SUCCESS" = true ]; then
    echo ""
    echo -e "${GREEN}🎉 SUCCESS: System admin created successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Login Details:${NC}"
    echo -e "   📧 Email: ${GREEN}${ADMIN_EMAIL}${NC}"
    echo -e "   🔑 Password: ${GREEN}[The password you entered]${NC}"
    echo -e "   🛡️  Role: ${GREEN}System Administrator${NC}"
    echo ""
    echo -e "${YELLOW}🚀 Next Steps:${NC}"
    echo -e "   1. Open your TelAgri Monitoring dashboard"
    echo -e "   2. Click 'Sign In'"
    echo -e "   3. Enter your email and password"
    echo -e "   4. You'll have full admin access to:"
    echo -e "      • User Management"
    echo -e "      • Bank Management" 
    echo -e "      • Farmer Management"
    echo -e "      • F-100 Reports"
    echo -e "      • System Settings"
    echo ""
    echo -e "${BLUE}🔐 Security Recommendations:${NC}"
    echo -e "   • Enable 2FA after first login"
    echo -e "   • Use a strong, unique password"
    echo -e "   • Regularly review admin access logs"
    echo ""
else
    echo ""
    echo -e "${RED}❌ FAILED: Could not create system admin${NC}"
    echo ""
    echo -e "${YELLOW}💡 Troubleshooting:${NC}"
    echo -e "   1. Make sure you're connected to the internet"
    echo -e "   2. Verify Supabase project is accessible"
    echo -e "   3. Check if you have the correct permissions"
    echo -e "   4. Try running: supabase status"
    echo ""
    exit 1
fi

# Clean up temporary file
rm -f "$ADMIN_SQL"

echo -e "${GREEN}✅ Admin user creation completed!${NC}"
