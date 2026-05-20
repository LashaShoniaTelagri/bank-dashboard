-- Add table to store Used Data maps/images uploaded by admin per phase
-- These are phase-specific maps that display in the Used Data section of F-100 reports

BEGIN;

-- Create phase_used_data_maps table
CREATE TABLE IF NOT EXISTS public.phase_used_data_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  phase_number INTEGER NOT NULL CHECK (phase_number BETWEEN 1 AND 12),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_mime TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  display_order INTEGER DEFAULT 0,
  annotation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT unique_farmer_phase_file UNIQUE(farmer_id, phase_number, file_path)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_phase_used_data_maps_farmer_phase 
  ON public.phase_used_data_maps(farmer_id, phase_number);

CREATE INDEX IF NOT EXISTS idx_phase_used_data_maps_created_at 
  ON public.phase_used_data_maps(created_at DESC);

-- Add comments
COMMENT ON TABLE public.phase_used_data_maps IS 'Stores PDF and image files uploaded by admins for the Used Data section of F-100 reports, organized by phase';
COMMENT ON COLUMN public.phase_used_data_maps.file_path IS 'Supabase Storage path in format: phase_used_data_maps/{farmer_id}/{phase_number}/{filename}';
COMMENT ON COLUMN public.phase_used_data_maps.annotation IS 'Optional description or note about the map/file';

-- Row Level Security (RLS)
ALTER TABLE public.phase_used_data_maps ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admins have full access to phase used data maps"
  ON public.phase_used_data_maps
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Bank viewers can view maps for their bank's farmers
CREATE POLICY "Bank viewers can view phase used data maps for their farmers"
  ON public.phase_used_data_maps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      JOIN public.farmers ON farmers.bank_id = profiles.bank_id
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'bank_viewer'
      AND farmers.id = phase_used_data_maps.farmer_id
    )
  );

-- Specialists can view maps for their assigned phases
CREATE POLICY "Specialists can view phase used data maps for assigned phases"
  ON public.phase_used_data_maps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.specialist_assignments
      WHERE specialist_assignments.specialist_id = auth.uid()
      AND specialist_assignments.farmer_id = phase_used_data_maps.farmer_id
      AND specialist_assignments.phase = phase_used_data_maps.phase_number
    )
  );

COMMIT;

