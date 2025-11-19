-- Chart Templates System
-- Allows admins to create reusable chart templates that display on farmer profiles
-- Bank viewers and admins can view charts, only admins can manage them

BEGIN;

-- Create chart_templates table
CREATE TABLE IF NOT EXISTS public.chart_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  chart_type text NOT NULL CHECK (chart_type IN ('line', 'bar', 'bar-horizontal', 'area', 'pie', 'donut', 'scatter', 'radar', 'gauge')),
  chart_data jsonb NOT NULL, -- Flexible JSON structure for chart data
  annotation text, -- Optional annotation displayed on every chart
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  is_active boolean NOT NULL DEFAULT true -- Allow soft deletion
);

-- Create index for active charts
CREATE INDEX IF NOT EXISTS idx_chart_templates_active ON public.chart_templates(is_active) WHERE is_active = true;

-- Create index for chart type filtering
CREATE INDEX IF NOT EXISTS idx_chart_templates_type ON public.chart_templates(chart_type);

-- Enable RLS
ALTER TABLE public.chart_templates ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (READ)
-- Admin and bank viewers can read all active charts
CREATE POLICY "chart_templates.read.all"
ON public.chart_templates FOR SELECT
TO authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (p.role = 'admin' OR p.role = 'bank_viewer')
  )
);

-- RLS POLICIES (WRITE) - Admin only
CREATE POLICY "chart_templates.write.admin"
ON public.chart_templates FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chart_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chart_templates_updated_at
BEFORE UPDATE ON public.chart_templates
FOR EACH ROW
EXECUTE FUNCTION update_chart_templates_updated_at();

COMMIT;

