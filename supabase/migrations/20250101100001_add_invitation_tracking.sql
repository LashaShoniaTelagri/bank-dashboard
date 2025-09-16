-- Add invitation tracking fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS invited_by text,
ADD COLUMN IF NOT EXISTS invited_at timestamptz,
ADD COLUMN IF NOT EXISTS invitation_accepted_at timestamptz,
ADD COLUMN IF NOT EXISTS invitation_status text DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'expired'));

-- Update existing profiles to have 'accepted' status (they're already active)
UPDATE public.profiles 
SET invitation_status = 'accepted', 
    invitation_accepted_at = created_at 
WHERE invitation_status = 'pending';

-- Add RLS policy for admins to read all profiles (for invitation management)
CREATE POLICY "profiles.read.admin"
ON public.profiles FOR SELECT
TO authenticated
USING (
  exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin')
);

-- Create a view for recent invitations with bank names
CREATE OR REPLACE VIEW public.v_recent_invitations AS
SELECT 
  p.user_id,
  p.role,
  p.bank_id,
  b.name as bank_name,
  p.invited_by,
  p.invited_at,
  p.invitation_accepted_at,
  p.invitation_status,
  p.created_at,
  au.email
FROM public.profiles p
LEFT JOIN public.banks b ON p.bank_id = b.id  
LEFT JOIN auth.users au ON p.user_id = au.id
WHERE p.invited_at IS NOT NULL
ORDER BY p.invited_at DESC; 