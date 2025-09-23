import React, { useRef, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Brain, Send, Loader2 } from "lucide-react";
import { llmService, AnalysisPrompts } from "@/lib/llm-service";

interface AIAnalysisChatProps {
  farmerId: string;
  farmerName: string;
  phase: string;
  onClose?: () => void;
}

export const AIAnalysisChat: React.FC<AIAnalysisChatProps> = ({ farmerId, farmerName, phase, onClose }) => {
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState<Record<string, unknown>>({
    farmerId,
    farmerName,
    phase,
  });
  const [history, setHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isLoading]);

  const runAnalysis = async (input: string) => {
    if (!input.trim()) return;
    setIsLoading(true);
    setHistory(prev => [...prev, { role: 'user', content: input }]);
    try {
      const result = await llmService.analyzeData(input, context);
      if (result.success && result.data) {
        const content = `${result.data.analysis}`;
        setHistory(prev => [...prev, { role: 'assistant', content }]);
      } else {
        setHistory(prev => [...prev, { role: 'assistant', content: `Error: ${result.error?.message || 'Unknown error'}` }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Naive markdown renderer for headings, lists, and bold text
  const renderRichText = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let listBuffer: string[] = [];
    let ordered = false;

    const flushList = () => {
      if (listBuffer.length === 0) return;
      const items = listBuffer.map((txt, idx) => <li key={`li-${elements.length}-${idx}`}>{applyInline(txt)}</li>);
      elements.push(ordered ? <ol key={`ol-${elements.length}`} className="list-decimal pl-5 space-y-1">{items}</ol>
                             : <ul key={`ul-${elements.length}`} className="list-disc pl-5 space-y-1">{items}</ul>);
      listBuffer = [];
      ordered = false;
    };

    const applyInline = (txt: string) => {
      // bold **text**
      const parts = txt.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
      return parts.map((part, i) => part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part);
    };

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (/^\s*[-•]\s+/.test(line)) {
        listBuffer.push(line.replace(/^\s*[-•]\s+/, ''));
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        if (!ordered && listBuffer.length > 0) flushList();
        ordered = true;
        listBuffer.push(line.replace(/^\s*\d+\.\s+/, ''));
        continue;
      }
      flushList();
      if (line.startsWith('### ')) {
        elements.push(<h3 key={`h3-${elements.length}`} className="font-semibold mt-3">{applyInline(line.slice(4))}</h3>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={`h2-${elements.length}`} className="font-semibold text-lg mt-3">{applyInline(line.slice(3))}</h2>);
      } else if (line.startsWith('# ')) {
        elements.push(<h1 key={`h1-${elements.length}`} className="font-bold text-xl mt-3">{applyInline(line.slice(2))}</h1>);
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
          Private AI workspace for {farmerName} - {phase.replace('_', ' ')}. Messages are not shared with the farmer.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Controls */}
        <div className="px-4 pb-3 flex items-center justify-end">
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          )}
        </div>

        {/* Transcript */}
        <div className="flex-1 overflow-y-auto px-4">
          <div className="mx-auto max-w-3xl w-full space-y-4">
            {history.length === 0 ? (
            <div className="text-sm text-gray-600">
              Start by asking a question or use a preset:
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => runAnalysis(AnalysisPrompts.cropHealth(context))}>Crop Health</Button>
                <Button variant="outline" size="sm" onClick={() => runAnalysis(AnalysisPrompts.soilAnalysis(context))}>Soil Analysis</Button>
                <Button variant="outline" size="sm" onClick={() => runAnalysis(AnalysisPrompts.irrigationOptimization(context))}>Irrigation</Button>
                <Button variant="outline" size="sm" onClick={() => runAnalysis(AnalysisPrompts.financialRisk(context))}>Financial Risk</Button>
                <Button variant="outline" size="sm" onClick={() => runAnalysis(AnalysisPrompts.complianceReview(context))}>Compliance</Button>
              </div>
            </div>
            ) : (
              <>
                {history.map((m, i) => (
                  <div key={i} className="flex">
                    <div className={`rounded-lg px-3 py-2 max-w-[85%] break-words ${m.role === 'user' ? 'bg-blue-50 text-blue-900 border border-blue-200' : 'bg-gray-50 text-gray-900 border border-gray-200'}`}>
                      {m.role === 'assistant' ? renderRichText(m.content) : <div className="whitespace-pre-wrap">{m.content}</div>}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex">
                    <div className="rounded-lg px-3 py-2 bg-gray-50 text-gray-600 border border-gray-200">
                      <span className="inline-flex items-center gap-2">
                        <span className="relative inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="relative inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="relative inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
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

        {/* Input */}
        <div className="border-t p-4">
          <div className="mx-auto max-w-3xl w-full flex gap-2">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask for analysis or paste notes/data..."
              className="min-h-[48px] flex-1 resize-none"
            />
            <Button
              onClick={() => { const p = prompt.trim(); if (!p) return; setPrompt(''); runAnalysis(p); }}
              disabled={isLoading || !prompt.trim()}
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


