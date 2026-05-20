-- Farmer Orchard Maps System
-- Allows admins to upload orchard/sector maps (PDF or images)
-- Bank representatives have view-only access

BEGIN;

-- Create farmer_orchard_maps table
CREATE TABLE IF NOT EXISTS public.farmer_orchard_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  name text NOT NULL, -- Map name/description
  file_path text NOT NULL, -- Storage path in Supabase Storage
  file_type text NOT NULL CHECK (file_type IN ('pdf', 'image')), -- File type
  mime_type text NOT NULL, -- e.g., application/pdf, image/jpeg, image/png
  file_size_bytes bigint NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  notes text, -- Admin notes about the map
  is_active boolean NOT NULL DEFAULT true,
  display_order integer DEFAULT 0, -- For ordering multiple maps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orchard_maps_farmer ON public.farmer_orchard_maps(farmer_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_orchard_maps_active ON public.farmer_orchard_maps(is_active);
CREATE INDEX IF NOT EXISTS idx_orchard_maps_display_order ON public.farmer_orchard_maps(farmer_id, display_order);

-- Enable RLS
ALTER TABLE public.farmer_orchard_maps ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (READ) - Admins and bank viewers can read active maps
DROP POLICY IF EXISTS "orchard_maps.read.all" ON public.farmer_orchard_maps;
CREATE POLICY "orchard_maps.read.all" ON public.farmer_orchard_maps
  FOR SELECT
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
DROP POLICY IF EXISTS "orchard_maps.write.admin" ON public.farmer_orchard_maps;
CREATE POLICY "orchard_maps.write.admin" ON public.farmer_orchard_maps
  FOR ALL
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
CREATE OR REPLACE FUNCTION update_orchard_maps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orchard_maps_updated_at ON public.farmer_orchard_maps;
CREATE TRIGGER trg_orchard_maps_updated_at
BEFORE UPDATE ON public.farmer_orchard_maps
FOR EACH ROW
EXECUTE FUNCTION update_orchard_maps_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.farmer_orchard_maps IS 'Orchard sector maps for farmers (PDF or images) - admin upload, bank viewer read-only';
COMMENT ON COLUMN public.farmer_orchard_maps.file_type IS 'pdf or image';
COMMENT ON COLUMN public.farmer_orchard_maps.display_order IS 'Order for displaying multiple maps for same farmer';

COMMIT;

