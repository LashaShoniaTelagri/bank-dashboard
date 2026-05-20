-- Add one_pager_summary field to farmer_phases table
-- Allows admins to add a summary for each phase that appears in the One Pager

BEGIN;

-- Add one_pager_summary column with rich text/HTML content
ALTER TABLE public.farmer_phases
ADD COLUMN IF NOT EXISTS one_pager_summary TEXT;

COMMIT;

