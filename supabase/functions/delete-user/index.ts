import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    const supabaseClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { userId } = await req.json()

    if (!userId) {
      throw new Error('User ID is required')
    }

    console.log('🗑️ Deleting user:', userId)

    // First, delete the profile record
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .delete()
      .eq('user_id', userId)

    if (profileError) {
      console.error('Profile deletion error:', profileError)
      throw new Error(`Failed to delete profile: ${profileError.message}`)
    }

    console.log('✅ Profile deleted successfully')

    // Then, delete the auth user (requires admin privileges)
    const { error: authError } = await supabaseClient.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Auth user deletion error:', authError)
      // If auth deletion fails but profile succeeded, log but don't fail completely
      // since the important invitation data is already removed
      console.log('⚠️ Auth user deletion failed, but profile was deleted')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Invitation removed successfully (profile deleted, auth user may persist)',
          profileDeleted: true,
          authDeleted: false
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    console.log('✅ Auth user deleted successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User and invitation deleted completely',
        profileDeleted: true,
        authDeleted: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Delete user function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
}) 