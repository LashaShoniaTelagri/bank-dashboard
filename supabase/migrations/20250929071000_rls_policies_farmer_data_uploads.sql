-- Secure RLS policies for farmer_data_uploads
-- Fixes: empty client responses caused by missing SELECT policy

BEGIN;

-- Ensure RLS is enabled
ALTER TABLE public.farmer_data_uploads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent safety)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='farmer_data_uploads' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.farmer_data_uploads', r.policyname);
  END LOOP;
END $$;

-- Admins - full access
CREATE POLICY "Admins can select uploads" ON public.farmer_data_uploads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can modify uploads" ON public.farmer_data_uploads
  FOR ALL
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

-- Bank viewers - read uploads for their bank
CREATE POLICY "Bank viewers can read their bank uploads" ON public.farmer_data_uploads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'bank_viewer'
        AND p.bank_id = public.farmer_data_uploads.bank_id
    )
  );

-- Specialists - read uploads for assigned farmers
CREATE POLICY "Specialists can read uploads for assigned farmers" ON public.farmer_data_uploads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.specialist_assignments sa
      WHERE sa.specialist_id = auth.uid()
        AND sa.farmer_id = public.farmer_data_uploads.farmer_id
    )
  );

-- Any authenticated user can insert their own uploads
CREATE POLICY "Authenticated can insert own uploads" ON public.farmer_data_uploads
  FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
  );

COMMIT;


