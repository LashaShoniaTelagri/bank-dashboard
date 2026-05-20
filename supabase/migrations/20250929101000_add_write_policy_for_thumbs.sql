-- Allow admins to write to the public thumbnails bucket
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Admins can write thumbnails'
  ) THEN
    CREATE POLICY "Admins can write thumbnails" ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'farmer-thumbs' AND
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid() AND p.role = 'admin'
        )
      );
  END IF;
END$$;

COMMIT;


