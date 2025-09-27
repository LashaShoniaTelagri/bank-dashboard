import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Brain,
  FileText,
  Upload,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Calendar,
  FileDown
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "../components/ui/use-toast";
import {
  SpecialistAssignmentWithData,
  F100Phase,
  AnalysisStatus,
  getPhaseLabel,
  FarmerDataUpload
} from "../types/specialist";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import AIAnalysisChat from "../components/AIAnalysisChat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { formatFileSize } from "../lib/formatters";

interface AIChatContext {
  farmerId: string;
  farmerName: string;
  phase: F100Phase;
  phaseLabel: string;
  assignmentId: string;
  uploads: FarmerDataUpload[];
}

export const SpecialistDashboard = () => {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("assignments");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<AnalysisStatus | "all">("all");
  const [phaseFilter, setPhaseFilter] = useState<F100Phase | "all">("all");
  const [assignmentUploads, setAssignmentUploads] = useState<Record<string, FarmerDataUpload[]>>({});
  const [chatContextUploads, setChatContextUploads] = useState<Record<string, FarmerDataUpload[]>>({});
  const [aiChatContext, setAiChatContext] = useState<AIChatContext | null>(null);

  const {
    data: assignments = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ["specialist-assignments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_specialist_assignments");
      if (error) throw error;
      return data as SpecialistAssignmentWithData[];
    },
    enabled: !!user?.id
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Error loading assignments",
        description: error.message,
        variant: "destructive"
      });
    }
  }, [error]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      const matchesSearch =
        assignment.farmer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.farmer_id_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.bank_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || assignment.status === statusFilter;
      const matchesPhase = phaseFilter === "all" || assignment.phase === phaseFilter;

      return matchesSearch && matchesStatus && matchesPhase;
    });
  }, [assignments, searchTerm, statusFilter, phaseFilter]);

  const handleUploadsLoaded = useCallback(
    (assignmentId: string, uploads: FarmerDataUpload[]) => {
      setAssignmentUploads((prev) => {
        const current = prev[assignmentId];
        if (uploadsEqual(current, uploads)) {
          return prev;
        }
        return { ...prev, [assignmentId]: uploads };
      });

      setChatContextUploads((prev) => {
        if (prev[assignmentId]) {
          return prev;
        }
        return { ...prev, [assignmentId]: uploads };
      });
    },
    []
  );

  useEffect(() => {
    if (!aiChatContext) return;
    const latestUploads = assignmentUploads[aiChatContext.assignmentId] ?? [];
    const hasChanged =
      latestUploads.length !== aiChatContext.uploads.length ||
      latestUploads.some(
        (upload, idx) =>
          upload.id !== aiChatContext.uploads[idx]?.id ||
          upload.updated_at !== aiChatContext.uploads[idx]?.updated_at
      );

    if (hasChanged) {
      setAiChatContext((prev) => (prev ? { ...prev, uploads: latestUploads } : prev));
    }
  }, [assignmentUploads, aiChatContext]);

  const totalAssignments = assignments.length;
  const totalInProgress = useMemo(
    () => assignments.filter((assignment) => assignment.status === "in_progress").length,
    [assignments]
  );
  const totalCompleted = useMemo(
    () => assignments.filter((assignment) => assignment.status === "completed").length,
    [assignments]
  );
  const totalPendingReview = useMemo(
    () => assignments.filter((assignment) => assignment.status === "requires_review").length,
    [assignments]
  );

  const getStatusColor = (status: AnalysisStatus) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "requires_review":
        return "bg-orange-100 text-orange-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPhaseIcon = (phase: F100Phase) => {
    if (phase <= 4) return <FileText className="h-4 w-4" />;
    if (phase <= 8) return <Brain className="h-4 w-4" />;
    if (phase <= 11) return <AlertCircle className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const uploadsEqual = (a: FarmerDataUpload[] = [], b: FarmerDataUpload[] = []) => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    return a.every((item, index) => {
      const other = b[index];
      return other && item.id === other.id && item.updated_at === other.updated_at;
    });
  };

  const handleChatContextChange = useCallback((assignmentId: string, uploads: FarmerDataUpload[]) => {
    setChatContextUploads((prev) => {
      const current = prev[assignmentId];
      if (uploadsEqual(current, uploads)) {
        return prev;
      }
      return { ...prev, [assignmentId]: uploads };
    });

    setAiChatContext((prev) =>
      prev && prev.assignmentId === assignmentId ? { ...prev, uploads } : prev
    );
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Specialist Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back, {user?.email ?? "Specialist"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Brain className="h-8 w-8 text-blue-600" />
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            Agricultural Data Specialist
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Assignments</p>
                <p className="text-2xl font-bold text-gray-900">{totalAssignments}</p>
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
                <p className="text-2xl font-bold text-blue-600">{totalInProgress}</p>
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
                <p className="text-2xl font-bold text-green-600">{totalCompleted}</p>
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
                <p className="text-2xl font-bold text-orange-600">{totalPendingReview}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="assignments">My Assignments</TabsTrigger>
          <TabsTrigger value="library">Data Library</TabsTrigger>
          <TabsTrigger value="chat">AI Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-4">
          {/* Hidden components to preload upload data */}
          <div className="hidden">
            {assignments.map((assignment) => (
              <AssignmentUploads
                key={`preload-${assignment.assignment_id}`}
                assignmentId={assignment.assignment_id}
                farmerId={assignment.farmer_id}
                farmerName={assignment.farmer_name}
                phase={assignment.phase}
                onLoaded={handleUploadsLoaded}
              />
            ))}
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Input
                      placeholder="Search farmers, banks, or ID numbers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Brain className="h-4 w-4" />
                    </div>
                  </div>
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as AnalysisStatus | "all")}
                >
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
                <Select
                  value={phaseFilter === "all" ? "all" : phaseFilter.toString()}
                  onValueChange={(value) =>
                    setPhaseFilter(value === "all" ? "all" : (parseInt(value) as F100Phase))
                  }
                >
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Phases</SelectItem>
                    {(Array.from({ length: 12 }, (_, i) => (i + 1) as F100Phase)).map((phase) => (
                      <SelectItem key={phase} value={phase.toString()}>
                        {getPhaseLabel(phase)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : filteredAssignments.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
                  <p className="text-gray-600">
                    {assignments.length === 0
                      ? "You don't have any assignments yet. Contact your administrator to get started."
                      : "No assignments match your current filters. Try adjusting your search criteria."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredAssignments.map((assignment) => {
                const uploadsForAssignment = assignmentUploads[assignment.assignment_id] ?? [];
                return (
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
                              {assignment.status.replace("_", " ")}
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
                              <p className="font-medium">{getPhaseLabel(assignment.phase)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Upload className="h-4 w-4" />
                              {uploadsForAssignment.length} files
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
                            variant="outline"
                            onClick={async () => {
                              // Force refresh uploads for this assignment if we don't have any
                              let currentUploads = assignmentUploads[assignment.assignment_id] ?? [];
                              
                              if (currentUploads.length === 0) {
                                try {
                                  const { data: uploads } = await supabase
                                    .from('farmer_data_uploads')
                                    .select('*')
                                    .eq('farmer_id', assignment.farmer_id)
                                    .order('created_at', { ascending: false });
                                  
                                  if (uploads) {
                                    currentUploads = uploads;
                                    handleUploadsLoaded(assignment.assignment_id, uploads);
                                  }
                                } catch (error) {
                                  console.error('Failed to fetch uploads:', error);
                                }
                              }

                              const initialUploads =
                                (chatContextUploads[assignment.assignment_id]?.length > 0 
                                  ? chatContextUploads[assignment.assignment_id] 
                                  : currentUploads);

                              setChatContextUploads((prev) => {
                                if (uploadsEqual(prev[assignment.assignment_id], initialUploads)) {
                                  return prev;
                                }
                                return {
                                  ...prev,
                                  [assignment.assignment_id]: initialUploads,
                                };
                              });

                              setAiChatContext({
                                farmerId: assignment.farmer_id,
                                farmerName: assignment.farmer_name,
                                phase: assignment.phase,
                                phaseLabel: getPhaseLabel(assignment.phase),
                                assignmentId: assignment.assignment_id,
                                uploads: initialUploads
                              });
                              setActiveTab("chat");
                            }}
                          >
                            <Brain className="h-4 w-4 mr-1" />
                            AI Chat
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Data Library
              </CardTitle>
              <CardDescription>
                Review and download admin-uploaded documents that power your analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {assignments.length === 0 ? (
                <div className="text-center text-gray-600 py-8">
                  You do not have any assignments yet. Once admin uploads files for a farmer, they will appear here.
                </div>
              ) : (
                assignments.map((assignment) => (
                  <AssignmentUploads
                    key={assignment.assignment_id}
                    assignmentId={assignment.assignment_id}
                    farmerId={assignment.farmer_id}
                    farmerName={assignment.farmer_name}
                    phase={assignment.phase}
                    onLoaded={handleUploadsLoaded}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          {aiChatContext ? (
            <AIAnalysisChat
              farmerId={aiChatContext.farmerId}
              farmerName={aiChatContext.farmerName}
              phase={aiChatContext.phase}
              phaseLabel={aiChatContext.phaseLabel}
              assignmentId={aiChatContext.assignmentId}
              uploads={chatContextUploads[aiChatContext.assignmentId] ?? []}
              onContextChange={(updatedUploads) =>
                handleChatContextChange(aiChatContext.assignmentId, updatedUploads)
              }
              onClose={() => setAiChatContext(null)}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Analysis Workspace
                </CardTitle>
                <CardDescription>
                  Select an assignment above to open the AI analysis chat with the relevant farmer data.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface AssignmentUploadsProps {
  assignmentId: string;
  farmerId: string;
  farmerName: string;
  phase: F100Phase;
  onLoaded: (assignmentId: string, uploads: FarmerDataUpload[]) => void;
}

const AssignmentUploads: React.FC<AssignmentUploadsProps> = ({
  assignmentId,
  farmerId,
  farmerName,
  phase,
  onLoaded
}) => {
  const phaseLabel = getPhaseLabel(phase);

  const {
    data: uploads = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ["assignment-uploads", assignmentId, farmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farmer_data_uploads")
        .select("id, file_name, data_type, file_size_bytes, created_at, phase, file_path, description, tags, metadata, updated_at")
        .eq("farmer_id", farmerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FarmerDataUpload[];
    }
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Unable to load uploads",
        description: error.message,
        variant: "destructive"
      });
    }
  }, [error]);

  useEffect(() => {
    onLoaded(assignmentId, uploads);
  }, [assignmentId, uploads, onLoaded]);

  const handleDownload = useCallback(async (upload: FarmerDataUpload) => {
    const { data, error } = await supabase.storage
      .from("farmer-documents")
      .createSignedUrl(upload.file_path, 3600);

    if (error) {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{farmerName}</h3>
          <p className="text-xs text-gray-500">{phaseLabel}</p>
        </div>
        <Badge variant="secondary">{uploads.length} files</Badge>
      </div>
      {isLoading ? (
        <div className="text-sm text-gray-500">Loading files...</div>
      ) : uploads.length === 0 ? (
        <div className="text-sm text-gray-500">No uploads available for this assignment yet.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploads.map((upload) => (
                <TableRow key={upload.id}>
                  <TableCell className="font-medium break-all">{upload.file_name}</TableCell>
                  <TableCell className="capitalize">{upload.data_type}</TableCell>
                  <TableCell>{getPhaseLabel(upload.phase)}</TableCell>
                  <TableCell>{formatFileSize(upload.file_size_bytes)}</TableCell>
                  <TableCell>{new Date(upload.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(upload)}>
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};