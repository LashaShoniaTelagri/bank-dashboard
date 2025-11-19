-- Fix impersonation functions to accept admin_user_id parameter
-- This allows Edge Functions to call them with service role

-- Drop and recreate start_user_impersonation with admin_user_id parameter
DROP FUNCTION IF EXISTS start_user_impersonation(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION start_user_impersonation(
  p_admin_user_id UUID,
  p_target_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_admin_profile RECORD;
  v_target_profile RECORD;
  v_session_id UUID;
BEGIN
  -- Validate admin user ID
  IF p_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Admin user ID required';
  END IF;
  
  -- Get admin profile with email from auth.users
  SELECT p.user_id, au.email::TEXT as email, p.role 
  INTO v_admin_profile
  FROM public.profiles p
  INNER JOIN auth.users au ON p.user_id = au.id
  WHERE p.user_id = p_admin_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin user not found';
  END IF;
  
  -- Security check: Only admins and system admins can impersonate
  IF v_admin_profile.role NOT IN ('admin', 'system_admin', 'Administrator', 'System Administrator') THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can impersonate users';
  END IF;
  
  -- Cannot impersonate yourself
  IF p_admin_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot impersonate yourself';
  END IF;
  
  -- Get target user profile with email from auth.users
  SELECT p.user_id, au.email::TEXT as email, p.role 
  INTO v_target_profile
  FROM public.profiles p
  INNER JOIN auth.users au ON p.user_id = au.id
  WHERE p.user_id = p_target_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;
  
  -- Cannot impersonate another admin (security policy)
  IF v_target_profile.role IN ('admin', 'system_admin', 'Administrator', 'System Administrator') THEN
    RAISE EXCEPTION 'Security policy: Cannot impersonate other administrators';
  END IF;
  
  -- Check for existing active impersonation by this admin
  -- End any existing active impersonations first
  UPDATE public.admin_impersonation_sessions
  SET 
    is_active = FALSE,
    ended_at = NOW(),
    duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
  WHERE admin_user_id = p_admin_user_id AND is_active = TRUE;
  
  -- Create new impersonation session
  INSERT INTO public.admin_impersonation_sessions (
    admin_user_id,
    admin_email,
    admin_role,
    target_user_id,
    target_email,
    target_role,
    reason,
    ip_address,
    user_agent
  ) VALUES (
    p_admin_user_id,
    v_admin_profile.email,
    v_admin_profile.role,
    p_target_user_id,
    v_target_profile.email,
    v_target_profile.role,
    COALESCE(p_reason, 'Admin support'),
    p_ip_address::INET,
    p_user_agent
  )
  RETURNING id INTO v_session_id;
  
  -- Audit logging is handled by admin_impersonation_sessions table
  -- No need for separate audit_log entry
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update end_user_impersonation to accept admin_user_id parameter
DROP FUNCTION IF EXISTS end_user_impersonation(UUID);

CREATE OR REPLACE FUNCTION end_user_impersonation(
  p_admin_user_id UUID,
  p_session_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- If session ID provided, end that specific session
  IF p_session_id IS NOT NULL THEN
    SELECT * INTO v_session
    FROM public.admin_impersonation_sessions
    WHERE id = p_session_id 
      AND admin_user_id = p_admin_user_id
      AND is_active = TRUE;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Active session not found';
    END IF;
    
    -- End the session
    UPDATE public.admin_impersonation_sessions
    SET 
      is_active = FALSE,
      ended_at = NOW(),
      duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
    WHERE id = p_session_id;
  ELSE
    -- End all active sessions for this admin
    UPDATE public.admin_impersonation_sessions
    SET 
      is_active = FALSE,
      ended_at = NOW(),
      duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
    WHERE admin_user_id = p_admin_user_id AND is_active = TRUE;
  END IF;
  
  -- Audit logging is handled by admin_impersonation_sessions table
  -- Duration is automatically calculated on session end
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION start_user_impersonation(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION end_user_impersonation(UUID, UUID) TO service_role;

-- Add comments
COMMENT ON FUNCTION start_user_impersonation(UUID, UUID, TEXT, TEXT, TEXT) IS 'Start user impersonation session. Called by Edge Functions with service role. Requires admin_user_id parameter.';
COMMENT ON FUNCTION end_user_impersonation(UUID, UUID) IS 'End user impersonation session. Called by Edge Functions with service role. Requires admin_user_id parameter.';

