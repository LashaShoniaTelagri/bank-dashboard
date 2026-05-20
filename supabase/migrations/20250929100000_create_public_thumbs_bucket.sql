-- Create a dedicated public bucket for thumbnails only
BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('farmer-thumbs', 'farmer-thumbs', true)
ON CONFLICT (id) DO NOTHING;

-- Ensure read access for anon on the thumbnails bucket (defense in depth)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read thumbnails'
  ) THEN
    CREATE POLICY "Public read thumbnails" ON storage.objects
      FOR SELECT
      USING ( bucket_id = 'farmer-thumbs' );
  END IF;
END$$;

COMMIT;


