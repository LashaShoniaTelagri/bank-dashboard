-- User Impersonation System for Admin Support
-- Banking-grade audit trail for compliance and security

-- Create impersonation sessions table for tracking
CREATE TABLE IF NOT EXISTS public.admin_impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Admin performing impersonation
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  admin_email TEXT NOT NULL,
  admin_role TEXT NOT NULL,
  
  -- User being impersonated
  target_user_id UUID NOT NULL REFERENCES auth.users(id),
  target_email TEXT NOT NULL,
  target_role TEXT NOT NULL,
  
  -- Session details
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Context
  reason TEXT, -- Why impersonating? "Support ticket #123", "Testing", etc.
  ip_address INET,
  user_agent TEXT,
  
  -- Security
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CHECK (admin_user_id != target_user_id),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Create index for active impersonations
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active ON public.admin_impersonation_sessions(admin_user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target ON public.admin_impersonation_sessions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_started ON public.admin_impersonation_sessions(started_at DESC);

-- Create impersonation actions audit log
CREATE TABLE IF NOT EXISTS public.admin_impersonation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to impersonation session
  session_id UUID NOT NULL REFERENCES public.admin_impersonation_sessions(id) ON DELETE CASCADE,
  
  -- Action details
  action_type TEXT NOT NULL, -- 'view_page', 'api_call', 'button_click', etc.
  action_description TEXT,
  page_url TEXT,
  api_endpoint TEXT,
  
  -- Request/Response data (sanitized)
  request_data JSONB,
  response_status INTEGER,
  
  -- Timing
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  
  -- Context
  ip_address INET,
  user_agent TEXT
);

-- Index for querying actions
CREATE INDEX IF NOT EXISTS idx_impersonation_actions_session ON public.admin_impersonation_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_actions_performed ON public.admin_impersonation_actions(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_actions_type ON public.admin_impersonation_actions(action_type);

-- Function to start impersonation
CREATE OR REPLACE FUNCTION start_user_impersonation(
  p_target_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_admin_user_id UUID;
  v_admin_profile RECORD;
  v_target_profile RECORD;
  v_session_id UUID;
BEGIN
  -- Get current admin user
  v_admin_user_id := auth.uid();
  
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get admin profile
  SELECT user_id, email, role INTO v_admin_profile
  FROM public.profiles
  WHERE user_id = v_admin_user_id;
  
  -- Security check: Only admins and system admins can impersonate
  IF v_admin_profile.role NOT IN ('admin', 'system_admin', 'Administrator', 'System Administrator') THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can impersonate users';
  END IF;
  
  -- Cannot impersonate yourself
  IF v_admin_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot impersonate yourself';
  END IF;
  
  -- Get target user profile
  SELECT user_id, email, role INTO v_target_profile
  FROM public.profiles
  WHERE user_id = p_target_user_id;
  
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
  WHERE admin_user_id = v_admin_user_id AND is_active = TRUE;
  
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
    v_admin_user_id,
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
  
  -- Log the impersonation start
  INSERT INTO public.audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    v_admin_user_id,
    'IMPERSONATION_STARTED',
    'user',
    p_target_user_id,
    jsonb_build_object(
      'admin_email', v_admin_profile.email,
      'target_email', v_target_profile.email,
      'reason', p_reason
    ),
    p_ip_address,
    p_user_agent
  );
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end impersonation
CREATE OR REPLACE FUNCTION end_user_impersonation(
  p_session_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_user_id UUID;
  v_session RECORD;
BEGIN
  v_admin_user_id := auth.uid();
  
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- If no session_id provided, end all active sessions for this admin
  IF p_session_id IS NULL THEN
    UPDATE public.admin_impersonation_sessions
    SET 
      is_active = FALSE,
      ended_at = NOW(),
      duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
    WHERE admin_user_id = v_admin_user_id AND is_active = TRUE
    RETURNING * INTO v_session;
  ELSE
    -- End specific session
    UPDATE public.admin_impersonation_sessions
    SET 
      is_active = FALSE,
      ended_at = NOW(),
      duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
    WHERE id = p_session_id AND admin_user_id = v_admin_user_id AND is_active = TRUE
    RETURNING * INTO v_session;
  END IF;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Log the impersonation end
  INSERT INTO public.audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    v_admin_user_id,
    'IMPERSONATION_ENDED',
    'user',
    v_session.target_user_id,
    jsonb_build_object(
      'duration_seconds', v_session.duration_seconds,
      'target_email', v_session.target_email
    )
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log impersonation actions
CREATE OR REPLACE FUNCTION log_impersonation_action(
  p_session_id UUID,
  p_action_type TEXT,
  p_action_description TEXT DEFAULT NULL,
  p_page_url TEXT DEFAULT NULL,
  p_api_endpoint TEXT DEFAULT NULL,
  p_request_data JSONB DEFAULT NULL,
  p_response_status INTEGER DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_action_id UUID;
BEGIN
  INSERT INTO public.admin_impersonation_actions (
    session_id,
    action_type,
    action_description,
    page_url,
    api_endpoint,
    request_data,
    response_status,
    duration_ms
  ) VALUES (
    p_session_id,
    p_action_type,
    p_action_description,
    p_page_url,
    p_api_endpoint,
    p_request_data,
    p_response_status,
    p_duration_ms
  )
  RETURNING id INTO v_action_id;
  
  RETURN v_action_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current impersonation session
CREATE OR REPLACE FUNCTION get_active_impersonation()
RETURNS TABLE (
  session_id UUID,
  target_user_id UUID,
  target_email TEXT,
  target_role TEXT,
  started_at TIMESTAMPTZ,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    ais.target_user_id,
    ais.target_email,
    ais.target_role,
    ais.started_at,
    ais.reason
  FROM public.admin_impersonation_sessions ais
  WHERE ais.admin_user_id = auth.uid() 
    AND ais.is_active = TRUE
  ORDER BY ais.started_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get impersonation history for admin dashboard
CREATE OR REPLACE FUNCTION get_impersonation_history(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  session_id UUID,
  admin_email TEXT,
  target_email TEXT,
  target_role TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  reason TEXT,
  action_count BIGINT
) AS $$
BEGIN
  -- Only admins can view history
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'system_admin', 'Administrator', 'System Administrator')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    ais.id,
    ais.admin_email,
    ais.target_email,
    ais.target_role,
    ais.started_at,
    ais.ended_at,
    ais.duration_seconds,
    ais.reason,
    COUNT(aia.id) as action_count
  FROM public.admin_impersonation_sessions ais
  LEFT JOIN public.admin_impersonation_actions aia ON aia.session_id = ais.id
  GROUP BY ais.id
  ORDER BY ais.started_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE public.admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_impersonation_actions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Admins can view all impersonation sessions" ON public.admin_impersonation_sessions;
DROP POLICY IF EXISTS "System can manage impersonation sessions" ON public.admin_impersonation_sessions;
DROP POLICY IF EXISTS "Admins can view all impersonation actions" ON public.admin_impersonation_actions;

-- Admins can view all impersonation sessions
CREATE POLICY "Admins can view all impersonation sessions" ON public.admin_impersonation_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'system_admin', 'Administrator', 'System Administrator')
    )
  );

-- Only system can insert/update (via functions)
CREATE POLICY "System can manage impersonation sessions" ON public.admin_impersonation_sessions
  FOR ALL USING (FALSE) WITH CHECK (FALSE);

-- Admins can view all impersonation actions
CREATE POLICY "Admins can view all impersonation actions" ON public.admin_impersonation_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'system_admin', 'Administrator', 'System Administrator')
    )
  );

-- Grant necessary permissions (with full function signatures for uniqueness)
GRANT EXECUTE ON FUNCTION start_user_impersonation(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION end_user_impersonation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_impersonation_action(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_impersonation() TO authenticated;
GRANT EXECUTE ON FUNCTION get_impersonation_history(INTEGER, INTEGER) TO authenticated;

-- Comments for documentation (with full function signatures for uniqueness)
COMMENT ON TABLE public.admin_impersonation_sessions IS 'Audit trail of admin user impersonation sessions for support and debugging';
COMMENT ON TABLE public.admin_impersonation_actions IS 'Detailed log of actions performed during impersonation sessions';
COMMENT ON FUNCTION start_user_impersonation(UUID, TEXT, TEXT, TEXT) IS 'Starts an impersonation session (admin only)';
COMMENT ON FUNCTION end_user_impersonation(UUID) IS 'Ends an active impersonation session';
COMMENT ON FUNCTION log_impersonation_action(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, INTEGER) IS 'Logs an action performed during impersonation';
COMMENT ON FUNCTION get_active_impersonation() IS 'Gets the current active impersonation session for the admin';
COMMENT ON FUNCTION get_impersonation_history(INTEGER, INTEGER) IS 'Gets impersonation history for admin dashboard';
