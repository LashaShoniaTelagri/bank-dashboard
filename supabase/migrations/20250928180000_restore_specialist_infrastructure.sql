-- Restore specialist infrastructure tables and functions
-- This migration recreates the specialist_assignments table and related infrastructure

-- 1. Create specialist_assignments table
CREATE TABLE IF NOT EXISTS public.specialist_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  phase INTEGER NOT NULL CHECK (phase >= 1 AND phase <= 12),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique assignment per specialist-farmer-phase combination
  UNIQUE(specialist_id, farmer_id, phase)
);

-- 2. Create analysis_sessions table
CREATE TABLE IF NOT EXISTS public.analysis_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  phase INTEGER NOT NULL CHECK (phase >= 1 AND phase <= 12),
  session_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,
  results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create AI chat infrastructure
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS on all tables
ALTER TABLE public.specialist_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for specialist_assignments
CREATE POLICY "Specialists can view their own assignments" ON public.specialist_assignments
  FOR SELECT USING (auth.uid() = specialist_id);

CREATE POLICY "Admins can view all specialist assignments" ON public.specialist_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can create specialist assignments" ON public.specialist_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update specialist assignments" ON public.specialist_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Specialists can update their own assignment status" ON public.specialist_assignments
  FOR UPDATE USING (auth.uid() = specialist_id);

-- 7. Create RLS policies for analysis_sessions
CREATE POLICY "Specialists can manage their own analysis sessions" ON public.analysis_sessions
  FOR ALL USING (auth.uid() = specialist_id);

CREATE POLICY "Admins can view all analysis sessions" ON public.analysis_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 8. Create RLS policies for chat_messages
CREATE POLICY "Users can view messages in their sessions" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.analysis_sessions 
      WHERE id = chat_messages.session_id 
      AND specialist_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their sessions" ON public.chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.analysis_sessions 
      WHERE id = chat_messages.session_id 
      AND specialist_id = auth.uid()
    )
  );

-- 9. Create RLS policies for AI chat infrastructure
CREATE POLICY "Users can manage their own AI chat sessions" ON public.ai_chat_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage messages in their AI chat sessions" ON public.ai_chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.ai_chat_sessions 
      WHERE id = ai_chat_messages.session_id 
      AND user_id = auth.uid()
    )
  );

-- 10. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.specialist_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_messages TO authenticated;

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_specialist_assignments_specialist_id ON public.specialist_assignments(specialist_id);
CREATE INDEX IF NOT EXISTS idx_specialist_assignments_farmer_id ON public.specialist_assignments(farmer_id);
CREATE INDEX IF NOT EXISTS idx_specialist_assignments_phase ON public.specialist_assignments(phase);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_specialist_id ON public.analysis_sessions(specialist_id);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_farmer_id ON public.analysis_sessions(farmer_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON public.ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_id ON public.ai_chat_messages(session_id);

-- 12. Add table comments
COMMENT ON TABLE public.specialist_assignments IS 'Assignments of specialists to specific farmers and F-100 phases';
COMMENT ON TABLE public.analysis_sessions IS 'Analysis sessions conducted by specialists for assigned farmers';
COMMENT ON TABLE public.chat_messages IS 'Messages exchanged during analysis sessions';
COMMENT ON TABLE public.ai_chat_sessions IS 'AI-powered chat sessions for agricultural analysis';
COMMENT ON TABLE public.ai_chat_messages IS 'Messages in AI chat sessions';

-- 13. Recreate the specialist_dashboard_data view (if it was dropped)
DROP VIEW IF EXISTS public.specialist_dashboard_data CASCADE;
CREATE VIEW public.specialist_dashboard_data AS
SELECT 
  sa.id as assignment_id,
  sa.farmer_id,
  sa.phase,
  sa.status as assignment_status,
  sa.assigned_at,
  sa.notes,
  f.name as farmer_name,
  f.id_number as farmer_id_number,
  b.name as bank_name,
  COUNT(fdu.id) as data_uploads_count,
  COUNT(CASE WHEN fdu.data_type::text = 'photo' THEN 1 END) as photo_count,
  COUNT(CASE WHEN fdu.data_type::text = 'analysis' THEN 1 END) as analysis_count,
  COUNT(CASE WHEN fdu.data_type::text = 'maps' THEN 1 END) as maps_count,
  COUNT(CASE WHEN fdu.data_type::text = 'text' THEN 1 END) as text_count,
  COUNT(CASE WHEN fdu.data_type::text = 'document' THEN 1 END) as document_count,
  COUNT(as2.id) as analysis_sessions_count,
  MAX(as2.updated_at) as last_analysis_at
FROM public.specialist_assignments sa
JOIN public.farmers f ON sa.farmer_id = f.id
JOIN public.banks b ON sa.bank_id = b.id
LEFT JOIN public.farmer_data_uploads fdu 
  ON sa.farmer_id = fdu.farmer_id
  AND COALESCE((fdu.metadata->>'f100_phase')::int, NULL) = sa.phase
LEFT JOIN public.analysis_sessions as2
  ON sa.farmer_id = as2.farmer_id
  AND sa.phase = as2.phase
  AND as2.specialist_id = sa.specialist_id
WHERE sa.specialist_id = auth.uid()
GROUP BY sa.id, sa.farmer_id, sa.phase, sa.status, sa.assigned_at, sa.notes, f.name, f.id_number, b.name;

-- Grant access to the view
GRANT SELECT ON public.specialist_dashboard_data TO authenticated;

-- 14. Recreate get_specialist_assignments function
CREATE OR REPLACE FUNCTION public.get_specialist_assignments(p_specialist_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  assignment_id uuid,
  farmer_id uuid,
  farmer_name text,
  farmer_id_number text,
  bank_name text,
  phase int,
  status text,
  assigned_at timestamptz,
  data_uploads_count bigint,
  analysis_sessions_count bigint,
  last_activity timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.id,
    sa.farmer_id,
    f.name,
    f.id_number,
    b.name,
    sa.phase,
    sa.status,
    sa.assigned_at,
    COUNT(DISTINCT fdu.id),
    COUNT(DISTINCT as2.id),
    GREATEST(
      MAX(fdu.created_at),
      MAX(as2.updated_at),
      MAX(cm.created_at)
    )
  FROM public.specialist_assignments sa
  JOIN public.farmers f ON sa.farmer_id = f.id
  JOIN public.banks b ON sa.bank_id = b.id
  LEFT JOIN public.farmer_data_uploads fdu
    ON sa.farmer_id = fdu.farmer_id
    AND COALESCE((fdu.metadata->>'f100_phase')::int, NULL) = sa.phase
  LEFT JOIN public.analysis_sessions as2
    ON sa.farmer_id = as2.farmer_id
    AND sa.phase = as2.phase
    AND as2.specialist_id = sa.specialist_id
  LEFT JOIN public.chat_messages cm
    ON cm.session_id IN (
      SELECT id FROM public.analysis_sessions 
      WHERE farmer_id = sa.farmer_id 
      AND specialist_id = sa.specialist_id
    )
  WHERE sa.specialist_id = p_specialist_id
  GROUP BY sa.id, sa.farmer_id, f.name, f.id_number, b.name, sa.phase, sa.status, sa.assigned_at
  ORDER BY sa.assigned_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_specialist_assignments(uuid) TO authenticated;
