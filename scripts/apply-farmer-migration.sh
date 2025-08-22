#!/bin/bash

# Script to apply the comprehensive farmer form migration
# This script should be run after setting up Supabase CLI access

echo "🚀 Applying Comprehensive Farmer Form Migration..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if user is logged in
if ! supabase status &> /dev/null; then
    echo "🔐 Please login to Supabase first:"
    echo "supabase login"
    exit 1
fi

# Check if project is linked
if ! supabase status | grep -q "Project"; then
    echo "🔗 Please link to your Supabase project first:"
    echo "supabase link --project-ref YOUR_PROJECT_REF"
    exit 1
fi

echo "📊 Applying database migration..."
supabase db push

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully!"
    echo ""
    echo "🎉 The comprehensive farmer form is now ready to use!"
    echo ""
    echo "📋 What was added:"
    echo "  - Extended farmers table with 15+ new fields"
    echo "  - New storage bucket for farmer documents"
    echo "  - Comprehensive form with 4 organized sections"
    echo "  - File upload functionality for schemas and lab analysis"
    echo "  - Georgian language support"
    echo ""
    echo "🚀 You can now:"
    echo "  1. Start the development server: npm run dev"
    echo "  2. Navigate to the Farmers section"
    echo "  3. Click 'Add Farmer' to test the new form"
    echo ""
    echo "📖 For more information, see: COMPREHENSIVE_FARMER_FORM.md"
else
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi