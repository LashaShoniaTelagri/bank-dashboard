-- Fix ambiguous column reference in list_specialists function
-- The issue is that 'user_id' could refer to either the profiles.user_id column or the function return variable

-- Drop and recreate the list_specialists function with proper column qualification
DROP FUNCTION IF EXISTS public.list_specialists(uuid);

CREATE OR REPLACE FUNCTION public.list_specialists(p_bank_id uuid DEFAULT NULL)
RETURNS TABLE (
  user_id uuid,
  email text,
  bank_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Fix: Properly qualify the column reference to avoid ambiguity
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.user_id, u.email::text, p.bank_id
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.role = 'specialist'
    AND (
      p_bank_id IS NULL
      OR p.bank_id = p_bank_id
      OR p.bank_id IS NULL
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.list_specialists(uuid) TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
