-- Add comprehensive agricultural fields to farmers table
-- This migration extends the farmers table with detailed agricultural information

-- Add new columns to farmers table
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS ltd_name text;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS farmer_location text;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS area numeric(10,2);
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS crop text;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS variety text;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS variety_cultivation_year integer;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS variety_cultivation_area numeric(10,2);
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS irrigation_type text;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS has_reservoir boolean DEFAULT false;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS reservoir_amount numeric(10,2);
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS reservoir_capacity numeric(10,2);
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS water_source text;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS last_year_harvest_amount numeric(10,2);
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS irrigation_sectors_count integer;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS equipment_list text;

-- Create table for farmer documents (irrigation diagrams, current analysis, etc.)
CREATE TABLE IF NOT EXISTS public.farmer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  bank_id uuid NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('irrigation_diagram', 'current_analysis', 'other')),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_mime text NOT NULL,
  file_size_bytes bigint NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS farmer_documents_farmer_idx ON public.farmer_documents(farmer_id);
CREATE INDEX IF NOT EXISTS farmer_documents_bank_idx ON public.farmer_documents(bank_id);
CREATE INDEX IF NOT EXISTS farmer_documents_type_idx ON public.farmer_documents(document_type);

-- Enable RLS on farmer_documents table
ALTER TABLE public.farmer_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for farmer_documents
-- Read policy: Admin can read all, bank viewers can read only their bank's documents
CREATE POLICY "farmer_documents.read"
ON public.farmer_documents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'admin'
        OR (p.role = 'bank_viewer' AND p.bank_id = farmer_documents.bank_id)
      )
  )
);

-- Write policies: Only admins can insert/update/delete
CREATE POLICY "farmer_documents.insert"
ON public.farmer_documents FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

CREATE POLICY "farmer_documents.update"
ON public.farmer_documents FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

CREATE POLICY "farmer_documents.delete"
ON public.farmer_documents FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Trigger to automatically set bank_id from farmer
CREATE OR REPLACE FUNCTION public.set_farmer_document_bank_id()
RETURNS trigger 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  SELECT bank_id INTO NEW.bank_id FROM public.farmers WHERE id = NEW.farmer_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_farmer_document_bank_id
  BEFORE INSERT OR UPDATE OF farmer_id ON public.farmer_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_farmer_document_bank_id();

-- Add constraints for data validation
ALTER TABLE public.farmers ADD CONSTRAINT farmers_area_positive CHECK (area IS NULL OR area > 0);
ALTER TABLE public.farmers ADD CONSTRAINT farmers_variety_cultivation_year_valid CHECK (variety_cultivation_year IS NULL OR variety_cultivation_year BETWEEN 1900 AND EXTRACT(YEAR FROM CURRENT_DATE) + 10);
ALTER TABLE public.farmers ADD CONSTRAINT farmers_variety_cultivation_area_positive CHECK (variety_cultivation_area IS NULL OR variety_cultivation_area > 0);
ALTER TABLE public.farmers ADD CONSTRAINT farmers_reservoir_amount_positive CHECK (reservoir_amount IS NULL OR reservoir_amount > 0);
ALTER TABLE public.farmers ADD CONSTRAINT farmers_reservoir_capacity_positive CHECK (reservoir_capacity IS NULL OR reservoir_capacity > 0);
ALTER TABLE public.farmers ADD CONSTRAINT farmers_last_year_harvest_positive CHECK (last_year_harvest_amount IS NULL OR last_year_harvest_amount >= 0);
ALTER TABLE public.farmers ADD CONSTRAINT farmers_irrigation_sectors_positive CHECK (irrigation_sectors_count IS NULL OR irrigation_sectors_count > 0);

-- Update the existing text search index to include new searchable fields
DROP INDEX IF EXISTS farmers_text_idx;
CREATE INDEX farmers_text_idx ON public.farmers USING gin (
  to_tsvector('simple', 
    coalesce(name,'') || ' ' || 
    coalesce(id_number,'') || ' ' ||
    coalesce(ltd_name,'') || ' ' ||
    coalesce(full_name,'') || ' ' ||
    coalesce(mobile,'') || ' ' ||
    coalesce(farmer_location,'') || ' ' ||
    coalesce(crop,'') || ' ' ||
    coalesce(variety,'')
  )
);

-- Comment on new columns for documentation
COMMENT ON COLUMN public.farmers.ltd_name IS 'LTD/Company name if farmer is a company';
COMMENT ON COLUMN public.farmers.full_name IS 'Full name and lastname of the farmer';
COMMENT ON COLUMN public.farmers.mobile IS 'Mobile phone number';
COMMENT ON COLUMN public.farmers.farmer_location IS 'Geographic location of the farm';
COMMENT ON COLUMN public.farmers.area IS 'Total farm area in hectares';
COMMENT ON COLUMN public.farmers.crop IS 'Primary crop type';
COMMENT ON COLUMN public.farmers.variety IS 'Crop variety';
COMMENT ON COLUMN public.farmers.variety_cultivation_year IS 'Year when variety cultivation started';
COMMENT ON COLUMN public.farmers.variety_cultivation_area IS 'Area dedicated to variety cultivation in hectares';
COMMENT ON COLUMN public.farmers.irrigation_type IS 'Type of irrigation system used';
COMMENT ON COLUMN public.farmers.has_reservoir IS 'Whether the farm has a water reservoir';
COMMENT ON COLUMN public.farmers.reservoir_amount IS 'Amount of water in reservoir (cubic meters)';
COMMENT ON COLUMN public.farmers.reservoir_capacity IS 'Total reservoir capacity (cubic meters)';
COMMENT ON COLUMN public.farmers.water_source IS 'Primary water source for irrigation';
COMMENT ON COLUMN public.farmers.last_year_harvest_amount IS 'Amount of last year harvest (tons)';
COMMENT ON COLUMN public.farmers.irrigation_sectors_count IS 'Number of irrigation sectors on the farm';
COMMENT ON COLUMN public.farmers.equipment_list IS 'List of agricultural equipment';

COMMENT ON TABLE public.farmer_documents IS 'Documents and files associated with farmers (irrigation diagrams, analysis reports, etc.)';
COMMENT ON COLUMN public.farmer_documents.document_type IS 'Type of document: irrigation_diagram, current_analysis, or other';
