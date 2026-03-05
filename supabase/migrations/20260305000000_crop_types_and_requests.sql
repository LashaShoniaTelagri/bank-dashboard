-- Dynamic crop type management with request/approval workflow
-- Replaces hardcoded CHECK constraint with a managed crop_types table

-- 1. Drop the old hardcoded CHECK constraint
ALTER TABLE public.underwriting_applications DROP CONSTRAINT IF EXISTS valid_crop_type;

-- 2. Approved crop types table
CREATE TABLE public.underwriting_crop_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.underwriting_crop_types IS 'Approved crop types available for underwriting applications. Admin-managed.';

CREATE INDEX idx_uw_crop_types_active ON public.underwriting_crop_types(is_active, label);

-- Seed default crops
INSERT INTO public.underwriting_crop_types (value, label) VALUES
  ('almond', 'Almond'),
  ('apple', 'Apple'),
  ('pear', 'Pear'),
  ('corn', 'Corn'),
  ('cotton', 'Cotton');

-- RLS: everyone can read active crops, only admins can manage
ALTER TABLE public.underwriting_crop_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uw_crop_types_read"
  ON public.underwriting_crop_types
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "uw_crop_types_admin_manage"
  ON public.underwriting_crop_types
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- 3. Crop requests table
CREATE TABLE public.underwriting_crop_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_name TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  bank_id UUID REFERENCES public.banks(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.underwriting_crop_requests IS 'Pending crop type requests from underwriters. Approved crops get added to underwriting_crop_types.';

CREATE INDEX idx_uw_crop_requests_status ON public.underwriting_crop_requests(status, created_at DESC);
CREATE INDEX idx_uw_crop_requests_user ON public.underwriting_crop_requests(requested_by);

ALTER TABLE public.underwriting_crop_requests ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "uw_crop_req_admin_all"
  ON public.underwriting_crop_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Bank viewers: can insert requests and read own requests
CREATE POLICY "uw_crop_req_user_insert"
  ON public.underwriting_crop_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND (profiles.products_enabled & 2) > 0
    )
  );

CREATE POLICY "uw_crop_req_user_read"
  ON public.underwriting_crop_requests
  FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid()
  );
