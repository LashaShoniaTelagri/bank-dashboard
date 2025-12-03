import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// SendGrid email template for password reset
const createPasswordResetEmail = (
  userEmail: string,
  resetUrl: string
) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TelAgri - Reset Your Password</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
        .btn { display: inline-block; background: #10b981; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .btn:hover { background: #059669; }
        .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .warning { background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 TelAgri</h1>
          <p>Password Reset Request</p>
        </div>
        
        <div class="content">
          <h2>Reset Your Password</h2>
          <p>Hello!</p>
          <p>We received a request to reset the password for your TelAgri account.</p>
          
          <div class="info-box">
            <h3>🔒 Security Notice</h3>
            <p>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
            <p>Your account security is important to us. If you believe someone else is trying to access your account, please contact your administrator immediately.</p>
          </div>
          
          <h3>Reset Your Password:</h3>
          <p>Click the button below to create a new password for your TelAgri account:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="btn">Reset My Password →</a>
          </div>
          
          <div class="warning">
            <p><strong>⚠️ Important Security Information:</strong></p>
            <ul>
              <li>This reset link expires in <strong>1 hour</strong> for your security</li>
              <li>The link can only be used once</li>
              <li>For security, don't share this link with anyone</li>
              <li>Make sure to choose a strong password with at least 8 characters</li>
            </ul>
          </div>
          
          <p><strong>Password Requirements:</strong></p>
          <ul style="color: #6b7280; font-size: 14px;">
            <li>Minimum 8 characters</li>
            <li>At least one uppercase letter</li>
            <li>At least one lowercase letter</li>
            <li>At least one number</li>
          </ul>
          
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px;">${resetUrl}</p>
        </div>
        
        <div class="footer">
          <p>This email was sent by TelAgri</p>
          <p style="font-size: 12px; color: #6b7280;">
            Agricultural Finance Management System
          </p>
          <p style="font-size: 12px; color: #6b7280; margin-top: 10px;">
            If you didn't request this password reset, you can safely ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
TelAgri - Reset Your Password

We received a request to reset the password for your TelAgri account.

If you didn't request this password reset, please ignore this email and your password will remain unchanged.

To reset your password, visit: ${resetUrl}

IMPORTANT:
• This reset link expires in 1 hour for your security
• The link can only be used once
• Make sure to choose a strong password with at least 8 characters

Password Requirements:
• Minimum 8 characters
• At least one uppercase letter
• At least one lowercase letter
• At least one number

---
TelAgri
Agricultural Finance Management System

If you didn't request this password reset, you can safely ignore this email.
  `;

  // Return SendGrid v3 API format with click tracking DISABLED
  // Click tracking must be disabled to preserve Supabase auth tokens in the URL
  return {
    personalizations: [{
      to: [{ email: userEmail }],
      subject: 'Reset Your TelAgri Password'
    }],
    from: { 
      email: Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@telagri.com',
      name: 'TelAgri Platform'
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
    ],
    tracking_settings: {
      click_tracking: {
        enable: false,
        enable_text: false
      },
      open_tracking: {
        enable: false
      }
    }
  };
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

    const { email } = await req.json()

    if (!email) {
      throw new Error('Email is required')
    }

    // Validate SendGrid configuration
    const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY')
    if (!sendGridApiKey) {
      throw new Error('SendGrid API key not configured')
    }

    console.log(`🔐 Processing password reset request for ${email}`)

    // Check if user exists (without revealing this to the client for security)
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers()
    const existingUser = existingUsers.users.find(u => u.email === email)
    
    if (!existingUser) {
      console.log(`⚠️ User not found: ${email}`)
      // Return success anyway to prevent email enumeration attacks
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Generate password reset link with proper URL handling
    const origin = req.headers.get('origin');
    const siteUrl = Deno.env.get('SITE_URL');
    
    // For production, prioritize SITE_URL over origin header to avoid localhost issues
    const baseUrl = siteUrl || origin || 'http://localhost:3000';
    
    console.log('🔗 URL Debug Info:');
    console.log('  - Request origin:', origin);
    console.log('  - SITE_URL env var:', siteUrl);
    console.log('  - Using base URL:', baseUrl);
    console.log('  - Redirect URL will be:', `${baseUrl}/reset-password`);

    // Generate a proper recovery link with auth tokens
    const { data: resetData, error: resetError } = await supabaseClient.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${baseUrl}/reset-password`
      }
    })

    if (resetError) {
      console.error('❌ Reset link generation failed:', resetError);
      throw new Error(`Failed to generate secure reset link: ${resetError.message}`);
    }

    if (!resetData?.properties?.action_link) {
      console.error('❌ No action link returned from Supabase');
      throw new Error('Failed to generate secure reset link: No action link returned from Supabase auth service.');
    }

    const resetUrl = resetData.properties.action_link;
    console.log('✅ Successfully generated secure reset URL');
    console.log('📋 Reset URL length:', resetUrl.length);
    console.log('🔑 Contains access_token:', resetUrl.includes('access_token='));

    // Validate that the URL contains security tokens
    if (!resetUrl.includes('access_token=') && !resetUrl.includes('token=')) {
      console.error('❌ Generated URL does not contain security tokens');
      throw new Error('Security validation failed: Generated reset link does not contain proper authentication tokens.');
    }

    // Prepare email data
    const emailData = createPasswordResetEmail(email, resetUrl)

    console.log('📧 Sending password reset email via SendGrid...')
    
    // Send email via SendGrid
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
      throw new Error(`Failed to send email: ${response.statusText}`)
    }

    console.log(`✅ Password reset email sent successfully to ${email}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Password reset function error:', error)
    
    // Return generic error message for security (don't reveal if user exists)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unable to process password reset request. Please try again or contact support.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

