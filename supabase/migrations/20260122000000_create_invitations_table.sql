-- Migration: Create custom invitations table for 5-day expiration and multi-click support
-- This replaces reliance on Supabase's 24-hour OTP tokens

-- Create invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'bank_viewer', 'specialist')),
  bank_id UUID REFERENCES public.banks(id) ON DELETE CASCADE,
  invited_by TEXT,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  clicks_count INTEGER DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_bank_for_role CHECK (
    (role = 'admin' AND bank_id IS NULL) OR
    (role IN ('bank_viewer', 'specialist') AND bank_id IS NOT NULL)
  )
);

-- Create indexes for performance
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_status ON public.invitations(status);
CREATE INDEX idx_invitations_expires_at ON public.invitations(expires_at);
CREATE INDEX idx_invitations_user_id ON public.invitations(user_id);

-- Add comment
COMMENT ON TABLE public.invitations IS 'Custom invitation system with 5-day expiration and multi-click support, bypassing Supabase 24-hour OTP limit';

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can view all invitations
CREATE POLICY "Admins can view all invitations"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policy: Users can view their own invitation (by email match)
CREATE POLICY "Users can view their own invitation by email"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (email = auth.jwt()->>'email');

-- RLS Policy: Service role can do everything (for Edge Functions)
CREATE POLICY "Service role full access"
  ON public.invitations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_invitations_updated_at_trigger
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_invitations_updated_at();

-- Create function to automatically expire old invitations (can be called by cron or manually)
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION expire_old_invitations() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION expire_old_invitations() IS 'Updates status of pending invitations that have passed their expiration date. Returns count of expired invitations.';
