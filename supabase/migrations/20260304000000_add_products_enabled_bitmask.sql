-- SS-244: Add Bitmask-Based Product Access to User Profiles
-- Product bits: 1 = Field Monitoring, 2 = Underwriting, 4 = (future), 8 = (future)
-- Supports up to 32 products without schema changes (INTEGER = 32 bits)

-- Add products_enabled column (default 1 = Field Monitoring only)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS products_enabled INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.profiles.products_enabled IS 'Bitmask for product access: bit 0 (1) = Field Monitoring, bit 1 (2) = Underwriting. Check with (products_enabled & bit) > 0';

-- Update existing users: all current users get Field Monitoring enabled
UPDATE public.profiles
SET products_enabled = 1
WHERE products_enabled = 0 OR products_enabled IS NULL;

-- Function: Check if a user has access to a specific product
CREATE OR REPLACE FUNCTION check_product_access(target_user_id UUID, product_bit INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = target_user_id
      AND (products_enabled & product_bit) > 0
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION check_product_access(UUID, INTEGER) IS 'Check if user has access to a product via bitmask. product_bit: 1=FieldMonitoring, 2=Underwriting';

-- Function: Grant product access to a user
CREATE OR REPLACE FUNCTION grant_product_access(target_user_id UUID, product_bit INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET products_enabled = products_enabled | product_bit
  WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION grant_product_access(UUID, INTEGER) IS 'Grant product access by setting the corresponding bit. product_bit: 1=FieldMonitoring, 2=Underwriting';

-- Function: Revoke product access from a user
CREATE OR REPLACE FUNCTION revoke_product_access(target_user_id UUID, product_bit INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET products_enabled = products_enabled & ~product_bit
  WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION revoke_product_access(UUID, INTEGER) IS 'Revoke product access by clearing the corresponding bit. product_bit: 1=FieldMonitoring, 2=Underwriting';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_product_access(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION grant_product_access(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_product_access(UUID, INTEGER) TO authenticated;

-- Create index for fast bitmask lookups
CREATE INDEX IF NOT EXISTS idx_profiles_products_enabled ON public.profiles(products_enabled);
