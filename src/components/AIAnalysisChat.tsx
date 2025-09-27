import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Brain, Send, Loader2, MinusCircle } from "lucide-react";
import { llmService, AnalysisPrompts } from "@/lib/llm-service";
import { FarmerDataUpload, F100Phase, AIChatMessage } from "@/types/specialist";
import { formatFileSize } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "./ui/use-toast";

interface AIAnalysisChatProps {
  farmerId: string;
  farmerName: string;
  phase: F100Phase;
  phaseLabel: string;
  assignmentId: string;
  uploads?: FarmerDataUpload[];
  onContextChange?: (uploads: FarmerDataUpload[]) => void;
  onHistoryLoaded?: (messages: AIChatMessage[]) => void;
  onClose?: () => void;
}

type ChatBubble = { role: "user" | "assistant"; content: string };

const mapMessagesToHistory = (messages: AIChatMessage[]): ChatBubble[] =>
  messages.map((message) => ({
    role: message.sender_role === "specialist" ? "user" : "assistant",
    content: message.content
  }));

const uploadsEqual = (a: FarmerDataUpload[], b: FarmerDataUpload[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((upload, index) => {
    const other = b[index];
    return (
      !!other &&
      upload.id === other.id &&
      upload.updated_at === other.updated_at
    );
  });
};

export const AIAnalysisChat: React.FC<AIAnalysisChatProps> = ({
  farmerId,
  farmerName,
  phase,
  phaseLabel,
  assignmentId,
  uploads = [],
  onContextChange,
  onHistoryLoaded,
  onClose
}) => {
  const { profile } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatBubble[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [attachedUploads, setAttachedUploads] = useState<FarmerDataUpload[]>(uploads);
  const endRef = useRef<HTMLDivElement>(null);
  const lastContextRef = useRef<FarmerDataUpload[]>(uploads);

  useEffect(() => {
    setAttachedUploads((prev) => (uploadsEqual(prev, uploads) ? prev : uploads));
  }, [uploads]);

  const propagateContextChange = useCallback((nextUploads: FarmerDataUpload[]) => {
    if (!uploadsEqual(lastContextRef.current, nextUploads)) {
      lastContextRef.current = nextUploads;
      onContextChange?.(nextUploads);
    }
  }, [onContextChange]);

  const removeUploadById = useCallback((id: string) => {
    setAttachedUploads((prev) => {
      const filtered = prev.filter((upload) => upload.id !== id);
      // Use setTimeout to defer the context change to avoid updating parent during render
      setTimeout(() => {
        propagateContextChange(filtered);
      }, 0);
      return filtered;
    });
  }, [propagateContextChange]);

  // Only propagate context changes when uploads prop changes from parent
  useEffect(() => {
    if (!uploadsEqual(lastContextRef.current, attachedUploads)) {
      // Use setTimeout to defer the context change to avoid updating parent during render
      const timeoutId = setTimeout(() => {
        propagateContextChange(attachedUploads);
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [attachedUploads, propagateContextChange]);

  const ensureSession = useCallback(async () => {
    if (!profile?.user_id) {
      return null;
    }

    if (sessionId) {
      setInitializing(false);
      return sessionId;
    }

    try {
      const { data: existing, error: existingError } = await supabase
        .from("ai_chat_sessions")
        .select("id")
        .eq("assignment_id", assignmentId)
        .eq("farmer_id", farmerId)
        .eq("phase", phase)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        setSessionId(existing.id);
        return existing.id;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("ai_chat_sessions")
        .insert({
          farmer_id: farmerId,
          specialist_id: profile.user_id,
          assignment_id: assignmentId,
          phase
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      setSessionId(inserted.id);
      return inserted.id;
    } catch (err: any) {
      console.error("Failed to initialize AI chat session", err);
      toast({
        title: "Unable to open AI chat",
        description: err?.message ?? "Unexpected error while preparing the workspace.",
        variant: "destructive"
      });
      return null;
    } finally {
      setInitializing(false);
    }
  }, [assignmentId, farmerId, phase, profile?.user_id, sessionId]);

  const loadHistory = useCallback(
    async (activeSessionId: string) => {
      const { data, error } = await supabase
        .from("ai_chat_messages")
        .select("id, sender_role, content, metadata, created_at")
        .eq("session_id", activeSessionId)
        .order("created_at", { ascending: true });

      if (error) {
        toast({
          title: "Unable to load chat history",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      const mappedHistory = mapMessagesToHistory(data as AIChatMessage[]);
      setHistory(mappedHistory);
      onHistoryLoaded?.(data as AIChatMessage[]);
    },
    [onHistoryLoaded]
  );

  useEffect(() => {
    let isMounted = true;

    if (profile?.user_id) {
      ensureSession().then((activeSessionId) => {
        if (activeSessionId && isMounted) {
          loadHistory(activeSessionId);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [ensureSession, loadHistory, profile?.user_id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isLoading]);

  const persistMessage = useCallback(
    async (
      activeSessionId: string,
      role: "specialist" | "assistant",
      content: string,
      attachments: FarmerDataUpload[]
    ) => {
      const { data, error } = await supabase
        .from("ai_chat_messages")
        .insert({
          session_id: activeSessionId,
          sender_role: role,
          content,
          metadata: {
            attachments: attachments.map((upload) => ({
              id: upload.id,
              name: upload.file_name,
              type: upload.data_type,
              size: upload.file_size_bytes,
              phase: upload.phase
            }))
          }
        })
        .select("id")
        .single();

      if (error) {
        console.error("Failed to persist chat message", error);
        toast({
          title: "Chat persistence failed",
          description: error.message,
          variant: "destructive"
        });
        return null;
      }

      if (attachments.length > 0) {
        const contextRows = attachments.map((upload) => ({
          message_id: data.id,
          data_upload_id: upload.id
        }));
        const { error: contextError } = await supabase
          .from("ai_chat_context_files")
          .insert(contextRows);
        if (contextError) {
          console.warn("Failed to persist chat context files", contextError);
        }
      }

      return data.id as string;
    },
    []
  );

  const handleRemoveUpload = useCallback(
    (id: string) => {
      removeUploadById(id);
    },
    [removeUploadById]
  );

  const runAnalysis = useCallback(
    async (input: string) => {
      if (!input.trim()) return;

      const activeSessionId = sessionId ?? (await ensureSession());
      if (!activeSessionId) return;

      setIsLoading(true);
      setHistory((prev) => [...prev, { role: "user", content: input }]);
      await persistMessage(activeSessionId, "specialist", input, attachedUploads);

      try {
        const result = await llmService.analyzeData(input, {
          farmerId,
          farmerName,
          phase,
          phaseLabel,
          assignmentId,
          attachments: attachedUploads.map((upload) => ({
            id: upload.id,
            name: upload.file_name,
            type: upload.data_type,
            size: upload.file_size_bytes,
            phase: upload.phase,
            uploadedAt: upload.created_at
          }))
        }, 'openai', attachedUploads);

        if (result.success && result.data) {
          setHistory((prev) => [...prev, { role: "assistant", content: result.data.analysis }]);
          await persistMessage(activeSessionId, "assistant", result.data.analysis, []);
        } else {
          const errorMessage = `Error: ${result.error?.message || "Unknown error"}`;
          setHistory((prev) => [...prev, { role: "assistant", content: errorMessage }]);
          await persistMessage(activeSessionId, "assistant", errorMessage, []);
        }
      } catch (error: any) {
        console.error("AI analysis error", error);
        const fallback = `Error: ${error?.message || "Unknown analysis error"}`;
        setHistory((prev) => [...prev, { role: "assistant", content: fallback }]);
        await persistMessage(activeSessionId, "assistant", fallback, []);
      } finally {
        setIsLoading(false);
      }
    },
    [assignmentId, attachedUploads, ensureSession, farmerId, farmerName, phase, phaseLabel, persistMessage, sessionId]
  );

  const suggestedUploads = useMemo(() => attachedUploads, [attachedUploads]);

  const renderRichText = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let listBuffer: string[] = [];
    let ordered = false;

    const flushList = () => {
      if (listBuffer.length === 0) return;
      const items = listBuffer.map((txt, idx) => <li key={`li-${elements.length}-${idx}`}>{applyInline(txt)}</li>);
      elements.push(
        ordered ? (
          <ol key={`ol-${elements.length}`} className="list-decimal pl-5 space-y-1">
            {items}
          </ol>
        ) : (
          <ul key={`ul-${elements.length}`} className="list-disc pl-5 space-y-1">
            {items}
          </ul>
        )
      );
      listBuffer = [];
      ordered = false;
    };

    const applyInline = (txt: string) => {
      const parts = txt.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
      return parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part
      );
    };

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (/^\s*[-•]\s+/.test(line)) {
        listBuffer.push(line.replace(/^\s*[-•]\s+/, ""));
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        if (!ordered && listBuffer.length > 0) flushList();
        ordered = true;
        listBuffer.push(line.replace(/^\s*\d+\.\s+/, ""));
        continue;
      }
      flushList();
      if (line.startsWith("### ")) {
        elements.push(
          <h3 key={`h3-${elements.length}`} className="font-semibold mt-3">
            {applyInline(line.slice(4))}
          </h3>
        );
      } else if (line.startsWith("## ")) {
        elements.push(
          <h2 key={`h2-${elements.length}`} className="font-semibold text-lg mt-3">
            {applyInline(line.slice(3))}
          </h2>
        );
      } else if (line.startsWith("# ")) {
        elements.push(
          <h1 key={`h1-${elements.length}`} className="font-bold text-xl mt-3">
            {applyInline(line.slice(2))}
          </h1>
        );
      } else if (line.length === 0) {
        elements.push(<div key={`sp-${elements.length}`} className="h-2" />);
      } else {
        elements.push(<p key={`p-${elements.length}`}>{applyInline(line)}</p>);
      }
    }
    flushList();
    return <div className="prose prose-sm max-w-none">{elements}</div>;
  };

  return (
    <Card className="flex flex-col h-[70vh]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Analysis Assistant
        </CardTitle>
        <CardDescription>
          Private AI workspace for {farmerName} - {phaseLabel}. Attachments provide additional context to the assistant.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex-1">
            {suggestedUploads.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestedUploads.map((upload) => (
                  <span
                    key={upload.id}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700"
                  >
                    {upload.file_name} • {formatFileSize(upload.file_size_bytes)}
                    <button
                      type="button"
                      onClick={() => handleRemoveUpload(upload.id)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <MinusCircle className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <div className="mx-auto max-w-3xl w-full space-y-4">
            {initializing ? (
              <div className="text-sm text-gray-600">Preparing secure AI workspace...</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-gray-600">
                Start by asking a question or use a preset:
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => runAnalysis(AnalysisPrompts.cropHealth({ farmerId, farmerName, phase }))}>
                    Crop Health
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => runAnalysis(AnalysisPrompts.soilAnalysis({ farmerId, farmerName, phase }))}>
                    Soil Analysis
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => runAnalysis(AnalysisPrompts.irrigationOptimization({ farmerId, farmerName, phase }))}>
                    Irrigation
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => runAnalysis(AnalysisPrompts.financialRisk({ farmerId, farmerName, phase }))}>
                    Financial Risk
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => runAnalysis(AnalysisPrompts.complianceReview({ farmerId, farmerName, phase }))}>
                    Compliance
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {history.map((message, index) => (
                  <div key={index} className="flex">
                    <div
                      className={`rounded-lg px-3 py-2 max-w-[85%] break-words ${
                        message.role === "user"
                          ? "bg-blue-50 text-blue-900 border border-blue-200"
                          : "bg-gray-50 text-gray-900 border border-gray-200"
                      }`}
                    >
                      {message.role === "assistant" ? renderRichText(message.content) : (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex">
                    <div className="rounded-lg px-3 py-2 bg-gray-50 text-gray-600 border border-gray-200">
                      <span className="inline-flex items-center gap-2">
                        <span className="relative inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                        <span className="relative inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                        <span className="relative inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                        <span>Thinking...</span>
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="border-t p-4">
          <div className="mx-auto max-w-3xl w-full flex gap-2">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask for analysis or paste notes/data..."
              className="min-h-[48px] flex-1 resize-none"
            />
            <Button
              onClick={() => {
                const trimmed = prompt.trim();
                if (!trimmed) return;
                setPrompt("");
                void runAnalysis(trimmed);
              }}
              disabled={isLoading || initializing || !prompt.trim()}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIAnalysisChat;


