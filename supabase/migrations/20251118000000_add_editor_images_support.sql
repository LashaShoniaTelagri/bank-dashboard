-- Migration: Add support for editor images in Supabase Storage
-- Description: Allow authenticated users to upload images for rich text editor

-- Note: Using existing 'orchard-maps' bucket for editor images
-- Images will be stored in 'editor-images/' folder

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Admins can upload editor images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view editor images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete editor images" ON storage.objects;

-- Update storage policies to allow editor image uploads
-- Policy for uploading editor images
CREATE POLICY "Admins can upload editor images" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'orchard-maps' 
    AND (storage.foldername(name))[1] = 'editor-images'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Administrator', 'Bank User')
      )
    )
  );

-- Policy for reading editor images (public access for viewing)
CREATE POLICY "Anyone can view editor images" ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'orchard-maps' 
    AND (storage.foldername(name))[1] = 'editor-images'
  );

-- Policy for deleting editor images (admins only)
CREATE POLICY "Admins can delete editor images" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'orchard-maps' 
    AND (storage.foldername(name))[1] = 'editor-images'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'Administrator'
      )
    )
  );

-- Comments removed: Cannot add comments to system table policies
-- Policy documentation:
-- - "Admins can upload editor images": Allows administrators and bank users to upload images for the rich text editor
-- - "Anyone can view editor images": Allows public viewing of editor images embedded in phase descriptions and one-pager summaries
-- - "Admins can delete editor images": Allows administrators to delete editor images

