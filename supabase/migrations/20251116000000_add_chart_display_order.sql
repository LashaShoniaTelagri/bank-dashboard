-- Add display_order field to chart_templates for drag and drop ordering

BEGIN;

-- Add display_order column with default value
ALTER TABLE public.chart_templates
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Create index for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_chart_templates_display_order ON public.chart_templates (display_order);

-- Update existing charts to have sequential display_order based on created_at
-- This ensures existing charts have a proper order
UPDATE public.chart_templates
SET display_order = subquery.row_number
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY farmer_id ORDER BY created_at ASC) as row_number
  FROM public.chart_templates
) AS subquery
WHERE public.chart_templates.id = subquery.id;

COMMIT;

