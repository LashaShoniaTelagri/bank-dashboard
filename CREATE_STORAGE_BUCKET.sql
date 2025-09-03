-- Create storage bucket for farmer documents
-- Run this in your Supabase Dashboard SQL Editor

-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('farmer-documents', 'farmer-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for farmer documents
CREATE POLICY "Authenticated users can upload farmer documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'farmer-documents');

CREATE POLICY "Users can view farmer documents from their bank"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'farmer-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.farmer_documents fd ON fd.file_path = name
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'admin' 
        OR (p.role = 'bank_viewer' AND p.bank_id = fd.bank_id)
      )
  )
);

CREATE POLICY "Admins can delete farmer documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'farmer-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'farmer-documents';
