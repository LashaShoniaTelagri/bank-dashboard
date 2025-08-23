-- Create some sample banks for testing
-- Note: Admin profiles will be created automatically when users sign up
INSERT INTO public.banks (name, logo_url) VALUES
('First National Agricultural Bank', 'https://via.placeholder.com/150x60/22C55E/FFFFFF?text=FNAB'),
('Rural Development Bank', 'https://via.placeholder.com/150x60/3B82F6/FFFFFF?text=RDB'),
('Cooperative Credit Union', 'https://via.placeholder.com/150x60/F59E0B/FFFFFF?text=CCU')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- ADMIN SETUP FUNCTIONS FOR DEVELOPMENT
-- =============================================================================

-- Function 1: Auto-create profile for new users with environment-based admin detection
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Check if this is the first user (make them admin)
  IF (SELECT COUNT(*) FROM public.profiles) = 0 THEN
    INSERT INTO public.profiles (
      user_id, role, bank_id, created_at, 
      invitation_status, invitation_accepted_at
    )
    VALUES (
      NEW.id, 'admin', NULL, NOW(), 
      'accepted', NOW()
    );
  ELSE
    -- For subsequent users, create as bank_viewer (they'll be invited properly later)
    INSERT INTO public.profiles (
      user_id, role, bank_id, created_at, 
      invitation_status, invitation_accepted_at
    )
    VALUES (
      NEW.id, 'bank_viewer', NULL, NOW(), 
      'accepted', NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function 2: Promote any user to admin (for development setup)
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email TEXT)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  target_user_id UUID;
  result_text TEXT;
BEGIN
  -- Find user by email
  SELECT au.id INTO target_user_id
  FROM auth.users au
  WHERE au.email = user_email
    AND au.email_confirmed_at IS NOT NULL
    AND au.deleted_at IS NULL
  LIMIT 1;
  
  IF target_user_id IS NULL THEN
    RETURN 'ERROR: User not found or email not confirmed: ' || user_email;
  END IF;
  
  -- Create or update profile to admin
  INSERT INTO public.profiles (
    user_id, role, bank_id, created_at,
    invitation_status, invitation_accepted_at
  )
  VALUES (
    target_user_id, 'admin', NULL, NOW(),
    'accepted', NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET 
    role = 'admin',
    bank_id = NULL,
    invitation_status = 'accepted',
    invitation_accepted_at = COALESCE(profiles.invitation_accepted_at, NOW());
  
  result_text := 'SUCCESS: User ' || user_email || ' promoted to admin';
  RETURN result_text;
END;
$$;

-- Function 3: Initialize development environment with specific admin
CREATE OR REPLACE FUNCTION public.setup_dev_admin(admin_email TEXT)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  result_text TEXT;
BEGIN
  -- Use the promote function
  SELECT public.promote_user_to_admin(admin_email) INTO result_text;
  
  -- Add some helpful info
  IF result_text LIKE 'SUCCESS:%' THEN
    result_text := result_text || E'\n\nDevelopment environment ready!';
    result_text := result_text || E'\n- Sample banks created';
    result_text := result_text || E'\n- Admin user configured';
    result_text := result_text || E'\n- You can now invite other users through the dashboard';
  END IF;
  
  RETURN result_text;
END;
$$;

-- Create trigger for auto-profile creation (commented out by default)
-- Uncomment if you want automatic profile creation for ALL new signups
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.promote_user_to_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.setup_dev_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;