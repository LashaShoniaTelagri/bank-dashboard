-- Add bottom_description field to chart_templates table
-- Allows admins to add formatted text description that appears at the bottom of charts

BEGIN;

-- Add bottom_description column to store rich text HTML
ALTER TABLE public.chart_templates
ADD COLUMN IF NOT EXISTS bottom_description text;

-- Add comment explaining the field
COMMENT ON COLUMN public.chart_templates.bottom_description IS 'Rich text HTML description displayed at the bottom of the chart, after data points';

COMMIT;


