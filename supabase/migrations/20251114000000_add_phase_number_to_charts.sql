-- Add phase_number column to chart_templates table
-- This allows charts to be associated with specific phases (1-12)

-- Add phase_number column
ALTER TABLE IF EXISTS public.chart_templates 
ADD COLUMN IF NOT EXISTS phase_number integer CHECK (phase_number >= 1 AND phase_number <= 12);

-- Add comment
COMMENT ON COLUMN public.chart_templates.phase_number IS 'Optional: Associates chart with a specific phase (1-12). NULL means chart is not phase-specific.';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_chart_templates_phase_number 
ON public.chart_templates(phase_number) 
WHERE phase_number IS NOT NULL;

-- Create compound index for farmer_id + phase_number queries
CREATE INDEX IF NOT EXISTS idx_chart_templates_farmer_phase 
ON public.chart_templates(farmer_id, phase_number) 
WHERE farmer_id IS NOT NULL;

