-- Fix storage RLS policies for farmer-documents bucket
-- The bank_viewer INSERT policy has incorrect logic that checks farmer.name instead of objects.name

-- Drop the incorrect policies
DROP POLICY IF EXISTS "storage.farmer_documents.write.bank_viewer" ON storage.objects;
DROP POLICY IF EXISTS "storage.farmer_documents.read.bank_viewer" ON storage.objects;
DROP POLICY IF EXISTS "storage.farmer_documents.update.bank_viewer" ON storage.objects;

-- Create correct INSERT policy for bank viewers
-- Allow bank viewers to upload files for farmers in their bank
CREATE POLICY "storage.farmer_documents.write.bank_viewer"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'farmer-documents' AND
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() 
    AND p.role = 'bank_viewer'
    AND POSITION('/farmer/' IN COALESCE(objects.name, '')) > 0
    AND EXISTS (
      SELECT 1 FROM farmers f
      WHERE f.bank_id = p.bank_id 
      AND POSITION(('/farmer/' || f.id::text || '/') IN COALESCE(objects.name, '')) > 0
    )
  )
);

-- Create correct READ policy for bank viewers
-- Allow bank viewers to read files for farmers in their bank
CREATE POLICY "storage.farmer_documents.read.bank_viewer"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'farmer-documents' AND
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() 
    AND p.role = 'bank_viewer'
    AND POSITION('/farmer/' IN COALESCE(objects.name, '')) > 0
    AND EXISTS (
      SELECT 1 FROM farmers f
      WHERE f.bank_id = p.bank_id 
      AND POSITION(('/farmer/' || f.id::text || '/') IN COALESCE(objects.name, '')) > 0
    )
  )
);

-- Create correct UPDATE policy for bank viewers
-- Allow bank viewers to update files for farmers in their bank
CREATE POLICY "storage.farmer_documents.update.bank_viewer"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'farmer-documents' AND
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() 
    AND p.role = 'bank_viewer'
    AND POSITION('/farmer/' IN COALESCE(objects.name, '')) > 0
    AND EXISTS (
      SELECT 1 FROM farmers f
      WHERE f.bank_id = p.bank_id 
      AND POSITION(('/farmer/' || f.id::text || '/') IN COALESCE(objects.name, '')) > 0
    )
  )
)
WITH CHECK (
  bucket_id = 'farmer-documents' AND
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() 
    AND p.role = 'bank_viewer'
    AND POSITION('/farmer/' IN COALESCE(objects.name, '')) > 0
    AND EXISTS (
      SELECT 1 FROM farmers f
      WHERE f.bank_id = p.bank_id 
      AND POSITION(('/farmer/' || f.id::text || '/') IN COALESCE(objects.name, '')) > 0
    )
  )
);
