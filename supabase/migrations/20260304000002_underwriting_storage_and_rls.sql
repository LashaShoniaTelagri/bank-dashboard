-- SS-247: Hash-Partitioned Shapefile Storage
-- SS-248: RLS Policies for Bank-Isolated Underwriting Access

-- Storage bucket for underwriting files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'underwriting-files',
  'underwriting-files',
  false,
  52428800, -- 50MB
  ARRAY['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Storage path generator: distributes files across 16 directories (0-f)
CREATE OR REPLACE FUNCTION generate_underwriting_storage_path(app_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN LEFT(REPLACE(app_id::TEXT, '-', ''), 1) || '/' || app_id::TEXT || '.zip';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_underwriting_storage_path(UUID) IS 'Generates hash-partitioned storage path: {first-hex-char}/{uuid}.zip for even file distribution';
GRANT EXECUTE ON FUNCTION generate_underwriting_storage_path(UUID) TO authenticated;

-- ============================================================
-- RLS POLICIES: Underwriting Applications
-- ============================================================
ALTER TABLE public.underwriting_applications ENABLE ROW LEVEL SECURITY;

-- Admins: full access to all applications
CREATE POLICY "uw_apps_admin_all"
  ON public.underwriting_applications
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

-- Bank users: see only their bank's applications + must have Underwriting access
CREATE POLICY "uw_apps_bank_read"
  ON public.underwriting_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.bank_id = underwriting_applications.bank_id
        AND (profiles.products_enabled & 2) > 0
    )
  );

-- Bank users: can insert applications for their own bank
CREATE POLICY "uw_apps_bank_insert"
  ON public.underwriting_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.bank_id = underwriting_applications.bank_id
        AND (profiles.products_enabled & 2) > 0
    )
    AND submitted_by = auth.uid()
  );

-- Specialists: can read all applications (they score across banks)
CREATE POLICY "uw_apps_specialist_read"
  ON public.underwriting_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'specialist'
        AND (profiles.products_enabled & 2) > 0
    )
  );

-- Specialists: can update status (in_review, scored, rejected)
CREATE POLICY "uw_apps_specialist_update"
  ON public.underwriting_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'specialist'
        AND (profiles.products_enabled & 2) > 0
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'specialist'
        AND (profiles.products_enabled & 2) > 0
    )
  );

-- ============================================================
-- RLS POLICIES: Application Scores
-- ============================================================
ALTER TABLE public.application_scores ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "uw_scores_admin_all"
  ON public.application_scores
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

-- Bank users: can read scores for their bank's applications
CREATE POLICY "uw_scores_bank_read"
  ON public.application_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.underwriting_applications ua
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE ua.id = application_scores.application_id
        AND ua.bank_id = p.bank_id
        AND (p.products_enabled & 2) > 0
    )
  );

-- Specialists: can read all scores and insert/update their own scores
CREATE POLICY "uw_scores_specialist_read"
  ON public.application_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'specialist'
        AND (profiles.products_enabled & 2) > 0
    )
  );

CREATE POLICY "uw_scores_specialist_insert"
  ON public.application_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'specialist'
        AND (profiles.products_enabled & 2) > 0
    )
    AND scored_by = auth.uid()
  );

CREATE POLICY "uw_scores_specialist_update"
  ON public.application_scores
  FOR UPDATE
  TO authenticated
  USING (
    scored_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'specialist'
        AND (profiles.products_enabled & 2) > 0
    )
  )
  WITH CHECK (
    scored_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'specialist'
        AND (profiles.products_enabled & 2) > 0
    )
  );

-- ============================================================
-- STORAGE POLICIES: Underwriting Files
-- ============================================================

-- Bank users: can upload files to their partitioned path
CREATE POLICY "uw_files_bank_upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'underwriting-files'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND (profiles.products_enabled & 2) > 0
    )
  );

-- Authenticated users with underwriting access can read files
CREATE POLICY "uw_files_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'underwriting-files'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND (profiles.products_enabled & 2) > 0
    )
  );

-- Admins: full access to underwriting files
CREATE POLICY "uw_files_admin_all"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'underwriting-files'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'underwriting-files'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
