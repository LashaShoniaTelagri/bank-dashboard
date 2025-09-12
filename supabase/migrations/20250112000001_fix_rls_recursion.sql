-- Fix RLS recursion issue in profiles table
-- This migration fixes the infinite recursion problem by using simpler, non-recursive policies

-- Drop the problematic recursive policies
DROP POLICY IF EXISTS "profiles.read.admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles.write.admin" ON public.profiles;

-- Keep the existing "profiles.read.own" policy if it exists and is working
-- If it doesn't exist, create it
DO $$
BEGIN
    -- Check if the policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'profiles.read.own'
    ) THEN
        -- Create the policy if it doesn't exist
        CREATE POLICY "profiles.read.own" ON public.profiles
          FOR SELECT TO authenticated
          USING (user_id = auth.uid());
    END IF;
END $$;

-- Create a simple update policy for users to update their own profiles
DROP POLICY IF EXISTS "profiles.update.own" ON public.profiles;
CREATE POLICY "profiles.update.own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Note: Admin operations will be handled at the application layer
-- to avoid RLS recursion issues. The application will use service role
-- for admin operations that bypass RLS.

-- Ensure RLS is enabled on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
