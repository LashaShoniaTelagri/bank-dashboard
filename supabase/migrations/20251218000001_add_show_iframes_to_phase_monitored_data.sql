-- Add show_iframes column to phase_monitored_data to control iframe display in Used Data section
-- This allows admins to control whether Interactive Maps are displayed for each phase

BEGIN;

-- Add show_iframes column to phase_monitored_data
ALTER TABLE public.phase_monitored_data
  ADD COLUMN IF NOT EXISTS show_iframes BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.phase_monitored_data.show_iframes IS 'Controls whether Interactive Maps are displayed in the Used Data section of F-100 reports. Admin-only setting.';

COMMIT;

