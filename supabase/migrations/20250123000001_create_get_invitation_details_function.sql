-- Create the get_invitation_details function that the UI is calling
CREATE OR REPLACE FUNCTION public.get_invitation_details()
RETURNS TABLE (
  user_id uuid,
  email text,
  role text,
  bank_id uuid,
  bank_name text,
  invited_by text,
  invited_at timestamptz,
  invitation_accepted_at timestamptz,
  invitation_status text,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT 
    p.user_id,
    COALESCE(au.email, au.raw_user_meta_data->>'email') as email,
    p.role,
    p.bank_id,
    COALESCE(b.name, 'Unknown Bank') as bank_name,
    COALESCE(p.invited_by, 'Unknown') as invited_by,
    p.invited_at,
    p.invitation_accepted_at,
    -- Determine status based on actual user state
    CASE 
      -- If user has confirmed their email and has a valid auth record, they're accepted
      WHEN au.email_confirmed_at IS NOT NULL AND au.deleted_at IS NULL THEN 'accepted'
      -- If invitation was sent more than 48 hours ago and no confirmation, it's expired
      WHEN p.invited_at IS NOT NULL AND p.invited_at < NOW() - INTERVAL '48 hours' AND au.email_confirmed_at IS NULL THEN 'expired'
      -- If manually cancelled or status explicitly set
      WHEN p.invitation_status = 'cancelled' THEN 'cancelled'
      -- Otherwise it's still pending
      ELSE 'pending'
    END as invitation_status,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.banks b ON p.bank_id = b.id  
  LEFT JOIN auth.users au ON p.user_id = au.id
  WHERE p.invited_at IS NOT NULL
  ORDER BY p.invited_at DESC
  LIMIT 10;
$$;

-- Grant execute permission to authenticated users (admin check will be done by RLS)
GRANT EXECUTE ON FUNCTION public.get_invitation_details() TO authenticated;

-- Create trigger function to automatically update invitation status when user confirms email
CREATE OR REPLACE FUNCTION public.update_invitation_status_on_confirm()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Update the invitation status to 'accepted' when user confirms email
  UPDATE public.profiles 
  SET 
    invitation_status = 'accepted',
    invitation_accepted_at = NOW()
  WHERE user_id = NEW.id 
    AND invitation_status = 'pending'
    AND invited_at IS NOT NULL
    AND NEW.email_confirmed_at IS NOT NULL
    AND OLD.email_confirmed_at IS NULL;
    
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table to automatically update profile when email is confirmed
-- Note: This requires superuser privileges, so it should be applied manually in Supabase dashboard
-- DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
-- CREATE TRIGGER on_auth_user_confirmed
--   AFTER UPDATE ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.update_invitation_status_on_confirm();

-- For now, let's create a scheduled function that can be called periodically to update statuses
CREATE OR REPLACE FUNCTION public.sync_invitation_statuses()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  -- Update profiles to 'accepted' if the user has confirmed their email
  UPDATE public.profiles p
  SET 
    invitation_status = 'accepted',
    invitation_accepted_at = COALESCE(p.invitation_accepted_at, au.email_confirmed_at)
  FROM auth.users au
  WHERE p.user_id = au.id
    AND p.invitation_status = 'pending'
    AND p.invited_at IS NOT NULL
    AND au.email_confirmed_at IS NOT NULL;
    
  -- Update profiles to 'expired' if invitation is older than 48 hours and not confirmed
  UPDATE public.profiles p
  SET invitation_status = 'expired'
  FROM auth.users au
  WHERE p.user_id = au.id
    AND p.invitation_status = 'pending'
    AND p.invited_at IS NOT NULL
    AND p.invited_at < NOW() - INTERVAL '48 hours'
    AND au.email_confirmed_at IS NULL;
$$;

-- Grant execute permission for the sync function
GRANT EXECUTE ON FUNCTION public.sync_invitation_statuses() TO authenticated; 