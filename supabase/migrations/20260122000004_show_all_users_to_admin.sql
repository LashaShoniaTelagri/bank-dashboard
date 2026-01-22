-- Migration: Update get_invitation_details to show ALL users (not just pending invitations)
-- This allows admins to see both pending invitations AND existing active users

-- Drop old function
DROP FUNCTION IF EXISTS public.get_invitation_details();

-- Recreate function to show all users with their invitation/status info
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
  created_at timestamptz,
  invitation_id uuid,
  invitation_type text,
  expires_at timestamptz,
  clicks_count integer,
  last_clicked_at timestamptz,
  is_active boolean,
  last_sign_in_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  -- UNION of two sources:
  -- 1. Users from new invitations table (pending invitations)
  -- 2. Users from profiles table (existing users without recent invitations)
  
  WITH invitation_users AS (
    -- Get users from invitations table
    SELECT 
      i.user_id,
      i.email,
      COALESCE(i.role, 'Unknown') as role,
      i.bank_id,
      COALESCE(b.name, 'N/A') as bank_name,
      COALESCE(i.invited_by, 'System') as invited_by,
      i.invited_at,
      i.completed_at as invitation_accepted_at,
      CASE 
        WHEN i.status = 'completed' THEN 'accepted'
        WHEN i.status = 'expired' THEN 'expired'
        WHEN i.status = 'cancelled' THEN 'cancelled'
        WHEN i.expires_at < NOW() THEN 'expired'
        ELSE 'pending'
      END as invitation_status,
      i.created_at,
      i.id as invitation_id,
      COALESCE(i.type, 'invitation') as invitation_type,
      i.expires_at,
      i.clicks_count,
      i.last_clicked_at,
      CASE WHEN au.deleted_at IS NULL THEN true ELSE false END as is_active,
      au.last_sign_in_at
    FROM public.invitations i
    LEFT JOIN public.banks b ON i.bank_id = b.id
    LEFT JOIN auth.users au ON i.user_id = au.id
    WHERE i.type = 'invitation' OR i.type IS NULL
  ),
  profile_users AS (
    -- Get users from profiles table who don't have recent invitations
    SELECT 
      p.user_id,
      COALESCE(au.email, au.raw_user_meta_data->>'email') as email,
      p.role,
      p.bank_id,
      COALESCE(b.name, 'N/A') as bank_name,
      COALESCE(p.invited_by, 'Direct Creation') as invited_by,
      p.invited_at,
      p.invitation_accepted_at,
      CASE 
        WHEN au.deleted_at IS NOT NULL THEN 'deleted'
        WHEN au.email_confirmed_at IS NOT NULL THEN 'accepted'
        WHEN p.invitation_status IS NOT NULL THEN p.invitation_status
        ELSE 'accepted'
      END as invitation_status,
      p.created_at,
      NULL::uuid as invitation_id,
      'profile' as invitation_type,
      NULL::timestamptz as expires_at,
      0 as clicks_count,
      NULL::timestamptz as last_clicked_at,
      CASE WHEN au.deleted_at IS NULL THEN true ELSE false END as is_active,
      au.last_sign_in_at
    FROM public.profiles p
    LEFT JOIN public.banks b ON p.bank_id = b.id
    LEFT JOIN auth.users au ON p.user_id = au.id
    WHERE NOT EXISTS (
      -- Exclude users who have invitations in the invitations table
      SELECT 1 FROM public.invitations i2
      WHERE i2.user_id = p.user_id
      AND i2.type = 'invitation'
    )
  )
  -- Combine both sources
  SELECT * FROM invitation_users
  UNION ALL
  SELECT * FROM profile_users
  ORDER BY invited_at DESC NULLS LAST, created_at DESC
  LIMIT 100;  -- Show more users (increased from 50)
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_invitation_details() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.get_invitation_details() 
IS 'Returns ALL users (both pending invitations from invitations table AND existing users from profiles table) for admin dashboard. Includes invitation status, activity, and metadata.';
