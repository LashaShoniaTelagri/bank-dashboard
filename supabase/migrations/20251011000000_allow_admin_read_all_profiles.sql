-- Allow administrators to read any user's profile
-- This is required for the account switching feature to work properly

-- Create a SECURITY DEFINER function to check if user is admin
-- This bypasses RLS to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'system_admin', 'Administrator', 'System Administrator')
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "profiles.read.own" ON public.profiles;
DROP POLICY IF EXISTS "profiles.read.admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- Create policy that allows users to read their own profile
CREATE POLICY "profiles.read.own"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create policy that allows admins to read any profile
-- Uses SECURITY DEFINER function to avoid infinite recursion
CREATE POLICY "profiles.read.admin"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_admin());

-- Add comments for documentation
COMMENT ON FUNCTION public.is_admin() IS 
'Checks if the current user is an administrator. Uses SECURITY DEFINER to bypass RLS and avoid infinite recursion.';

COMMENT ON POLICY "profiles.read.admin" ON public.profiles IS 
'Allows administrators to read any user profile. Required for account switching feature.';

