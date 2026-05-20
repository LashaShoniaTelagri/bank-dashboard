import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function createScoreEmail(appNumber: string, cropType: string, overallScore: number, dashboardUrl: string) {
  const scoreColor = overallScore >= 70 ? '#16a34a' : overallScore >= 40 ? '#ca8a04' : '#dc2626';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Application Scored</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; }
        .btn { display: inline-block; background: #10b981; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .score-circle { display: inline-block; width: 80px; height: 80px; border-radius: 50%; line-height: 80px; text-align: center; font-size: 28px; font-weight: 700; color: white; margin: 16px 0; }
        .details { background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
        .detail-label { color: #6b7280; }
        .detail-value { font-weight: 600; color: #111827; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;">Application Scored</h1>
          <p style="margin:8px 0 0;opacity:0.9;">TelAgri Underwriting</p>
        </div>
        <div class="content">
          <p>Your underwriting application has been reviewed and scored.</p>

          <div style="text-align:center;">
            <div class="score-circle" style="background-color:${scoreColor};">${overallScore}</div>
          </div>

          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Application</span>
              <span class="detail-value">${appNumber}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Crop</span>
              <span class="detail-value">${cropType}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Overall Score</span>
              <span class="detail-value" style="color:${scoreColor};">${overallScore}/10</span>
            </div>
          </div>

          <p>You can view the full scoring details in your dashboard.</p>

          <div style="text-align:center;">
            <a href="${dashboardUrl}" class="btn">View Application</a>
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
Application Scored - TelAgri Underwriting

Your application ${appNumber} has been scored.

Application: ${appNumber}
Crop: ${cropType}
Overall Score: ${overallScore}/10

View details at: ${dashboardUrl}

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

    const { applicationId, overallScore, cropType } = await req.json()

    if (!applicationId) {
      throw new Error('applicationId is required')
    }

    const { data: app } = await supabaseClient
      .from('underwriting_applications')
      .select('id, submitted_by, crop_type')
      .eq('id', applicationId)
      .single()

    if (!app) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Application not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const { data: { users } } = await supabaseClient.auth.admin.listUsers({ perPage: 1000 })
    const submitter = users.find((u: any) => u.id === app.submitted_by)

    if (!submitter?.email) {
      console.log('Submitter email not found')
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const appNumber = 'UW-' + app.id.replace(/-/g, '').substring(0, 8).toUpperCase()
    const displayCrop = cropType || app.crop_type
    const dashboardUrl = `${siteUrl}/underwriting/applications`

    const { htmlContent, textContent } = createScoreEmail(
      appNumber,
      displayCrop.charAt(0).toUpperCase() + displayCrop.slice(1),
      overallScore,
      dashboardUrl
    )

    const emailPayload = {
      personalizations: [{
        to: [{ email: submitter.email }],
        subject: `Your Application ${appNumber} Has Been Scored - TelAgri`
      }],
      from: { email: fromEmail, name: 'TelAgri Platform' },
      content: [
        { type: "text/plain", value: textContent },
        { type: "text/html", value: htmlContent }
      ]
    }

    console.log(`Sending score notification to ${submitter.email} for ${appNumber} (score: ${overallScore})`)

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

    console.log(`Score notification sent to ${submitter.email}`)

    return new Response(
      JSON.stringify({ success: true, sent: 1 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Score notification error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
