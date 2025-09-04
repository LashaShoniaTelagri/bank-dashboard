-- Fix the security definer view issue
DROP VIEW IF EXISTS public.v_latest_f100;

-- Recreate the view without security definer (it will use the invoker's permissions)
CREATE VIEW public.v_latest_f100 AS
SELECT DISTINCT ON (farmer_id, phase)
  id, farmer_id, bank_id, phase, issue_date, score, file_path, created_at
FROM public.f100
ORDER BY farmer_id, phase, issue_date DESC, created_at DESC;