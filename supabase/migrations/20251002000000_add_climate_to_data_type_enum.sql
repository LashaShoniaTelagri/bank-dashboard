-- Add 'climate' to the data_type enum
-- Reason: Frontend uses 'climate' for weather, rainfall, temperature, and climate indicators

BEGIN;

-- Add 'climate' value to the data_type enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'data_type' 
    AND e.enumlabel = 'climate'
  ) THEN
    ALTER TYPE data_type ADD VALUE 'climate';
    RAISE NOTICE 'Added "climate" to data_type enum';
  ELSE
    RAISE NOTICE '"climate" already exists in data_type enum';
  END IF;
END
$$;

-- Update the view to include climate_count
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
  COUNT(CASE WHEN fdu.data_type::text = 'climate' THEN 1 END) as climate_count,
  COUNT(CASE WHEN fdu.data_type::text = 'video' THEN 1 END) as video_count,
  COUNT(CASE WHEN fdu.data_type::text = 'audio' THEN 1 END) as audio_count,
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

COMMIT;


