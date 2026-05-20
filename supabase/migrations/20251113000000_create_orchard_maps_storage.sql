-- Create storage bucket for orchard maps
-- Allows admins to upload PDF and image files
-- Bank viewers have read-only access

BEGIN;

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'orchard-maps',
  'orchard-maps',
  true, -- Public bucket for easy access
  10485760, -- 10MB file size limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for orchard-maps bucket
-- Note: RLS is already enabled by default on storage.objects

-- 1. Admin users can upload files
DROP POLICY IF EXISTS "orchard_maps.upload.admin" ON storage.objects;
CREATE POLICY "orchard_maps.upload.admin"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'orchard-maps'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- 2. Admin users can update their uploaded files
DROP POLICY IF EXISTS "orchard_maps.update.admin" ON storage.objects;
CREATE POLICY "orchard_maps.update.admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'orchard-maps'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'orchard-maps'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- 3. Admin users can delete files
DROP POLICY IF EXISTS "orchard_maps.delete.admin" ON storage.objects;
CREATE POLICY "orchard_maps.delete.admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'orchard-maps'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- 4. Authenticated users (admin and bank viewers) can view files
DROP POLICY IF EXISTS "orchard_maps.select.authenticated" ON storage.objects;
CREATE POLICY "orchard_maps.select.authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'orchard-maps'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'bank_viewer')
  )
);

COMMIT;

-- Note: Storage bucket 'orchard-maps' created with:
-- - Public access enabled for easy URL access
-- - 10MB file size limit
-- - Allowed file types: PDF, JPEG, JPG, PNG, WebP
-- - Admin users can upload/update/delete files
-- - Authenticated users (admin and bank viewers) can view files

