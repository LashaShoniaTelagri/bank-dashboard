-- Add "Other" to monitored issues list
-- Extends the default monitoring categories with a catch-all "Other" option

BEGIN;

-- Insert "Other" as the 7th monitored issue
INSERT INTO public.monitored_issues (name, display_order, is_active) 
VALUES ('Other', 7, true)
ON CONFLICT (name) DO NOTHING;

COMMIT;

