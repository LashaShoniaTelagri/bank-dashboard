import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { 
  Brain, 
  FileText, 
  MessageSquare, 
  Upload, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Users,
  MapPin,
  Calendar,
  Filter,
  Search
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "../components/ui/use-toast";
import { SpecialistAssignmentWithData, AnalysisPhase, AnalysisStatus } from "../types/specialist";
import { ANALYSIS_PHASES } from "../types/specialist";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { LLMApiKeyModal } from "../components/LLMApiKeyModal";
import { ChatInterface } from "../components/ChatInterface";

export const SpecialistDashboard = () => {
  const { user, profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<AnalysisStatus | "all">("all");
  const [phaseFilter, setPhaseFilter] = useState<AnalysisPhase | "all">("all");
  const [selectedChatFarmer, setSelectedChatFarmer] = useState<{id: string, name: string} | null>(null);

  // Fetch specialist assignments
  const { data: assignments = [], isLoading, error } = useQuery({
    queryKey: ['specialist-assignments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_specialist_assignments', { p_specialist_id: user?.id });

      if (error) throw error;
      return data as SpecialistAssignmentWithData[];
    },
    enabled: !!user?.id,
  });

  // Filter assignments based on search and filters
  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = 
      assignment.farmer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.farmer_id_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.bank_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || assignment.status === statusFilter;
    const matchesPhase = phaseFilter === "all" || assignment.phase === phaseFilter;
    
    return matchesSearch && matchesStatus && matchesPhase;
  });

  // Get status color
  const getStatusColor = (status: AnalysisStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'requires_review':
        return 'bg-orange-100 text-orange-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get phase icon
  const getPhaseIcon = (phase: AnalysisPhase) => {
    switch (phase) {
      case 'initial_assessment':
        return <FileText className="h-4 w-4" />;
      case 'crop_analysis':
        return <BarChart3 className="h-4 w-4" />;
      case 'soil_analysis':
        return <MapPin className="h-4 w-4" />;
      case 'irrigation_analysis':
        return <BarChart3 className="h-4 w-4" />;
      case 'harvest_analysis':
        return <CheckCircle className="h-4 w-4" />;
      case 'financial_analysis':
        return <BarChart3 className="h-4 w-4" />;
      case 'compliance_review':
        return <AlertCircle className="h-4 w-4" />;
      case 'final_report':
        return <FileText className="h-4 w-4" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  if (error) {
    toast({
      title: "Error loading assignments",
      description: "Failed to load your specialist assignments. Please try again.",
      variant: "destructive",
    });
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Specialist Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {profile?.user_id ? user?.email : 'Specialist'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Brain className="h-8 w-8 text-blue-600" />
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            Agricultural Data Specialist
          </Badge>
          <LLMApiKeyModal />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Assignments</p>
                <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">
                  {assignments.filter(a => a.status === 'in_progress').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {assignments.filter(a => a.status === 'completed').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-2xl font-bold text-orange-600">
                  {assignments.filter(a => a.status === 'requires_review').length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="assignments">My Assignments</TabsTrigger>
          <TabsTrigger value="analysis">Analysis Tools</TabsTrigger>
          <TabsTrigger value="chat">Communication</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search farmers, banks, or ID numbers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AnalysisStatus | "all")}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="requires_review">Requires Review</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={phaseFilter} onValueChange={(value) => setPhaseFilter(value as AnalysisPhase | "all")}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Phases</SelectItem>
                    {Object.entries(ANALYSIS_PHASES).map(([key, phase]) => (
                      <SelectItem key={key} value={key}>
                        {phase.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Assignments List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
                  <p className="text-gray-600">
                    {assignments.length === 0 
                      ? "You don't have any assignments yet. Contact your administrator to get started."
                      : "No assignments match your current filters. Try adjusting your search criteria."
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredAssignments.map((assignment) => (
                <Card key={assignment.assignment_id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getPhaseIcon(assignment.phase)}
                          <h3 className="text-lg font-semibold text-gray-900">
                            {assignment.farmer_name}
                          </h3>
                          <Badge className={getStatusColor(assignment.status)}>
                            {assignment.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-600">Farmer ID</p>
                            <p className="font-medium">{assignment.farmer_id_number}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Bank</p>
                            <p className="font-medium">{assignment.bank_name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Phase</p>
                            <p className="font-medium">{ANALYSIS_PHASES[assignment.phase].name}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Upload className="h-4 w-4" />
                            {assignment.data_uploads_count} files
                          </div>
                          <div className="flex items-center gap-1">
                            <Brain className="h-4 w-4" />
                            {assignment.analysis_sessions_count} analyses
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                          </div>
                          {assignment.last_activity && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Last activity {new Date(assignment.last_activity).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={() => {
                            // Navigate to analysis session
                            window.location.href = `/specialist/analysis/${assignment.assignment_id}`;
                          }}
                        >
                          Start Analysis
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedChatFarmer({
                              id: assignment.farmer_id,
                              name: assignment.farmer_name
                            });
                          }}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Chat
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Analysis Tools
              </CardTitle>
              <CardDescription>
                Access advanced AI-powered analysis tools for agricultural data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">Upload Data</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Upload photos, documents, and analysis files for AI processing
                    </p>
                    <Button variant="outline" size="sm">
                      Upload Files
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">AI Analysis</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Generate insights using GPT and other AI models
                    </p>
                    <Button variant="outline" size="sm">
                      Start Analysis
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          {selectedChatFarmer ? (
            <ChatInterface
              farmerId={selectedChatFarmer.id}
              farmerName={selectedChatFarmer.name}
              onClose={() => setSelectedChatFarmer(null)}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Communication Center
                </CardTitle>
                <CardDescription>
                  Chat with farmers, admins, and other specialists
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No active conversations</h3>
                  <p className="text-sm text-gray-600">
                    Start a conversation by selecting an assignment above
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};