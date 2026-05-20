-- Add RLS policy for specialists to view farmer_phases
-- Specialists should be able to read iframe_urls and phase data for their assigned farmers

BEGIN;

-- Drop policy if exists and recreate
DROP POLICY IF EXISTS "Specialists can view assigned farmers' phases" ON public.farmer_phases;

-- Create policy for specialists to view assigned farmers' phases
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
      AND sa.status IN ('pending', 'in_progress', 'completed')
  )
);

COMMENT ON POLICY "Specialists can view assigned farmers' phases" ON public.farmer_phases IS 
'Allows specialists to view phase data (including iframe_urls) for farmers they are assigned to';

COMMIT;

