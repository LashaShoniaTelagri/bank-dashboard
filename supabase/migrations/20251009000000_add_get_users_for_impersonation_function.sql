-- Function to get users for impersonation modal
-- Returns users with their email from auth.users (not stored in profiles)

CREATE OR REPLACE FUNCTION public.get_users_for_impersonation()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  role TEXT,
  bank_id UUID,
  bank_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if requesting user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.user_id = auth.uid() 
    AND public.profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can access user list for impersonation';
  END IF;

  -- Return users with their emails from auth.users
  RETURN QUERY
  SELECT 
    p.user_id,
    au.email::TEXT,
    p.role,
    p.bank_id,
    b.name as bank_name,
    p.created_at
  FROM public.profiles p
  INNER JOIN auth.users au ON p.user_id = au.id
  LEFT JOIN public.banks b ON p.bank_id = b.id
  WHERE p.role != 'admin' -- Don't allow impersonating other admins
  ORDER BY au.email ASC
  LIMIT 100;
END;
$$;

-- Grant execute permission to authenticated users (function checks admin role internally)
GRANT EXECUTE ON FUNCTION public.get_users_for_impersonation() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_users_for_impersonation() IS 'Returns list of users (excluding admins) for impersonation modal. Only callable by administrators.';

