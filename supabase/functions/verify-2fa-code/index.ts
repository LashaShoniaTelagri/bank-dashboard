import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Hash code for comparison (must match the hash function in send-2fa-code)
const hashCode = async (code: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(code + 'telagri_2fa_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    )

    const { email, code, rememberDevice = false, deviceFingerprint, deviceInfo } = await req.json()

    if (!email || !code) {
      throw new Error('Email and verification code are required')
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      throw new Error('Invalid verification code format')
    }

    console.log(`🔐 Verifying 2FA code for ${email}`)

    // Get the most recent valid code for this email
    const { data: codeRecords, error: fetchError } = await supabaseClient
      .from('two_factor_codes')
      .select('*')
      .eq('email', email)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      console.error('Database fetch error:', fetchError)
      throw new Error('Failed to verify code')
    }

    if (!codeRecords || codeRecords.length === 0) {
      throw new Error('No valid verification code found. Please request a new code.')
    }

    const codeRecord = codeRecords[0]

    // Check attempt limit (max 3 attempts per code)
    if (codeRecord.attempts >= 3) {
      // Mark code as used/invalid
      await supabaseClient
        .from('two_factor_codes')
        .update({ attempts: 999 }) // Mark as exhausted
        .eq('id', codeRecord.id)

      throw new Error('Too many failed attempts. Please request a new verification code.')
    }

    // Hash the provided code and compare
    const providedCodeHash = await hashCode(code)
    
    if (providedCodeHash !== codeRecord.code_hash) {
      // Increment attempt counter
      await supabaseClient
        .from('two_factor_codes')
        .update({ attempts: codeRecord.attempts + 1 })
        .eq('id', codeRecord.id)

      const remainingAttempts = 3 - (codeRecord.attempts + 1)
      
      if (remainingAttempts <= 0) {
        throw new Error('Invalid verification code. Too many failed attempts. Please request a new code.')
      } else {
        throw new Error(`Invalid verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`)
      }
    }

    // Code is valid! Mark it as used
    const { error: deleteError } = await supabaseClient
      .from('two_factor_codes')
      .delete()
      .eq('id', codeRecord.id)

    if (deleteError) {
      console.error('Error marking code as used:', deleteError)
      // Don't fail the verification, but log the issue
    }

    console.log(`✅ 2FA code verified successfully for ${email}`)

    // Handle trusted device registration
    let trustedDeviceId = null;
    if (rememberDevice && deviceFingerprint) {
      try {
        console.log(`🔐 Registering trusted device for ${email}`);
        
        const { data: trustedDevice, error: deviceError } = await supabaseClient
          .rpc('add_trusted_device', {
            p_user_email: email,
            p_device_fingerprint: deviceFingerprint,
            p_device_info: deviceInfo || {}
          });
        
        if (deviceError) {
          console.error('Failed to register trusted device:', deviceError);
          // Don't fail the verification, just log the error
        } else {
          trustedDeviceId = trustedDevice;
          console.log(`✅ Trusted device registered with ID: ${trustedDeviceId}`);
        }
      } catch (deviceError) {
        console.error('Error registering trusted device:', deviceError);
        // Don't fail the verification, just log the error
      }
    }

    // Clean up any other expired codes for this email
    await supabaseClient
      .from('two_factor_codes')
      .delete()
      .eq('email', email)
      .lt('expires_at', new Date().toISOString())

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verification code confirmed',
        verified: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('2FA verification error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        verified: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
}) 