-- Fix RLS policies for farmer_documents table
-- The bank_viewer policies have incorrect conditions that always evaluate to true

-- Drop the incorrect policies
DROP POLICY IF EXISTS "farmer_documents.insert.bank_viewer" ON public.farmer_documents;
DROP POLICY IF EXISTS "farmer_documents.read.bank_viewer" ON public.farmer_documents;
DROP POLICY IF EXISTS "farmer_documents.update.bank_viewer" ON public.farmer_documents;

-- Create correct policies for bank_viewer
-- INSERT policy: Allow bank viewers to insert documents for their bank
CREATE POLICY "farmer_documents.insert.bank_viewer"
ON public.farmer_documents FOR INSERT TO authenticated
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'bank_viewer' 
    AND p.bank_id = farmer_documents.bank_id
  )
);

-- READ policy: Allow bank viewers to read documents from their bank
CREATE POLICY "farmer_documents.read.bank_viewer"
ON public.farmer_documents FOR SELECT TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'bank_viewer' 
    AND p.bank_id = farmer_documents.bank_id
  )
);

-- UPDATE policy: Allow bank viewers to update documents from their bank
CREATE POLICY "farmer_documents.update.bank_viewer"
ON public.farmer_documents FOR UPDATE TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'bank_viewer' 
    AND p.bank_id = farmer_documents.bank_id
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'bank_viewer' 
    AND p.bank_id = farmer_documents.bank_id
  )
);
