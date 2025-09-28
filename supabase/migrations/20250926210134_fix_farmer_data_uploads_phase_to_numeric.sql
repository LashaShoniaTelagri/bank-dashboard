-- Fix farmer_data_uploads table: convert phase column from enum to numeric
-- This migration converts the phase column from analysis_phase enum to integer (1-12)

begin;

-- 1) Add new numeric phase column
alter table public.farmer_data_uploads 
add column if not exists phase_number int;

-- 2) Backfill numeric values from enum (if any data exists)
update public.farmer_data_uploads 
set phase_number = case phase
  when 'initial_assessment' then 1
  when 'crop_analysis' then 2
  when 'soil_analysis' then 3
  when 'irrigation_analysis' then 4
  when 'harvest_analysis' then 8
  when 'financial_analysis' then 10
  when 'compliance_review' then 11
  when 'final_report' then 12
  else 1 -- default to phase 1 for any unknown values
end
where phase_number is null;

-- 3) Make numeric column required and add constraint
alter table public.farmer_data_uploads 
alter column phase_number set not null;

alter table public.farmer_data_uploads
add constraint farmer_data_uploads_phase_number_check 
check (phase_number >= 1 and phase_number <= 12);

-- 4) Drop the old enum column
alter table public.farmer_data_uploads 
drop column if exists phase;

-- 5) Rename the new column to phase
alter table public.farmer_data_uploads 
rename column phase_number to phase;

-- 6) Update the admin_insert_farmer_data_upload function to use numeric phase
create or replace function public.admin_insert_farmer_data_upload(
  p_farmer_id uuid,
  p_bank_id uuid,
  p_data_type text,
  p_file_name text,
  p_file_path text,
  p_file_mime text,
  p_file_size bigint,
  p_description text default '',
  p_tags text[] default '{}',
  p_phase int default 1,
  p_metadata jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  upload_id uuid;
begin
  -- Check if user is admin
  if not exists (
    select 1 from public.profiles 
    where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Access denied. Admin role required.';
  end if;

  -- Insert the farmer data upload
  insert into public.farmer_data_uploads (
    farmer_id,
    bank_id,
    uploaded_by,
    data_type,
    file_name,
    file_path,
    file_mime,
    file_size_bytes,
    description,
    tags,
    phase,
    metadata
  ) values (
    p_farmer_id,
    p_bank_id,
    auth.uid(),
    p_data_type,
    p_file_name,
    p_file_path,
    p_file_mime,
    p_file_size,
    p_description,
    p_tags,
    p_phase,
    p_metadata
  ) returning id into upload_id;
  
  return upload_id;
end;
$$;

grant execute on function public.admin_insert_farmer_data_upload(uuid, uuid, text, text, text, text, bigint, text, text[], int, jsonb) to authenticated;

commit;
