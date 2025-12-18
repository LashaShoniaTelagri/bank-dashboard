-- Add "Used Data" to monitored issues list
-- This extends the monitoring categories with a specific section for data sources and references
-- Used Data will be the 8th monitored issue, appearing after "Other"

BEGIN;

-- Insert "Used Data" as the 8th monitored issue
INSERT INTO public.monitored_issues (name, display_order, is_active)
VALUES ('Used Data', 8, true)
ON CONFLICT (name) DO UPDATE
  SET display_order = 8,
      is_active = true;

COMMIT;

