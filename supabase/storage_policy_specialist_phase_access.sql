-- Storage policy update for specialist phase-based access
-- NOTE: This file CANNOT be run as a migration due to Supabase ownership restrictions
-- It must be run manually via Supabase Dashboard SQL Editor or with service role credentials
-- 
-- The primary security layer is the get-file-url Edge Function which validates:
-- 1. Specialist assignment to farmer
-- 2. Assignment status (excludes cancelled)
-- 3. Phase-specific access for farmer-data/* files
--
-- This storage policy adds defense-in-depth but is optional since the Edge Function
-- provides comprehensive security

-- Update storage policy to check phase and status
DROP POLICY IF EXISTS "storage.farmer_documents.read.specialist" ON storage.objects;

CREATE POLICY "storage.farmer_documents.read.specialist"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'farmer-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() 
    AND p.role = 'specialist'
    AND EXISTS (
      SELECT 1 FROM public.specialist_assignments sa
      JOIN public.farmers f ON f.id = sa.farmer_id
      WHERE sa.specialist_id = auth.uid()
      AND sa.status IN ('pending', 'in_progress', 'completed')
      AND (
        -- Format 1: farmer-data/{farmer-id}/{phase}/{filename}
        -- Extract phase from path and verify assignment
        (POSITION('farmer-data/' IN COALESCE(storage.objects.name, '')) > 0
         AND POSITION(('farmer-data/' || f.id::text || '/') IN COALESCE(storage.objects.name, '')) > 0
         AND (
           -- Check if the phase in the path matches assigned phase
           -- Path format: farmer-data/{farmer-id}/{phase}/...
           sa.phase::text = split_part(
             substring(storage.objects.name from ('farmer-data/' || f.id::text || '/(.*)')), 
             '/', 
             1
           )
           -- If phase can't be extracted, allow (for backward compatibility)
           OR split_part(
             substring(storage.objects.name from ('farmer-data/' || f.id::text || '/(.*)')), 
             '/', 
             1
           ) = ''
         ))
        OR
        -- Format 2: farmer/{farmer-id}/{document-type}/{filename}
        -- No phase restriction for general documents
        (POSITION('farmer/' IN COALESCE(storage.objects.name, '')) > 0
         AND POSITION(('farmer/' || f.id::text || '/') IN COALESCE(storage.objects.name, '')) > 0)
      )
    )
  )
);



