import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!apiKey || !supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server not configured" }), { 
        status: 500, 
        headers: { ...cors, "Content-Type": "application/json" } 
      });
    }

    const { filePath, fileName, farmerId, farmerName } = await req.json();

    if (!filePath || !fileName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    console.log(`🖼️ Generating description for image: ${fileName}`);

    // Download image from Supabase Storage
    const storageUrl = `${supabaseUrl}/storage/v1/object/farmer-documents/${filePath}`;
    const imageResponse = await fetch(storageUrl, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
      }
    });

    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();
    const uint8Array = new Uint8Array(imageBuffer);
    const base64Image = base64Encode(uint8Array);
    const mimeType = imageBlob.type || 'image/jpeg';

    console.log(`📷 Image downloaded: ${imageBlob.size} bytes, type: ${mimeType}`);

    // Generate agricultural description using GPT-4 Vision
    const visionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are an agricultural specialist analyzing farm images for ${farmerName}. 

Analyze this image and provide a detailed description focusing on:
1. Crop type and growth stage (if visible)
2. Plant health indicators (color, vigor, diseases, pests)
3. Soil conditions (if visible)
4. Environmental factors (weather damage, irrigation, etc.)
5. Any agricultural equipment or infrastructure
6. Potential issues or concerns for farming operations

Provide a concise but comprehensive description that would help agricultural specialists understand what's shown in the image for F-100 reporting and farm analysis.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      throw new Error(`OpenAI Vision API error: ${visionResponse.status} ${errorText}`);
    }

    const visionResult = await visionResponse.json();
    const description = visionResult.choices[0]?.message?.content;

    if (!description) {
      throw new Error("No description generated");
    }

    console.log(`✅ Generated description: ${description.substring(0, 100)}...`);

    // Update metadata JSON with AI description (avoids schema/migration dependency)
    // 1) Load existing metadata for this file
    const selectUrl = new URL(`${supabaseUrl}/rest/v1/farmer_data_uploads`);
    selectUrl.searchParams.set('select', 'metadata');
    selectUrl.searchParams.set('file_path', `eq.${filePath}`);
    const selectResp = await fetch(selectUrl.toString(), {
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Content-Type": "application/json"
      }
    });

    let existingMetadata: Record<string, unknown> = {};
    if (selectResp.ok) {
      const rows = await selectResp.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.metadata) {
        existingMetadata = rows[0].metadata as Record<string, unknown>;
      }
    }

    const mergedMetadata = {
      ...existingMetadata,
      ai_description: description,
      ai_description_generated_at: new Date().toISOString()
    };

    // 2) Patch back merged metadata
    const updateUrl = new URL(`${supabaseUrl}/rest/v1/farmer_data_uploads`);
    updateUrl.searchParams.set('file_path', `eq.${filePath}`);
    const updateResponse = await fetch(updateUrl.toString(), {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({ metadata: mergedMetadata })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(`Failed to update database: ${updateResponse.status} ${errorText}`);
    } else {
      console.log(`💾 Updated metadata with AI description`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      description,
      fileName 
    }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('❌ Image description generation failed:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error' 
    }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});