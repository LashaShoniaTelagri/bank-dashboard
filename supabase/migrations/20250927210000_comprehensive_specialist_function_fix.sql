-- Comprehensive fix for specialist functions and views
-- This migration ensures all specialist-related database objects are correct

-- 1. Drop all existing specialist-related functions and views
DROP VIEW IF EXISTS public.specialist_dashboard_data CASCADE;
DROP FUNCTION IF EXISTS public.get_specialist_assignments(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_specialist_assignments() CASCADE;

-- 2. Recreate specialist_dashboard_data view
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
  COUNT(CASE WHEN fdu.data_type::text = 'climate' THEN 1 END) as climate_count,
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

-- 3. Recreate get_specialist_assignments function
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
    ON sa.farmer_id = cm.farmer_id
    AND cm.sender_id = sa.specialist_id
  WHERE sa.specialist_id = p_specialist_id
  GROUP BY sa.id, sa.farmer_id, f.name, f.id_number, b.name, sa.phase, sa.status, sa.assigned_at
  ORDER BY sa.assigned_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_specialist_assignments(uuid) TO authenticated;

-- 4. Ensure farmers table has correct column (crop_types, not crop_type)
-- This is a safety check - if crop_type exists, rename it to crop_types
DO $$
BEGIN
  -- Check if crop_type column exists and rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'farmers' 
    AND column_name = 'crop_type'
  ) THEN
    -- If crop_types doesn't exist, rename crop_type to crop_types
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'farmers' 
      AND column_name = 'crop_types'
    ) THEN
      ALTER TABLE public.farmers RENAME COLUMN crop_type TO crop_types;
    ELSE
      -- If both exist, drop crop_type (crop_types is the correct one)
      ALTER TABLE public.farmers DROP COLUMN crop_type;
    END IF;
  END IF;
END $$;
