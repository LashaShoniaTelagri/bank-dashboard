import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function createNotificationEmail(
  appNumber: string,
  cropType: string,
  bankName: string,
  submittedAt: string,
  dashboardUrl: string
) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Underwriting Application</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; }
        .btn { display: inline-block; background: #10b981; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .detail-grid { display: table; width: 100%; border-collapse: collapse; margin: 16px 0; }
        .detail-row { display: table-row; }
        .detail-label { display: table-cell; padding: 8px 12px; font-weight: 600; color: #6b7280; background: #f9fafb; border: 1px solid #e5e7eb; width: 140px; }
        .detail-value { display: table-cell; padding: 8px 12px; border: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;">New Underwriting Application</h1>
          <p style="margin:8px 0 0;opacity:0.9;">TelAgri Platform</p>
        </div>
        <div class="content">
          <p>A new underwriting application has been submitted and requires attention.</p>

          <div class="detail-grid">
            <div class="detail-row">
              <div class="detail-label">Application</div>
              <div class="detail-value"><strong>${appNumber}</strong></div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Bank</div>
              <div class="detail-value">${bankName}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Crop Type</div>
              <div class="detail-value">${cropType}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Submitted</div>
              <div class="detail-value">${submittedAt}</div>
            </div>
          </div>

          <div style="text-align:center;">
            <a href="${dashboardUrl}" class="btn">View Application</a>
          </div>

          <p style="font-size:13px;color:#6b7280;margin-top:16px;">
            Please review the application and assign specialists if needed.
          </p>
        </div>
        <div class="footer">
          <p>TelAgri - Agricultural Finance Management System</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
New Underwriting Application Submitted

Application: ${appNumber}
Bank: ${bankName}
Crop Type: ${cropType}
Submitted: ${submittedAt}

Please review this application at: ${dashboardUrl}

---
TelAgri - Agricultural Finance Management System
  `.trim();

  return { htmlContent, textContent };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY')
    const fromEmail = Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@telagri.com'
    const siteUrl = Deno.env.get('SITE_URL') || req.headers.get('origin') || 'https://dashboard.telagri.com'

    if (!sendGridApiKey) {
      console.warn('SendGrid API key not configured - skipping notification')
      return new Response(
        JSON.stringify({ success: false, reason: 'SendGrid not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    const { applicationId, bankId, cropType, appNumber } = await req.json()

    if (!applicationId || !bankId || !cropType || !appNumber) {
      throw new Error('applicationId, bankId, cropType, and appNumber are required')
    }

    // Get bank name
    const { data: bank } = await supabaseClient
      .from('banks')
      .select('name')
      .eq('id', bankId)
      .single()
    const bankName = bank?.name ?? 'Unknown Bank'

    // Get all admin emails
    const { data: admins } = await supabaseClient
      .from('profiles')
      .select('user_id')
      .eq('role', 'admin')

    // Get specialists with underwriting access for this bank
    const { data: specialists } = await supabaseClient
      .from('profiles')
      .select('user_id')
      .eq('role', 'specialist')
      .gt('products_enabled', 0)

    // Filter specialists who have underwriting bit set (bit 1 = value 2)
    const uwSpecialists = (specialists ?? []).filter(
      (s: { user_id: string; products_enabled?: number }) =>
        ((s as any).products_enabled & 2) > 0
    )

    const recipientIds = [
      ...(admins ?? []).map((a: { user_id: string }) => a.user_id),
      ...uwSpecialists.map((s: { user_id: string }) => s.user_id),
    ]

    if (recipientIds.length === 0) {
      console.log('No recipients found for notification')
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get emails from auth.users via admin API
    const { data: { users: allUsers } } = await supabaseClient.auth.admin.listUsers({ perPage: 1000 })
    const recipientEmails = allUsers
      .filter((u: any) => recipientIds.includes(u.id) && u.email)
      .map((u: any) => u.email as string)

    const uniqueEmails = [...new Set(recipientEmails)]

    if (uniqueEmails.length === 0) {
      console.log('No valid email addresses found')
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const dashboardUrl = `${siteUrl}/admin/underwriting`
    const submittedAt = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })

    const { htmlContent, textContent } = createNotificationEmail(
      appNumber,
      cropType,
      bankName,
      submittedAt,
      dashboardUrl
    )

    const emailPayload = {
      personalizations: [{
        to: uniqueEmails.map((email: string) => ({ email })),
        subject: `New Underwriting Application - ${appNumber} - ${bankName}`
      }],
      from: { email: fromEmail, name: 'TelAgri Platform' },
      content: [
        { type: "text/plain", value: textContent },
        { type: "text/html", value: htmlContent }
      ]
    }

    console.log(`Sending underwriting notification to ${uniqueEmails.length} recipients for ${appNumber}`)

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SendGrid error:', response.status, errorText)
      return new Response(
        JSON.stringify({ success: false, error: `SendGrid error: ${response.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`Notification sent successfully to ${uniqueEmails.length} recipients`)

    return new Response(
      JSON.stringify({ success: true, sent: uniqueEmails.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Notification error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
