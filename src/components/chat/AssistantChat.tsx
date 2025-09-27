import React, { useState } from "react";
import * as AUI from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";

type Message = { id: string; role: "user" | "assistant"; content: string };

export default function AssistantChat({
  context,
}: { context: Record<string, unknown> }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setMessages((m) => [...m, userMsg]);
    setIsSending(true);
    try {
      const res = await fetch("/functions/v1/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: trimmed }], context }),
      });
      const data = await res.json();
      const assistantText = data?.choices?.[0]?.message?.content || "No response";
      const aiMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: assistantText };
      setMessages((m) => [...m, aiMsg]);
    } catch (e: any) {
      const aiMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: `Error: ${e?.message || "Unknown error"}` };
      setMessages((m) => [...m, aiMsg]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-[70vh] max-w-3xl mx-auto">
      <AUI.Chat
        messages={messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: <MarkdownTextPrimitive remarkPlugins={[remarkGfm]}>{m.content}</MarkdownTextPrimitive>,
        }))}
        onSendMessage={(content) => send(content)}
        thinkingIndicator={{ label: "Thinking..." }}
        composer={{ placeholder: "Ask for analysis or paste notes/data...", sendDisabled: isSending }}
      />
    </div>
  );
}


