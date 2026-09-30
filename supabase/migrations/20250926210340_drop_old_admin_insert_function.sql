-- Drop old version of admin_insert_farmer_data_upload function to resolve overloading conflict
-- This migration removes the old function that uses enum parameters

begin;

-- Drop the old function with enum parameters
drop function if exists public.admin_insert_farmer_data_upload(
  uuid, uuid, public.data_type, text, text, text, bigint, text, text[], public.analysis_phase, jsonb
);

-- Also drop any other variations that might exist
drop function if exists public.admin_insert_farmer_data_upload(
  p_farmer_id uuid,
  p_bank_id uuid,
  p_data_type public.data_type,
  p_file_name text,
  p_file_path text,
  p_file_mime text,
  p_file_size bigint,
  p_description text,
  p_tags text[],
  p_phase public.analysis_phase,
  p_metadata jsonb
);

-- Ensure only the new function with text data_type and int phase exists
-- (This was already created in the previous migration, so we don't need to recreate it)

commit;
