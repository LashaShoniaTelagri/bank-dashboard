-- Fix ambiguity in get_specialist_assignments (farmer_id)

BEGIN;

DROP FUNCTION IF EXISTS public.get_specialist_assignments(uuid);

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
  last_activity timestamptz,
  f100_doc_url text
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
    ),
    sa.f100_doc_url
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
      SELECT as3.id 
      FROM public.analysis_sessions as as3
      WHERE as3.farmer_id = sa.farmer_id 
        AND as3.specialist_id = sa.specialist_id
    )
  WHERE sa.specialist_id = p_specialist_id
  GROUP BY sa.id, sa.farmer_id, f.name, f.id_number, b.name, sa.phase, sa.status, sa.assigned_at, sa.f100_doc_url
  ORDER BY sa.assigned_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_specialist_assignments(uuid) TO authenticated;

COMMIT;


