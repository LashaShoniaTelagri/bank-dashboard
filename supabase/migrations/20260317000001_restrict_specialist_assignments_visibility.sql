-- Restrict specialist assignment visibility to admins only
-- Bank viewers/underwriters should not see which specialists are assigned

-- Drop the bank viewer read policy that allowed underwriters to see assignments
DROP POLICY IF EXISTS "uw_spec_assign_bank_read"
  ON public.underwriting_specialist_assignments;

-- Note: Specialists can still see their own assignments through the specialist_read policy
-- Admins can see all assignments through the admin_all policy
