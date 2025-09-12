-- Service Cost storage, Location fields, Cadastral codes, Comments
-- Farmer Loans table with RLS and triggers

-- 1) Farmers table extensions
ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS service_cost_tariff text,
  ADD COLUMN IF NOT EXISTS service_cost_total_eur numeric(14,2),
  ADD COLUMN IF NOT EXISTS service_cost_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS service_cost_selections jsonb,
  ADD COLUMN IF NOT EXISTS location_name text,
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS cadastral_codes text[],
  ADD COLUMN IF NOT EXISTS bank_comment text,
  ADD COLUMN IF NOT EXISTS other_comment text,
  ADD COLUMN IF NOT EXISTS registration_date timestamptz DEFAULT now();

-- Ensure farmer type defaults to company and normalize existing
ALTER TYPE public.farmer_type RENAME VALUE 'person' TO 'person'; -- no-op if value exists
ALTER TABLE public.farmers ALTER COLUMN type SET DEFAULT 'company';
UPDATE public.farmers SET type = 'company' WHERE type IS DISTINCT FROM 'company';

-- 2) Farmer loans table
CREATE TABLE IF NOT EXISTS public.farmer_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  bank_id uuid NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL CHECK (currency IN ('GEL','USD','EUR')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  issuance_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_farmer_loans_farmer ON public.farmer_loans(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farmer_loans_bank ON public.farmer_loans(bank_id);

-- keep start_date <= end_date
ALTER TABLE public.farmer_loans
  ADD CONSTRAINT farmer_loans_valid_dates CHECK (start_date <= end_date);

-- Trigger to set bank_id from farmer and set created_by / updated_at
CREATE OR REPLACE FUNCTION public.set_farmer_loan_defaults()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT bank_id INTO NEW.bank_id FROM public.farmers WHERE id = NEW.farmer_id;
    NEW.created_by := auth.uid();
    NEW.updated_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_farmer_loan_defaults ON public.farmer_loans;
CREATE TRIGGER trg_set_farmer_loan_defaults
BEFORE INSERT OR UPDATE ON public.farmer_loans
FOR EACH ROW EXECUTE FUNCTION public.set_farmer_loan_defaults();

-- Enforce max 15 loans per farmer
CREATE OR REPLACE FUNCTION public.enforce_max_loans_per_farmer()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  loan_count integer;
BEGIN
  SELECT COUNT(*) INTO loan_count FROM public.farmer_loans WHERE farmer_id = NEW.farmer_id;
  IF TG_OP = 'INSERT' THEN
    IF loan_count >= 15 THEN
      RAISE EXCEPTION 'A farmer can have at most 15 loans.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_max_loans ON public.farmer_loans;
CREATE TRIGGER trg_enforce_max_loans
BEFORE INSERT ON public.farmer_loans
FOR EACH ROW EXECUTE FUNCTION public.enforce_max_loans_per_farmer();

-- Enable RLS
ALTER TABLE public.farmer_loans ENABLE ROW LEVEL SECURITY;

-- RLS policies for farmer_loans
-- READ
CREATE POLICY IF NOT EXISTS "farmer_loans.read.admin"
ON public.farmer_loans FOR SELECT TO authenticated
USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
);

CREATE POLICY IF NOT EXISTS "farmer_loans.read.bank_viewer"
ON public.farmer_loans FOR SELECT TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'bank_viewer' AND p.bank_id = bank_id
  )
);

-- INSERT
CREATE POLICY IF NOT EXISTS "farmer_loans.insert.admin"
ON public.farmer_loans FOR INSERT TO authenticated
WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
);

CREATE POLICY IF NOT EXISTS "farmer_loans.insert.bank_viewer"
ON public.farmer_loans FOR INSERT TO authenticated
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'bank_viewer' AND p.bank_id = bank_id
  )
);

-- UPDATE
CREATE POLICY IF NOT EXISTS "farmer_loans.update.admin"
ON public.farmer_loans FOR UPDATE TO authenticated
USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
)
WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
);

CREATE POLICY IF NOT EXISTS "farmer_loans.update.bank_viewer"
ON public.farmer_loans FOR UPDATE TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'bank_viewer' AND p.bank_id = bank_id
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'bank_viewer' AND p.bank_id = bank_id
  )
);

-- DELETE (admin only)
CREATE POLICY IF NOT EXISTS "farmer_loans.delete.admin"
ON public.farmer_loans FOR DELETE TO authenticated
USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
);

-- Comments and docs
COMMENT ON COLUMN public.farmers.service_cost_tariff IS 'Tariff used in service cost calculation (T1/T2)';
COMMENT ON COLUMN public.farmers.service_cost_total_eur IS 'Total service cost in EUR';
COMMENT ON COLUMN public.farmers.service_cost_breakdown IS 'JSON breakdown of price components';
COMMENT ON COLUMN public.farmers.service_cost_selections IS 'Selected option labels for calculator inputs';
COMMENT ON COLUMN public.farmers.location_name IS 'Display name from Google Places autocomplete';
COMMENT ON COLUMN public.farmers.location_lat IS 'Latitude of selected farm location';
COMMENT ON COLUMN public.farmers.location_lng IS 'Longitude of selected farm location';
COMMENT ON COLUMN public.farmers.cadastral_codes IS 'Array of cadastral codes for farm plots';
COMMENT ON COLUMN public.farmers.registration_date IS 'Explicit registration timestamp; mirrors created_at';
COMMENT ON COLUMN public.farmers.bank_comment IS 'Bank viewer comment on farmer registration';
COMMENT ON COLUMN public.farmers.other_comment IS 'Additional comment from user in Other section';

