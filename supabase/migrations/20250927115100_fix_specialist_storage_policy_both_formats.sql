-- Fix specialist storage policy to handle both file path formats
-- Format 1: farmer-data/{farmer-id}/{phase}/{filename} (from DataUploadModal)
-- Format 2: farmer/{farmer-id}/{document-type}/{filename} (from FarmerModal)

-- Drop the existing policy
DROP POLICY IF EXISTS "storage.farmer_documents.read.specialist" ON storage.objects;

-- Create comprehensive READ policy for specialists
-- Allow specialists to read files for farmers they are assigned to (both path formats)
CREATE POLICY "storage.farmer_documents.read.specialist"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'farmer-documents' AND
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() 
    AND p.role = 'specialist'
    AND EXISTS (
      SELECT 1 FROM specialist_assignments sa
      JOIN farmers f ON f.id = sa.farmer_id
      WHERE sa.specialist_id = auth.uid()
      AND (
        -- Format 1: farmer-data/{farmer-id}/{phase}/{filename}
        (POSITION('farmer-data/' IN COALESCE(objects.name, '')) > 0
         AND POSITION(('farmer-data/' || f.id::text || '/') IN COALESCE(objects.name, '')) > 0)
        OR
        -- Format 2: farmer/{farmer-id}/{document-type}/{filename}
        (POSITION('farmer/' IN COALESCE(objects.name, '')) > 0
         AND POSITION(('farmer/' || f.id::text || '/') IN COALESCE(objects.name, '')) > 0)
      )
    )
  )
);
