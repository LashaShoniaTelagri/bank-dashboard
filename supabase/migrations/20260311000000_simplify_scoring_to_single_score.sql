-- Simplify application_scores: remove sub-score columns, tighten overall_score to 0-10

-- Drop unused sub-score columns
ALTER TABLE public.application_scores
  DROP COLUMN IF EXISTS land_suitability,
  DROP COLUMN IF EXISTS crop_viability,
  DROP COLUMN IF EXISTS risk_assessment,
  DROP COLUMN IF EXISTS historical_data;

-- Update overall_score constraint from 0-100 to 0-10
ALTER TABLE public.application_scores
  DROP CONSTRAINT IF EXISTS application_scores_overall_score_check;

-- Scale existing scores from 0-100 range down to 0-10
UPDATE public.application_scores
  SET overall_score = ROUND((overall_score / 10.0)::numeric, 1)
  WHERE overall_score > 10;

ALTER TABLE public.application_scores
  ADD CONSTRAINT application_scores_overall_score_check
    CHECK (overall_score >= 0 AND overall_score <= 10);
