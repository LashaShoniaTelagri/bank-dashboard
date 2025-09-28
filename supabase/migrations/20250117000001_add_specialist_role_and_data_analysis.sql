-- Add specialist role and data analysis infrastructure
-- This migration adds support for specialist role, data uploads, phase assignments, and analysis tracking

-- Create enum for data types
CREATE TYPE data_type AS ENUM (
  'photo',
  'analysis',
  'geospatial',
  'text',
  'document',
  'video',
  'audio'
);

-- Create enum for analysis phases
CREATE TYPE analysis_phase AS ENUM (
  'initial_assessment',
  'crop_analysis',
  'soil_analysis',
  'irrigation_analysis',
  'harvest_analysis',
  'financial_analysis',
  'compliance_review',
  'final_report'
);

-- Create enum for analysis status
CREATE TYPE analysis_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'requires_review',
  'cancelled'
);

-- Create farmer_data_uploads table for storing uploaded data
CREATE TABLE farmer_data_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_type data_type NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_mime TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  metadata JSONB DEFAULT '{}',
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  phase analysis_phase NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create specialist_assignments table for phase-based specialist assignments
CREATE TABLE specialist_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase analysis_phase NOT NULL,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  status analysis_status DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(farmer_id, specialist_id, phase)
);

-- Create analysis_sessions table for tracking LLM analysis sessions
CREATE TABLE analysis_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase analysis_phase NOT NULL,
  session_name TEXT NOT NULL,
  context_data JSONB DEFAULT '{}',
  analysis_prompt TEXT NOT NULL,
  llm_response TEXT,
  llm_model TEXT,
  llm_usage JSONB,
  status analysis_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create analysis_attachments table for linking data uploads to analysis sessions
CREATE TABLE analysis_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  data_upload_id UUID NOT NULL REFERENCES farmer_data_uploads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, data_upload_id)
);

-- Create chat_messages table for specialist-farmer communication
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('specialist', 'farmer', 'admin', 'bank_viewer')),
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  session_id UUID REFERENCES analysis_sessions(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create llm_api_keys table for secure API key storage
CREATE TABLE llm_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'azure')),
  key_name TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider, key_name)
);

-- Add indexes for performance
CREATE INDEX idx_farmer_data_uploads_farmer_id ON farmer_data_uploads(farmer_id);
CREATE INDEX idx_farmer_data_uploads_phase ON farmer_data_uploads(phase);
CREATE INDEX idx_farmer_data_uploads_data_type ON farmer_data_uploads(data_type);
CREATE INDEX idx_farmer_data_uploads_created_at ON farmer_data_uploads(created_at);

CREATE INDEX idx_specialist_assignments_farmer_id ON specialist_assignments(farmer_id);
CREATE INDEX idx_specialist_assignments_specialist_id ON specialist_assignments(specialist_id);
CREATE INDEX idx_specialist_assignments_phase ON specialist_assignments(phase);
CREATE INDEX idx_specialist_assignments_status ON specialist_assignments(status);

CREATE INDEX idx_analysis_sessions_farmer_id ON analysis_sessions(farmer_id);
CREATE INDEX idx_analysis_sessions_specialist_id ON analysis_sessions(specialist_id);
CREATE INDEX idx_analysis_sessions_phase ON analysis_sessions(phase);
CREATE INDEX idx_analysis_sessions_status ON analysis_sessions(status);

CREATE INDEX idx_chat_messages_farmer_id ON chat_messages(farmer_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

CREATE INDEX idx_llm_api_keys_user_id ON llm_api_keys(user_id);
CREATE INDEX idx_llm_api_keys_provider ON llm_api_keys(provider);

-- Add RLS policies for farmer_data_uploads
ALTER TABLE farmer_data_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view data uploads for their bank's farmers" ON farmer_data_uploads
  FOR SELECT USING (
    bank_id IN (
      SELECT bank_id FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'bank_viewer', 'specialist')
    )
  );

CREATE POLICY "Admins and bank viewers can upload data" ON farmer_data_uploads
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() AND
    bank_id IN (
      SELECT bank_id FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'bank_viewer')
    )
  );

CREATE POLICY "Admins can update data uploads" ON farmer_data_uploads
  FOR UPDATE USING (
    bank_id IN (
      SELECT bank_id FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete data uploads" ON farmer_data_uploads
  FOR DELETE USING (
    bank_id IN (
      SELECT bank_id FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Add RLS policies for specialist_assignments
ALTER TABLE specialist_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assignments for their bank's farmers" ON specialist_assignments
  FOR SELECT USING (
    bank_id IN (
      SELECT bank_id FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'bank_viewer', 'specialist')
    ) OR
    specialist_id = auth.uid()
  );

CREATE POLICY "Admins can manage specialist assignments" ON specialist_assignments
  FOR ALL USING (
    bank_id IN (
      SELECT bank_id FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Specialists can update their own assignments" ON specialist_assignments
  FOR UPDATE USING (
    specialist_id = auth.uid() AND
    status IN ('pending', 'in_progress')
  );

-- Add RLS policies for analysis_sessions
ALTER TABLE analysis_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analysis sessions for their bank's farmers" ON analysis_sessions
  FOR SELECT USING (
    bank_id IN (
      SELECT bank_id FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'bank_viewer', 'specialist')
    ) OR
    specialist_id = auth.uid()
  );

CREATE POLICY "Specialists can manage their own analysis sessions" ON analysis_sessions
  FOR ALL USING (
    specialist_id = auth.uid()
  );

CREATE POLICY "Admins can view all analysis sessions" ON analysis_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Add RLS policies for analysis_attachments
ALTER TABLE analysis_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments for accessible sessions" ON analysis_attachments
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM analysis_sessions 
      WHERE bank_id IN (
        SELECT bank_id FROM profiles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'bank_viewer', 'specialist')
      ) OR specialist_id = auth.uid()
    )
  );

CREATE POLICY "Specialists can manage attachments for their sessions" ON analysis_attachments
  FOR ALL USING (
    session_id IN (
      SELECT id FROM analysis_sessions 
      WHERE specialist_id = auth.uid()
    )
  );

-- Add RLS policies for chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for their bank's farmers" ON chat_messages
  FOR SELECT USING (
    bank_id IN (
      SELECT bank_id FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'bank_viewer', 'specialist')
    ) OR
    sender_id = auth.uid()
  );

CREATE POLICY "Users can send messages for their bank's farmers" ON chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    bank_id IN (
      SELECT bank_id FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'bank_viewer', 'specialist')
    )
  );

CREATE POLICY "Users can update their own messages" ON chat_messages
  FOR UPDATE USING (
    sender_id = auth.uid()
  );

-- Add RLS policies for llm_api_keys
ALTER TABLE llm_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own API keys" ON llm_api_keys
  FOR ALL USING (
    user_id = auth.uid()
  );

-- Create function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_farmer_data_uploads_updated_at
  BEFORE UPDATE ON farmer_data_uploads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_specialist_assignments_updated_at
  BEFORE UPDATE ON specialist_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analysis_sessions_updated_at
  BEFORE UPDATE ON analysis_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_llm_api_keys_updated_at
  BEFORE UPDATE ON llm_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to encrypt API keys
CREATE OR REPLACE FUNCTION encrypt_api_key(api_key TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Use pgcrypto for encryption (requires extension)
  -- For now, we'll use a simple encoding - in production, use proper encryption
  RETURN encode(api_key::bytea, 'base64');
END;
$$ LANGUAGE plpgsql;

-- Create function to decrypt API keys
CREATE OR REPLACE FUNCTION decrypt_api_key(encrypted_key TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Decode from base64 - in production, use proper decryption
  RETURN convert_from(decode(encrypted_key, 'base64'), 'UTF8');
END;
$$ LANGUAGE plpgsql;

-- Create view for specialist dashboard data
CREATE VIEW specialist_dashboard_data AS
SELECT 
  sa.id as assignment_id,
  sa.farmer_id,
  sa.phase,
  sa.status as assignment_status,
  sa.assigned_at,
  sa.notes,
  f.name as farmer_name,
  f.id_number,
  b.name as bank_name,
  COUNT(fdu.id) as data_uploads_count,
  COUNT(CASE WHEN fdu.data_type = 'photo' THEN 1 END) as photo_count,
  COUNT(CASE WHEN fdu.data_type = 'analysis' THEN 1 END) as analysis_count,
  COUNT(CASE WHEN fdu.data_type = 'geospatial' THEN 1 END) as geospatial_count,
  COUNT(CASE WHEN fdu.data_type = 'text' THEN 1 END) as text_count,
  COUNT(as2.id) as analysis_sessions_count,
  MAX(as2.updated_at) as last_analysis_at
FROM specialist_assignments sa
JOIN farmers f ON sa.farmer_id = f.id
JOIN banks b ON sa.bank_id = b.id
LEFT JOIN farmer_data_uploads fdu ON sa.farmer_id = fdu.farmer_id AND sa.phase = fdu.phase
LEFT JOIN analysis_sessions as2 ON sa.farmer_id = as2.farmer_id AND sa.phase = as2.phase AND as2.specialist_id = sa.specialist_id
WHERE sa.specialist_id = auth.uid()
GROUP BY sa.id, sa.farmer_id, sa.phase, sa.status, sa.assigned_at, sa.notes, f.name, f.id_number, b.name;

-- Grant access to the view
GRANT SELECT ON specialist_dashboard_data TO authenticated;

-- Add RLS policy for the view
ALTER VIEW specialist_dashboard_data SET (security_invoker = true);

-- Create function to get specialist assignments with data
CREATE OR REPLACE FUNCTION get_specialist_assignments(p_specialist_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  assignment_id UUID,
  farmer_id UUID,
  farmer_name TEXT,
  farmer_id_number TEXT,
  bank_name TEXT,
  phase analysis_phase,
  status analysis_status,
  assigned_at TIMESTAMPTZ,
  data_uploads_count BIGINT,
  analysis_sessions_count BIGINT,
  last_activity TIMESTAMPTZ
) AS $$
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
  FROM specialist_assignments sa
  JOIN farmers f ON sa.farmer_id = f.id
  JOIN banks b ON sa.bank_id = b.id
  LEFT JOIN farmer_data_uploads fdu ON sa.farmer_id = fdu.farmer_id AND sa.phase = fdu.phase
  LEFT JOIN analysis_sessions as2 ON sa.farmer_id = as2.farmer_id AND sa.phase = as2.phase AND as2.specialist_id = sa.specialist_id
  LEFT JOIN chat_messages cm ON sa.farmer_id = cm.farmer_id AND cm.sender_id = sa.specialist_id
  WHERE sa.specialist_id = p_specialist_id
  GROUP BY sa.id, sa.farmer_id, f.name, f.id_number, b.name, sa.phase, sa.status, sa.assigned_at
  ORDER BY sa.assigned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_specialist_assignments TO authenticated;

-- Update profiles table to support specialist role
-- Add check constraint to allow specialist role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'bank_viewer', 'specialist'));

-- Add comment to document the new role
COMMENT ON COLUMN profiles.role IS 'User role: admin (full access), bank_viewer (bank-specific access), specialist (data analysis access)';