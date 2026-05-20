-- Create audit_log table used by delete_specialist_assignment and other auditing needs

BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON public.audit_log(table_name);

-- Enable RLS and restrict reads to admins; allow inserts from server-side functions
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read audit logs
CREATE POLICY "Admins can read audit logs" ON public.audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Allow inserts (from SECURITY DEFINER functions or service role)
CREATE POLICY "Allow inserts to audit_log" ON public.audit_log
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.audit_log IS 'Generic audit log table for recording critical actions';

COMMIT;



