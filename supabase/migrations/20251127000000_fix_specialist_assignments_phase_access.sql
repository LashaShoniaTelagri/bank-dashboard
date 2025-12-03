-- Fix specialist access to only include files from assigned phases
-- Specialists should only access farmer data for phases they are assigned to
-- This prevents access errors when specialists try to view files from unassigned phases

BEGIN;

-- Drop existing specialist read policy
DROP POLICY IF EXISTS "Specialists can read uploads for assigned farmers" ON public.farmer_data_uploads;

-- Recreate with phase filtering and status checking
CREATE POLICY "Specialists can read uploads for assigned farmers and phases" 
ON public.farmer_data_uploads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.specialist_assignments sa
    WHERE sa.specialist_id = auth.uid()
      AND sa.farmer_id = public.farmer_data_uploads.farmer_id
      AND sa.status IN ('pending', 'in_progress', 'completed')
      AND (
        -- Check if the file's phase matches any assigned phase
        sa.phase = COALESCE(
          (public.farmer_data_uploads.metadata->>'f100_phase')::int,
          public.farmer_data_uploads.phase
        )
      )
  )
);

COMMENT ON POLICY "Specialists can read uploads for assigned farmers and phases" ON public.farmer_data_uploads IS 
'Allows specialists to view data uploads only for farmers AND phases they are actively assigned to. Excludes cancelled assignments.';

-- Also fix farmer_phases RLS policy to filter by specific phase
DROP POLICY IF EXISTS "Specialists can view assigned farmers' phases" ON public.farmer_phases;

CREATE POLICY "Specialists can view assigned farmers' phases"
ON public.farmer_phases
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN specialist_assignments sa ON sa.specialist_id = p.user_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'specialist'
      AND sa.farmer_id = farmer_phases.farmer_id
      AND sa.phase = farmer_phases.phase_number
      AND sa.status IN ('pending', 'in_progress', 'completed')
  )
);

COMMENT ON POLICY "Specialists can view assigned farmers' phases" ON public.farmer_phases IS 
'Allows specialists to view phase data (including iframe_urls) only for specific phases they are assigned to';

-- Note: Storage policies cannot be modified via migrations due to ownership restrictions
-- Storage access is primarily secured by the get-file-url Edge Function which:
-- 1. Validates specialist assignment to farmer
-- 2. Checks assignment status (excludes cancelled)
-- 3. Verifies phase-specific access for farmer-data/* files
-- Storage policies must be manually updated via Supabase Dashboard if needed

COMMIT;

