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
  resetUrl?: string
) => {
  const isAdmin = role === 'admin';
  const isSpecialist = role === 'specialist';
  const roleTitle = isAdmin ? 'Administrator' : isSpecialist ? 'Specialist' : 'Bank Viewer';
  const bankSection = isAdmin ? '' : (bankName && bankName !== 'N/A' ? ` for <strong>${bankName}</strong>` : '');
  
  const adminPermissions = `
    <li>Manage all farmers across all banks</li>
    <li>View and manage all F-100 reports</li>
    <li>Invite and manage bank viewers and specialists</li>
    <li>Access comprehensive system analytics</li>
    <li>Configure bank partnerships and settings</li>
  `;
  
  const bankViewerPermissions = `
    <li>View farmers associated with ${bankName && bankName !== 'N/A' ? bankName : 'your bank'}</li>
    <li>Access F-100 agricultural assessment reports</li>
    <li>Monitor farmer performance metrics and scores</li>
    <li>Generate reports for your bank's portfolio</li>
  `;

  const specialistPermissions = `
    <li>Access assigned farmers${bankName && bankName !== 'N/A' ? ` for ${bankName}` : ''}</li>
    <li>Upload and manage analysis data per phase</li>
    <li>Run analysis sessions and record results</li>
    <li>Communicate via secure messages with farmers and admins</li>
  `;

  // Text versions for plain text email
  const textIntroSuffix = isAdmin ? '' : (bankName && bankName !== 'N/A' ? ` for ${bankName}` : '');
  const textPermissions = isAdmin 
    ? `• Manage all farmers across all banks
• View and manage all F-100 reports  
• Invite and manage bank viewers and specialists
• Access comprehensive system analytics
• Configure bank partnerships and settings`
    : isSpecialist 
    ? `• Access assigned farmers${bankName && bankName !== 'N/A' ? ` for ${bankName}` : ''}
• Upload and manage analysis data per phase
• Run analysis sessions and record results
• Communicate via secure messages with farmers and admins`
    : `• View farmers associated with ${bankName && bankName !== 'N/A' ? bankName : 'your bank'}
• Access F-100 agricultural assessment reports
• Monitor farmer performance metrics and scores
• Generate reports for your bank's portfolio`;

const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TelAgri Invitation</title>
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
            <h1>🌱 TelAgri</h1>
            <p>Agricultural Finance Management System</p>
          </div>
          
          <div class="content">
            <h2>Welcome to TelAgri Bank Dashboard!</h2>
            <p>Hello!</p>
            <p>You have been invited to join <strong>TelAgri</strong> as a <strong>${roleTitle}</strong>${bankSection}.</p>
            
            <div class="info-box">
              <h3>${isAdmin ? '🔐' : '🏦'} Your Role: ${roleTitle}</h3>
              <p>As a ${roleTitle}, you will have access to:</p>
              <ul>
                ${isAdmin ? adminPermissions : isSpecialist ? specialistPermissions : bankViewerPermissions}
              </ul>
            </div>
            
            <h3>Next Steps:</h3>
            <p>1. Click the button below to set up your password and activate your account</p>
            <p>2. Complete your profile setup</p>
            <p>3. Start ${isAdmin ? 'managing the TelAgri platform' : isSpecialist ? 'performing farmer data analysis' : 'managing your bank\'s farmer portfolio'}</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="btn">Set Up Your Account →</a>
            </div>
            
            <div class="warning">
              <p><strong>⚠️ Important:</strong></p>
              <p>• This invitation link expires in 5 days and can only be used once</p>
              <p>• For security, please don't share this link with others</p>
              <p>• If the link expires or you need a new one, contact your administrator</p>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px; font-family: monospace;">${resetUrl}</p>
          </div>
          
          <div class="footer">
            <p>This email was sent by TelAgri</p>
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

You have been invited to join TelAgri as a ${roleTitle}${textIntroSuffix}.

As a ${roleTitle}, you'll have access to:
${textPermissions}

To activate your account, visit: ${resetUrl}

IMPORTANT: This link expires in 5 days and can only be used once.
If the link expires or you need a new one, contact your administrator.

If you have any questions, please contact your administrator.

---
TelAgri
Agricultural Finance Management System
    `;

  // Return correct SendGrid v3 API format with click tracking DISABLED
  // Click tracking must be disabled to preserve Supabase auth tokens in the URL
  return {
    personalizations: [{
      to: [{ email: userEmail }],
      subject: `Invitation to TelAgri${isAdmin ? ' - Administrator Access' : isSpecialist ? ' - Specialist Access' : (bankName && bankName !== 'N/A' ? ` - ${bankName}` : '')}`
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

    const { email, role, bankId, inviterEmail } = await req.json()

    if (!email || !role) {
      throw new Error('Email and role are required')
    }

    if ((role === 'bank_viewer') && !bankId) {
      throw new Error('Bank ID is required for bank viewer invitations')
    }

    if (!['admin', 'bank_viewer', 'specialist'].includes(role)) {
      throw new Error('Invalid role. Must be one of "admin", "bank_viewer", "specialist"')
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
          (existingProfile.role === role && existingProfile.bank_id === bankId)

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

    // Get bank name for email (if role requires bank)
    let bankName = 'N/A'
    if ((role === 'bank_viewer' || role === 'specialist') && bankId) {
      const { data: bank } = await supabaseClient
        .from('banks')
        .select('name')
        .eq('id', bankId)
        .single()
      
      bankName = bank?.name || 'Unknown Bank'
    }

    // Generate custom invitation token (5-day expiration, multi-click support)
    const origin = req.headers.get('origin');
    const siteUrl = Deno.env.get('SITE_URL');
    // Prioritize SITE_URL (https://dashboard.telagri.com) for production consistency
    const baseUrl = siteUrl || origin || 'http://localhost:8081';
    
    console.log('🔗 URL Configuration:');
    console.log('  - Request origin:', origin);
    console.log('  - SITE_URL env var:', siteUrl);
    console.log('  - Using base URL:', baseUrl);

    // Generate secure random token (64 characters hex)
    const generateInvitationToken = () => {
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    };

    const invitationToken = generateInvitationToken();
    const expiresAt = new Date(Date.now() + (5 * 24 * 60 * 60 * 1000)); // 5 days

    console.log('🎫 Creating custom invitation token');
    console.log('  - Token length:', invitationToken.length);
    console.log('  - Expires at:', expiresAt.toISOString());
    console.log('  - Days valid:', 5);
    console.log('  - Role:', role);

    // Store invitation in database
    const { data: invitation, error: invitationError } = await supabaseClient
      .from('invitations')
      .insert({
        email: email,
        token: invitationToken,
        user_id: userId,
        role: role,
        bank_id: role === 'admin' ? null : bankId,
        invited_by: inviterEmail,
        expires_at: expiresAt.toISOString(),
        status: 'pending'
      })
      .select()
      .single();

    if (invitationError) {
      console.error('❌ Failed to create invitation:', invitationError);
      throw new Error(`Failed to create invitation: ${invitationError.message}`);
    }

    console.log('✅ Invitation record created:', invitation.id);

    // Create custom invitation URL
    const invitationUrl = `${baseUrl}/invitation/accept?token=${invitationToken}`;
    console.log('🔗 Custom invitation URL generated');
    console.log('  - URL:', invitationUrl.substring(0, 80) + '...');
    console.log('  - Multi-click: Enabled');
    console.log('  - Expiration: 5 days');

    // Prepare email data with custom invitation URL
    const emailData = createInvitationEmail(
      email,
      role,
      bankName,
      invitationUrl
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

    return new Response(
      JSON.stringify({
        success: true,
        message: `${role === 'admin' ? 'Administrator' : role === 'specialist' ? 'Specialist' : 'Bank viewer'} invitation sent successfully to ${email}`,
        userId: userId,
        role: role,
        bankName: bankName,
        isNewUser: isNewUser,
        invitationId: invitation.id,
        expiresAt: expiresAt.toISOString(),
        validDays: 5
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