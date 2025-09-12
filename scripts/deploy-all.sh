#!/bin/bash

# TelAgri Monitoring - Flexible Deployment Script
# This script handles Edge Functions deployment dynamically and safely

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to validate environment
validate_environment() {
    print_status "Validating environment..."
    
    # Check if Supabase CLI is installed
    if ! command_exists supabase; then
        print_error "Supabase CLI is not installed. Please install it first:"
        echo "curl -sSfL https://supabase.com/install.sh | sh"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -d "supabase" ]; then
        print_error "This script must be run from the project root directory"
        exit 1
    fi
    
    print_success "Environment validation passed"
}

# Function to load environment variables
load_environment() {
    local env_file="$1"
    
    if [ ! -f "$env_file" ]; then
        print_error "Environment file not found: $env_file"
        exit 1
    fi
    
    print_status "Loading environment from: $env_file"
    
    # Source the environment file
    set -a  # Automatically export all variables
    source "$env_file"
    set +a  # Stop auto-exporting
    
    # Validate required variables
    local required_vars=("SUPABASE_PROJECT_ID" "SUPABASE_DB_PASSWORD")
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    print_success "Environment loaded successfully"
}

# Function to link to Supabase project
link_project() {
    print_status "Linking to Supabase project: $SUPABASE_PROJECT_ID"
    
    if supabase link --project-ref "$SUPABASE_PROJECT_ID" --password "$SUPABASE_DB_PASSWORD"; then
        print_success "Successfully linked to Supabase project"
    else
        print_error "Failed to link to Supabase project"
        exit 1
    fi
}

# Function to deploy Edge Functions dynamically
deploy_edge_functions() {
    print_status "Deploying Edge Functions..."
    
    local functions_dir="supabase/functions"
    local deployed_count=0
    local failed_count=0
    
    if [ ! -d "$functions_dir" ]; then
        print_warning "No Edge Functions directory found at $functions_dir"
        return 0
    fi
    
    # Find all function directories
    for function_dir in "$functions_dir"/*/; do
        if [ -d "$function_dir" ]; then
            local function_name=$(basename "$function_dir")
            
            print_status "Deploying function: $function_name"
            
            if supabase functions deploy "$function_name" --no-verify-jwt; then
                print_success "Successfully deployed: $function_name"
                ((deployed_count++))
            else
                print_error "Failed to deploy: $function_name"
                ((failed_count++))
            fi
        fi
    done
    
    if [ $failed_count -eq 0 ]; then
        print_success "All Edge Functions deployed successfully ($deployed_count functions)"
    else
        print_error "$failed_count functions failed to deploy"
        exit 1
    fi
}

# Function to set Edge Function secrets
set_edge_function_secrets() {
    print_status "Setting Edge Function secrets..."
    
    # Define required secrets with their environment variable names
    declare -A secrets=(
        ["PROJECT_URL"]="${PROJECT_URL:-${VITE_SUPABASE_URL}}"
        ["SERVICE_ROLE_KEY"]="${SERVICE_ROLE_KEY}"
        ["SENDGRID_API_KEY"]="${SENDGRID_API_KEY}"
        ["SENDGRID_FROM_EMAIL"]="${SENDGRID_FROM_EMAIL:-noreply@telagri.com}"
    )
    
    local set_count=0
    local skip_count=0
    
    for secret_name in "${!secrets[@]}"; do
        local secret_value="${secrets[$secret_name]}"
        
        # Skip if value is empty or is a placeholder
        if [ -z "$secret_value" ] || [[ "$secret_value" == REPLACE_WITH_* ]]; then
            print_warning "Skipping secret $secret_name (not configured or placeholder value)"
            ((skip_count++))
            continue
        fi
        
        print_status "Setting secret: $secret_name"
        
        if supabase secrets set "$secret_name=$secret_value"; then
            print_success "Successfully set secret: $secret_name"
            ((set_count++))
        else
            print_error "Failed to set secret: $secret_name"
            exit 1
        fi
    done
    
    print_success "Secrets configured: $set_count set, $skip_count skipped"
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Check migration status first
    print_status "Checking current migration status..."
    supabase migration list --linked || print_warning "Could not retrieve migration list"
    
    # Apply migrations
    if supabase db push --linked; then
        print_success "Migrations applied successfully"
    else
        print_error "Migration failed"
        exit 1
    fi
    
    # Post-migration validation
    print_status "Post-migration validation..."
    supabase migration list --linked
    
    if supabase db diff --linked >/dev/null 2>&1; then
        print_warning "Schema differences detected after migration"
    else
        print_success "No schema differences - migrations fully applied"
    fi
}

# Main deployment function
main() {
    local environment=""
    local skip_migrations=false
    local skip_functions=false
    local env_file=""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                environment="$2"
                shift 2
                ;;
            --skip-migrations)
                skip_migrations=true
                shift
                ;;
            --skip-functions)
                skip_functions=true
                shift
                ;;
            --env-file)
                env_file="$2"
                shift 2
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  -e, --environment ENV    Environment (dev, staging, prod)"
                echo "  --env-file FILE          Path to environment file"
                echo "  --skip-migrations        Skip database migrations"
                echo "  --skip-functions         Skip Edge Functions deployment"
                echo "  -h, --help              Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Determine environment file if not specified
    if [ -z "$env_file" ]; then
        if [ -n "$environment" ]; then
            env_file="env.backend.$environment"
        else
            # Try to detect environment file
            if [ -f "env.backend.dev" ]; then
                env_file="env.backend.dev"
                environment="dev"
            elif [ -f ".env" ]; then
                env_file=".env"
                environment="local"
            else
                print_error "No environment file found. Please specify with --env-file or create env.backend.dev"
                exit 1
            fi
        fi
    fi
    
    print_status "Starting TelAgri Monitoring deployment..."
    print_status "Environment: ${environment:-auto-detected}"
    print_status "Environment file: $env_file"
    
    # Run deployment steps
    validate_environment
    load_environment "$env_file"
    link_project
    
    if [ "$skip_migrations" = false ]; then
        run_migrations
    else
        print_warning "Skipping database migrations"
    fi
    
    if [ "$skip_functions" = false ]; then
        deploy_edge_functions
        set_edge_function_secrets
    else
        print_warning "Skipping Edge Functions deployment"
    fi
    
    print_success "🎉 TelAgri Monitoring deployment completed successfully!"
    print_status "Environment: $environment"
    print_status "Project ID: $SUPABASE_PROJECT_ID"
    
    if [ -n "$VITE_APP_URL" ]; then
        print_status "App URL: $VITE_APP_URL"
    fi
}

# Run main function with all arguments
main "$@"
