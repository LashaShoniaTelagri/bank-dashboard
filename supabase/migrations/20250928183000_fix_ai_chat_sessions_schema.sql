-- Fix ai_chat_sessions table schema to match frontend expectations
-- Add missing columns that the frontend code requires

-- First, make user_id nullable to avoid constraint violations
ALTER TABLE public.ai_chat_sessions 
ALTER COLUMN user_id DROP NOT NULL;

-- Make session_name nullable as well since it might not always be provided
ALTER TABLE public.ai_chat_sessions 
ALTER COLUMN session_name DROP NOT NULL;

-- Add missing columns to ai_chat_sessions table
ALTER TABLE public.ai_chat_sessions 
ADD COLUMN IF NOT EXISTS farmer_id UUID REFERENCES public.farmers(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS specialist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES public.specialist_assignments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS phase INTEGER CHECK (phase >= 1 AND phase <= 12);

-- Update existing records to have proper relationships if any exist
-- Set specialist_id to user_id for existing records
UPDATE public.ai_chat_sessions 
SET specialist_id = user_id 
WHERE specialist_id IS NULL AND user_id IS NOT NULL;

-- For new records, we'll use specialist_id as the primary user reference
-- Update the default session_name to be more descriptive
UPDATE public.ai_chat_sessions 
SET session_name = COALESCE(session_name, 'AI Analysis Session')
WHERE session_name IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_farmer_id ON public.ai_chat_sessions(farmer_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_specialist_id ON public.ai_chat_sessions(specialist_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_assignment_id ON public.ai_chat_sessions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_phase ON public.ai_chat_sessions(phase);

-- Update RLS policies to work with the new columns
DROP POLICY IF EXISTS "Users can manage their own AI chat sessions" ON public.ai_chat_sessions;
DROP POLICY IF EXISTS "Specialists can manage their own AI chat sessions" ON public.ai_chat_sessions;

CREATE POLICY "Specialists can manage their own AI chat sessions" ON public.ai_chat_sessions
  FOR ALL USING (
    auth.uid() = specialist_id OR 
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Add comment to document the table structure
COMMENT ON TABLE public.ai_chat_sessions IS 'AI-powered chat sessions for agricultural analysis with proper farmer and specialist relationships';
COMMENT ON COLUMN public.ai_chat_sessions.farmer_id IS 'Reference to the farmer being analyzed';
COMMENT ON COLUMN public.ai_chat_sessions.specialist_id IS 'Reference to the specialist conducting the analysis';
COMMENT ON COLUMN public.ai_chat_sessions.assignment_id IS 'Reference to the specialist assignment';
COMMENT ON COLUMN public.ai_chat_sessions.phase IS 'F-100 phase for the analysis session';
