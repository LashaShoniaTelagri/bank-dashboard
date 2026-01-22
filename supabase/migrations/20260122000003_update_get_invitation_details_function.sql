-- Migration: Update get_invitation_details to use new invitations table
-- This fixes admin not seeing invitation list

-- Drop old function
DROP FUNCTION IF EXISTS public.get_invitation_details();

-- Recreate function to query from new invitations table
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
  last_clicked_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT 
    i.user_id,
    i.email,
    COALESCE(i.role, 'password_reset') as role,
    i.bank_id,
    COALESCE(b.name, 'N/A') as bank_name,
    COALESCE(i.invited_by, 'System') as invited_by,
    i.invited_at,
    i.completed_at as invitation_accepted_at,
    -- Map status from invitations table
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
    i.last_clicked_at
  FROM public.invitations i
  LEFT JOIN public.banks b ON i.bank_id = b.id
  WHERE i.type = 'invitation' OR i.type IS NULL  -- Only show invitations, not password resets
  ORDER BY i.invited_at DESC
  LIMIT 50;  -- Increased from 10 to 50 for better visibility
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_invitation_details() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.get_invitation_details() 
IS 'Returns invitation details from the new invitations table for admin dashboard. Filters to show only invitations (not password resets).';
