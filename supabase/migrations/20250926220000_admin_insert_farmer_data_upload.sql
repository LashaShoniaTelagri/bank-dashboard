-- Admin helper to insert farmer_data_uploads bypassing RLS (SECURITY DEFINER)
-- and corrected RLS policies for inserts. Safe to re-run.

-- Function: admin_insert_farmer_data_upload
create or replace function public.admin_insert_farmer_data_upload(
  p_farmer_id uuid,
  p_bank_id uuid,
  p_data_type data_type,
  p_file_name text,
  p_file_path text,
  p_file_mime text,
  p_file_size bigint,
  p_description text,
  p_tags text[],
  p_phase analysis_phase,
  p_metadata jsonb
)
returns farmer_data_uploads
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
  rec farmer_data_uploads%rowtype;
begin
  select exists (
    select 1 from profiles where user_id = auth.uid() and role = 'admin'
  ) into is_admin;

  if not is_admin then
    raise exception 'Only admins can use this endpoint';
  end if;

  insert into farmer_data_uploads(
    farmer_id, bank_id, uploaded_by, data_type, file_name, file_path, file_mime,
    file_size_bytes, description, tags, phase, metadata
  )
  values (
    p_farmer_id, p_bank_id, auth.uid(), p_data_type, p_file_name, p_file_path, p_file_mime,
    p_file_size, p_description, coalesce(p_tags,'{}'::text[]), p_phase, coalesce(p_metadata,'{}'::jsonb)
  )
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.admin_insert_farmer_data_upload(
  uuid, uuid, data_type, text, text, text, bigint, text, text[], analysis_phase, jsonb
) to authenticated;

-- RLS: explicit insert policies for admins and bank_viewers
alter table public.farmer_data_uploads enable row level security;

-- Safely drop legacy policies if they exist
drop policy if exists "Admins and bank viewers can upload data" on public.farmer_data_uploads;
drop policy if exists "Bank viewers can upload data" on public.farmer_data_uploads;
drop policy if exists "Admins can upload (any bank)" on public.farmer_data_uploads;
drop policy if exists "Bank viewers can upload (own bank)" on public.farmer_data_uploads;

create policy "Admins can upload (any bank)" on public.farmer_data_uploads
for insert
with check (
  uploaded_by = auth.uid()
  and exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin')
);

create policy "Bank viewers can upload (own bank)" on public.farmer_data_uploads
for insert
with check (
  uploaded_by = auth.uid()
  and bank_id in (
    select p.bank_id from profiles p where p.user_id = auth.uid() and p.role = 'bank_viewer'
  )
);

-- Keep existing SELECT policies unchanged


