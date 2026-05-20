-- Add Farm Status to Underwriting Applications
-- Allows underwriters to specify whether a farm is planted or not planted

-- Create farm status enum
CREATE TYPE public.farm_status AS ENUM ('Planted', 'Not Planted');

-- Add farm_status column to underwriting_applications
ALTER TABLE public.underwriting_applications
ADD COLUMN farm_status public.farm_status NOT NULL DEFAULT 'Planted';

-- Add comment for the new column
COMMENT ON COLUMN public.underwriting_applications.farm_status IS 'Farm status indicating whether land is planted or not planted';

-- Create index for filtering by farm status
CREATE INDEX idx_uw_apps_farm_status ON public.underwriting_applications(farm_status);
