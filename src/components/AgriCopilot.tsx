import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { 
  Brain, 
  Loader2, 
  MinusCircle, 
  Eye, 
  Image, 
  FileText, 
  BarChart3,
  Maximize2,
  Minimize2,
  X,
  Sparkles,
  MessageSquare,
  Database,
  TrendingUp
} from 'lucide-react';
import { FarmerDataUpload, F100Phase, AIChatMessage } from '@/types/specialist';
import { formatFileSize } from '@/lib/formatters';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FileViewer } from './FileViewer';
import { toast } from './ui/use-toast';
import { llmService, AnalysisPrompts } from '@/lib/llm-service';

interface AgriCopilotProps {
  farmerId: string;
  farmerIdNumber: string;
  crop: string;
  phase: F100Phase;
  phaseLabel: string;
  assignmentId: string;
  uploads?: FarmerDataUpload[];
  onContextChange?: (uploads: FarmerDataUpload[]) => void;
  onMessageCountUpdate?: (count: number) => void;
  onClose?: () => void;
}

interface AnalysisResult {
  id: string;
  title: string;
  content: string;
  timestamp: Date;
  type: 'analysis' | 'recommendation' | 'insight';
  confidence?: number;
  tags?: string[];
}

type ChatBubble = { role: "user" | "assistant"; content: string; timestamp?: Date };

const AgriCopilot: React.FC<AgriCopilotProps> = ({
  farmerId,
  farmerIdNumber,
  crop,
  phase,
  phaseLabel,
  assignmentId,
  uploads = [],
  onContextChange,
  onMessageCountUpdate,
  onClose
}) => {
  const { profile } = useAuth();
  
  // Layout state
  const [isMaximized, setIsMaximized] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(350);
  const [isMobile, setIsMobile] = useState(false);
  
  // Data state
  const [attachedUploads, setAttachedUploads] = useState<FarmerDataUpload[]>(uploads);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);
  
  // Chat state
  const [chatHistory, setChatHistory] = useState<ChatBubble[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingImages, setAnalyzingImages] = useState<Set<string>>(new Set());
  
  // Session management
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  
  // File viewer state
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileViewerFiles, setFileViewerFiles] = useState<any[]>([]);
  const [fileViewerInitialIndex, setFileViewerInitialIndex] = useState(0);
  const [fileViewerSectionName, setFileViewerSectionName] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ isResizing: boolean; startX: number; startWidth: number }>({
    isResizing: false,
    startX: 0,
    startWidth: 0
  });

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    handleResize(); // Check initial size
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize session
  const ensureSession = useCallback(async () => {
    if (!profile?.user_id) return null;
    
    try {
      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .select('id')
        .eq('farmer_id', farmerId)
        .eq('specialist_id', profile.user_id)
        .eq('assignment_id', assignmentId)
        .single();

      if (data) {
        return data.id;
      }

      const { data: newSession, error: createError } = await supabase
        .from('ai_chat_sessions')
        .insert({
          farmer_id: farmerId,
          specialist_id: profile.user_id,
          assignment_id: assignmentId,
          phase: phase
        })
        .select('id')
        .single();

      if (createError) throw createError;
      return newSession.id;
    } catch (error) {
      console.error('Failed to ensure session:', error);
      return null;
    }
  }, [profile?.user_id, farmerId, assignmentId, farmerIdNumber, crop, phaseLabel, phase]);

  // Load chat history
  const loadChatHistory = useCallback(async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const history = data.map(msg => ({
        role: msg.sender_role === 'specialist' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at)
      })) as ChatBubble[];

      setChatHistory(history);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, []);

  // Initialize component
  useEffect(() => {
    const initialize = async () => {
      if (!profile?.user_id) return;
      
      const session = await ensureSession();
      if (session) {
        setSessionId(session);
        await loadChatHistory(session);
      }
      setInitializing(false);
    };

    initialize();
  }, [profile?.user_id, ensureSession, loadChatHistory]);

  // Sync uploads
  useEffect(() => {
    setAttachedUploads(uploads);
  }, [uploads]);

  // Update message count when chat history changes
  useEffect(() => {
    if (onMessageCountUpdate) {
      onMessageCountUpdate(chatHistory.length);
    }
  }, [chatHistory.length, onMessageCountUpdate]);

  // Handle file removal
  const handleRemoveUpload = useCallback((uploadId: string) => {
    const filtered = attachedUploads.filter(u => u.id !== uploadId);
    setAttachedUploads(filtered);
    onContextChange?.(filtered);
  }, [attachedUploads, onContextChange]);

  // Analyze specific image
  const analyzeSpecificImage = useCallback(async (upload: FarmerDataUpload) => {
    if (analyzingImages.has(upload.id) || isAnalyzing) return;

    setAnalyzingImages(prev => new Set(prev).add(upload.id));
    
    try {
      const prompt = `Analyze this agricultural image: ${upload.file_name}. ${upload.ai_description ? `Context: ${upload.ai_description}` : ''} Provide detailed insights for F-100 reporting.`;
      
      const result = await llmService.analyzeData(prompt, {
        farmerId,
        farmerIdNumber,
        crop,
        phase,
        phaseLabel,
        assignmentId,
        attachments: [{
          id: upload.id,
          name: upload.file_name,
          type: upload.data_type,
          size: upload.file_size_bytes,
          phase: upload.phase,
          uploadedAt: upload.created_at
        }]
      }, 'openai', [upload]);

      if (result.success && result.data) {
        // Add to chat history
        setChatHistory(prev => [
          ...prev,
          { role: 'user', content: `Analyze image: ${upload.file_name}`, timestamp: new Date() },
          { role: 'assistant', content: result.data.analysis, timestamp: new Date() }
        ]);

        // Add to analysis results
        const analysisResult: AnalysisResult = {
          id: `img-${upload.id}-${Date.now()}`,
          title: `Image Analysis: ${upload.file_name}`,
          content: result.data.analysis,
          timestamp: new Date(),
          type: 'analysis',
          tags: ['image', 'visual-analysis', upload.data_type]
        };
        
        setAnalysisResults(prev => [analysisResult, ...prev]);
        setSelectedResult(analysisResult);
      }
    } catch (error) {
      console.error('Image analysis failed:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Failed to analyze the image. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setAnalyzingImages(prev => {
        const next = new Set(prev);
        next.delete(upload.id);
        return next;
      });
    }
  }, [analyzingImages, isAnalyzing, farmerId, farmerIdNumber, crop, phase, phaseLabel, assignmentId]);

  // Send chat message
  const sendMessage = useCallback(async () => {
    if (!currentMessage.trim() || isAnalyzing || !sessionId) return;

    const userMessage = currentMessage.trim();
    setCurrentMessage('');
    setIsAnalyzing(true);

    // Add user message to chat
    setChatHistory(prev => [...prev, { 
      role: 'user', 
      content: userMessage, 
      timestamp: new Date() 
    }]);

    try {
      const result = await llmService.analyzeData(userMessage, {
        farmerId,
        farmerIdNumber,
        crop,
        phase,
        phaseLabel,
        assignmentId,
        attachments: attachedUploads.map(upload => ({
          id: upload.id,
          name: upload.file_name,
          type: upload.data_type,
          size: upload.file_size_bytes,
          phase: upload.phase,
          uploadedAt: upload.created_at
        }))
      }, 'openai', attachedUploads);

      if (result.success && result.data) {
        const assistantMessage = result.data.analysis;
        
        // Add assistant response to chat
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: assistantMessage, 
          timestamp: new Date() 
        }]);

        // Create analysis result
        const analysisResult: AnalysisResult = {
          id: `chat-${Date.now()}`,
          title: userMessage.length > 50 ? `${userMessage.substring(0, 50)}...` : userMessage,
          content: assistantMessage,
          timestamp: new Date(),
          type: 'analysis',
          tags: ['chat', 'analysis']
        };
        
        setAnalysisResults(prev => [analysisResult, ...prev]);
        setSelectedResult(analysisResult);

        // Persist to database
        await supabase.from('ai_chat_messages').insert([
          {
            session_id: sessionId,
            sender_role: 'specialist',
            content: userMessage
          },
          {
            session_id: sessionId,
            sender_role: 'assistant',
            content: assistantMessage
          }
        ]);
      }
    } catch (error) {
      console.error('Chat analysis failed:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Failed to process your message. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [currentMessage, isAnalyzing, sessionId, farmerId, farmerIdNumber, crop, phase, phaseLabel, assignmentId, attachedUploads]);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = {
      isResizing: true,
      startX: e.clientX,
      startWidth: leftPanelWidth
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current.isResizing) return;
      
      const deltaX = e.clientX - resizeRef.current.startX;
      const newWidth = Math.max(300, Math.min(500, resizeRef.current.startWidth + deltaX));
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      resizeRef.current.isResizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [leftPanelWidth]);

  const getImageUrl = useCallback((upload: FarmerDataUpload) => {
    return supabase.storage.from('farmer-documents').getPublicUrl(upload.file_path).data.publicUrl;
  }, []);

  // File preview functions
  const openFileViewer = useCallback((clickedUpload: FarmerDataUpload, uploadsGroup: FarmerDataUpload[], sectionName: string) => {
    console.log('🎯 Opening file viewer for:', clickedUpload.file_name, 'in section:', sectionName);
    
    // Convert uploads to FileViewer format without signed URLs (will be generated on-demand)
    const fileViewerDocs = uploadsGroup.map(upload => ({
      id: upload.id,
      file_name: upload.file_name,
      file_path: upload.file_path,
      file_mime: upload.file_mime || 'application/octet-stream',
      file_size_bytes: upload.file_size_bytes,
      created_at: upload.created_at,
      // No signedUrl - FileViewer will generate on-demand using Edge Function
      bucket: 'farmer-documents'
    }));
    
    const index = uploadsGroup.findIndex(upload => upload.id === clickedUpload.id);
    
    // Open immediately without waiting for URL generation
    setFileViewerFiles(fileViewerDocs);
    setFileViewerInitialIndex(index >= 0 ? index : 0);
    setFileViewerSectionName(sectionName);
    setFileViewerOpen(true);
  }, []);

  const handleFileViewerClose = useCallback(() => {
    setFileViewerOpen(false);
    setFileViewerFiles([]);
    setFileViewerSectionName('');
  }, []);

  if (initializing) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Initializing TelAgri Co-Pilot...
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border rounded-lg shadow-lg ${isMaximized ? 'fixed inset-2 md:inset-4 z-50' : 'h-[600px] md:h-[800px]'} flex flex-col transition-all duration-300`}>
      {/* Enhanced Header with Professional Design */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary flex-shrink-0" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-heading-secondary">TelAgri Co-Pilot</h2>
              <p className="text-body-secondary truncate">ID: {farmerIdNumber} | {crop} - {phaseLabel}</p>
            </div>
          </div>
          {!isMobile && (
            <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary hidden sm:flex">
              <Sparkles className="h-3 w-3 mr-1" />
              AI-Powered Analysis
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMaximized(!isMaximized)}
            className="text-muted-foreground hover:text-foreground"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          {onClose && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Content - 2 Panel Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel - Data & Context */}
        <div 
          className={`${isMobile ? 'border-b' : 'border-r'} bg-muted/30 ${isMobile ? 'flex-shrink-0' : ''} transition-all duration-300`}
          style={{ 
            width: isMobile ? '100%' : leftPanelWidth,
            height: isMobile ? '250px' : 'auto'
          }}
          data-tour="copilot-sidebar"
        >
          <div className="p-4 border-b bg-card/50">
            <h3 className="font-medium text-heading-tertiary flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Data & Context
            </h3>
          </div>
          
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Attached Files */}
              {attachedUploads.length > 0 && (
                <div className="space-y-3" data-tour="attached-files">
                  <h4 className="text-sm font-medium text-body-secondary">
                    Attached Files ({attachedUploads.length})
                  </h4>
                  <div className="space-y-2">
                    {attachedUploads.map((upload) => (
                      <div
                        key={upload.id}
                        className="border rounded-lg p-3 bg-card hover:bg-muted/50 transition-all duration-200"
                      >
                        {/* File Header */}
                        <div className="flex items-center gap-3 mb-2">
                          {upload.data_type === 'photo' && upload.file_mime?.startsWith('image/') ? (
                            <div className="relative flex-shrink-0">
                              <img
                                src={getImageUrl(upload)}
                                alt={upload.file_name}
                                className="w-8 h-8 object-cover rounded border"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                              <div className="hidden w-8 h-8 bg-gray-200 rounded border flex items-center justify-center">
                                <Image className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-blue-100 rounded border flex items-center justify-center flex-shrink-0">
                              <FileText className="h-3 w-3 text-blue-600" />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <button
                                  onClick={() => openFileViewer(upload, attachedUploads, 'Data & Context')}
                                  className="text-sm font-medium text-blue-600 hover:text-blue-800 underline truncate text-left w-full"
                                  title={`Click to preview: ${upload.file_name}`}
                                >
                                  {upload.file_name}
                                </button>
                                
                                {/* Action Button - Right under file name */}
                                {upload.data_type === 'photo' && (
                                  <div className="mt-1 mb-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => analyzeSpecificImage(upload)}
                                      className="text-xs h-5 px-2"
                                      disabled={isAnalyzing || analyzingImages.has(upload.id)}
                                    >
                                      {analyzingImages.has(upload.id) ? (
                                        <>
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                          Analyzing...
                                        </>
                                      ) : (
                                        <>
                                          <Eye className="h-3 w-3 mr-1" />
                                          Analyze
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                )}
                                
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(upload.file_size_bytes)} • Phase {upload.phase}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveUpload(upload.id)}
                                className="text-gray-400 hover:text-red-600 flex-shrink-0 p-1"
                                title="Remove from context"
                              >
                                <MinusCircle className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* AI Description */}
                        {upload.ai_description && (
                          <div className="mb-2 p-2 bg-blue-50 rounded text-xs text-gray-700 border-l-2 border-blue-200">
                            <span className="font-medium text-blue-800">AI:</span>
                            <p className="mt-1 line-clamp-2">{upload.ai_description}</p>
                          </div>
                        )}
                        
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Quick Analysis</h4>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMessage(AnalysisPrompts.cropHealth({ farmerId, farmerIdNumber, crop, phase }).replace('Context Data:', '').trim())}
                    className="justify-start text-xs h-8"
                  >
                    🌱 Crop Health Assessment
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMessage(AnalysisPrompts.soilAnalysis({ farmerId, farmerIdNumber, crop, phase }).replace('Context Data:', '').trim())}
                    className="justify-start text-xs h-8"
                  >
                    🌍 Soil Analysis
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMessage(AnalysisPrompts.financialRisk({ farmerId, farmerIdNumber, crop, phase }).replace('Context Data:', '').trim())}
                    className="justify-start text-xs h-8"
                  >
                    💰 Financial Risk
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Resize Handle */}
        {!isMobile && (
          <div
            className="w-1 bg-gray-200 hover:bg-blue-300 cursor-col-resize transition-colors"
            onMouseDown={handleMouseDown}
          />
        )}

        {/* Main Chat Interface - Optimized for Readability */}
        <div className="flex-1 flex flex-col bg-ai-surface transition-all duration-300">
          {/* Chat Header */}
          <div className="p-4 border-b bg-ai-surface-elevated">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-heading-secondary">AI Agricultural Assistant</h3>
                  <p className="text-ai-text-secondary">Powered by TelAgri Co-Pilot</p>
                </div>
              </div>
              {analysisResults.length > 0 && (
                <Badge variant="secondary" className="bg-primary/5 border-primary/20 text-primary">
                  {analysisResults.length} Analysis
                </Badge>
              )}
            </div>
          </div>
          
          {/* Chat History - Enhanced for Long-form Reading */}
          <ScrollArea className="flex-1 p-4 bg-ai-surface">
            <div className="max-w-4xl mx-auto space-y-6">
              {chatHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
                    <Brain className="h-8 w-8 text-primary" />
                  </div>
                  <h4 className="text-heading-secondary mb-2">Welcome to TelAgri Co-Pilot</h4>
                  <p className="text-ai-text-secondary mb-6">Start analyzing agricultural data with AI-powered insights</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage("Analyze the overall crop health and provide recommendations")}
                      className="text-xs"
                    >
                      🌱 Analyze Crop Health
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage("Review soil conditions and nutrient requirements")}
                      className="text-xs"
                    >
                      🌍 Soil Assessment
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage("Evaluate financial risks and opportunities")}
                      className="text-xs"
                    >
                      💰 Financial Analysis
                    </Button>
                  </div>
                </div>
              ) : (
                chatHistory.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-5 py-4 shadow-sm transition-all duration-200 ${
                        message.role === 'user'
                          ? 'bg-ai-user-message text-white'
                          : 'bg-ai-assistant-message border'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <div className="ai-content prose prose-base max-w-none 
                          prose-headings:text-ai-text-primary prose-headings:font-semibold prose-headings:mb-4 prose-headings:leading-snug prose-headings:tracking-tight
                          prose-p:text-ai-text-primary prose-p:leading-loose prose-p:mb-6 prose-p:text-base
                          prose-strong:text-ai-text-primary prose-strong:font-semibold
                          prose-ul:text-ai-text-primary prose-ul:mb-6 prose-ul:leading-loose prose-ul:text-base
                          prose-ol:text-ai-text-primary prose-ol:mb-6 prose-ol:leading-loose prose-ol:text-base
                          prose-li:text-ai-text-primary prose-li:mb-2 prose-li:leading-loose prose-li:text-base
                          prose-code:text-ai-accent prose-code:bg-primary/10 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:font-mono
                          prose-pre:bg-muted/50 prose-pre:border prose-pre:text-ai-text-primary prose-pre:text-sm prose-pre:p-4 prose-pre:rounded-lg prose-pre:leading-relaxed
                          prose-blockquote:border-l-primary prose-blockquote:text-ai-text-secondary prose-blockquote:pl-6 prose-blockquote:py-2 prose-blockquote:italic prose-blockquote:leading-loose
                          prose-a:text-ai-accent prose-a:no-underline hover:prose-a:underline prose-a:font-medium prose-a:transition-colors
                          prose-table:text-ai-text-primary prose-th:text-ai-text-primary prose-td:text-ai-text-primary prose-th:font-semibold prose-th:pb-3 prose-td:py-2">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({children}) => <h1 className="text-xl font-bold mb-4 leading-snug tracking-tight">{children}</h1>,
                              h2: ({children}) => <h2 className="text-lg font-semibold mb-4 leading-snug tracking-tight">{children}</h2>,
                              h3: ({children}) => <h3 className="text-base font-semibold mb-3 leading-snug">{children}</h3>,
                              h4: ({children}) => <h4 className="text-base font-medium mb-3 leading-snug">{children}</h4>,
                              p: ({children}) => <p className="mb-6 leading-loose text-base">{children}</p>,
                              ul: ({children}) => <ul className="list-disc list-inside mb-6 space-y-2 leading-loose text-base">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal list-inside mb-6 space-y-2 leading-loose text-base">{children}</ol>,
                              li: ({children}) => <li className="leading-loose">{children}</li>,
                              strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                              em: ({children}) => <em className="italic">{children}</em>,
                              code: ({children}) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>,
                              pre: ({children}) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto mb-3">{children}</pre>,
                              blockquote: ({children}) => <blockquote className="border-l-4 border-primary pl-3 py-2 mb-3 bg-primary/10 italic">{children}</blockquote>
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed font-medium">{message.content}</div>
                      )}
                      {message.timestamp && (
                        <div className={`text-xs mt-2 ${
                          message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              
              {isAnalyzing && (
                <div className="flex justify-start">
                  <div className="bg-gray-50 dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg px-4 py-3 transition-colors">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-neon-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">TelAgri Co-Pilot is analyzing...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Chat Input - Enhanced for Comfort */}
          <div className="p-4 border-t bg-ai-surface-elevated">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-3">
                <Textarea
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder="Ask about crop health, soil analysis, financial risks, or any agricultural insights..."
                  className="flex-1 min-h-[48px] max-h-[120px] resize-none text-sm bg-card border-input focus:border-primary focus:ring-1 focus:ring-primary/20 ai-text-primary placeholder:text-ai-text-muted"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!currentMessage.trim() || isAnalyzing}
                  className="h-12 w-12 p-0 rounded-lg bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground flex-shrink-0"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* File Viewer Modal */}
      <FileViewer
        isOpen={fileViewerOpen}
        onClose={handleFileViewerClose}
        files={fileViewerFiles}
        initialFileIndex={fileViewerInitialIndex}
        sectionName={fileViewerSectionName}
      />
    </div>
  );
};

export default AgriCopilot;
