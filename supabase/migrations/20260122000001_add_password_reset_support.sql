-- Migration: Add password reset support to invitations table
-- Allows same table to handle both invitations (5 days) and password resets (24 hours)

-- Add type column to distinguish between invitation and password reset
ALTER TABLE public.invitations 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'invitation' CHECK (type IN ('invitation', 'password_reset'));

-- Add index for type
CREATE INDEX IF NOT EXISTS idx_invitations_type ON public.invitations(type);

-- Update comment
COMMENT ON TABLE public.invitations IS 'Unified token system for invitations (5-day, multi-click) and password resets (24-hour, multi-click), bypassing Supabase single-use token limitations';

-- Update constraint to allow password_reset without role requirement
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
ALTER TABLE public.invitations ADD CONSTRAINT invitations_role_check 
  CHECK (
    (type = 'invitation' AND role IS NOT NULL) OR
    (type = 'password_reset' AND role IS NULL)
  );

-- Update constraint to allow password_reset without bank_id for any role
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS valid_bank_for_role;
ALTER TABLE public.invitations ADD CONSTRAINT valid_bank_for_role CHECK (
  (type = 'invitation' AND role = 'admin' AND bank_id IS NULL) OR
  (type = 'invitation' AND role IN ('bank_viewer', 'specialist') AND bank_id IS NOT NULL) OR
  (type = 'password_reset' AND bank_id IS NULL)
);

-- Make role nullable for password resets
ALTER TABLE public.invitations ALTER COLUMN role DROP NOT NULL;

-- Add comment explaining the distinction
COMMENT ON COLUMN public.invitations.type IS 'Type of token: invitation (5 days, requires role) or password_reset (24 hours, no role needed)';
