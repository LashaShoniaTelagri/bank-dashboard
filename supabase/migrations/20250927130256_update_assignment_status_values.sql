-- Update assignment status values to support specialist workflow
-- Add 'pending_review' status and ensure consistency with TypeScript types

BEGIN;

-- Update the check constraint to include the new status values
ALTER TABLE public.specialist_assignments 
DROP CONSTRAINT IF EXISTS specialist_assignments_status_check;

ALTER TABLE public.specialist_assignments 
ADD CONSTRAINT specialist_assignments_status_check 
CHECK (status IN ('pending', 'in_progress', 'completed', 'pending_review', 'cancelled'));

-- Update any existing 'on_hold' status to 'pending_review' for consistency
UPDATE public.specialist_assignments 
SET status = 'pending_review' 
WHERE status = 'on_hold';

-- Add index on status for better query performance
CREATE INDEX IF NOT EXISTS idx_specialist_assignments_status 
ON public.specialist_assignments(status);

-- Add index on specialist_id and status for dashboard queries
CREATE INDEX IF NOT EXISTS idx_specialist_assignments_specialist_status 
ON public.specialist_assignments(specialist_id, status);

-- Update the RLS policy for specialists to allow status updates
DROP POLICY IF EXISTS "Specialists can update their own assignment status" ON public.specialist_assignments;

CREATE POLICY "Specialists can update their own assignment status" ON public.specialist_assignments
  FOR UPDATE USING (specialist_id = auth.uid())
  WITH CHECK (specialist_id = auth.uid());

COMMIT;
