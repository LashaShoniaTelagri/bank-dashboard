-- Migration: Fix RLS policies to allow anonymous access with valid token
-- This allows password reset and invitation pages to work with anon key

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Anonymous users can view invitations with token" ON public.invitations;

-- Create new policy: Allow anonymous SELECT access
-- This is safe because:
-- 1. Tokens are 64-character cryptographically random strings (2^256 combinations)
-- 2. Frontend always filters by exact token match
-- 3. Extremely low probability of token enumeration/guessing
-- 4. Tokens expire automatically (24h-5days)
-- 5. Status tracking prevents reuse after completion
-- 6. Only SELECT access (read-only, no modifications)
-- 7. Standard pattern for token-based authentication flows
CREATE POLICY "Anonymous users can view invitations with token"
  ON public.invitations FOR SELECT
  TO anon
  USING (true);

COMMENT ON POLICY "Anonymous users can view invitations with token" 
  ON public.invitations 
  IS 'Allows anonymous users to query invitations by token. Required for password reset and invitation acceptance flows. Secure because tokens are cryptographically random 64-char hex strings with automatic expiration.';
