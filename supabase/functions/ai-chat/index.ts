import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const beta = { "OpenAI-Beta": "assistants=v2" };

async function createThread(apiKey: string) {
  const res = await fetch("https://api.openai.com/v1/threads", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...beta,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI thread error: ${res.status} ${body}`);
  }
  return await res.json();
}

// Supported file types for Agricultural Analysis (OpenAI File Search compatible)
const SUPPORTED_FILE_EXTENSIONS = [
  // Text-based formats for agricultural reports and data
  '.txt', '.csv', '.md',
  // Document formats for agricultural reports, research papers, and analysis
  '.pdf', '.docx', '.pptx', '.xlsx'
];

function isFileSupported(fileName: string): boolean {
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  return SUPPORTED_FILE_EXTENSIONS.includes(extension);
}

async function uploadFileToOpenAI(apiKey: string, supabaseUrl: string, serviceRoleKey: string, filePath: string, fileName: string) {
  try {
    console.log(`🔍 Attempting to download file from Supabase Storage: ${filePath}`);
    
    // Use Supabase Storage API with service role key for private buckets
    const storageUrl = `${supabaseUrl}/storage/v1/object/farmer-documents/${filePath}`;
    console.log(`🌐 Storage URL: ${storageUrl}`);
    
    const fileResponse = await fetch(storageUrl, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
      }
    });
    console.log(`📥 File download response status: ${fileResponse.status}`);
    
    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();
      console.error(`❌ Failed to download file: ${fileResponse.status} - ${errorText}`);
      throw new Error(`Failed to download file: ${fileResponse.status} - ${errorText}`);
    }
    
    const fileBlob = await fileResponse.blob();
    console.log(`📄 File blob size: ${fileBlob.size} bytes, type: ${fileBlob.type}`);
    
    // Create form data for OpenAI file upload
    const formData = new FormData();
    formData.append('file', fileBlob, fileName);
    formData.append('purpose', 'assistants');
    
    console.log(`🚀 Uploading file to OpenAI: ${fileName}`);
    const res = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: formData,
    });
    
    const responseText = await res.text();
    console.log(`📤 OpenAI upload response status: ${res.status}`);
    console.log(`📤 OpenAI upload response: ${responseText}`);
    
    if (!res.ok) {
      throw new Error(`OpenAI file upload error: ${res.status} ${responseText}`);
    }
    
    const result = JSON.parse(responseText);
    console.log(`✅ File uploaded successfully with ID: ${result.id}`);
    return result;
  } catch (error) {
    console.error('❌ File upload failed:', error);
    return null;
  }
}

async function addMessage(apiKey: string, threadId: string, role: string, content: string, attachments?: any[]) {
  const messageBody: any = { role, content };
  
  if (attachments && attachments.length > 0) {
    messageBody.attachments = attachments;
    console.log(`💬 Adding message with ${attachments.length} attachments`);
  } else {
    console.log(`💬 Adding message without attachments`);
  }
  
  console.log(`📤 Message body:`, JSON.stringify(messageBody, null, 2));
  
  const res = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...beta,
    },
    body: JSON.stringify(messageBody),
  });
  
  const responseText = await res.text();
  console.log(`💬 Add message response status: ${res.status}`);
  console.log(`💬 Add message response: ${responseText}`);
  
  if (!res.ok) {
    throw new Error(`OpenAI add message error: ${res.status} ${responseText}`);
  }
  return JSON.parse(responseText);
}

async function runAssistant(apiKey: string, threadId: string, assistantId: string, model?: string) {
  const res = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...beta,
    },
    body: JSON.stringify({ assistant_id: assistantId, model }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI run error: ${res.status} ${body}`);
  }
  return await res.json();
}

async function getRun(apiKey: string, threadId: string, runId: string) {
  const res = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
    headers: { "Authorization": `Bearer ${apiKey}`, ...beta },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI poll error: ${res.status} ${body}`);
  }
  return await res.json();
}

async function listMessages(apiKey: string, threadId: string) {
  const res = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    headers: { "Authorization": `Bearer ${apiKey}`, ...beta },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI list messages error: ${res.status} ${body}`);
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    const assistantId = Deno.env.get("TELAGRI_ASSISTANT_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!apiKey || !assistantId || !supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server not configured" }), { 
        status: 500, 
        headers: { ...cors, "Content-Type": "application/json" } 
      });
    }

    const { messages, context, attachedFiles } = await req.json();

    // Basic validation and hardening: only accept user content array
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Create thread (Assistant tools like File Search are configured server-side on the Assistant)
    const thread = await createThread(apiKey);

    // Upload attached files to OpenAI if provided
    const attachments: any[] = [];
    console.log(`📋 Received attachedFiles:`, JSON.stringify(attachedFiles, null, 2));
    
    if (attachedFiles && Array.isArray(attachedFiles) && attachedFiles.length > 0) {
      console.log(`📤 Uploading ${attachedFiles.length} files to OpenAI...`);
      
      for (const file of attachedFiles) {
        console.log(`🔍 Processing file:`, JSON.stringify(file, null, 2));
        
        if (file.file_path && file.file_name) {
          console.log(`🔍 Processing file path: ${file.file_path}`);
          
          // Check if file type is supported by OpenAI File Search
          if (!isFileSupported(file.file_name)) {
            console.log(`⚠️ Skipping unsupported file type: ${file.file_name}`);
            continue;
          }
          
          const uploadedFile = await uploadFileToOpenAI(apiKey, supabaseUrl, serviceRoleKey, file.file_path, file.file_name);
          if (uploadedFile && uploadedFile.id) {
            const attachment = {
              file_id: uploadedFile.id,
              tools: [{ type: "file_search" }]
            };
            attachments.push(attachment);
            console.log(`✅ Successfully uploaded file: ${file.file_name} (ID: ${uploadedFile.id})`);
            console.log(`📎 Attachment object:`, JSON.stringify(attachment, null, 2));
          } else {
            console.error(`❌ Failed to upload file: ${file.file_name}`);
          }
        } else {
          console.error(`❌ File missing required fields:`, { 
            file_path: file.file_path, 
            file_name: file.file_name 
          });
        }
      }
    } else {
      console.log(`📭 No attached files to process`);
    }
    
    console.log(`📎 Final attachments array:`, JSON.stringify(attachments, null, 2));

    // Add user message (do not pass system prompts from client)
    const userText = messages
      .filter((m: any) => m && m.role === "user" && typeof m.content === "string")
      .map((m: any) => m.content)
      .join("\n\n");

    // Enhance context with AI descriptions for images
    let enhancedContext = context;
    if (attachedFiles && Array.isArray(attachedFiles) && attachedFiles.length > 0) {
      const imageDescriptions = attachedFiles
        .filter(file => file.data_type === 'photo' && file.ai_description)
        .map(file => ({
          fileName: file.file_name,
          description: file.ai_description,
          phase: file.phase
        }));
      
      if (imageDescriptions.length > 0) {
        enhancedContext = {
          ...context,
          imageAnalysis: imageDescriptions
        };
      }
    }

    const contextualized = enhancedContext
      ? `Context Data: ${JSON.stringify(enhancedContext, null, 2)}\n\n${userText}`
      : userText;

    await addMessage(apiKey, thread.id, "user", contextualized || "", attachments.length > 0 ? attachments : undefined);

    // Run assistant
    const run = await runAssistant(apiKey, thread.id, assistantId);

    // Poll until completion (max ~20s)
    let status = run.status;
    let tries = 0;
    while (status !== "completed" && status !== "failed" && status !== "cancelled" && tries < 40) {
      await new Promise((r) => setTimeout(r, 500));
      const rj = await getRun(apiKey, thread.id, run.id);
      status = rj.status;
      tries++;
    }

    const messagesList = await listMessages(apiKey, thread.id);
    const assistantMsg = messagesList?.data?.find((m: any) => m.role === "assistant");
    const text = assistantMsg?.content?.[0]?.text?.value || "";

    // Return in chat.completions-like shape for the client
    return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});


