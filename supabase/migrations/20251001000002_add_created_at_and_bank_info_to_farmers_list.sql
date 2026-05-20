-- Update list_farmers_with_latest_f100 to include created_at and bank info
-- Drop the existing function first since we're changing the return type
DROP FUNCTION IF EXISTS public.list_farmers_with_latest_f100(text, date, date, uuid);

CREATE OR REPLACE FUNCTION public.list_farmers_with_latest_f100(
  search text default null,
  from_date date default null,
  to_date date default null,
  filter_bank_id uuid default null
)
RETURNS table (
  farmer_id uuid,
  bank_id uuid,
  name text,
  id_number text,
  created_at timestamptz,
  bank_name text,
  bank_logo_url text,
  latest jsonb
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  with base as (
    select f.*
    from public.farmers f
    where (search is null or to_tsvector('simple', coalesce(f.name,'')||' '||coalesce(f.id_number,'')) @@ plainto_tsquery('simple', search))
      and (filter_bank_id is null or f.bank_id = filter_bank_id)
  ),
  latest as (
    select l.farmer_id,
           jsonb_object_agg(l.phase::text, jsonb_build_object(
             'issue_date', l.issue_date,
             'score', l.score,
             'file_path', l.file_path
           ) order by l.phase) as phase_map
    from public.v_latest_f100 l
    where (from_date is null or l.issue_date >= from_date)
      and (to_date is null or l.issue_date <= to_date)
    group by l.farmer_id
  )
  select 
    b.id as farmer_id, 
    b.bank_id, 
    b.name, 
    b.id_number, 
    b.created_at,
    banks.name as bank_name,
    banks.logo_url as bank_logo_url,
    coalesce(l.phase_map, '{}'::jsonb) as latest
  from base b
  left join latest l on l.farmer_id = b.id
  left join public.banks on banks.id = b.bank_id;
$$;

