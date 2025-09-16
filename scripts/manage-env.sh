#!/bin/bash

# TelAgri Monitoring - Interactive Environment Management
# Easy-to-use script for managing AWS Parameter Store environment variables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}🌾 TelAgri Monitoring - Environment Management${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

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

# Function to show menu
show_menu() {
    echo ""
    echo -e "${YELLOW}What would you like to do?${NC}"
    echo "1. 📤 Update Parameter Store (upload local env file)"
    echo "2. 📥 Fetch from Parameter Store (download to local file)"
    echo "3. 👀 View Parameter Store values"
    echo "4. 🧪 Test Parameter Store setup"
    echo "5. 📋 List all parameters"
    echo "6. ❌ Exit"
    echo ""
}

# Function to get user input
get_input() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    if [ -n "$default" ]; then
        echo -ne "${CYAN}$prompt [$default]: ${NC}"
    else
        echo -ne "${CYAN}$prompt: ${NC}"
    fi
    
    read input
    if [ -z "$input" ] && [ -n "$default" ]; then
        input="$default"
    fi
    
    eval "$var_name='$input'"
}

# Function to select environment type
select_type() {
    echo ""
    echo -e "${YELLOW}Select environment type:${NC}"
    echo "1. Frontend (public variables, safe for builds)"
    echo "2. Backend (sensitive variables, server-side only)"
    echo ""
    
    while true; do
        get_input "Choose type (1-2)" "1" choice
        case $choice in
            1) TYPE="frontend"; break ;;
            2) TYPE="backend"; break ;;
            *) print_error "Please choose 1 or 2" ;;
        esac
    done
}

# Function to select environment
select_environment() {
    echo ""
    echo -e "${YELLOW}Select environment:${NC}"
    echo "1. Development (dev)"
    echo "2. Production (prod)"
    echo "3. Custom"
    echo ""
    
    while true; do
        get_input "Choose environment (1-3)" "1" choice
        case $choice in
            1) ENVIRONMENT="dev"; break ;;
            2) ENVIRONMENT="prod"; break ;;
            3) get_input "Enter custom environment name" "" ENVIRONMENT; break ;;
            *) print_error "Please choose 1-3" ;;
        esac
    done
}

# Function to update parameter store
update_parameter_store() {
    print_status "Updating Parameter Store..."
    
    select_type
    select_environment
    
    echo ""
    print_status "Configuration:"
    echo "  Type: $TYPE"
    echo "  Environment: $ENVIRONMENT"
    echo "  Parameter: /telagri/monitoring/$ENVIRONMENT/$TYPE/env"
    
    # Auto-detect environment file
    local env_file=""
    if [ -f "env.backend.$ENVIRONMENT" ] && [ "$TYPE" = "backend" ]; then
        env_file="env.backend.$ENVIRONMENT"
    elif [ -f ".env.$TYPE.$ENVIRONMENT" ]; then
        env_file=".env.$TYPE.$ENVIRONMENT"
    elif [ -f "env.$TYPE.$ENVIRONMENT" ]; then
        env_file="env.$TYPE.$ENVIRONMENT"
    elif [ -f ".env" ] && [ "$ENVIRONMENT" = "dev" ]; then
        env_file=".env"
    fi
    
    if [ -n "$env_file" ] && [ -f "$env_file" ]; then
        print_success "Found environment file: $env_file"
        get_input "Use this file? (y/n)" "y" use_file
        if [ "$use_file" != "y" ] && [ "$use_file" != "Y" ]; then
            get_input "Enter path to environment file" "" env_file
        fi
    else
        get_input "Enter path to environment file" "env.$TYPE.$ENVIRONMENT" env_file
    fi
    
    echo ""
    print_status "Updating Parameter Store..."
    
    if ./scripts/update-parameter-store.sh "$TYPE" "$ENVIRONMENT" "$env_file"; then
        print_success "Parameter Store updated successfully!"
    else
        print_error "Failed to update Parameter Store"
        return 1
    fi
}

# Function to fetch from parameter store
fetch_parameter_store() {
    print_status "Fetching from Parameter Store..."
    
    select_environment
    
    echo ""
    print_status "Fetching environment configuration for: $ENVIRONMENT"
    
    if ./scripts/fetch-env-from-aws.sh "$ENVIRONMENT"; then
        print_success "Environment configuration fetched successfully!"
    else
        print_error "Failed to fetch environment configuration"
        return 1
    fi
}

# Function to view parameter store values
view_parameter_store() {
    print_status "Viewing Parameter Store values..."
    
    select_type
    select_environment
    
    local parameter_name="/telagri/monitoring/$ENVIRONMENT/$TYPE/env"
    
    echo ""
    print_status "Fetching parameter: $parameter_name"
    
    if aws ssm get-parameter --name "$parameter_name" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null; then
        echo ""
        print_success "Parameter retrieved successfully"
    else
        print_error "Parameter not found or access denied"
        echo "Make sure you have AWS credentials configured and the parameter exists"
        return 1
    fi
}

# Function to test parameter store setup
test_parameter_store() {
    print_status "Testing Parameter Store setup..."
    
    select_environment
    
    echo ""
    print_status "Testing environment: $ENVIRONMENT"
    
    # Check if parameters exist
    local frontend_param="/telagri/monitoring/$ENVIRONMENT/frontend/env"
    local backend_param="/telagri/monitoring/$ENVIRONMENT/backend/env"
    
    echo ""
    print_status "Checking frontend parameter: $frontend_param"
    if aws ssm get-parameter --name "$frontend_param" >/dev/null 2>&1; then
        print_success "Frontend parameter exists"
    else
        print_warning "Frontend parameter missing"
    fi
    
    print_status "Checking backend parameter: $backend_param"
    if aws ssm get-parameter --name "$backend_param" >/dev/null 2>&1; then
        print_success "Backend parameter exists"
    else
        print_warning "Backend parameter missing"
    fi
    
    echo ""
    print_status "Testing fetch script..."
    if ./scripts/fetch-env-from-aws.sh "$ENVIRONMENT" >/dev/null 2>&1; then
        print_success "Fetch script works correctly"
    else
        print_warning "Fetch script failed"
    fi
}

# Function to list all parameters
list_parameters() {
    print_status "Listing all TelAgri parameters..."
    
    echo ""
    print_status "Searching for parameters with prefix: /telagri/monitoring/"
    
    aws ssm get-parameters-by-path \
        --path "/telagri/monitoring/" \
        --recursive \
        --query 'Parameters[].{Name:Name,Type:Type,LastModified:LastModifiedDate}' \
        --output table 2>/dev/null || {
        print_error "Failed to list parameters"
        echo "Make sure you have AWS credentials configured"
        return 1
    }
}

# Main function
main() {
    print_header
    
    # Check AWS CLI
    if ! command -v aws >/dev/null 2>&1; then
        print_error "AWS CLI not found. Please install AWS CLI first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        print_error "AWS credentials not configured or invalid."
        echo "Please configure AWS credentials using: aws configure"
        exit 1
    fi
    
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    print_success "Connected to AWS account: $account_id"
    
    while true; do
        show_menu
        get_input "Choose an option (1-6)" "1" choice
        
        case $choice in
            1) update_parameter_store ;;
            2) fetch_parameter_store ;;
            3) view_parameter_store ;;
            4) test_parameter_store ;;
            5) list_parameters ;;
            6) print_success "Goodbye!"; exit 0 ;;
            *) print_error "Please choose 1-6" ;;
        esac
        
        echo ""
        echo -e "${CYAN}Press Enter to continue...${NC}"
        read
    done
}

# Run main function
main "$@"
