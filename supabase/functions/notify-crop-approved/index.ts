import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from "../_shared/email.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function createCropApprovedEmail(cropName: string) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Crop Request Approved</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; }
        .crop-name { font-size: 20px; font-weight: 700; color: #059669; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;">Crop Request Approved</h1>
          <p style="margin:8px 0 0;opacity:0.9;">TelAgri Underwriting</p>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>The requested crop (<span class="crop-name">${cropName}</span>) has been successfully added to the system.</p>
          <p>You can now select it when submitting a new underwriting application.</p>
          <p>Best regards,<br>TelAgri</p>
        </div>
        <div class="footer">
          <p>TelAgri - Agricultural Finance Management System</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `Hello,

The requested crop (${cropName}) has been successfully added to the system.

You can now select it when submitting a new underwriting application.

Best regards,
TelAgri`.trim();

  return { htmlContent, textContent };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    const { requestId, cropName } = await req.json()

    if (!requestId || !cropName) {
      throw new Error('requestId and cropName are required')
    }

    // Get the requester's user ID from the crop request record
    const { data: reqRecord } = await supabaseClient
      .from('underwriting_crop_requests')
      .select('requested_by')
      .eq('id', requestId)
      .single()

    if (!reqRecord) {
      throw new Error('Crop request not found')
    }

    // Get the requester's email from auth
    const { data: { users } } = await supabaseClient.auth.admin.listUsers({ perPage: 1000 })
    const requester = users.find((u: any) => u.id === reqRecord.requested_by)

    if (!requester?.email) {
      console.warn('Requester email not found - skipping notification')
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { htmlContent, textContent } = createCropApprovedEmail(cropName)

    console.log(`Sending crop approval notification to ${requester.email} for "${cropName}"`)

    const result = await sendEmail({
      to: requester.email,
      subject: `Your crop request "${cropName}" has been approved – TelAgri`,
      html: htmlContent,
      text: textContent,
    })

    if (!result.ok) {
      return new Response(
        JSON.stringify({ success: false, reason: result.notConfigured ? 'Resend not configured' : undefined, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`Crop approval notification sent to ${requester.email}`)

    return new Response(
      JSON.stringify({ success: true, sent: 1 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Crop approval notification error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
