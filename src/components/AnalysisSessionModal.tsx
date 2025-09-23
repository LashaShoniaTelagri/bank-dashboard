import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { 
  Brain, 
  FileText, 
  Upload, 
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  Eye,
  Trash2,
  Plus,
  X,
  Settings,
  Key
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "./ui/use-toast";
import { AnalysisSessionForm, AnalysisResult, FarmerDataUpload, LLMProvider } from "../types/specialist";
import { llmService, AnalysisPrompts } from "../lib/llm-service";
import { ANALYSIS_PHASES, LLM_PROVIDERS } from "../types/specialist";

interface AnalysisSessionModalProps {
  farmerId: string;
  farmerName: string;
  phase: string;
  assignmentId?: string;
  onAnalysisComplete?: () => void;
}

export const AnalysisSessionModal: React.FC<AnalysisSessionModalProps> = ({
  farmerId,
  farmerName,
  phase,
  assignmentId,
  onAnalysisComplete
}) => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [sessionData, setSessionData] = useState<AnalysisSessionForm>({
    farmer_id: farmerId,
    phase: phase as any,
    session_name: '',
    analysis_prompt: '',
    context_data: {},
    attachments: []
  });
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('openai');

  const queryClient = useQueryClient();

  // Fetch available data uploads for this farmer and phase
  const { data: dataUploads = [], isLoading: uploadsLoading } = useQuery({
    queryKey: ['farmer-data-uploads', farmerId, phase],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farmer_data_uploads')
        .select('*')
        .eq('farmer_id', farmerId)
        .eq('phase', phase)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FarmerDataUpload[];
    },
    enabled: !!farmerId && !!phase,
  });

  // Fetch existing analysis sessions
  const { data: existingSessions = [] } = useQuery({
    queryKey: ['analysis-sessions', farmerId, phase],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analysis_sessions')
        .select('*')
        .eq('farmer_id', farmerId)
        .eq('phase', phase)
        .eq('specialist_id', profile?.user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!farmerId && !!phase && !!profile?.user_id,
  });

  // Create analysis session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: AnalysisSessionForm) => {
      const { data, error } = await supabase
        .from('analysis_sessions')
        .insert({
          farmer_id: sessionData.farmer_id,
          bank_id: profile?.bank_id || '',
          specialist_id: profile?.user_id || '',
          phase: sessionData.phase,
          session_name: sessionData.session_name,
          context_data: sessionData.context_data,
          analysis_prompt: sessionData.analysis_prompt,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Create attachments if any
      if (selectedAttachments.length > 0) {
        const attachmentInserts = selectedAttachments.map(uploadId => ({
          session_id: data.id,
          data_upload_id: uploadId
        }));

        const { error: attachmentError } = await supabase
          .from('analysis_attachments')
          .insert(attachmentInserts);

        if (attachmentError) {
          console.warn('Failed to create attachments:', attachmentError);
        }
      }

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Analysis session created",
        description: `Session "${data.session_name}" created successfully`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['analysis-sessions', farmerId, phase] });
      onAnalysisComplete?.();
    },
    onError: (error) => {
      console.error('Session creation error:', error);
      toast({
        title: "Failed to create session",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update session with analysis result
  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, result }: { sessionId: string; result: AnalysisResult }) => {
      const { error } = await supabase
        .from('analysis_sessions')
        .update({
          llm_response: result.success ? result.data?.analysis : null,
          llm_model: result.success ? result.data?.model_used : null,
          llm_usage: result.success ? result.data : null,
          status: result.success ? 'completed' : 'requires_review'
        })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis-sessions', farmerId, phase] });
    }
  });

  // Handle analysis execution
  const handleAnalyze = async () => {
    if (!sessionData.analysis_prompt.trim()) {
      toast({
        title: "No prompt provided",
        description: "Please enter an analysis prompt",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Prepare context data
      const contextData = {
        ...sessionData.context_data,
        farmer_id: farmerId,
        farmer_name: farmerName,
        phase: phase,
        attachments: selectedAttachments.map(id => {
          const upload = dataUploads.find(u => u.id === id);
          return upload ? {
            id: upload.id,
            type: upload.data_type,
            name: upload.file_name,
            description: upload.description,
            tags: upload.tags
          } : null;
        }).filter(Boolean)
      };

      // Execute analysis
      const result = await llmService.analyzeData(
        sessionData.analysis_prompt,
        contextData,
        selectedProvider
      );

      setAnalysisResult(result);

      if (result.success) {
        toast({
          title: "Analysis completed",
          description: "AI analysis completed successfully",
        });
      } else {
        toast({
          title: "Analysis failed",
          description: result.error?.message || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis error",
        description: "An unexpected error occurred during analysis",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle session creation
  const handleCreateSession = async () => {
    if (!sessionData.session_name.trim()) {
      toast({
        title: "Session name required",
        description: "Please enter a session name",
        variant: "destructive",
      });
      return;
    }

    if (!analysisResult) {
      toast({
        title: "No analysis to save",
        description: "Please run an analysis first",
        variant: "destructive",
      });
      return;
    }

    createSessionMutation.mutate(sessionData);
  };

  // Handle attachment selection
  const handleAttachmentToggle = (uploadId: string) => {
    setSelectedAttachments(prev => 
      prev.includes(uploadId)
        ? prev.filter(id => id !== uploadId)
        : [...prev, uploadId]
    );
  };

  // Get data type icon
  const getDataTypeIcon = (type: string) => {
    switch (type) {
      case 'photo':
        return <Eye className="h-4 w-4" />;
      case 'analysis':
        return <FileText className="h-4 w-4" />;
      case 'geospatial':
        return <FileText className="h-4 w-4" />;
      case 'text':
        return <FileText className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'video':
        return <Eye className="h-4 w-4" />;
      case 'audio':
        return <Eye className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Get suggested prompts based on phase
  const getSuggestedPrompts = () => {
    const phaseData = ANALYSIS_PHASES[phase as keyof typeof ANALYSIS_PHASES];
    if (!phaseData) return [];

    switch (phase) {
      case 'crop_analysis':
        return [
          'Analyze crop health and identify any diseases or pests',
          'Assess crop growth stage and predict yield potential',
          'Provide recommendations for crop management improvements'
        ];
      case 'soil_analysis':
        return [
          'Analyze soil composition and nutrient levels',
          'Assess soil health and provide fertilization recommendations',
          'Evaluate soil drainage and water retention capacity'
        ];
      case 'irrigation_analysis':
        return [
          'Analyze irrigation system efficiency and water usage',
          'Assess water quality and provide optimization recommendations',
          'Evaluate seasonal water requirements and scheduling'
        ];
      case 'financial_analysis':
        return [
          'Analyze financial projections and risk factors',
          'Assess loan repayment capacity and market conditions',
          'Provide recommendations for financial risk mitigation'
        ];
      default:
        return [
          'Provide a comprehensive analysis of the provided data',
          'Identify key insights and actionable recommendations',
          'Assess potential risks and opportunities'
        ];
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Brain className="h-4 w-4 mr-2" />
          Start Analysis
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Analysis Session - {farmerName}</DialogTitle>
          <DialogDescription>
            {ANALYSIS_PHASES[phase as keyof typeof ANALYSIS_PHASES]?.name || phase} Analysis
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="analysis" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="data">Data Files</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-4">
            {/* Session Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Session Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="session-name">Session Name</Label>
                    <Input
                      id="session-name"
                      placeholder="Enter session name..."
                      value={sessionData.session_name}
                      onChange={(e) => setSessionData(prev => ({ ...prev, session_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider">AI Provider</Label>
                    <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as LLMProvider)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LLM_PROVIDERS).map(([key, provider]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Key className="h-4 w-4" />
                              {provider.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Analysis Prompt */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Analysis Prompt</CardTitle>
                <CardDescription>
                  Describe what you want the AI to analyze
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Suggested Prompts</Label>
                  <div className="flex flex-wrap gap-2">
                    {getSuggestedPrompts().map((prompt, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => setSessionData(prev => ({ ...prev, analysis_prompt: prompt }))}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
                <Textarea
                  placeholder="Enter your analysis prompt..."
                  value={sessionData.analysis_prompt}
                  onChange={(e) => setSessionData(prev => ({ ...prev, analysis_prompt: e.target.value }))}
                  rows={4}
                />
              </CardContent>
            </Card>

            {/* Analysis Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !sessionData.analysis_prompt.trim()}
                className="flex-1"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Run Analysis
                  </>
                )}
              </Button>
              {analysisResult && (
                <Button
                  onClick={handleCreateSession}
                  disabled={createSessionMutation.isPending || !sessionData.session_name.trim()}
                  variant="outline"
                >
                  {createSessionMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Save Session
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Analysis Results */}
            {analysisResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    {analysisResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    Analysis Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysisResult.success ? (
                    <div className="space-y-4">
                      <div className="prose max-w-none">
                        <h4>Analysis</h4>
                        <p className="whitespace-pre-wrap">{analysisResult.data?.analysis}</p>
                      </div>
                      
                      {analysisResult.data?.recommendations && analysisResult.data.recommendations.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">Recommendations</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {analysisResult.data.recommendations.map((rec, index) => (
                              <li key={index} className="text-sm">{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Model: {analysisResult.data?.model_used}</span>
                        <span>Confidence: {Math.round((analysisResult.data?.confidence_score || 0) * 100)}%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-red-600">
                      <p className="font-semibold">Analysis Failed</p>
                      <p className="text-sm">{analysisResult.error?.message}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Available Data Files</CardTitle>
                <CardDescription>
                  Select files to include in your analysis context
                </CardDescription>
              </CardHeader>
              <CardContent>
                {uploadsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : dataUploads.length === 0 ? (
                  <div className="text-center py-8">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No data files available for this phase</p>
                    <p className="text-sm text-gray-500">Upload data files to enable analysis</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dataUploads.map((upload) => (
                      <div
                        key={upload.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedAttachments.includes(upload.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleAttachmentToggle(upload.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              selectedAttachments.includes(upload.id)
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300'
                            }`}>
                              {selectedAttachments.includes(upload.id) && (
                                <CheckCircle className="h-3 w-3 text-white" />
                              )}
                            </div>
                            {getDataTypeIcon(upload.data_type)}
                            <div>
                              <p className="font-medium text-sm">{upload.file_name}</p>
                              <p className="text-xs text-gray-500">
                                {upload.data_type} • {(upload.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                              </p>
                              {upload.description && (
                                <p className="text-xs text-gray-600 mt-1">{upload.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {upload.tags.length > 0 && (
                              <div className="flex gap-1">
                                {upload.tags.slice(0, 2).map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {upload.tags.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{upload.tags.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Analysis History</CardTitle>
                <CardDescription>
                  Previous analysis sessions for this farmer and phase
                </CardDescription>
              </CardHeader>
              <CardContent>
                {existingSessions.length === 0 ? (
                  <div className="text-center py-8">
                    <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No previous analysis sessions</p>
                    <p className="text-sm text-gray-500">Start your first analysis above</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {existingSessions.map((session) => (
                      <div key={session.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{session.session_name}</h4>
                          <Badge variant="outline">
                            {session.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{session.analysis_prompt}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Created: {new Date(session.created_at).toLocaleDateString()}</span>
                          {session.llm_model && <span>Model: {session.llm_model}</span>}
                        </div>
                        {session.llm_response && (
                          <div className="mt-3">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View Results
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};