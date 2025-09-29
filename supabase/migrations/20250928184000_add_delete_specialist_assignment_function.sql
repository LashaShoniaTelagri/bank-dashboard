-- Create delete_specialist_assignment function for admin use
-- This function allows admins to remove specialist assignments

CREATE OR REPLACE FUNCTION public.delete_specialist_assignment(p_assignment_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignment_record record;
  is_admin boolean;
BEGIN
  -- Check if the current user is an admin
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Unauthorized: Only administrators can delete specialist assignments'
    );
  END IF;

  -- Check if the assignment exists and get details for logging
  SELECT 
    sa.id,
    sa.specialist_id,
    sa.farmer_id,
    sa.phase,
    f.name as farmer_name,
    f.id_number as farmer_id_number
  INTO assignment_record
  FROM specialist_assignments sa
  JOIN farmers f ON sa.farmer_id = f.id
  WHERE sa.id = p_assignment_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Assignment not found'
    );
  END IF;

  -- Delete related data first (cascade should handle this, but being explicit)
  -- Delete related AI chat sessions
  DELETE FROM ai_chat_sessions 
  WHERE assignment_id = p_assignment_id;

  -- Delete related analysis sessions
  DELETE FROM analysis_sessions 
  WHERE farmer_id = assignment_record.farmer_id 
    AND phase = assignment_record.phase 
    AND specialist_id = assignment_record.specialist_id;

  -- Delete the assignment
  DELETE FROM specialist_assignments 
  WHERE id = p_assignment_id;

  -- Log the deletion for audit purposes
  INSERT INTO audit_log (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    created_at
  ) VALUES (
    auth.uid(),
    'DELETE',
    'specialist_assignments',
    p_assignment_id,
    json_build_object(
      'specialist_id', assignment_record.specialist_id,
      'farmer_id', assignment_record.farmer_id,
      'farmer_name', assignment_record.farmer_name,
      'farmer_id_number', assignment_record.farmer_id_number,
      'phase', assignment_record.phase
    ),
    NOW()
  ) ON CONFLICT DO NOTHING; -- In case audit_log table doesn't exist

  RETURN json_build_object(
    'success', true,
    'message', 'Specialist assignment deleted successfully',
    'deleted_assignment', json_build_object(
      'assignment_id', p_assignment_id,
      'farmer_name', assignment_record.farmer_name,
      'farmer_id_number', assignment_record.farmer_id_number,
      'phase', assignment_record.phase
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to delete assignment: ' || SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users (function handles authorization internally)
GRANT EXECUTE ON FUNCTION public.delete_specialist_assignment(uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.delete_specialist_assignment(uuid) IS 'Deletes a specialist assignment and related data. Only accessible by administrators.';
