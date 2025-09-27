-- Ensure clean admin_insert_farmer_data_upload function without enum conflicts
-- This migration drops all versions and creates a single clean function

begin;

-- Drop all possible versions of the function
drop function if exists public.admin_insert_farmer_data_upload(uuid, uuid, text, text, text, text, bigint, text, text[], int, jsonb);
drop function if exists public.admin_insert_farmer_data_upload(uuid, uuid, public.data_type, text, text, text, bigint, text, text[], int, jsonb);
drop function if exists public.admin_insert_farmer_data_upload(uuid, uuid, text, text, text, text, bigint, text, text[], public.analysis_phase, jsonb);
drop function if exists public.admin_insert_farmer_data_upload(uuid, uuid, public.data_type, text, text, text, bigint, text, text[], public.analysis_phase, jsonb);

-- Create the clean function with text data_type and int phase
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

  -- Validate data_type (convert text to enum for insertion)
  if p_data_type not in ('photo', 'analysis', 'maps', 'climate', 'text', 'document', 'video') then
    raise exception 'Invalid data type: %', p_data_type;
  end if;

  -- Validate phase
  if p_phase < 1 or p_phase > 12 then
    raise exception 'Invalid phase: %. Must be between 1 and 12', p_phase;
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
    p_data_type::data_type, -- Cast text to enum for insertion
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
