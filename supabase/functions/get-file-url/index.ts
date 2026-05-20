import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  filePath: string;
  bucket?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the user's JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const { filePath, bucket = 'farmer-documents' }: RequestBody = await req.json()

    if (!filePath) {
      return new Response(
        JSON.stringify({ error: 'Missing filePath' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user is a specialist and has access to this file
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, bank_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // For specialists, verify they have access to this farmer's files
    if (profile.role === 'specialist') {
      // Extract farmer ID and phase from file path
      let farmerId: string | null = null
      let filePhase: number | null = null
      
      // Handle both path formats
      if (filePath.startsWith('farmer-data/')) {
        // Format: farmer-data/{farmer-id}/{phase}/{filename}
        const pathParts = filePath.split('/')
        if (pathParts.length >= 3) {
          farmerId = pathParts[1]
          // Try to extract phase from path
          const phaseStr = pathParts[2]
          if (phaseStr && !isNaN(parseInt(phaseStr))) {
            filePhase = parseInt(phaseStr)
          }
        }
      } else if (filePath.startsWith('farmer/')) {
        // Format: farmer/{farmer-id}/{document-type}/{filename}
        // For general farmer documents, no specific phase required
        const pathParts = filePath.split('/')
        if (pathParts.length >= 2) {
          farmerId = pathParts[1]
        }
      }

      if (!farmerId) {
        return new Response(
          JSON.stringify({ error: 'Invalid file path format' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Check if specialist is assigned to this farmer
      // Filter by status (exclude cancelled assignments) and by phase if specified
      const assignmentQuery = supabase
        .from('specialist_assignments')
        .select('id, phase, status')
        .eq('specialist_id', user.id)
        .eq('farmer_id', farmerId)
        .in('status', ['pending', 'in_progress', 'completed'])

      // If file has a specific phase, check that the specialist is assigned to that phase
      if (filePhase !== null) {
        assignmentQuery.eq('phase', filePhase)
      }

      const { data: assignments, error: assignmentError } = await assignmentQuery

      if (assignmentError) {
        console.error('Assignment query error:', assignmentError)
        return new Response(
          JSON.stringify({ error: 'Failed to verify assignment' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      if (!assignments || assignments.length === 0) {
        const phaseMsg = filePhase ? ` for phase ${filePhase}` : ''
        return new Response(
          JSON.stringify({ 
            error: `Access denied: Not assigned to this farmer${phaseMsg}`,
            details: {
              farmerId,
              phase: filePhase,
              specialistId: user.id
            }
          }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Generate signed URL using service role (bypasses RLS)
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (error) {
      console.error('Storage error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to generate signed URL', details: error.message }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ signedUrl: data.signedUrl }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
