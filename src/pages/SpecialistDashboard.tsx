import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { 
  Brain, 
  FileText, 
  Upload, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Users,
  Calendar,
  FileDown,
  Image,
  File,
  FileSpreadsheet,
  Presentation,
  Archive,
  Map,
  Cloud,
  Eye,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  X,
  Play,
  XCircle,
  MoreHorizontal,
  LogOut,
  Menu,
  ChevronLeft,
  Home,
  Database,
  MessageSquare,
  Settings
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "../components/ui/use-toast";
import {
  SpecialistAssignmentWithData,
  F100Phase,
  AnalysisStatus,
  getPhaseLabel,
  FarmerDataUpload,
  getStatusLabel,
  getStatusColor,
  getAllowedStatusTransitions
} from "../types/specialist";
import AIAnalysisChat from "../components/AIAnalysisChat";
import AgriCopilot from "../components/AgriCopilot";
import { F100ModalSpecialist } from "../components/F100ModalSpecialist";
import { ThemeToggle } from "../components/ThemeToggle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { formatFileSize } from "../lib/formatters";
import { FileViewer } from "../components/FileViewer";
import { useProductTour, SPECIALIST_ONBOARDING_TOUR, DATA_LIBRARY_TOUR, AI_COPILOT_TOUR } from "../hooks/useProductTour";

interface AIChatContext {
  farmerId: string;
  farmerIdNumber: string;
  crop: string;
  phase: F100Phase;
  phaseLabel: string;
  assignmentId: string;
  uploads: FarmerDataUpload[];
}

export const SpecialistDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get active tab from URL or default to assignments
  const getActiveTabFromUrl = () => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('tab') || 'assignments';
  };
  
  const [activeTab, setActiveTab] = useState<string>(getActiveTabFromUrl());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<AnalysisStatus | "all">("all");
  const [phaseFilter, setPhaseFilter] = useState<F100Phase | "all">("all");
  const [assignmentUploads, setAssignmentUploads] = useState<Record<string, FarmerDataUpload[]>>({});
  
  // Sidebar navigation state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState<string>(getActiveTabFromUrl() || 'assignments');
  const [isSigningOut, setIsSigningOut] = useState(false);
  
  // Navigation items configuration
  const navigationItems = [
    {
      id: 'assignments',
      label: 'My Assignments',
      icon: Users,
      description: 'View and manage your farmer assignments'
    },
    {
      id: 'library',
      label: 'Data Library',
      icon: Database,
      description: 'Browse uploaded farmer documents'
    },
    {
      id: 'chat',
      label: 'AI Co-Pilot',
      icon: MessageSquare,
      description: 'TelAgri AI-powered agricultural analysis'
    }
  ];
  const [chatContextUploads, setChatContextUploads] = useState<Record<string, FarmerDataUpload[]>>({});
  const [aiChatContext, setAiChatContext] = useState<AIChatContext | null>(null);
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({});

  // Data Library filtering and grouping state
  const [dataLibrarySearchTerm, setDataLibrarySearchTerm] = useState('');
  const [dataLibrarySelectedDataType, setDataLibrarySelectedDataType] = useState<string>('all');
  const [dataLibrarySelectedPhase, setDataLibrarySelectedPhase] = useState<string>('all');
  const [collapsedAssignments, setCollapsedAssignments] = useState<Set<string>>(new Set());

  // Toggle assignment collapse state
  const toggleAssignmentCollapse = useCallback((assignmentId: string) => {
    setCollapsedAssignments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assignmentId)) {
        newSet.delete(assignmentId);
      } else {
        newSet.add(assignmentId);
      }
      return newSet;
    });
  }, []);

  // Product tour functionality
  const { startTour, autoStartTour, hasCompletedTour, resetTour, debugTourElements, fixTourElements } = useProductTour();

  // Update assignment status
  const updateAssignmentStatus = useCallback(async (assignmentId: string, newStatus: AnalysisStatus, notes?: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      // Add completion timestamp if marking as completed
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      // Add notes if provided
      if (notes) {
        updateData.notes = notes;
      }

      const { error } = await supabase
        .from('specialist_assignments')
        .update(updateData)
        .eq('id', assignmentId);

      if (error) {
        console.error('Error updating assignment status:', error);
        toast({
          title: "Error",
          description: "Failed to update assignment status. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Status Updated",
        description: `Assignment status changed to ${getStatusLabel(newStatus)}`,
      });

      // Refresh assignments data
      window.location.reload(); // Simple refresh for now - could be optimized with query invalidation
    } catch (error) {
      console.error('Error updating assignment status:', error);
      toast({
        title: "Error",
        description: "Failed to update assignment status. Please try again.",
        variant: "destructive",
      });
    }
  }, []);

  const {
    data: assignments = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ["specialist-assignments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_specialist_assignments");
      if (error) throw error;
      // Transform data to privacy-compliant format
      return (data as any[]).map(item => ({
        assignment_id: item.assignment_id,
        farmer_id: item.farmer_id,
        farmer_id_number: item.farmer_id_number,
        crop: item.farmer_crop || 'Not specified',
        phase: item.phase,
        status: item.status,
        assigned_at: item.assigned_at,
        data_uploads_count: item.data_uploads_count,
        analysis_sessions_count: item.analysis_sessions_count,
        last_activity: item.last_activity
      })) as SpecialistAssignmentWithData[];
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds - assignments can change frequently
    cacheTime: 2 * 60 * 1000, // 2 minutes cache
    refetchOnWindowFocus: false, // Prevent excessive refetching
    refetchOnMount: true, // Refetch on component mount
    retry: 1, // Reduce retry attempts for failed queries
  });

  useEffect(() => {
    if (error) {
      // Only show toast for actual errors, not for "function not found" when no assignments exist
      if (!error.message?.includes("Could not find the function") && 
          !error.message?.includes("get_specialist_assignments")) {
        toast({
          title: "Error loading assignments",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  }, [error]);

  // Auto-start tour for new users
  useEffect(() => {
    if (!isLoading && assignments.length > 0) {
      console.log('🎯 Checking tour auto-start conditions:', {
        isLoading,
        assignmentsLength: assignments.length,
        hasCompleted: hasCompletedTour()
      });
      autoStartTour(SPECIALIST_ONBOARDING_TOUR);
    }
  }, [isLoading, assignments.length, autoStartTour, hasCompletedTour]);

  // Handle sign out
  const handleSignOut = async () => {
    if (isSigningOut) return; // Prevent multiple clicks
    
    setIsSigningOut(true);
    
    try {
      const { error } = await signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        toast({
          title: "Sign Out Failed",
          description: error.message || "Failed to sign out. Please try again.",
          variant: "destructive"
        });
        setIsSigningOut(false);
        return;
      }
      
      // Clear local storage but preserve tour completion status
      const tourCompleted = localStorage.getItem('telagri-specialist-tour-completed');
      localStorage.clear();
      if (tourCompleted) {
        localStorage.setItem('telagri-specialist-tour-completed', tourCompleted);
      }
      
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      
      // Redirect to login page
      navigate('/', { replace: true });
      
    } catch (error: any) {
      console.error('Unexpected sign out error:', error);
      toast({
        title: "Sign Out Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
      setIsSigningOut(false);
    }
  };

  // Handle tab change with URL update
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setActiveNavItem(tab);
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('tab', tab);
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  };

  // Handle navigation item change
  const handleNavItemChange = (itemId: string) => {
    setActiveNavItem(itemId);
    handleTabChange(itemId);
  };

  // Toggle sidebar collapse
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Handle header click to refresh page with clean URL
  const handleHeaderClick = () => {
    window.location.href = '/specialist/dashboard';
  };

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
    const matchesSearch = 
      assignment.farmer_id_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.crop.toLowerCase().includes(searchTerm.toLowerCase());
    
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
    () => assignments.filter((assignment) => assignment.status === "pending_review").length,
    [assignments]
  );


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

  // Handle message count updates from AI chat
  const handleMessageCountUpdate = useCallback((assignmentId: string, count: number) => {
    setMessageCounts((prev) => ({
      ...prev,
      [assignmentId]: count
    }));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors flex">
      {/* Sidebar Navigation */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-sidebar dark:bg-dark-card border-r border-sidebar-border dark:border-dark-border transition-all duration-300 flex flex-col light-elevated dark:shadow-neon/20 h-screen sticky top-0`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b dark:border-dark-border">
      <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div 
                className="flex items-center gap-3 cursor-pointer hover:bg-sidebar-accent dark:hover:bg-dark-border rounded-lg p-2 -m-2 transition-all duration-200"
                onClick={handleHeaderClick}
                title="Return to start page"
              >
                <Brain className="h-8 w-8 neon-brain" />
        <div>
                  <h2 className="text-lg font-bold text-heading-primary">TelAgri</h2>
                  <p className="text-xs text-body-secondary">Specialist</p>
        </div>
              </div>
            )}
        <div className="flex items-center gap-2">
              {sidebarCollapsed && (
                <div 
                  className="cursor-pointer hover:bg-sidebar-accent dark:hover:bg-dark-border rounded-lg p-2 transition-all duration-200"
                  onClick={handleHeaderClick}
                  title="Return to start page"
                >
                  <Brain className="h-6 w-6 neon-brain" />
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-dark-border"
              >
                {sidebarCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>
        </div>
      </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-2 overflow-y-auto">
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNavItem === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavItemChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary/10 dark:bg-blue-900/20 text-primary dark:text-blue-400 border-r-2 border-primary dark:border-blue-400 light-card-shadow' 
                      : 'text-foreground dark:text-gray-300 hover:bg-muted dark:hover:bg-dark-border hover:light-card-shadow'
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                  data-tour={item.id === 'library' ? 'nav-data-library' : item.id === 'chat' ? 'nav-ai-analysis' : undefined}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
                  {!sidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Footer - Always Visible */}
        <div className="p-2 border-t border-sidebar-border dark:border-dark-border bg-sidebar dark:bg-dark-card flex-shrink-0">
          <div className="space-y-1">
            <button
              onClick={() => startTour(SPECIALIST_ONBOARDING_TOUR)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 text-sidebar-foreground dark:text-gray-300 hover:bg-sidebar-accent dark:hover:bg-dark-border hover:light-card-shadow ${sidebarCollapsed ? 'justify-center' : ''}`}
              title={sidebarCollapsed ? "Start Product Tour" : undefined}
            >
              <span className="text-lg flex-shrink-0">🎯</span>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">Tour</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Start product tour</p>
                </div>
              )}
            </button>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 ${
                isSigningOut 
                  ? 'text-muted-foreground dark:text-gray-600 cursor-not-allowed' 
                  : 'text-sidebar-foreground dark:text-gray-300 hover:bg-sidebar-accent dark:hover:bg-dark-border hover:light-card-shadow'
              } ${sidebarCollapsed ? 'justify-center' : ''}`}
              title={sidebarCollapsed ? (isSigningOut ? "Signing out..." : "Sign Out") : undefined}
            >
              {isSigningOut ? (
                <div className="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300" />
              ) : (
                <LogOut className="h-5 w-5 flex-shrink-0" />
              )}
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{isSigningOut ? "Signing out..." : "Sign Out"}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {isSigningOut ? "Please wait..." : "Exit application"}
          </p>
        </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="border-b bg-white dark:bg-dark-card shadow-sm dark:border-dark-border transition-colors" data-tour="welcome">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl text-heading-primary">Welcome back, Specialist</h1>
                <p className="text-sm text-body-secondary">{user?.email ?? "Specialist"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle variant="icon" size="sm" />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-tour="stats-overview">
        <Card className="dark:bg-dark-card dark:border-dark-border transition-colors hover:shadow-lg dark:hover:shadow-neon/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-body-secondary">Total Assignments</p>
                <p className="text-2xl text-heading-primary">{totalAssignments}</p>
              </div>
              <Users className="h-8 w-8 text-accent-blue" />
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-dark-card dark:border-dark-border transition-colors hover:shadow-lg dark:hover:shadow-neon/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-body-secondary">In Progress</p>
                <p className="text-2xl font-bold text-accent-blue">{totalInProgress}</p>
              </div>
              <Clock className="h-8 w-8 text-accent-blue" />
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-dark-card dark:border-dark-border transition-colors hover:shadow-lg dark:hover:shadow-neon/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-body-secondary">Completed</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalCompleted}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400 transition-colors" />
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-dark-card dark:border-dark-border transition-colors hover:shadow-lg dark:hover:shadow-neon/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-body-secondary">Pending Review</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{totalPendingReview}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-600 dark:text-orange-400 transition-colors" />
            </div>
          </CardContent>
        </Card>
      </div>

            {/* Content based on active navigation item */}

            {activeNavItem === 'assignments' && (
              <div className="space-y-4">
          {/* Hidden components to preload upload data */}
          <div className="hidden">
            {assignments.map((assignment) => (
              <AssignmentUploads
                key={`preload-${assignment.assignment_id}`}
                assignmentId={assignment.assignment_id}
                farmerId={assignment.farmer_id}
                farmerIdNumber={assignment.farmer_id_number}
                crop={assignment.crop}
                phase={assignment.phase}
                onLoaded={handleUploadsLoaded}
              />
            ))}
          </div>

          <Card>
            <CardContent className="p-4" data-tour="search-filters">
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
              <Card className="border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20">
                <CardContent className="p-8 text-center">
                  <Brain className="h-12 w-12 text-rose-500 dark:text-rose-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-rose-900 dark:text-rose-100 mb-2">No assignments found</h3>
                  <p className="text-rose-700 dark:text-rose-300">
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
                  <Card key={assignment.assignment_id} className="hover:shadow-md dark:hover:shadow-neon/20 transition-all dark:bg-dark-card dark:border-dark-border" data-tour={filteredAssignments.indexOf(assignment) === 0 ? "assignment-card" : undefined}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getPhaseIcon(assignment.phase)}
                            <h3 className="text-lg text-heading-secondary">
                            Farmer ID: {assignment.farmer_id_number}
                          </h3>
                            <div className="flex items-center gap-2">
                              <Badge className={`${getStatusColor(assignment.status)} cursor-default pointer-events-none`}>
                                {getStatusLabel(assignment.status)}
                          </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild data-tour={filteredAssignments.indexOf(assignment) === 0 ? "status-dropdown" : undefined}>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {getAllowedStatusTransitions(assignment.status).map((newStatus) => (
                                    <DropdownMenuItem
                                      key={newStatus}
                                      onClick={() => updateAssignmentStatus(assignment.assignment_id, newStatus)}
                                      className="flex items-center gap-2"
                                    >
                                      {newStatus === 'in_progress' && <Play className="h-3 w-3" />}
                                      {newStatus === 'completed' && <CheckCircle className="h-3 w-3" />}
                                      {newStatus === 'pending_review' && <AlertCircle className="h-3 w-3" />}
                                      {newStatus === 'pending' && <Clock className="h-3 w-3" />}
                                      {newStatus === 'cancelled' && <XCircle className="h-3 w-3" />}
                                      Mark as {getStatusLabel(newStatus)}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                              <p className="text-sm text-body-secondary">Farmer ID</p>
                              <p className="font-medium text-body-primary">{assignment.farmer_id_number}</p>
                          </div>
                          <div>
                              <p className="text-sm text-body-secondary">Crop</p>
                              <p className="font-medium text-body-primary">
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-md text-sm">
                                  🌾 {assignment.crop || 'Not specified'}
                                </span>
                              </p>
                          </div>
                          <div>
                              <p className="text-sm text-body-secondary">Phase</p>
                              <p className="font-medium text-body-primary">{getPhaseLabel(assignment.phase)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-gray-600">
                            <div 
                              className="flex items-center gap-1 cursor-pointer text-accent-interactive hover:underline"
                              onClick={() => {
                                // Switch to data library tab and filter by this assignment
                                handleTabChange('library');
                                // You could add filtering logic here if needed
                              }}
                              title="View files in Data Library"
                            >
                            <Upload className="h-4 w-4" />
                              {uploadsForAssignment.length} files
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
                            variant="default"
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200 dark:bg-neon-600 dark:hover:bg-neon-500 dark:shadow-neon dark:hover:shadow-neon-lg"
                            data-tour={filteredAssignments.indexOf(assignment) === 0 ? "ai-chat-button" : undefined}
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
                                    currentUploads = uploads as FarmerDataUpload[];
                                    handleUploadsLoaded(assignment.assignment_id, uploads as FarmerDataUpload[]);
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
                                farmerIdNumber: assignment.farmer_id_number,
                                crop: assignment.crop,
                                phase: assignment.phase,
                                phaseLabel: getPhaseLabel(assignment.phase),
                                assignmentId: assignment.assignment_id,
                                uploads: initialUploads
                              });
                              handleNavItemChange("chat");
                            }}
                          >
                            <Brain className="h-4 w-4 mr-1" />
                            AI Co-Pilot
                            {messageCounts[assignment.assignment_id] > 0 && (
                              <span className="ml-2 bg-white text-blue-600 text-xs px-2 py-1 rounded-full font-medium">
                                {messageCounts[assignment.assignment_id]}
                              </span>
                            )}
                        </Button>
                        
                        <div className="mt-3">
                          <F100ModalSpecialist
                          farmerId={assignment.farmer_id}
                          farmerName={assignment.farmer_name}
                          farmerIdNumber={assignment.farmer_id_number}
                          phase={assignment.phase}
                          crop={assignment.crop}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })
            )}
          </div>
              </div>
            )}

            {activeNavItem === 'library' && (
              <div className="space-y-4">
          <Card className="dark:bg-dark-card dark:border-dark-border transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-heading-secondary">
                <Upload className="h-5 w-5 text-accent-blue" />
                Data Library
              </CardTitle>
              <CardDescription className="text-body-secondary">
                Review and download admin-uploaded documents organized by farmer assignments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {assignments.length === 0 ? (
                <div className="text-center py-8">
                  <Upload className="h-12 w-12 text-body-muted mx-auto mb-3" />
                  <p className="text-body-secondary">You do not have any assignments yet.</p>
                  <p className="text-sm text-body-muted">Once admin uploads files for a farmer, they will appear here.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Filter Controls */}
                  <div className="bg-gray-50 dark:bg-dark-bg p-4 rounded-lg border dark:border-dark-border transition-colors" data-tour="library-filters">
                    <div className="flex items-center gap-2 mb-3">
                      <Filter className="h-4 w-4 text-accent-blue" />
                      <span className="text-sm font-medium text-heading-tertiary">Filter Files</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-body-muted" />
                        <Input
                          placeholder="Search files..."
                          value={dataLibrarySearchTerm}
                          onChange={(e) => setDataLibrarySearchTerm(e.target.value)}
                          className="pl-9"
                        />
                        {dataLibrarySearchTerm && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                            onClick={() => setDataLibrarySearchTerm('')}
                          >
                            <X className="h-3 w-3" />
                    </Button>
                        )}
                      </div>
                      
                      {/* Data Type Filter */}
                      <Select value={dataLibrarySelectedDataType} onValueChange={setDataLibrarySelectedDataType}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {(() => {
                            const allAssignmentUploads = Object.values(assignmentUploads).flat();
                            const types = Array.from(new Set(allAssignmentUploads.map(upload => upload.data_type))).sort();
                            return types.map(type => (
                              <SelectItem key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                      
                      {/* Phase Filter */}
                      <Select value={dataLibrarySelectedPhase} onValueChange={setDataLibrarySelectedPhase}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Phases" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Phases</SelectItem>
                          {(() => {
                            const allAssignmentUploads = Object.values(assignmentUploads).flat();
                            const phases = Array.from(new Set(allAssignmentUploads.map(upload => upload.phase.toString()))).sort((a, b) => parseInt(a) - parseInt(b));
                            return phases.map(phase => (
                              <SelectItem key={phase} value={phase}>
                                Phase {phase}
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
              </div>
                  </div>

                  {/* Assignment Groups */}
                  {assignments.map((assignment) => {
                    return (
                      <AssignmentUploads
                        key={assignment.assignment_id}
                        assignmentId={assignment.assignment_id}
                        farmerId={assignment.farmer_id}
                        farmerIdNumber={assignment.farmer_id_number}
                        crop={assignment.crop}
                        phase={assignment.phase}
                        onLoaded={handleUploadsLoaded}
                        searchTerm={dataLibrarySearchTerm}
                        selectedDataType={dataLibrarySelectedDataType}
                        selectedPhase={dataLibrarySelectedPhase}
                        isCollapsed={collapsedAssignments.has(assignment.assignment_id)}
                        onToggleCollapse={() => toggleAssignmentCollapse(assignment.assignment_id)}
                      />
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
              </div>
            )}

            {activeNavItem === 'chat' && (
              <div className="space-y-4">
          {aiChatContext ? (
            <div className="space-y-4">
              {/* Mode Toggle */}
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">TelAgri Co-Pilot</h3>
              </div>

              {/* Copilot Interface */}
              <AgriCopilot
                farmerId={aiChatContext.farmerId}
                farmerIdNumber={aiChatContext.farmerIdNumber}
                crop={aiChatContext.crop}
                phase={aiChatContext.phase}
                phaseLabel={aiChatContext.phaseLabel}
                assignmentId={aiChatContext.assignmentId}
                uploads={chatContextUploads[aiChatContext.assignmentId] ?? []}
                onContextChange={(updatedUploads) =>
                  handleChatContextChange(aiChatContext.assignmentId, updatedUploads)
                }
                onMessageCountUpdate={(count) => 
                  handleMessageCountUpdate(aiChatContext.assignmentId, count)
                }
                onClose={() => setAiChatContext(null)}
              />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  TelAgri Co-Pilot Workspace
                </CardTitle>
                <CardDescription>
                  Select an assignment above to open the professional AI copilot with advanced agricultural analysis capabilities.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="p-4 border rounded-lg">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                    <h4 className="font-medium">Data Analysis</h4>
                    <p className="text-sm text-gray-600">Analyze uploaded files and documents</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <Brain className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <h4 className="font-medium">AI Insights</h4>
                    <p className="text-sm text-gray-600">Get agricultural recommendations</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                    <h4 className="font-medium">F-100 Reports</h4>
                    <p className="text-sm text-gray-600">Generate compliance reports</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface AssignmentUploadsProps {
  assignmentId: string;
  farmerId: string;
  farmerIdNumber: string;
  crop: string;
  phase: F100Phase;
  onLoaded: (assignmentId: string, uploads: FarmerDataUpload[]) => void;
  searchTerm?: string;
  selectedDataType?: string;
  selectedPhase?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const AssignmentUploads: React.FC<AssignmentUploadsProps> = ({
  assignmentId,
  farmerId,
  farmerIdNumber,
  crop,
  phase,
  onLoaded,
  searchTerm = '',
  selectedDataType = 'all',
  selectedPhase = 'all',
  isCollapsed = false,
  onToggleCollapse
}) => {
  const phaseLabel = getPhaseLabel(phase);
  
  // File viewer state
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileViewerFiles, setFileViewerFiles] = useState<any[]>([]);
  const [fileViewerInitialIndex, setFileViewerInitialIndex] = useState(0);
  const [fileViewerSectionName, setFileViewerSectionName] = useState('');

  const {
    data: uploads = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ["assignment-uploads", assignmentId, farmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farmer_data_uploads")
        .select("id, file_name, data_type, file_size_bytes, created_at, phase, file_path, file_mime, description, tags, metadata, updated_at")
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

  // File type utilities
  const getFileTypeIcon = useCallback((upload: FarmerDataUpload) => {
    const mimeType = upload.file_mime || '';
    const fileName = upload.file_name.toLowerCase();
    
    // Image files
    if (mimeType.startsWith('image/') || upload.data_type === 'photo') {
      return <Image className="h-5 w-5 text-blue-600" />;
    }
    
    // Document files
    if (mimeType.includes('wordprocessingml') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      return <FileText className="h-5 w-5 text-blue-700" />;
    }
    
    // Spreadsheet files
    if (mimeType.includes('spreadsheetml') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    }
    
    // Presentation files
    if (mimeType.includes('presentationml') || fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
      return <Presentation className="h-5 w-5 text-orange-600" />;
    }
    
    // PDF files
    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return <FileText className="h-5 w-5 text-red-600" />;
    }
    
    // Archive files
    if (fileName.endsWith('.zip') || fileName.endsWith('.rar') || fileName.endsWith('.7z')) {
      return <Archive className="h-5 w-5 text-purple-600" />;
    }
    
    // Map files (KML, KMZ)
    if (fileName.endsWith('.kml') || fileName.endsWith('.kmz') || upload.data_type === 'maps') {
      return <Map className="h-5 w-5 text-emerald-600" />;
    }
    
    // Climate data
    if (upload.data_type === 'climate') {
      return <Cloud className="h-5 w-5 text-sky-600" />;
    }
    
    // Default file icon
    return <File className="h-5 w-5 text-gray-600" />;
  }, []);

  const getFileTypeColor = useCallback((upload: FarmerDataUpload) => {
    const mimeType = upload.file_mime || '';
    const fileName = upload.file_name.toLowerCase();
    
    if (mimeType.startsWith('image/') || upload.data_type === 'photo') return 'bg-blue-50 border-blue-200';
    if (mimeType.includes('wordprocessingml') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) return 'bg-blue-50 border-blue-200';
    if (mimeType.includes('spreadsheetml') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) return 'bg-green-50 border-green-200';
    if (mimeType.includes('presentationml') || fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) return 'bg-orange-50 border-orange-200';
    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) return 'bg-red-50 border-red-200';
    if (fileName.endsWith('.zip') || fileName.endsWith('.rar') || fileName.endsWith('.7z')) return 'bg-purple-50 border-purple-200';
    if (fileName.endsWith('.kml') || fileName.endsWith('.kmz') || upload.data_type === 'maps') return 'bg-emerald-50 border-emerald-200';
    if (upload.data_type === 'climate') return 'bg-sky-50 border-sky-200';
    
    return 'bg-gray-50 border-gray-200';
  }, []);

  const getImageThumbnail = useCallback((upload: FarmerDataUpload) => {
    if (upload.file_mime?.startsWith('image/') || upload.data_type === 'photo') {
      const imageUrl = supabase.storage.from('farmer-documents').getPublicUrl(upload.file_path).data.publicUrl;
      return (
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border">
          <img
            src={imageUrl}
            alt={upload.file_name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="hidden w-full h-full flex items-center justify-center bg-gray-50">
            <Image className="h-6 w-6 text-gray-400" />
          </div>
        </div>
      );
    }
    return null;
  }, []);

  // Filter uploads based on search and filters
  const filteredUploads = useMemo(() => {
    return uploads.filter(upload => {
      const matchesSearch = searchTerm === '' || 
        upload.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        upload.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDataType = selectedDataType === 'all' || upload.data_type === selectedDataType;
      const matchesPhase = selectedPhase === 'all' || upload.phase.toString() === selectedPhase;
      
      return matchesSearch && matchesDataType && matchesPhase;
    });
  }, [uploads, searchTerm, selectedDataType, selectedPhase]);

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
    <Card className="border-l-4 border-l-blue-500 dark:border-l-blue-400 dark:bg-dark-card dark:border-dark-border transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400 transition-colors" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400 transition-colors" />
              )}
            </Button>
            <div>
              <h3 className="text-lg text-heading-secondary">Farmer ID: {farmerIdNumber}</h3>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="outline" className="text-xs dark:border-blue-500/30 dark:text-blue-300 transition-colors">
                  ID: {farmerId.slice(0, 8)}...
                </Badge>
                <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800 transition-colors">
                  🌾 {crop || 'Crop not specified'}
                </Badge>
                <Badge variant="secondary" className="text-xs dark:bg-dark-border dark:text-gray-300 transition-colors">
                  {phaseLabel}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="dark:bg-dark-border dark:text-gray-300 transition-colors">
              {filteredUploads.length} of {uploads.length} files
            </Badge>
            {filteredUploads.length !== uploads.length && (
              <Badge variant="outline" className="text-orange-600 border-orange-600 dark:text-orange-400 dark:border-orange-400 transition-colors">
                Filtered
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-sm text-gray-500">Loading files...</span>
            </div>
          ) : filteredUploads.length === 0 ? (
            <div className="text-center py-8">
              {uploads.length === 0 ? (
                <>
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No uploads available for this assignment yet.</p>
                </>
              ) : (
                <>
                  <Filter className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No files match the current filters.</p>
                  <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filter criteria.</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUploads.map((upload) => {
                const thumbnail = getImageThumbnail(upload);
                return (
                  <div
                    key={upload.id}
                    className={`border dark:border-dark-border rounded-lg p-4 hover:shadow-md dark:hover:shadow-neon/20 transition-all cursor-pointer ${getFileTypeColor(upload)} dark:bg-dark-card`}
                    onClick={() => openFileViewer(upload, filteredUploads, `Farmer ${farmerIdNumber} - Data Library`)}
                    title={`Click to preview: ${upload.file_name}`}
                  >
                    <div className="flex items-start space-x-3">
                      {/* Thumbnail or Icon */}
                      <div className="flex-shrink-0">
                        {thumbnail || (
                          <div className="w-16 h-16 rounded-lg bg-white dark:bg-dark-bg border-2 border-dashed border-gray-300 dark:border-dark-border flex items-center justify-center transition-colors">
                            {getFileTypeIcon(upload)}
                          </div>
                        )}
                      </div>
                      
                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-body-primary truncate text-accent-interactive">
                              {upload.file_name}
                            </h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="secondary" className="text-xs dark:bg-dark-border dark:text-gray-300 transition-colors">
                                {upload.data_type}
                              </Badge>
                              <Badge variant="outline" className="text-xs dark:border-blue-500/30 dark:text-blue-300 transition-colors">
                                Phase {upload.phase}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-body-muted">
                              <span>{formatFileSize(upload.file_size_bytes)}</span>
                              <span>{new Date(upload.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          
                          {/* Quick Actions */}
                          <div className="flex items-center space-x-1 ml-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-white/80 dark:hover:bg-dark-border/80 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                openFileViewer(upload, filteredUploads, `Farmer ${farmerIdNumber} - Data Library`);
                              }}
                              title="Preview file"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-white/80 dark:hover:bg-dark-border/80 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(upload);
                              }}
                              title="Download file"
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
      
      {/* File Viewer Modal */}
      <FileViewer
        isOpen={fileViewerOpen}
        onClose={handleFileViewerClose}
        files={fileViewerFiles}
        initialFileIndex={fileViewerInitialIndex}
        sectionName={fileViewerSectionName}
      />
    </Card>
  );
};