-- Add iframe_urls column to farmer_phases table
-- Allows admins to manage iframe URLs independently per phase
-- Structure: [{"url": "https://...", "name": "Map Name", "annotation": "Description"}]

BEGIN;

-- Add iframe_urls column as JSONB array of objects
ALTER TABLE public.farmer_phases
  ADD COLUMN IF NOT EXISTS iframe_urls jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.farmer_phases.iframe_urls IS 'Array of iframe objects with url, name, and annotation for this phase (admin-only feature)';

COMMIT;

