-- Fix the view security issue by recreating without SECURITY DEFINER
DROP VIEW IF EXISTS public.v_latest_f100;

CREATE VIEW public.v_latest_f100 AS
select distinct on (farmer_id, phase)
  id, farmer_id, bank_id, phase, issue_date, score, file_path, created_at
from public.f100
order by farmer_id, phase, issue_date desc, created_at desc;