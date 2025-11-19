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
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check
} from 'lucide-react';
import { FarmerDataUpload, F100Phase, AIChatMessage } from '@/types/specialist';
import { formatFileSize } from '@/lib/formatters';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, UserProfile } from '@/hooks/useAuth';
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
  onFullScreenChange?: (isFullScreen: boolean) => void;
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
  onClose,
  onFullScreenChange
}) => {
  const { profile } = useAuth();
  const userProfile = profile as UserProfile | null;
  
  // Layout state
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(350);
  const [isMobile, setIsMobile] = useState(false);
  const [showDataPanel, setShowDataPanel] = useState(false); // Hidden by default on mobile
  
  // Data state
  const [attachedUploads, setAttachedUploads] = useState<FarmerDataUpload[]>(uploads);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);
  
  // Chat state
  const [chatHistory, setChatHistory] = useState<ChatBubble[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingImages, setAnalyzingImages] = useState<Set<string>>(new Set());
  
  // Message interaction state
  const [messageRatings, setMessageRatings] = useState<Record<number, 'like' | 'dislike'>>({});
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  
  // Typing animation state
  const [typedPlaceholder, setTypedPlaceholder] = useState('');
  const [currentLoadingState, setCurrentLoadingState] = useState('');
  
  // Session management
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  
  // File viewer state
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileViewerFiles, setFileViewerFiles] = useState<any[]>([]);
  const [fileViewerInitialIndex, setFileViewerInitialIndex] = useState(0);
  const [fileViewerSectionName, setFileViewerSectionName] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeRef = useRef<{ isResizing: boolean; startX: number; startWidth: number }>({
    isResizing: false,
    startX: 0,
    startWidth: 0
  });

  // Auto-adjust textarea height based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height based on content, with max height constraints
      const maxHeight = isMobile ? 100 : 120;
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [isMobile]);

  // Adjust textarea height when message changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [currentMessage, adjustTextareaHeight]);

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

  // Typing animation for placeholder
  useEffect(() => {
    const placeholderTexts = isMobile 
      ? ["Ask about crops, soil, costs..."] 
      : ["Ask about crop health, soil analysis, cost efficiency, or any agricultural insights..."];
    
    const fullText = placeholderTexts[0];
    let currentIndex = 0;
    
    // Reset and start typing animation
    setTypedPlaceholder('');
    
    const typingInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setTypedPlaceholder(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, 50); // 50ms per character for smooth typing effect
    
    return () => clearInterval(typingInterval);
  }, [isMobile]);

  // Dynamic loading states with cursor effect
  useEffect(() => {
    if (!isAnalyzing) {
      setCurrentLoadingState('');
      return;
    }

    const loadingStates = [
      'Preparing',
      'Thinking',
      'Analyzing',
      'Processing',
      'Evaluating',
      'Computing',
      'Examining'
    ];
    
    // Pick a random state
    const randomState = loadingStates[Math.floor(Math.random() * loadingStates.length)];
    setCurrentLoadingState(randomState);
    
    // Change state every 4 seconds for better readability
    const stateInterval = setInterval(() => {
      const newState = loadingStates[Math.floor(Math.random() * loadingStates.length)];
      setCurrentLoadingState(newState);
    }, 4000);
    
    return () => clearInterval(stateInterval);
  }, [isAnalyzing]);

  // Notify parent of full-screen state changes
  useEffect(() => {
    onFullScreenChange?.(isFullScreen);
  }, [isFullScreen, onFullScreenChange]);

  // Toggle full-screen mode
  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => !prev);
  }, []);

  // Initialize session
  const ensureSession = useCallback(async () => {
    if (!userProfile?.user_id) return null;
    
    try {
      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .select('id')
        .eq('farmer_id', farmerId)
        .eq('specialist_id', userProfile.user_id)
        .eq('assignment_id', assignmentId)
        .maybeSingle();

      if (data) {
        return data.id;
      }

      const { data: newSession, error: createError } = await supabase
        .from('ai_chat_sessions')
        .insert({
          farmer_id: farmerId,
          specialist_id: userProfile.user_id,
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
  }, [userProfile?.user_id, farmerId, assignmentId, phase]);

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
      if (!userProfile?.user_id) return;
      
      const session = await ensureSession();
      if (session) {
        setSessionId(session);
        await loadChatHistory(session);
      }
      setInitializing(false);
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.user_id, farmerId, assignmentId, phase]);

  // Sync uploads
  useEffect(() => {
    setAttachedUploads(uploads);
  }, [uploads]);

  // Update message count when chat history changes
  useEffect(() => {
    if (onMessageCountUpdate) {
      onMessageCountUpdate(chatHistory.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistory.length]);

  // Handle file removal
  const handleRemoveUpload = useCallback((uploadId: string) => {
    setAttachedUploads(prev => {
      const filtered = prev.filter(u => u.id !== uploadId);
      onContextChange?.(filtered);
      return filtered;
    });
  }, [onContextChange]);

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

  // Handle message rating (like/dislike)
  const handleRateMessage = useCallback(async (messageIndex: number, rating: 'like' | 'dislike') => {
    setMessageRatings(prev => {
      const current = prev[messageIndex];
      // If clicking the same rating, remove it (toggle off)
      if (current === rating) {
        const { [messageIndex]: _, ...rest } = prev;
        return rest;
      }
      // Otherwise, set the new rating
      return { ...prev, [messageIndex]: rating };
    });

    const message = chatHistory[messageIndex];
    if (message && message.role === 'assistant') {
      try {
        // Get the message ID from the database
        // In a production system, you'd store message IDs in your ChatBubble interface
        // For now, we'll use the RPC function to record feedback
        
        const { data, error } = await supabase.rpc('record_ai_feedback', {
          p_message_id: (message as any).id || null, // Add message ID to ChatBubble interface
          p_rating: rating,
          p_feedback_comment: null,
          p_feedback_tags: []
        });

        if (error) {
          console.error('Failed to record feedback:', error);
          // Continue anyway to show UI feedback
        } else {
          console.log(`📊 Feedback recorded in database:`, { rating, feedbackId: data });
        }
      } catch (error) {
        console.error('Error recording feedback:', error);
      }
      
      // Show feedback toast
      toast({
        title: rating === 'like' ? '👍 Feedback Received' : '👎 Feedback Received',
        description: rating === 'like' 
          ? 'Thank you! This helps improve AI responses.' 
          : 'Thank you for the feedback. We\'ll work to improve.',
        duration: 2000
      });
    }
  }, [chatHistory]);

  // Handle copy message to clipboard
  const handleCopyMessage = useCallback(async (messageIndex: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(messageIndex);
      
      toast({
        title: '✓ Copied to clipboard',
        description: 'Message copied successfully',
        duration: 2000
      });

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedMessageIndex(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy message to clipboard',
        variant: 'destructive',
        duration: 2000
      });
    }
  }, []);

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
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Initializing TelAgri Co-Pilot...
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`bg-card border rounded-lg shadow-lg flex flex-col transition-all duration-300 ${
        isFullScreen 
          ? 'fixed inset-0 z-[100] rounded-none' 
          : isMaximized 
            ? 'fixed inset-2 md:inset-4 z-50' 
            : 'h-[calc(100vh-180px)] md:h-[calc(100vh-120px)]'
      }`}
      style={isFullScreen ? { height: '100dvh' } : undefined}
    >
      {/* Enhanced Header with Professional Design */}
      <div className="flex items-center justify-between p-3 md:p-4 border-b bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
              <Brain className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
            </div>
            {/* Hide title on mobile to save space */}
            <div className="min-w-0 hidden md:block">
              <h2 className="font-semibold text-sm md:text-base text-heading-secondary">TelAgri Co-Pilot</h2>
              <p className="text-xs md:text-sm text-body-secondary truncate">ID: {farmerIdNumber} | {crop}</p>
            </div>
          </div>
          {!isMobile && (
            <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary hidden sm:flex">
              <Sparkles className="h-3 w-3 mr-1" />
              AI-Powered Analysis
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1 md:gap-2">
          {/* File explorer toggle - always visible on mobile (including full-screen) */}
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDataPanel(!showDataPanel)}
              className="text-muted-foreground hover:text-foreground"
              title={showDataPanel ? "Hide files" : "Show files"}
            >
              <Database className="h-4 w-4" />
              <span className="text-xs font-medium ml-1">Files</span>
              {attachedUploads.length > 0 && (
                <span className="ml-1 text-xs">({attachedUploads.length})</span>
              )}
            </Button>
          )}
          {/* Full-screen toggle on mobile */}
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullScreen}
              className="text-muted-foreground hover:text-foreground"
              title={isFullScreen ? "Exit full screen" : "Enter full screen"}
            >
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}
          {/* Desktop maximize/minimize */}
          {!isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMaximized(!isMaximized)}
              className="text-muted-foreground hover:text-foreground"
            >
              {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}
          {/* Close button - only show when not in full-screen */}
          {onClose && !isFullScreen && (
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
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Panel - Data & Context (Desktop: sidebar, Mobile: slide-over) */}
        {(!isMobile || showDataPanel) && (
          <div 
            className={`
              ${isMobile 
                ? 'absolute inset-0 z-10 bg-card/95 backdrop-blur-sm' 
                : 'border-r bg-muted/30'
              } 
              transition-all duration-300 flex flex-col
            `}
            style={{ 
              width: isMobile ? '100%' : leftPanelWidth,
              height: isMobile ? '100%' : 'auto'
            }}
            data-tour="copilot-sidebar"
          >
          <div className="p-4 border-b bg-card/50 flex items-center justify-between">
            <h3 className="font-medium text-heading-tertiary flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Data & Context
            </h3>
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDataPanel(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <ScrollArea className="flex-1">
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
                    onClick={() => setCurrentMessage(AnalysisPrompts.costEfficiency({ farmerId, farmerIdNumber, crop, phase }).replace('Context Data:', '').trim())}
                    className="justify-start text-xs h-8"
                  >
                    💰 Cost efficiency
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
        )}

        {/* Resize Handle */}
        {!isMobile && (
          <div
            className="w-1 bg-gray-200 hover:bg-blue-300 cursor-col-resize transition-colors"
            onMouseDown={handleMouseDown}
          />
        )}

        {/* Main Chat Interface - Optimized for Readability */}
        <div className="flex-1 flex flex-col bg-ai-surface transition-all duration-300 overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b bg-ai-surface-elevated flex-shrink-0">
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
          
          {/* Chat History - Enhanced for Long-form Reading with Independent Scrolling */}
          <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-ai-surface overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
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
                      onClick={() => setCurrentMessage("Evaluate cost efficiency and ROI opportunities across inputs, water/energy, labor, and logistics")}
                      className="text-xs"
                    >
                      💰 Cost efficiency
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
                      className={`max-w-[90%] md:max-w-[85%] rounded-xl px-3 py-3 md:px-5 md:py-4 shadow-sm transition-all duration-200 ${
                        message.role === 'user'
                          ? 'bg-ai-user-message text-white'
                          : 'bg-ai-assistant-message border'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <>
                          <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert
                            prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-6 prose-headings:mb-4 first:prose-headings:mt-0
                            prose-h1:text-xl md:prose-h1:text-2xl prose-h1:font-bold prose-h1:border-b prose-h1:pb-2 prose-h1:mb-4
                            prose-h2:text-lg md:prose-h2:text-xl prose-h2:font-semibold
                            prose-h3:text-base md:prose-h3:text-lg prose-h3:font-semibold
                            prose-h4:text-base prose-h4:font-medium
                            prose-p:text-foreground prose-p:leading-relaxed prose-p:mb-4 prose-p:text-sm md:prose-p:text-base
                            prose-strong:text-foreground prose-strong:font-bold
                            prose-em:text-foreground prose-em:italic
                            prose-ul:my-4 prose-ul:space-y-2
                            prose-ol:my-4 prose-ol:space-y-2
                            prose-li:text-foreground prose-li:leading-relaxed prose-li:text-sm md:prose-li:text-base prose-li:my-1
                            prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs md:prose-code:text-sm prose-code:font-mono prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
                            prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:text-foreground prose-pre:text-xs md:prose-pre:text-sm prose-pre:p-4 prose-pre:rounded-lg prose-pre:my-4 prose-pre:overflow-x-auto
                            prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-muted/50 prose-blockquote:text-muted-foreground prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:my-4 prose-blockquote:italic prose-blockquote:not-italic
                            prose-a:text-primary prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-primary/80 prose-a:font-medium prose-a:transition-colors
                            prose-table:w-full prose-table:border-collapse prose-table:my-4
                            prose-thead:border-b prose-thead:border-border
                            prose-th:text-left prose-th:font-semibold prose-th:text-foreground prose-th:px-3 prose-th:py-2 prose-th:bg-muted/50
                            prose-td:text-foreground prose-td:px-3 prose-td:py-2 prose-td:border-b prose-td:border-border
                            prose-tr:border-b prose-tr:border-border last:prose-tr:border-0
                            prose-img:rounded-lg prose-img:my-4 prose-img:shadow-sm">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({children}) => (
                                  <h1 className="text-xl md:text-2xl font-bold border-b border-border pb-2 mb-4 mt-6 first:mt-0">
                                    {children}
                                  </h1>
                                ),
                                h2: ({children}) => (
                                  <h2 className="text-lg md:text-xl font-semibold mb-3 mt-6 first:mt-0">
                                    {children}
                                  </h2>
                                ),
                                h3: ({children}) => (
                                  <h3 className="text-base md:text-lg font-semibold mb-3 mt-5 first:mt-0">
                                    {children}
                                  </h3>
                                ),
                                h4: ({children}) => (
                                  <h4 className="text-base font-medium mb-2 mt-4 first:mt-0">
                                    {children}
                                  </h4>
                                ),
                                p: ({children}) => (
                                  <p className="mb-4 leading-relaxed text-sm md:text-base text-foreground">
                                    {children}
                                  </p>
                                ),
                                ul: ({children}) => (
                                  <ul className="list-disc pl-6 my-4 space-y-2 text-foreground">
                                    {children}
                                  </ul>
                                ),
                                ol: ({children}) => (
                                  <ol className="list-decimal pl-6 my-4 space-y-2 text-foreground">
                                    {children}
                                  </ol>
                                ),
                                li: ({children}) => (
                                  <li className="leading-relaxed text-sm md:text-base my-1">
                                    {children}
                                  </li>
                                ),
                                strong: ({children}) => (
                                  <strong className="font-bold text-foreground">
                                    {children}
                                  </strong>
                                ),
                                em: ({children}) => (
                                  <em className="italic text-foreground">
                                    {children}
                                  </em>
                                ),
                                code: ({node, className, children, ...props}) => {
                                  const isInline = !className;
                                  if (isInline) {
                                    return (
                                      <code className="bg-muted text-primary px-1.5 py-0.5 rounded text-xs md:text-sm font-mono border border-border/50">
                                        {children}
                                      </code>
                                    );
                                  }
                                  return <code className={className} {...props}>{children}</code>;
                                },
                                pre: ({children}) => (
                                  <pre className="bg-muted border border-border rounded-lg p-4 my-4 overflow-x-auto text-xs md:text-sm">
                                    {children}
                                  </pre>
                                ),
                                blockquote: ({children}) => (
                                  <blockquote className="border-l-4 border-primary bg-muted/50 pl-4 py-2 my-4 italic text-muted-foreground">
                                    {children}
                                  </blockquote>
                                ),
                                table: ({children}) => (
                                  <div className="overflow-x-auto my-4">
                                    <table className="w-full border-collapse border border-border rounded-lg">
                                      {children}
                                    </table>
                                  </div>
                                ),
                                thead: ({children}) => (
                                  <thead className="bg-muted/50 border-b border-border">
                                    {children}
                                  </thead>
                                ),
                                tbody: ({children}) => (
                                  <tbody className="divide-y divide-border">
                                    {children}
                                  </tbody>
                                ),
                                tr: ({children}) => (
                                  <tr className="border-b border-border last:border-0">
                                    {children}
                                  </tr>
                                ),
                                th: ({children}) => (
                                  <th className="text-left font-semibold px-3 py-2 text-foreground text-sm">
                                    {children}
                                  </th>
                                ),
                                td: ({children}) => (
                                  <td className="px-3 py-2 text-foreground text-sm">
                                    {children}
                                  </td>
                                ),
                                a: ({href, children}) => (
                                  <a 
                                    href={href} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium transition-colors"
                                  >
                                    {children}
                                  </a>
                                ),
                                hr: () => (
                                  <hr className="my-6 border-t border-border" />
                                )
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>

                          {/* Action Buttons - Like, Dislike, Copy */}
                          <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border/50">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRateMessage(index, 'like')}
                              className={`h-7 px-2 text-xs transition-all ${
                                messageRatings[index] === 'like'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                                  : 'text-muted-foreground hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                              }`}
                              title="Like this response"
                            >
                              <ThumbsUp className={`h-3.5 w-3.5 ${messageRatings[index] === 'like' ? 'fill-current' : ''}`} />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRateMessage(index, 'dislike')}
                              className={`h-7 px-2 text-xs transition-all ${
                                messageRatings[index] === 'dislike'
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                                  : 'text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                              }`}
                              title="Dislike this response"
                            >
                              <ThumbsDown className={`h-3.5 w-3.5 ${messageRatings[index] === 'dislike' ? 'fill-current' : ''}`} />
                            </Button>

                            <div className="w-px h-4 bg-border mx-1" />

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyMessage(index, message.content)}
                              className={`h-7 px-2 text-xs transition-all ${
                                copiedMessageIndex === index
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
                              }`}
                              title="Copy to clipboard"
                            >
                              {copiedMessageIndex === index ? (
                                <>
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  <span className="hidden sm:inline">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5 sm:mr-1" />
                                  <span className="hidden sm:inline">Copy</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed font-medium text-white">
                          {message.content}
                        </div>
                      )}
                      {message.timestamp && (
                        <div className={`text-xs mt-2 ${
                          message.role === 'user' ? 'text-white/70' : 'text-muted-foreground'
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
                  <div className="bg-muted border border-border rounded-lg px-4 py-3 transition-colors">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm inline-flex items-center">
                        {currentLoadingState.split('').map((char, index) => (
                          <span
                            key={index}
                            className="animate-pulse"
                            style={{
                              animationDelay: `${index * 0.1}s`,
                              animationDuration: '1.5s'
                            }}
                          >
                            {char}
                          </span>
                        ))}
                        {['.', '.', '.'].map((dot, index) => (
                          <span
                            key={`dot-${index}`}
                            className="animate-pulse"
                            style={{
                              animationDelay: `${(currentLoadingState.length * 0.1) + (index * 0.3)}s`,
                              animationDuration: '1.5s'
                            }}
                          >
                            {dot}
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Chat Input - Fixed at Bottom, Always Accessible */}
          <div className="flex-shrink-0 p-3 md:p-4 border-t bg-ai-surface-elevated">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-2 md:gap-3 items-end">
                <Textarea
                  ref={textareaRef}
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder={typedPlaceholder}
                  className="flex-1 min-h-[44px] md:min-h-[48px] max-h-[100px] md:max-h-[120px] resize-none text-sm md:text-base bg-card border-input focus:border-primary focus:ring-1 focus:ring-primary/20 ai-text-primary placeholder:text-ai-text-muted rounded-lg overflow-y-auto"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  rows={1}
                  style={{ height: 'auto' }}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!currentMessage.trim() || isAnalyzing}
                  className="h-11 w-11 md:h-12 md:w-12 p-0 rounded-lg bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground flex-shrink-0 touch-manipulation"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
