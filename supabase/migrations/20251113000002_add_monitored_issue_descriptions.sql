-- Add description field to monitored_issues table for admin-editable content

BEGIN;

-- Add description column with rich text/HTML content
ALTER TABLE public.monitored_issues
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_monitored_issues_active ON public.monitored_issues(is_active) WHERE is_active = true;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_monitored_issues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_monitored_issues ON public.monitored_issues;
CREATE TRIGGER set_updated_at_monitored_issues
  BEFORE UPDATE ON public.monitored_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_monitored_issues_updated_at();

COMMIT;

