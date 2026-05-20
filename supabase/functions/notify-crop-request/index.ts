import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function createCropRequestEmail(cropName: string, requesterEmail: string, dashboardUrl: string) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Crop Request</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; }
        .btn { display: inline-block; background: #10b981; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .crop-name { font-size: 24px; font-weight: 700; color: #059669; margin: 16px 0; }
        .detail { color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;">New Crop Type Request</h1>
          <p style="margin:8px 0 0;opacity:0.9;">TelAgri Underwriting</p>
        </div>
        <div class="content">
          <p>An underwriter has requested a new crop type to be added to the system.</p>

          <div class="crop-name">${cropName}</div>

          <p class="detail">Requested by: ${requesterEmail}</p>

          <p>Please review this request and approve or reject it from the admin dashboard.</p>

          <div style="text-align:center;">
            <a href="${dashboardUrl}" class="btn">Review Request</a>
          </div>
        </div>
        <div class="footer">
          <p>TelAgri - Agricultural Finance Management System</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
New Crop Type Request

Crop: ${cropName}
Requested by: ${requesterEmail}

Please review this request at: ${dashboardUrl}

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

    const { cropName, requestId } = await req.json()

    if (!cropName) {
      throw new Error('cropName is required')
    }

    // Get requester email from the request record
    let requesterEmail = 'Unknown user'
    if (requestId) {
      const { data: reqRecord } = await supabaseClient
        .from('underwriting_crop_requests')
        .select('requested_by')
        .eq('id', requestId)
        .single()

      if (reqRecord) {
        const { data: { users } } = await supabaseClient.auth.admin.listUsers({ perPage: 1000 })
        const requester = users.find((u: any) => u.id === reqRecord.requested_by)
        if (requester?.email) requesterEmail = requester.email
      }
    }

    // Get all admin emails
    const { data: admins } = await supabaseClient
      .from('profiles')
      .select('user_id')
      .eq('role', 'admin')

    if (!admins || admins.length === 0) {
      console.log('No admin users found')
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { users: allUsers } } = await supabaseClient.auth.admin.listUsers({ perPage: 1000 })
    const adminIds = admins.map((a: { user_id: string }) => a.user_id)
    const adminEmails = allUsers
      .filter((u: any) => adminIds.includes(u.id) && u.email)
      .map((u: any) => u.email as string)

    const uniqueEmails = [...new Set(adminEmails)]

    if (uniqueEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const dashboardUrl = `${siteUrl}/admin/underwriting`
    const { htmlContent, textContent } = createCropRequestEmail(cropName, requesterEmail, dashboardUrl)

    const emailPayload = {
      personalizations: [{
        to: uniqueEmails.map((email: string) => ({ email })),
        subject: `New Crop Request - "${cropName}" - TelAgri Underwriting`
      }],
      from: { email: fromEmail, name: 'TelAgri Platform' },
      content: [
        { type: "text/plain", value: textContent },
        { type: "text/html", value: htmlContent }
      ]
    }

    console.log(`Sending crop request notification to ${uniqueEmails.length} admins for "${cropName}"`)

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

    console.log(`Crop request notification sent to ${uniqueEmails.length} admins`)

    return new Response(
      JSON.stringify({ success: true, sent: uniqueEmails.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Crop request notification error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
