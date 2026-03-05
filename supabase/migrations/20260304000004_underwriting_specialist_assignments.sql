-- SS-275: Specialist Assignment for Underwriting Applications
-- Junction table linking specialists to underwriting applications

CREATE TABLE public.underwriting_specialist_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.underwriting_applications(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,

  CONSTRAINT uq_uw_specialist_per_app UNIQUE (application_id, specialist_id)
);

COMMENT ON TABLE public.underwriting_specialist_assignments
IS 'Maps specialists to underwriting applications for scoring assignment. Admin assigns one or many specialists per application.';

CREATE INDEX idx_uw_spec_assignments_app ON public.underwriting_specialist_assignments(application_id);
CREATE INDEX idx_uw_spec_assignments_specialist ON public.underwriting_specialist_assignments(specialist_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.underwriting_specialist_assignments ENABLE ROW LEVEL SECURITY;

-- Admins: full CRUD
CREATE POLICY "uw_spec_assign_admin_all"
  ON public.underwriting_specialist_assignments
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

-- Specialists: can see their own assignments
CREATE POLICY "uw_spec_assign_specialist_read"
  ON public.underwriting_specialist_assignments
  FOR SELECT
  TO authenticated
  USING (
    specialist_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'specialist'
        AND (profiles.products_enabled & 2) > 0
    )
  );

-- Bank viewers: can see assignments for their bank's applications
CREATE POLICY "uw_spec_assign_bank_read"
  ON public.underwriting_specialist_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.underwriting_applications ua
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE ua.id = underwriting_specialist_assignments.application_id
        AND ua.bank_id = p.bank_id
        AND (p.products_enabled & 2) > 0
    )
  );
