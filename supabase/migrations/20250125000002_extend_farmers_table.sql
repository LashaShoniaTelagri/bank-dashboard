-- Extend farmers table with comprehensive agricultural data
-- Add new fields for detailed farmer information

-- Add new columns to farmers table
ALTER TABLE public.farmers 
ADD COLUMN company_name text,
ADD COLUMN first_name text,
ADD COLUMN last_name text,
ADD COLUMN farm_location text,
ADD COLUMN total_area_hectares numeric(10,2),
ADD COLUMN crop_type text,
ADD COLUMN crop_varieties jsonb, -- Store varieties with years and areas
ADD COLUMN irrigation_type text,
ADD COLUMN has_reservoir boolean default false,
ADD COLUMN reservoir_count integer,
ADD COLUMN reservoir_volumes jsonb, -- Store individual reservoir volumes
ADD COLUMN water_source text,
ADD COLUMN last_year_harvest_quantity numeric(10,2),
ADD COLUMN last_year_harvest_unit text,
ADD COLUMN irrigation_sectors_count integer,
ADD COLUMN irrigation_system_schema_path text, -- File path for uploaded schema
ADD COLUMN equipment_list text,
ADD COLUMN lab_analysis_path text; -- File path for uploaded lab analysis

-- Create storage bucket for farmer documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('farmer-documents', 'farmer-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for farmer documents
-- READ: Admin can read all; viewer only within their bank path
CREATE POLICY "storage.farmer-documents.read.admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'farmer-documents'
  AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role='admin')
);

CREATE POLICY "storage.farmer-documents.read.viewer"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'farmer-documents'
  AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role='bank_viewer'
             AND position('/bank/'||p.bank_id::text||'/' IN coalesce(name,'')) > 0)
);

-- WRITE: Admin only
CREATE POLICY "storage.farmer-documents.write.admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'farmer-documents'
  AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role='admin')
);

CREATE POLICY "storage.farmer-documents.update.delete.admin"
ON storage.objects FOR UPDATE USING (bucket_id='farmer-documents' AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role='admin'))
WITH CHECK (bucket_id='farmer-documents' AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role='admin'));

CREATE POLICY "storage.farmer-documents.delete.admin"
ON storage.objects FOR DELETE USING (bucket_id='farmer-documents' AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role='admin'));

-- Add comments for documentation
COMMENT ON COLUMN public.farmers.company_name IS 'Company name for company type farmers';
COMMENT ON COLUMN public.farmers.first_name IS 'First name for person type farmers';
COMMENT ON COLUMN public.farmers.last_name IS 'Last name for person type farmers';
COMMENT ON COLUMN public.farmers.farm_location IS 'Farm location/address';
COMMENT ON COLUMN public.farmers.total_area_hectares IS 'Total farm area in hectares';
COMMENT ON COLUMN public.farmers.crop_type IS 'Main crop type being cultivated';
COMMENT ON COLUMN public.farmers.crop_varieties IS 'JSON array of crop varieties with planting years and areas';
COMMENT ON COLUMN public.farmers.irrigation_type IS 'Type of irrigation system';
COMMENT ON COLUMN public.farmers.has_reservoir IS 'Whether the farm has water reservoirs';
COMMENT ON COLUMN public.farmers.reservoir_count IS 'Number of reservoirs';
COMMENT ON COLUMN public.farmers.reservoir_volumes IS 'JSON array of reservoir volumes in cubic meters';
COMMENT ON COLUMN public.farmers.water_source IS 'Source of water for irrigation';
COMMENT ON COLUMN public.farmers.last_year_harvest_quantity IS 'Last year harvest quantity';
COMMENT ON COLUMN public.farmers.last_year_harvest_unit IS 'Unit of measurement for harvest quantity';
COMMENT ON COLUMN public.farmers.irrigation_sectors_count IS 'Number of irrigation sectors';
COMMENT ON COLUMN public.farmers.irrigation_system_schema_path IS 'File path for uploaded irrigation system schema';
COMMENT ON COLUMN public.farmers.equipment_list IS 'List of farm equipment';
COMMENT ON COLUMN public.farmers.lab_analysis_path IS 'File path for uploaded laboratory analysis documents';