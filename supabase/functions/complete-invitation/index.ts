import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    const { token, password } = await req.json()

    if (!token || !password) {
      throw new Error('Token and password are required')
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    console.log('🔐 Processing token completion request');
    console.log('  - Token:', token.substring(0, 10) + '...');

    // Validate token (can be invitation or password_reset)
    const { data: invitation, error: invitationError } = await supabaseClient
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (invitationError || !invitation) {
      console.error('❌ Token not found:', invitationError);
      throw new Error('Invalid or expired token');
    }

    const tokenType = invitation.type || 'invitation';
    console.log(`✅ Token found (${tokenType}):`, {
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      user_id: invitation.user_id,
      type: tokenType
    });

    // Check if expired
    const expiresAt = new Date(invitation.expires_at);
    const now = new Date();
    
    if (expiresAt < now) {
      console.error('❌ Invitation expired');
      
      // Update status
      await supabaseClient
        .from('invitations')
        .update({ status: 'expired' })
        .eq('token', token);
      
      throw new Error('This invitation has expired');
    }

    // Check if already completed
    if (invitation.status === 'completed') {
      console.warn('⚠️ Invitation already completed');
      throw new Error('This invitation has already been used');
    }

    // Check if cancelled
    if (invitation.status === 'cancelled') {
      console.warn('⚠️ Invitation cancelled');
      throw new Error('This invitation has been cancelled');
    }

    console.log('🔐 Updating user password via admin API');

    // Update user password using admin API
    const { data: userData, error: updateError } = await supabaseClient.auth.admin.updateUserById(
      invitation.user_id,
      { 
        password: password,
        email_confirm: true
      }
    );

    if (updateError) {
      console.error('❌ Password update failed:', updateError);
      throw new Error(`Failed to update password: ${updateError.message}`);
    }

    console.log('✅ Password updated successfully');

    // Mark invitation as completed
    const { error: invitationUpdateError } = await supabaseClient
      .from('invitations')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('token', token);

    if (invitationUpdateError) {
      console.warn('⚠️ Failed to update invitation status:', invitationUpdateError);
    }

    // Update profile status to active
    const { error: profileUpdateError } = await supabaseClient
      .from('profiles')
      .update({ 
        invitation_status: 'active'
      })
      .eq('user_id', invitation.user_id);

    if (profileUpdateError) {
      console.warn('⚠️ Failed to update profile status:', profileUpdateError);
    }

    console.log(`✅ ${tokenType === 'password_reset' ? 'Password reset' : 'Invitation'} completed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: tokenType === 'password_reset' ? 'Password reset completed successfully' : 'Account setup completed successfully',
        email: invitation.email,
        role: invitation.role,
        type: tokenType
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('❌ Complete invitation error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to complete invitation'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
