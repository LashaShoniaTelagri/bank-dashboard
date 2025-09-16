-- Clean up duplicate RLS policies for farmer_documents table
-- Remove old duplicate policies that are causing conflicts

-- The issue: Multiple INSERT policies exist and ALL must pass for RLS to allow the operation
-- This causes bank_viewer inserts to fail because they also need to satisfy admin-only policies

-- Drop all old duplicate policies
DROP POLICY IF EXISTS "farmer_documents.insert" ON public.farmer_documents;
DROP POLICY IF EXISTS "farmer_documents.read" ON public.farmer_documents;
DROP POLICY IF EXISTS "farmer_documents.update" ON public.farmer_documents;
DROP POLICY IF EXISTS "farmer_documents.delete" ON public.farmer_documents;

-- Keep only the specific role-based policies:
-- farmer_documents.insert.admin (allows admins to insert)
-- farmer_documents.insert.bank_viewer (allows bank viewers to insert for their bank)
-- farmer_documents.read.admin (allows admins to read all)
-- farmer_documents.read.bank_viewer (allows bank viewers to read their bank's documents)
-- farmer_documents.update.admin (allows admins to update all)
-- farmer_documents.update.bank_viewer (allows bank viewers to update their bank's documents)
-- farmer_documents.delete.admin (allows admins to delete)

-- These specific policies will work correctly because:
-- 1. For bank_viewer: Only the bank_viewer policy needs to pass
-- 2. For admin: Only the admin policy needs to pass
-- 3. No conflicting policies that require both roles simultaneously
