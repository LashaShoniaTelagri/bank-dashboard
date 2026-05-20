-- Add iframe_urls column to farmer_data_uploads table
-- Allows admins to add multiple iframe URLs with names and annotations for specialists
-- Structure: [{"url": "https://...", "name": "Map Name", "annotation": "Description"}]

BEGIN;

-- Add iframe_urls column as JSONB array of objects
ALTER TABLE public.farmer_data_uploads
  ADD COLUMN IF NOT EXISTS iframe_urls jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.farmer_data_uploads.iframe_urls IS 'Array of iframe objects with url, name, and annotation to display to assigned specialists (admin-only feature)';

-- Add index for querying uploads with iframe URLs
CREATE INDEX IF NOT EXISTS idx_farmer_data_uploads_iframe_urls
  ON public.farmer_data_uploads USING gin (iframe_urls)
  WHERE iframe_urls IS NOT NULL AND jsonb_array_length(iframe_urls) > 0;

COMMIT;

