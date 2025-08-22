#!/bin/bash

# TelAgri Bank Dashboard - Supabase Migration Setup Validator
# This script helps validate your local and GitHub Actions setup for database migrations

set -e

echo "🧪 TelAgri Migration Setup Validator"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check environment variables
echo "🔐 Checking Environment Variables"
echo "================================="

if [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
    print_success "SUPABASE_ACCESS_TOKEN is set"
    
    # Test authentication
    echo "Testing Supabase authentication..."
    if supabase projects list &> /dev/null; then
        print_success "Supabase API authentication successful"
    else
        print_error "Supabase API authentication failed"
        print_info "Please check your SUPABASE_ACCESS_TOKEN"
    fi
else
    print_warning "SUPABASE_ACCESS_TOKEN not set"
    print_info "Set it with: export SUPABASE_ACCESS_TOKEN=your_token"
fi

if [ -n "$SUPABASE_DB_PASSWORD" ]; then
    print_success "SUPABASE_DB_PASSWORD is set"
    
    # Test database linking
    echo "Testing database linking..."
    if supabase link --project-ref imncjxfppzikerifyukk --password "$SUPABASE_DB_PASSWORD" &> /dev/null; then
        print_success "Database linking successful"
        
        echo "Testing migration commands..."
        if supabase migration list &> /dev/null; then
            print_success "Migration list command works"
        else
            print_warning "Migration list failed"
        fi
        
        if supabase db push --dry-run &> /dev/null; then
            print_success "Migration push dry-run works"
        else
            print_warning "Migration push dry-run failed"
        fi
    else
        print_error "Database linking failed"
        print_info "Check your database password or try resetting it"
    fi
else
    print_warning "SUPABASE_DB_PASSWORD not set"
    print_info "Set it with: export SUPABASE_DB_PASSWORD=your_db_password"
fi

echo ""

# GitHub secrets validation
echo "🔑 GitHub Secrets Checklist"
echo "==========================="

print_info "Required secrets for GitHub Actions:"
echo "  1. SUPABASE_ACCESS_TOKEN - Your personal access token"
echo "  2. SUPABASE_PROJECT_ID - imncjxfppzikerifyukk"
echo "  3. SUPABASE_DB_PASSWORD - Your database password"
echo ""
print_info "To set secrets:"
echo "  1. Go to GitHub repository → Settings → Secrets and variables → Actions"
echo "  2. Click 'New repository secret'"
echo "  3. Add each required secret"

echo ""

# Migration status
echo "📊 Current Migration Status"
echo "=========================="

if [ -n "$SUPABASE_DB_PASSWORD" ] && [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "Local migrations:"
    ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l | xargs echo "  Found migrations:"
    
    echo ""
    echo "Remote migration status:"
    if supabase migration list 2>/dev/null; then
        print_success "Migration history retrieved"
    else
        print_warning "Could not retrieve migration history"
    fi
else
    print_warning "Skipping migration status - missing environment variables"
fi

echo ""
echo "🎉 Validation complete!" 