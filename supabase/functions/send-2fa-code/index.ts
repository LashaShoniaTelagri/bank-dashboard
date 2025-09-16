import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate a 6-digit numeric code
const generateSecure2FACode = (): string => {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}

// Hash code for secure storage
const hashCode = async (code: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(code + 'telagri_2fa_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Create 2FA email template
const create2FAEmail = (userEmail: string, code: string, userRole: string) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TelAgri 2FA Verification Code</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; }
        .code-box { background: #f0fdf4; border: 2px solid #10b981; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #059669; font-family: 'Courier New', monospace; }
        .warning { background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 TelAgri Security Code</h1>
          <p>Two-Factor Authentication</p>
        </div>
        
        <div class="content">
          <h2>Your Verification Code</h2>
          <p>Hello! You're trying to sign in to your TelAgri ${userRole} account.</p>
          
          <div class="code-box">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Enter this code to complete your login:</p>
            <div class="code">${code}</div>
          </div>
          
          <div class="warning">
            <p><strong>🔒 Security Notice:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>This code expires in <strong>5 minutes</strong></li>
              <li>Only use this code if you just tried to log in</li>
              <li>Never share this code with anyone</li>
              <li>TelAgri staff will never ask for this code</li>
            </ul>
          </div>
          
          <p><strong>Didn't try to log in?</strong><br>
          If you didn't request this code, someone may be trying to access your account. Please contact your administrator immediately.</p>
        </div>
        
        <div class="footer">
          <p>This code was generated for: ${userEmail}</p>
          <p style="font-size: 12px; color: #6b7280;">
            For security reasons, this email was sent automatically. Do not reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
TelAgri Security Code

Your 2FA verification code: ${code}

This code expires in 5 minutes.
Only use this code if you just tried to log in to your TelAgri ${userRole} account.

Never share this code with anyone.

If you didn't request this code, contact your administrator immediately.

Generated for: ${userEmail}
  `;

  return {
    personalizations: [{
      to: [{ email: userEmail }],
      subject: `TelAgri Security Code: ${code}`
    }],
    from: { 
      email: Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@telagri.com',
      name: 'TelAgri Security'
    },
    content: [
      {
        type: "text/plain",
        value: textContent
      },
      {
        type: "text/html",
        value: htmlContent
      }
    ]
  };
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

    const { email, userRole } = await req.json()

    if (!email) {
      throw new Error('Email is required')
    }

    // Validate SendGrid configuration
    const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY')
    if (!sendGridApiKey) {
      throw new Error('SendGrid API key not configured')
    }

    console.log(`🔐 Generating 2FA code for ${email} (${userRole})`)

    // Check rate limiting: max 3 codes per 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    
    const { data: recentCodes, error: rateLimitError } = await supabaseClient
      .from('two_factor_codes')
      .select('id')
      .eq('email', email)
      .gte('created_at', tenMinutesAgo)

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError)
    }

    if (recentCodes && recentCodes.length >= 3) {
      throw new Error('Too many verification codes requested. Please wait 10 minutes before requesting another code.')
    }

    // Generate and hash 2FA code
    const code = generateSecure2FACode()
    const hashedCode = await hashCode(code)
    
    console.log(`✅ Generated 2FA code for ${email}`)

    // Store hashed code in database with 5-minute expiration
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    
    const { error: insertError } = await supabaseClient
      .from('two_factor_codes')
      .insert({
        email: email,
        code_hash: hashedCode,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
        user_role: userRole || 'unknown'
      })

    if (insertError) {
      console.error('Database insert error:', insertError)
      throw new Error('Failed to store verification code')
    }

    // Send email via SendGrid
    const emailData = create2FAEmail(email, code, userRole || 'user')
    
    console.log('📧 Sending 2FA code via SendGrid...')
    
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SendGrid error:', errorText)
      throw new Error(`Failed to send 2FA code: ${response.statusText}`)
    }

    console.log(`✅ 2FA code sent successfully to ${email}`)

    // Clean up expired codes (housekeeping)
    await supabaseClient
      .from('two_factor_codes')
      .delete()
      .lt('expires_at', new Date().toISOString())

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verification code sent successfully',
        expiresAt: expiresAt.toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('2FA function error:', error)
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