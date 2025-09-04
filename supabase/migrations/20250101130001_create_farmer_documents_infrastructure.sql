-- Create farmer documents infrastructure
-- This adds the missing table, storage bucket, and policies for farmer document uploads

-- Create farmer_documents table
CREATE TABLE public.farmer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  bank_id uuid NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('irrigation_diagram', 'current_analysis', 'other')),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_mime text,
  file_size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create indexes for performance
CREATE INDEX farmer_documents_farmer_idx ON public.farmer_documents(farmer_id);
CREATE INDEX farmer_documents_bank_idx ON public.farmer_documents(bank_id);
CREATE INDEX farmer_documents_type_idx ON public.farmer_documents(document_type);

-- Enable RLS
ALTER TABLE public.farmer_documents ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES for farmer_documents table
-- READ: Admin can read all, bank_viewer can read their bank's documents
CREATE POLICY "farmer_documents.read.admin"
ON public.farmer_documents FOR SELECT
TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

CREATE POLICY "farmer_documents.read.bank_viewer"
ON public.farmer_documents FOR SELECT
TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer' 
      AND p.bank_id = bank_id
  )
);

-- INSERT: Admin can insert any document, bank_viewer can insert for their bank
CREATE POLICY "farmer_documents.insert.admin"
ON public.farmer_documents FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

CREATE POLICY "farmer_documents.insert.bank_viewer"
ON public.farmer_documents FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer' 
      AND p.bank_id = bank_id
  )
);

-- UPDATE: Admin can update any document, bank_viewer can update their bank's documents
CREATE POLICY "farmer_documents.update.admin"
ON public.farmer_documents FOR UPDATE
TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

CREATE POLICY "farmer_documents.update.bank_viewer"
ON public.farmer_documents FOR UPDATE
TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer' 
      AND p.bank_id = bank_id
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer' 
      AND p.bank_id = bank_id
  )
);

-- DELETE: Only admin can delete documents
CREATE POLICY "farmer_documents.delete.admin"
ON public.farmer_documents FOR DELETE
TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Create farmer-documents storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('farmer-documents', 'farmer-documents', false);

-- STORAGE POLICIES for farmer-documents bucket
-- READ: Admin can read all, bank_viewer can read their bank's files
CREATE POLICY "storage.farmer_documents.read.admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'farmer-documents'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

CREATE POLICY "storage.farmer_documents.read.bank_viewer"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'farmer-documents'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer'
      AND position('/farmer/' in coalesce(name,'')) > 0
      -- Additional check: ensure the farmer belongs to their bank
      AND EXISTS(
        SELECT 1 FROM public.farmers f
        WHERE f.bank_id = p.bank_id
          AND position('/farmer/' || f.id::text || '/' in coalesce(name,'')) > 0
      )
  )
);

-- WRITE: Admin can write anywhere, bank_viewer can write to their bank's farmer folders
CREATE POLICY "storage.farmer_documents.write.admin"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'farmer-documents'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

CREATE POLICY "storage.farmer_documents.write.bank_viewer"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'farmer-documents'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer'
      AND position('/farmer/' in coalesce(name,'')) > 0
      -- Ensure the farmer belongs to their bank
      AND EXISTS(
        SELECT 1 FROM public.farmers f
        WHERE f.bank_id = p.bank_id
          AND position('/farmer/' || f.id::text || '/' in coalesce(name,'')) > 0
      )
  )
);

-- UPDATE/DELETE: Admin can update/delete, bank_viewer can update/delete their bank's files
CREATE POLICY "storage.farmer_documents.update.admin"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'farmer-documents'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'farmer-documents'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

CREATE POLICY "storage.farmer_documents.update.bank_viewer"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'farmer-documents'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer'
      AND position('/farmer/' in coalesce(name,'')) > 0
      AND EXISTS(
        SELECT 1 FROM public.farmers f
        WHERE f.bank_id = p.bank_id
          AND position('/farmer/' || f.id::text || '/' in coalesce(name,'')) > 0
      )
  )
)
WITH CHECK (
  bucket_id = 'farmer-documents'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer'
      AND position('/farmer/' in coalesce(name,'')) > 0
      AND EXISTS(
        SELECT 1 FROM public.farmers f
        WHERE f.bank_id = p.bank_id
          AND position('/farmer/' || f.id::text || '/' in coalesce(name,'')) > 0
      )
  )
);

CREATE POLICY "storage.farmer_documents.delete.admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'farmer-documents'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Trigger to automatically set created_by field
CREATE OR REPLACE FUNCTION public.set_farmer_document_created_by()
RETURNS trigger AS $$
BEGIN
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_set_farmer_document_created_by
BEFORE INSERT ON public.farmer_documents
FOR EACH ROW EXECUTE FUNCTION public.set_farmer_document_created_by();
