-- Fix ambiguity errors in get_specialist_assignments by qualifying column names

BEGIN;

DROP FUNCTION IF EXISTS public.get_specialist_assignments(uuid);

CREATE OR REPLACE FUNCTION public.get_specialist_assignments(p_specialist_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  assignment_id uuid,
  farmer_id uuid,
  farmer_name text,
  farmer_id_number text,
  farmer_crop text,
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
    sa.id AS assignment_id,
    sa.farmer_id AS farmer_id,
    f.name AS farmer_name,
    f.id_number AS farmer_id_number,
    COALESCE(f.crop, 'Not specified') AS farmer_crop,
    b.name AS bank_name,
    sa.phase AS phase,
    sa.status AS status,
    sa.assigned_at AS assigned_at,
    COUNT(DISTINCT fdu.id) AS data_uploads_count,
    COUNT(DISTINCT as2.id) AS analysis_sessions_count,
    GREATEST(
      MAX(fdu.created_at),
      MAX(as2.updated_at),
      MAX(cm.created_at)
    ) AS last_activity,
    sa.f100_doc_url AS f100_doc_url
  FROM public.specialist_assignments AS sa
  JOIN public.farmers AS f ON sa.farmer_id = f.id
  JOIN public.banks AS b ON sa.bank_id = b.id
  LEFT JOIN public.farmer_data_uploads AS fdu
    ON sa.farmer_id = fdu.farmer_id
    AND COALESCE((fdu.metadata->>'f100_phase')::int, fdu.phase) = sa.phase
  LEFT JOIN public.analysis_sessions AS as2
    ON sa.farmer_id = as2.farmer_id
    AND sa.phase = as2.phase
    AND as2.specialist_id = sa.specialist_id
  LEFT JOIN public.chat_messages AS cm
    ON cm.session_id IN (
      SELECT as3.id 
      FROM public.analysis_sessions AS as3
      WHERE as3.farmer_id = sa.farmer_id 
        AND as3.specialist_id = sa.specialist_id
    )
  WHERE sa.specialist_id = p_specialist_id
  GROUP BY sa.id, sa.farmer_id, f.name, f.id_number, f.crop, b.name, sa.phase, sa.status, sa.assigned_at, sa.f100_doc_url
  ORDER BY sa.assigned_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_specialist_assignments(uuid) TO authenticated;

COMMIT;


