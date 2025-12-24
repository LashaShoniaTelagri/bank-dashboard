-- Add f100_url column to farmer_phases for external F-100 report links
-- This allows admins to specify a URL (e.g., Google Docs) that bank viewers can access

BEGIN;

-- Add f100_url column to farmer_phases
ALTER TABLE public.farmer_phases
  ADD COLUMN IF NOT EXISTS f100_url TEXT;

-- Add comment
COMMENT ON COLUMN public.farmer_phases.f100_url IS 'External URL for F-100 report (e.g., Google Docs link). If specified, bank viewers will use this URL instead of generated PDF download.';

COMMIT;

