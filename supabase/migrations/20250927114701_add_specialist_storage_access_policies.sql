-- Add storage access policies for specialist role
-- Specialists should be able to read files for farmers they are assigned to

-- Drop the policy if it exists (for re-running migration)
DROP POLICY IF EXISTS "storage.farmer_documents.read.specialist" ON storage.objects;

-- Create READ policy for specialists
-- Allow specialists to read files for farmers they are assigned to
-- File path format: farmer-data/{farmer-id}/{phase}/{filename}
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

-- Note: Specialists should NOT have write/update/delete permissions
-- They can only read files for farmers they are assigned to
-- This maintains security while allowing file preview functionality