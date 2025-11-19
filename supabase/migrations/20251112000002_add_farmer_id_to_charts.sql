BEGIN;

-- Add farmer_id column to chart_templates table
ALTER TABLE public.chart_templates
ADD COLUMN IF NOT EXISTS farmer_id UUID REFERENCES public.farmers(id) ON DELETE CASCADE;

-- Create index for faster farmer-specific chart queries
CREATE INDEX IF NOT EXISTS idx_chart_templates_farmer_id ON public.chart_templates(farmer_id);

-- Update RLS policies to allow access to farmer-specific charts
DROP POLICY IF EXISTS "Admins can manage all charts" ON public.chart_templates;
DROP POLICY IF EXISTS "Bank viewers can view their farmers' charts" ON public.chart_templates;

-- Admins can manage all charts
CREATE POLICY "Admins can manage all charts" ON public.chart_templates
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Bank viewers can view charts for farmers in their bank
CREATE POLICY "Bank viewers can view their farmers' charts" ON public.chart_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.farmers f ON f.id = chart_templates.farmer_id
      WHERE p.user_id = auth.uid()
        AND p.role = 'bank_viewer'
        AND p.bank_id = f.bank_id
    )
  );

COMMIT;

