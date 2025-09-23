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

async function addMessage(apiKey: string, threadId: string, role: string, content: string) {
  const res = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...beta,
    },
    body: JSON.stringify({ role, content }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI add message error: ${res.status} ${body}`);
  }
  return await res.json();
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
    if (!apiKey || !assistantId) {
      return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { messages, context } = await req.json();

    // Basic validation and hardening: only accept user content array
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Create thread (Assistant tools like File Search are configured server-side on the Assistant)
    const thread = await createThread(apiKey);

    // Add user message (do not pass system prompts from client)
    const userText = messages
      .filter((m: any) => m && m.role === "user" && typeof m.content === "string")
      .map((m: any) => m.content)
      .join("\n\n");

    const contextualized = context
      ? `Context Data: ${JSON.stringify(context, null, 2)}\n\n${userText}`
      : userText;

    await addMessage(apiKey, thread.id, "user", contextualized || "");

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


