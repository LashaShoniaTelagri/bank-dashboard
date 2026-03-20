-- Add shapefile_urls column to support attaching external links (Google Drive, etc.)
ALTER TABLE underwriting_applications
  ADD COLUMN IF NOT EXISTS shapefile_urls text[] DEFAULT NULL;
