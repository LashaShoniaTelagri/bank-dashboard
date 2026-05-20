-- Add description field to phase_monitored_data for phase-specific descriptions per farmer
-- This allows admins to add different descriptions for the same issue across different phases

BEGIN;

-- Add description column with rich text/HTML content
ALTER TABLE public.phase_monitored_data
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index for faster queries when fetching phase-specific descriptions
CREATE INDEX IF NOT EXISTS idx_phase_monitored_data_farmer_phase ON public.phase_monitored_data(farmer_id, phase_number);

COMMIT;

