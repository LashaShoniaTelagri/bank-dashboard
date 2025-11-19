-- Create phase management system for farmer monitoring
-- Supports 12 phases with scores and monitored issues

BEGIN;

-- Create farmer_phases table to store phase scores and data
CREATE TABLE IF NOT EXISTS public.farmer_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  phase_number INTEGER NOT NULL CHECK (phase_number BETWEEN 1 AND 12),
  score DECIMAL(3,1) CHECK (score >= 0 AND score <= 10),
  issue_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(farmer_id, phase_number)
);

-- Create monitored_issues table (default configuration)
CREATE TABLE IF NOT EXISTS public.monitored_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert default monitored issues
INSERT INTO public.monitored_issues (name, display_order) VALUES
  ('Irrigation', 1),
  ('Soil and plant fertility', 2),
  ('Pest control', 3),
  ('Weather risk', 4),
  ('Weed control', 5),
  ('Management', 6)
ON CONFLICT (name) DO NOTHING;

-- Create phase_monitored_data table to track specific issue data per phase
CREATE TABLE IF NOT EXISTS public.phase_monitored_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  phase_number INTEGER NOT NULL CHECK (phase_number BETWEEN 1 AND 12),
  issue_id UUID NOT NULL REFERENCES public.monitored_issues(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('good', 'warning', 'critical', 'pending')),
  value DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(farmer_id, phase_number, issue_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_farmer_phases_farmer_id ON public.farmer_phases(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farmer_phases_phase_number ON public.farmer_phases(phase_number);
CREATE INDEX IF NOT EXISTS idx_phase_monitored_data_farmer_id ON public.phase_monitored_data(farmer_id);
CREATE INDEX IF NOT EXISTS idx_phase_monitored_data_phase ON public.phase_monitored_data(phase_number);

-- Enable RLS
ALTER TABLE public.farmer_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitored_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase_monitored_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for farmer_phases
DROP POLICY IF EXISTS "Admins can manage farmer phases" ON public.farmer_phases;
CREATE POLICY "Admins can manage farmer phases" ON public.farmer_phases
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Bank viewers can view their farmers' phases" ON public.farmer_phases;
CREATE POLICY "Bank viewers can view their farmers' phases" ON public.farmer_phases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.farmers f ON f.id = farmer_phases.farmer_id
      WHERE p.user_id = auth.uid()
        AND p.role = 'bank_viewer'
        AND p.bank_id = f.bank_id
    )
  );

-- RLS Policies for monitored_issues (everyone can view, only admins can modify)
DROP POLICY IF EXISTS "Everyone can view monitored issues" ON public.monitored_issues;
CREATE POLICY "Everyone can view monitored issues" ON public.monitored_issues
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage monitored issues" ON public.monitored_issues;
CREATE POLICY "Admins can manage monitored issues" ON public.monitored_issues
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- RLS Policies for phase_monitored_data
DROP POLICY IF EXISTS "Admins can manage phase monitored data" ON public.phase_monitored_data;
CREATE POLICY "Admins can manage phase monitored data" ON public.phase_monitored_data
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Bank viewers can view their farmers' phase data" ON public.phase_monitored_data;
CREATE POLICY "Bank viewers can view their farmers' phase data" ON public.phase_monitored_data
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.farmers f ON f.id = phase_monitored_data.farmer_id
      WHERE p.user_id = auth.uid()
        AND p.role = 'bank_viewer'
        AND p.bank_id = f.bank_id
    )
  );

COMMIT;

