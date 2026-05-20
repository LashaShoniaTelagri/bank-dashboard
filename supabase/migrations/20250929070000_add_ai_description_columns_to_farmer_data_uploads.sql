-- Add AI description fields to farmer_data_uploads
-- Reason: Edge function generate-image-description writes ai_description fields

BEGIN;

ALTER TABLE public.farmer_data_uploads
  ADD COLUMN IF NOT EXISTS ai_description text,
  ADD COLUMN IF NOT EXISTS ai_description_generated_at timestamptz;

COMMENT ON COLUMN public.farmer_data_uploads.ai_description IS 'Short AI generated description of the uploaded image or file';
COMMENT ON COLUMN public.farmer_data_uploads.ai_description_generated_at IS 'Timestamp when AI description was generated';

-- Optional index to query latest AI descriptions
CREATE INDEX IF NOT EXISTS idx_farmer_data_uploads_ai_desc_generated_at
  ON public.farmer_data_uploads (ai_description_generated_at DESC NULLS LAST);

COMMIT;


