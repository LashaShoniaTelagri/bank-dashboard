-- Add new chart types to chart_templates
-- Adds support for: bar-horizontal, donut, gauge

BEGIN;

-- Drop the existing check constraint
ALTER TABLE public.chart_templates 
DROP CONSTRAINT IF EXISTS chart_templates_chart_type_check;

-- Add updated check constraint with new chart types
ALTER TABLE public.chart_templates 
ADD CONSTRAINT chart_templates_chart_type_check 
CHECK (chart_type IN ('line', 'bar', 'bar-horizontal', 'area', 'pie', 'donut', 'scatter', 'radar', 'gauge'));

COMMIT;

