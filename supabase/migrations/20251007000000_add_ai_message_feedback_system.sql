-- AI Message Feedback System for Quality Tracking
-- Enables tracking of user satisfaction with AI responses to improve model performance

-- Add feedback columns to ai_chat_messages table
ALTER TABLE public.ai_chat_messages 
ADD COLUMN IF NOT EXISTS feedback_rating TEXT CHECK (feedback_rating IN ('like', 'dislike', 'neutral')),
ADD COLUMN IF NOT EXISTS feedback_comment TEXT,
ADD COLUMN IF NOT EXISTS feedback_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS feedback_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER,
ADD COLUMN IF NOT EXISTS completion_tokens INTEGER,
ADD COLUMN IF NOT EXISTS total_tokens INTEGER,
ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT 'gpt-4o-mini',
ADD COLUMN IF NOT EXISTS response_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS error_occurred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Create detailed feedback tracking table for advanced analytics
CREATE TABLE IF NOT EXISTS public.ai_feedback_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.ai_chat_messages(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  
  -- User feedback
  rating TEXT CHECK (rating IN ('like', 'dislike', 'neutral')),
  feedback_comment TEXT,
  feedback_tags TEXT[], -- e.g., ['inaccurate', 'too-long', 'helpful', 'clear']
  
  -- Context data for analysis
  farmer_id UUID REFERENCES public.farmers(id),
  specialist_id UUID REFERENCES auth.users(id),
  phase INTEGER,
  crop_type TEXT,
  
  -- Query characteristics
  query_text TEXT,
  query_length INTEGER,
  query_type TEXT, -- 'crop_health', 'soil_analysis', 'cost_efficiency', 'general'
  
  -- Response characteristics
  response_text TEXT,
  response_length INTEGER,
  has_images BOOLEAN DEFAULT FALSE,
  has_structured_data BOOLEAN DEFAULT FALSE,
  
  -- Performance metrics
  model_version TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  response_time_ms INTEGER,
  api_cost_usd DECIMAL(10, 6), -- Track costs
  
  -- Quality indicators
  error_occurred BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  user_followed_up BOOLEAN DEFAULT FALSE, -- Did user ask clarifying questions?
  session_ended_after BOOLEAN DEFAULT FALSE, -- Was this the last message?
  
  -- Metadata
  user_agent TEXT,
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(message_id) -- One feedback entry per message
);

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_ai_feedback_rating ON public.ai_feedback_analytics(rating);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at ON public.ai_feedback_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_model_version ON public.ai_feedback_analytics(model_version);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_query_type ON public.ai_feedback_analytics(query_type);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_crop_type ON public.ai_feedback_analytics(crop_type);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_phase ON public.ai_feedback_analytics(phase);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_specialist ON public.ai_feedback_analytics(specialist_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_error ON public.ai_feedback_analytics(error_occurred);

-- Create materialized view for quick analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.ai_quality_metrics AS
SELECT 
  model_version,
  query_type,
  crop_type,
  phase,
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_responses,
  COUNT(*) FILTER (WHERE rating = 'like') as likes,
  COUNT(*) FILTER (WHERE rating = 'dislike') as dislikes,
  ROUND(AVG(response_time_ms)) as avg_response_time_ms,
  ROUND(AVG(prompt_tokens)) as avg_prompt_tokens,
  ROUND(AVG(completion_tokens)) as avg_completion_tokens,
  ROUND(AVG(response_length)) as avg_response_length,
  SUM(api_cost_usd) as total_cost_usd,
  COUNT(*) FILTER (WHERE error_occurred = TRUE) as error_count,
  -- Calculate satisfaction rate
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE rating = 'like') / 
    NULLIF(COUNT(*) FILTER (WHERE rating IN ('like', 'dislike')), 0), 
    2
  ) as satisfaction_rate
FROM public.ai_feedback_analytics
GROUP BY model_version, query_type, crop_type, phase, DATE_TRUNC('day', created_at);

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_ai_quality_metrics_date ON public.ai_quality_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_quality_metrics_model ON public.ai_quality_metrics(model_version);

-- Function to refresh metrics (call this periodically)
CREATE OR REPLACE FUNCTION refresh_ai_quality_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.ai_quality_metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record feedback (call from frontend)
CREATE OR REPLACE FUNCTION record_ai_feedback(
  p_message_id UUID,
  p_rating TEXT,
  p_feedback_comment TEXT DEFAULT NULL,
  p_feedback_tags TEXT[] DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_feedback_id UUID;
  v_session_id UUID;
  v_message_record RECORD;
BEGIN
  -- Get message details
  SELECT 
    aim.session_id,
    aim.role,
    aim.content,
    aim.created_at,
    acs.farmer_id,
    acs.specialist_id,
    acs.phase
  INTO v_message_record
  FROM public.ai_chat_messages aim
  JOIN public.ai_chat_sessions acs ON aim.session_id = acs.id
  WHERE aim.id = p_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found: %', p_message_id;
  END IF;

  -- Only allow feedback on assistant messages
  IF v_message_record.role != 'assistant' THEN
    RAISE EXCEPTION 'Feedback can only be recorded for assistant messages';
  END IF;

  -- Update the message table
  UPDATE public.ai_chat_messages
  SET 
    feedback_rating = p_rating,
    feedback_comment = p_feedback_comment,
    feedback_timestamp = NOW(),
    feedback_user_id = auth.uid()
  WHERE id = p_message_id;

  -- Insert into analytics table
  INSERT INTO public.ai_feedback_analytics (
    message_id,
    session_id,
    rating,
    feedback_comment,
    feedback_tags,
    farmer_id,
    specialist_id,
    phase,
    response_text,
    response_length,
    model_version
  ) VALUES (
    p_message_id,
    v_message_record.session_id,
    p_rating,
    p_feedback_comment,
    p_feedback_tags,
    v_message_record.farmer_id,
    v_message_record.specialist_id,
    v_message_record.phase,
    v_message_record.content,
    LENGTH(v_message_record.content),
    'gpt-4o-mini'
  )
  ON CONFLICT (message_id) 
  DO UPDATE SET
    rating = EXCLUDED.rating,
    feedback_comment = EXCLUDED.feedback_comment,
    feedback_tags = EXCLUDED.feedback_tags
  RETURNING id INTO v_feedback_id;

  RETURN v_feedback_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies for feedback tables
ALTER TABLE public.ai_feedback_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Specialists can view their own feedback" ON public.ai_feedback_analytics
  FOR SELECT USING (
    auth.uid() = specialist_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'system_admin'))
  );

CREATE POLICY "System can insert feedback" ON public.ai_feedback_analytics
  FOR INSERT WITH CHECK (TRUE); -- Function handles security

-- Grant necessary permissions
GRANT SELECT ON public.ai_quality_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION record_ai_feedback TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_ai_quality_metrics TO service_role;

-- Comments for documentation
COMMENT ON TABLE public.ai_feedback_analytics IS 'Comprehensive tracking of AI response quality for continuous improvement';
COMMENT ON FUNCTION record_ai_feedback IS 'Records user feedback on AI responses for quality analysis';
COMMENT ON MATERIALIZED VIEW public.ai_quality_metrics IS 'Aggregated AI quality metrics for performance monitoring';

