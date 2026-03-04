-- SS-245: Create Underwriting Applications Database Schema
-- SS-246: Application Scoring System with Queryable Metrics
-- Core tables for the TBC Bank UZ underwriting system

-- Application status enum
CREATE TYPE public.underwriting_status AS ENUM (
  'pending',
  'in_review',
  'scored',
  'rejected'
);

-- Underwriting Applications table
CREATE TABLE public.underwriting_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  shapefile_path TEXT,
  crop_type TEXT NOT NULL,
  notes TEXT,
  status public.underwriting_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_crop_type CHECK (
    crop_type IN ('wheat', 'corn', 'soy', 'cotton', 'vegetables', 'fruits', 'rice', 'other')
  ),
  CONSTRAINT valid_notes_length CHECK (char_length(notes) <= 500)
);

COMMENT ON TABLE public.underwriting_applications IS 'Underwriting applications submitted by bank users for agricultural land credit assessment';

-- Performance indexes for fast querying
CREATE INDEX idx_uw_apps_bank_status ON public.underwriting_applications(bank_id, status, submitted_at DESC);
CREATE INDEX idx_uw_apps_submitted_by ON public.underwriting_applications(submitted_by, submitted_at DESC);
CREATE INDEX idx_uw_apps_status ON public.underwriting_applications(status);

-- Display-friendly application number from UUID
CREATE OR REPLACE FUNCTION format_app_number(app_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN 'UW-' || UPPER(LEFT(REPLACE(app_id::TEXT, '-', ''), 8));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION format_app_number(UUID) IS 'Generates display format application number: UW-A7B3C4D5 from UUID';
GRANT EXECUTE ON FUNCTION format_app_number(UUID) TO authenticated;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_underwriting_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_underwriting_applications_updated_at
  BEFORE UPDATE ON public.underwriting_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_underwriting_updated_at();

-- Application Scores table (SS-246)
-- Structured numeric fields for fast AVG/MIN/MAX aggregations
CREATE TABLE public.application_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.underwriting_applications(id) ON DELETE CASCADE,
  overall_score NUMERIC(4,1) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  land_suitability NUMERIC(4,1) CHECK (land_suitability >= 0 AND land_suitability <= 100),
  crop_viability NUMERIC(4,1) CHECK (crop_viability >= 0 AND crop_viability <= 100),
  risk_assessment NUMERIC(4,1) CHECK (risk_assessment >= 0 AND risk_assessment <= 100),
  historical_data NUMERIC(4,1) CHECK (historical_data >= 0 AND historical_data <= 100),
  notes TEXT,
  scored_by UUID NOT NULL REFERENCES auth.users(id),
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_draft BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT one_final_score_per_app UNIQUE (application_id) WHERE (NOT is_draft)
);

COMMENT ON TABLE public.application_scores IS 'Structured scoring for underwriting applications - numeric fields enable fast aggregation queries';

-- Indexes for score analytics
CREATE INDEX idx_app_scores_application ON public.application_scores(application_id);
CREATE INDEX idx_app_scores_scored_by ON public.application_scores(scored_by, scored_at DESC);
CREATE INDEX idx_app_scores_overall ON public.application_scores(overall_score) WHERE NOT is_draft;
