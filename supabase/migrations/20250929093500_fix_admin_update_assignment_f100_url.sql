-- Fix admin_update_assignment_f100_url to qualify id column and avoid ambiguity

BEGIN;

DROP FUNCTION IF EXISTS public.admin_update_assignment_f100_url(uuid, text);

CREATE OR REPLACE FUNCTION public.admin_update_assignment_f100_url(
  p_assignment_id uuid,
  p_f100_doc_url text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
BEGIN
  SELECT role INTO actor_role FROM public.profiles WHERE user_id = auth.uid();
  IF actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.specialist_assignments AS sa
  SET f100_doc_url = NULLIF(TRIM(p_f100_doc_url), '')
  WHERE sa.id = p_assignment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_assignment_f100_url(uuid, text) TO authenticated;

COMMIT;


