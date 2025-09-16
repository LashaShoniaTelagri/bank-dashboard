import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// SendGrid email template (using correct v3 API format)
const createInvitationEmail = (
  userEmail: string, 
  role: string,
  bankName?: string, 
  inviterName?: string,
  resetUrl?: string
) => {
  const isAdmin = role === 'admin';
  const roleTitle = isAdmin ? 'Administrator' : 'Bank Viewer';
  const bankSection = isAdmin ? '' : ` for <strong>${bankName}</strong>`;
  
  const adminPermissions = `
    <li>Manage all farmers across all banks</li>
    <li>View and manage all F-100 reports</li>
    <li>Invite and manage bank viewers</li>
    <li>Access comprehensive system analytics</li>
    <li>Configure bank partnerships and settings</li>
  `;
  
  const bankViewerPermissions = `
    <li>View farmers associated with ${bankName}</li>
    <li>Access F-100 agricultural assessment reports</li>
    <li>Monitor farmer performance metrics and scores</li>
    <li>Generate reports for your bank's portfolio</li>
  `;

  const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TelAgri Bank Dashboard Invitation</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
          .btn { display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .btn:hover { background: #059669; }
          .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .warning { background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌱 TelAgri Bank Dashboard</h1>
            <p>Agricultural Finance Management System</p>
          </div>
          
          <div class="content">
            <h2>Welcome to TelAgri Bank Dashboard!</h2>
            <p>Hello!</p>
            <p><strong>${inviterName || 'TelAgri Admin'}</strong> has invited you to join the TelAgri Bank Dashboard as a <strong>${roleTitle}</strong>${bankSection}.</p>
            
            <div class="info-box">
              <h3>${isAdmin ? '🔐' : '🏦'} Your Role: ${roleTitle}</h3>
              <p>As a ${roleTitle}, you will have access to:</p>
              <ul>
                ${isAdmin ? adminPermissions : bankViewerPermissions}
              </ul>
            </div>
            
            <h3>Next Steps:</h3>
            <p>1. Click the button below to set up your password and activate your account</p>
            <p>2. Complete your profile setup</p>
            <p>3. Start ${isAdmin ? 'managing the TelAgri platform' : 'managing your bank\'s farmer portfolio'}</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="btn">Set Up Your Account →</a>
            </div>
            
            <div class="warning">
              <p><strong>⚠️ Important:</strong></p>
              <p>• This invitation link expires in 24 hours</p>
              <p>• For security, please don't share this link with others</p>
              <p>• If you have any issues, contact your administrator</p>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px; font-family: monospace;">${resetUrl}</p>
          </div>
          
          <div class="footer">
            <p>This email was sent by TelAgri Bank Dashboard</p>
            <p style="font-size: 12px; color: #6b7280;">
              If you didn't expect this invitation, please ignore this email or contact support.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

  const textContent = `
Welcome to TelAgri Bank Dashboard!

${inviterName || 'TelAgri Admin'} has invited you to join as a ${roleTitle}${isAdmin ? '' : ` for ${bankName}`}.

As a ${roleTitle}, you'll have access to:
${isAdmin ? 
  `- Manage all farmers across all banks
- View and manage all F-100 reports
- Invite and manage bank viewers
- Access comprehensive system analytics
- Configure bank partnerships and settings` :
  `- View farmers associated with ${bankName}
- Access F-100 agricultural assessment reports  
- Monitor farmer performance metrics
- Generate reports for your bank's portfolio`}

To activate your account, visit: ${resetUrl}

This link expires in 24 hours.

If you have any questions, please contact your administrator.

---
TelAgri Bank Dashboard
Agricultural Finance Management System
    `;

  // Return correct SendGrid v3 API format
  return {
    personalizations: [{
      to: [{ email: userEmail }],
      subject: `Invitation to TelAgri Bank Dashboard${isAdmin ? ' - Administrator Access' : ` - ${bankName}`}`
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
    ]
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    )

    const { email, role, bankId, inviterEmail } = await req.json()

    if (!email || !role) {
      throw new Error('Email and role are required')
    }

    if (role === 'bank_viewer' && !bankId) {
      throw new Error('Bank ID is required for bank viewer invitations')
    }

    if (!['admin', 'bank_viewer'].includes(role)) {
      throw new Error('Invalid role. Must be either "admin" or "bank_viewer"')
    }

    // Validate SendGrid configuration
    const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY')
    if (!sendGridApiKey) {
      throw new Error('SendGrid API key not configured')
    }

    console.log(`Processing invitation for ${email} with role ${role}${bankId ? ` for bank ${bankId}` : ''}`)

    // Check if user already exists
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers()
    const existingUser = existingUsers.users.find(u => u.email === email)
    
    let userId: string
    let isNewUser = false

    if (existingUser) {
      console.log('User already exists:', existingUser.id)
      userId = existingUser.id
      
      // For existing users, check if they already have a profile
      const { data: existingProfile } = await supabaseClient
        .from('profiles')
        .select('invitation_status, invited_at, role, bank_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (existingProfile) {
        const hasConflict = role === 'admin' ? 
          (existingProfile.role === 'admin') :
          (existingProfile.role === 'bank_viewer' && existingProfile.bank_id === bankId)

        if (hasConflict) {
          const status = existingProfile.invitation_status || 'active'
          const invitedDate = existingProfile.invited_at ? new Date(existingProfile.invited_at).toLocaleDateString() : 'unknown'
          
          return new Response(
            JSON.stringify({
              success: false,
              error: `User ${email} already has a ${status} invitation for this ${role === 'Administrator' ? 'admin role' : 'bank'} (sent: ${invitedDate}). Please check the Recent Invitations section or cancel the existing invitation first.`
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 409, // Conflict status
            },
          )
        }
      }

      // Update existing user's profile or create new one with invitation tracking
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .upsert({
          user_id: userId,
          role: role,
          bank_id: role === 'admin' ? null : bankId,
          invited_by: inviterEmail,
          invited_at: new Date().toISOString(),
          invitation_status: 'pending'
        })

      if (profileError) {
        console.error('Profile update error:', profileError)
        throw new Error(`Failed to update user profile: ${profileError.message}`)
      }
    } else {
      // Create new user
      const tempPassword = crypto.randomUUID()
      
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          invited_by: inviterEmail,
          bank_id: role === 'admin' ? null : bankId,
          role: role
        }
      })

      if (authError) {
        console.error('Auth error:', authError)
        throw new Error(`Failed to create user: ${authError.message}`)
      }

      console.log('User created:', authData.user?.id)
      userId = authData.user.id
      isNewUser = true

      // Create profile record with invitation tracking
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .insert({
          user_id: userId,
          role: role,
          bank_id: role === 'admin' ? null : bankId,
          invited_by: inviterEmail,
          invited_at: new Date().toISOString(),
          invitation_status: 'pending'
        })

      if (profileError) {
        console.error('Profile error:', profileError)
        // Clean up auth user if profile creation fails
        await supabaseClient.auth.admin.deleteUser(userId)
        throw new Error(`Failed to create user profile: ${profileError.message}`)
      }
    }

    // Get bank name for email (if role is bank_viewer)
    let bankName = 'N/A'
    if (role === 'bank_viewer' && bankId) {
      const { data: bank } = await supabaseClient
        .from('banks')
        .select('name')
        .eq('id', bankId)
        .single()
      
      bankName = bank?.name || 'Unknown Bank'
    }

    // Generate password reset link with improved URL handling
    const origin = req.headers.get('origin');
    const siteUrl = Deno.env.get('SITE_URL');
    
    // For production, prioritize SITE_URL over origin header to avoid localhost issues
    // Only use origin if SITE_URL is not set (development mode)
    const baseUrl = siteUrl || origin || 'http://localhost:8081';
    
    console.log('🔗 URL Debug Info:');
    console.log('  - Request origin:', origin);
    console.log('  - SITE_URL env var:', siteUrl);
    console.log('  - Using base URL:', baseUrl);
    console.log('  - Environment check - SITE_URL exists:', !!siteUrl);
    console.log('  - Final redirect URL will be:', `${baseUrl}/auth?type=recovery`);

    // Generate a proper recovery link with auth tokens
    console.log('🔗 Attempting to generate recovery link for:', email);
    console.log('  - PROJECT_URL:', Deno.env.get('PROJECT_URL') ? 'Set' : 'Missing');
    console.log('  - SERVICE_ROLE_KEY:', Deno.env.get('SERVICE_ROLE_KEY') ? 'Set' : 'Missing');
    console.log('  - Redirect URL:', `${baseUrl}/auth?type=recovery`);

    const { data: resetData, error: resetError } = await supabaseClient.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${baseUrl}/auth?type=recovery`
      }
    })

    console.log('🔗 Supabase generateLink result:');
    console.log('  - Error:', resetError);
    console.log('  - Data:', resetData ? 'Present' : 'Missing');
    console.log('  - Properties:', resetData?.properties ? 'Present' : 'Missing');
    console.log('  - Action Link:', resetData?.properties?.action_link ? 'Present' : 'Missing');

    if (resetError) {
      console.error('❌ Reset link generation failed:', resetError);
      
      // Provide specific error messages based on the error type
      if (resetError.message?.includes('invalid_request')) {
        throw new Error('Invalid request: Please check if the user email is valid and the service is properly configured.');
      } else if (resetError.message?.includes('user_not_found')) {
        throw new Error('User not found: Unable to generate recovery link for this email address.');
      } else {
        throw new Error(`Failed to generate secure reset link: ${resetError.message}`);
      }
    }

    if (!resetData?.properties?.action_link) {
      console.error('❌ No action link returned from Supabase');
      console.error('   - resetData structure:', JSON.stringify(resetData, null, 2));
      throw new Error('Failed to generate secure reset link: No action link returned from Supabase auth service.');
    }

    const resetUrl = resetData.properties.action_link;
    console.log('✅ Successfully generated secure reset URL');
    console.log('📋 Reset URL length:', resetUrl.length);
    console.log('🔑 Contains access_token:', resetUrl.includes('access_token='));
    console.log('🔑 Contains refresh_token:', resetUrl.includes('refresh_token='));
    console.log('🔗 Reset URL (first 100 chars):', resetUrl.substring(0, 100) + '...');
    console.log('🎯 FINAL CHECK - URL domain:', resetUrl.split('/')[2]); // Extract domain

    // Validate that the URL is actually secure
    if (!resetUrl.includes('access_token=') && !resetUrl.includes('token=')) {
      console.error('❌ Generated URL does not contain security tokens');
      throw new Error('Security validation failed: Generated reset link does not contain proper authentication tokens.');
    }

    // Prepare email data
    const emailData = createInvitationEmail(
      email,
      role,
      bankName,
      inviterEmail || 'TelAgri Admin',
      resetUrl
    )

    // Log the email data being sent to SendGrid
    console.log('📧 Sending email via SendGrid with data:', JSON.stringify(emailData, null, 2))
    
    // Send email via SendGrid
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    })

    console.log('📧 SendGrid response status:', response.status)
    console.log('📧 SendGrid response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())))

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SendGrid error:', errorText)
      throw new Error(`Failed to send email: ${response.statusText}`)
    } else {
      const responseText = await response.text()
      console.log('📧 SendGrid success response:', responseText)
    }

    console.log(`✅ Invitation email sent successfully to ${email}`)

    // Log invitation in database (optional - you might want to create an invitations table)
    await supabaseClient
      .from('profiles')
      .update({ 
        created_at: new Date().toISOString() 
      })
      .eq('user_id', userId)

    return new Response(
      JSON.stringify({
        success: true,
        message: `${role === 'admin' ? 'Administrator' : 'Bank viewer'} invitation sent successfully to ${email}`,
        userId: userId,
        role: role,
        bankName: bankName,
        isNewUser: isNewUser
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Invitation function error:', error)
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