-- Fix specialist storage policy to use correct file path format
-- The actual file path format is: farmer-data/{farmer-id}/{phase}/{filename}

-- Drop the existing policy
DROP POLICY IF EXISTS "storage.farmer_documents.read.specialist" ON storage.objects;

-- Create corrected READ policy for specialists
-- Allow specialists to read files for farmers they are assigned to
CREATE POLICY "storage.farmer_documents.read.specialist"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'farmer-documents' AND
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() 
    AND p.role = 'specialist'
    AND POSITION('farmer-data/' IN COALESCE(objects.name, '')) > 0
    AND EXISTS (
      SELECT 1 FROM specialist_assignments sa
      JOIN farmers f ON f.id = sa.farmer_id
      WHERE sa.specialist_id = auth.uid()
      AND POSITION(('farmer-data/' || f.id::text || '/') IN COALESCE(objects.name, '')) > 0
    )
  )
);
