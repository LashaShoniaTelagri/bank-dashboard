#!/bin/bash

# TelAgri Bank Dashboard - Development Environment Setup Script
# This script sets up a local Supabase development project

set -e

echo "🌾 TelAgri Bank Dashboard - Development Environment Setup"
echo "=========================================================="

# Check if required tools are installed
check_tools() {
    echo ""
    echo "🔍 Checking required tools..."
    
    if ! command -v bun &> /dev/null; then
        echo "❌ Bun is not installed. Please install it first:"
        echo "   curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi
    
    if ! command -v supabase &> /dev/null; then
        echo "❌ Supabase CLI is not installed. Please install it first:"
        echo "   npm install -g supabase"
        exit 1
    fi
    
    echo "✅ All required tools are installed"
}

# Get user input for Supabase project details
get_project_details() {
    echo ""
    echo "📋 Please provide your development Supabase project details:"
    echo ""
    echo "💡 Note: Get your database password from:"
    echo "   https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/database"
    echo ""
    
    read -p "🔗 Development Project ID: " SUPABASE_PROJECT_ID
    read -s -p "🔑 Development Project DB Password: " SUPABASE_DB_PASSWORD
    echo ""
    
    if [ -z "$SUPABASE_PROJECT_ID" ] || [ -z "$SUPABASE_DB_PASSWORD" ]; then
        echo "❌ Project ID and DB Password are required!"
        exit 1
    fi
}

# Construct database URL (no region detection needed for direct connection)
construct_db_url() {
    echo ""
    echo "🔗 Constructing database connection..."
    
    # Use direct database connection format
    DB_HOST="db.${SUPABASE_PROJECT_ID}.supabase.co"
    DB_PORT="5432"
    
    echo "✅ Using direct database connection to $DB_HOST"
}

# Validate inputs
validate_inputs() {
    echo ""
    echo "🔍 Validating project details..."
    
    if [ ${#SUPABASE_PROJECT_ID} -lt 10 ]; then
        echo "❌ Project ID seems too short. Please check and try again."
        exit 1
    fi
    
    if [ ${#SUPABASE_DB_PASSWORD} -lt 8 ]; then
        echo "❌ DB Password seems too short. Please check and try again."
        exit 1
    fi
    
    echo "✅ Project details validated"
}

# Test database connection
test_connection() {
    echo ""
    echo "🔗 Testing database connection..."
    
    # Construct database URL using direct connection format
    DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${SUPABASE_PROJECT_ID}.supabase.co:5432/postgres"
    
    # Test connection with retry logic
    retry_command() {
        local cmd="$1"
        local max_attempts=3
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            echo "  Attempt $attempt/$max_attempts..."
            
            if output=$(eval "$cmd" 2>&1); then
                echo "  ✅ Connection successful"
                return 0
            else
                echo "  ❌ Connection failed: $output"
                if [ $attempt -eq $max_attempts ]; then
                    return 1
                fi
                echo "  ⏳ Waiting 2 seconds before retry..."
                sleep 2
            fi
            
            ((attempt++))
        done
    }
    
    if retry_command "supabase migration list --db-url '$DB_URL' >/dev/null"; then
        echo "✅ Database connection verified"
    else
        echo "❌ Could not connect to database. Please check your credentials and try again."
        exit 1
    fi
}

# Apply database migrations
apply_migrations() {
    echo ""
    echo "🗄️ Applying database migrations..."
    
    # Construct database URL using direct connection format
    DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${SUPABASE_PROJECT_ID}.supabase.co:5432/postgres"
    
    # Function to retry database operations
    retry_db_operation() {
        local cmd="$1"
        local description="$2"
        local max_attempts=3
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            echo "  $description (attempt $attempt/$max_attempts)..."
            
            if output=$(eval "$cmd" 2>&1); then
                echo "  ✅ $description completed successfully"
                return 0
            else
                echo "  ❌ $description failed: $output"
                
                # Special handling for "up to date" scenarios
                if echo "$output" | grep -q "Remote database is up to date\|already exists"; then
                    echo "  ✅ Database is already up to date"
                    return 0
                fi
                
                if [ $attempt -eq $max_attempts ]; then
                    echo "  🚨 $description failed after $max_attempts attempts"
                    return 1
                fi
                
                echo "  ⏳ Waiting 3 seconds before retry..."
                sleep 3
            fi
            
            ((attempt++))
        done
    }
    
    # Push migrations
    if retry_db_operation "supabase db push --db-url '$DB_URL'" "Database migration"; then
        echo "✅ All migrations applied successfully"
    else
        echo "❌ Migration failed. Please check the error above and try again."
        exit 1
    fi
}

# Set up environment variables for Edge Functions
setup_edge_functions() {
    echo ""
    echo "⚡ Setting up Edge Functions environment..."
    
    # Link to project for Edge Functions
    if supabase link --project-ref "$SUPABASE_PROJECT_ID" >/dev/null 2>&1; then
        echo "✅ Project linked successfully"
    else
        echo "⚠️ Could not link project for Edge Functions (this is optional for basic setup)"
    fi
    
    # Set basic environment variables (user can add more later)
    echo "💡 You can set Edge Function environment variables later using:"
    echo "   supabase secrets set SENDGRID_API_KEY=your_key"
    echo "   supabase secrets set SENDGRID_FROM_EMAIL=your_email"
    echo "   supabase secrets set SITE_URL=http://localhost:5173"
}

# Create .env.local file
create_env_file() {
    echo ""
    echo "📝 Creating .env.local file..."
    
    cat > .env.local << EOF
# Supabase Development Configuration
VITE_SUPABASE_URL=https://${SUPABASE_PROJECT_ID}.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ1MTkyODM1LCJleHAiOjE5NjA3Njg4MzV9

# Development Database Connection (for migrations)
SUPABASE_PROJECT_ID=${SUPABASE_PROJECT_ID}
SUPABASE_DB_PASSWORD=${SUPABASE_DB_PASSWORD}

# Edge Functions Environment
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@telagri.com
SITE_URL=http://localhost:5173
EOF
    
    echo "✅ .env.local file created"
    echo "⚠️ Please update the VITE_SUPABASE_ANON_KEY with your actual anon key from:"
    echo "   https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/settings/api"
}

# Provide next steps for admin setup
provide_admin_setup_instructions() {
    echo ""
    echo "👑 ADMIN SETUP REQUIRED"
    echo "======================"
    echo ""
    echo "Your database is ready, but you need to create an admin user to access the dashboard."
    echo ""
    echo "📋 Choose one of these approaches:"
    echo ""
    echo "1️⃣ AUTOMATIC (First User Becomes Admin):"
    echo "   - Sign up through the app UI at http://localhost:5173"
    echo "   - The first user will automatically become admin"
    echo "   - No additional setup needed"
    echo ""
    echo "2️⃣ MANUAL (Promote Specific User):"
    echo "   - Sign up through the app UI first"
    echo "   - Then run: bun run promote-admin your@email.com"
    echo ""
    echo "3️⃣ ENABLE AUTO-PROFILE CREATION:"
    echo "   - Run: bun run enable-auto-profiles"
    echo "   - All future signups will get profiles automatically"
    echo ""
    echo "💡 After admin setup, you can invite other users through the dashboard."
}

# Main execution
main() {
    check_tools
    get_project_details
    construct_db_url
    validate_inputs
    test_connection
    apply_migrations
    setup_edge_functions
    create_env_file
    provide_admin_setup_instructions
    
    echo ""
    echo "🎉 Development Environment Setup Complete!"
    echo ""
    echo "Next steps:"
    echo "1. Update your .env.local file with the correct ANON_KEY"
    echo "2. Set up your admin user (see instructions above)"
    echo "3. Start development: bun run dev"
    echo ""
    echo "Happy coding! 🚀"
}

# Run the main function
main "$@" 