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
              <li>This reset link expires in <strong>24 hours</strong> for your security</li>
              <li>You can revisit this link multiple times within 24 hours if needed</li>
              <li>For security, don't share this link with anyone</li>
              <li>Make sure to choose a strong password with at least 6 characters</li>
            </ul>
          </div>
          
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
• This reset link expires in 24 hours for your security
• You can revisit this link multiple times within 24 hours if needed
• Make sure to choose a strong password with at least 6 characters

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

    // Generate custom password reset token (24-hour expiration, multi-click support)
    const origin = req.headers.get('origin');
    const siteUrl = Deno.env.get('SITE_URL');
    // Prioritize SITE_URL (https://dashboard.telagri.com) for production consistency
    const baseUrl = siteUrl || origin || 'http://localhost:3000';
    
    console.log('🔗 URL Configuration:');
    console.log('  - Request origin:', origin);
    console.log('  - SITE_URL env var:', siteUrl);
    console.log('  - Using base URL:', baseUrl);

    // Generate secure random token (64 characters hex)
    const generateResetToken = () => {
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    };

    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours

    console.log('🎫 Creating custom password reset token');
    console.log('  - Token length:', resetToken.length);
    console.log('  - Expires at:', expiresAt.toISOString());
    console.log('  - Hours valid:', 24);

    // Store password reset token in database (reusing invitations table)
    const { data: resetRecord, error: resetError } = await supabaseClient
      .from('invitations')
      .insert({
        email: email,
        token: resetToken,
        user_id: existingUser.id,
        type: 'password_reset',
        role: null, // Password resets don't need role
        bank_id: null,
        invited_by: null,
        expires_at: expiresAt.toISOString(),
        status: 'pending'
      })
      .select()
      .single();

    if (resetError) {
      console.error('❌ Failed to create password reset token:', resetError);
      throw new Error(`Failed to create password reset token: ${resetError.message}`);
    }

    console.log('✅ Password reset record created:', resetRecord.id);

    // Create custom reset URL
    const resetUrl = `${baseUrl}/password/reset?token=${resetToken}`;
    console.log('🔗 Custom password reset URL generated');
    console.log('  - URL:', resetUrl.substring(0, 80) + '...');
    console.log('  - Multi-click: Enabled');
    console.log('  - Expiration: 24 hours');

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

