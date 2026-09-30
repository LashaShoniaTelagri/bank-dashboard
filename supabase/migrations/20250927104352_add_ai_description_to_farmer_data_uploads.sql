-- Add AI description columns to farmer_data_uploads table for image analysis

ALTER TABLE farmer_data_uploads 
ADD COLUMN ai_description TEXT,
ADD COLUMN ai_description_generated_at TIMESTAMPTZ;

-- Add index for efficient querying of files with AI descriptions
CREATE INDEX idx_farmer_data_uploads_ai_description 
ON farmer_data_uploads (ai_description_generated_at) 
WHERE ai_description IS NOT NULL;

-- Add comment to document the purpose
COMMENT ON COLUMN farmer_data_uploads.ai_description IS 'AI-generated description of image content for agricultural analysis';
COMMENT ON COLUMN farmer_data_uploads.ai_description_generated_at IS 'Timestamp when AI description was generated';
