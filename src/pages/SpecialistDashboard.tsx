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
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
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
  Info,
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
  Settings,
  Clipboard
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
import { Sheet, SheetContent, SheetHeader as SheetHead, SheetTitle, SheetClose, SheetTrigger } from "../components/ui/sheet";
import { useIsMobile } from "../hooks/use-mobile";
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
  const isMobile = useIsMobile();
  
  // Ref for the main scrollable content area
  const contentAreaRef = React.useRef<HTMLDivElement>(null);
  
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
  // Pulse hint when collapsed (each time)
  const [showCollapsePulse, setShowCollapsePulse] = useState(false);
  // Track if user should see AI Co-Pilot button highlight
  const [highlightAICoPilot, setHighlightAICoPilot] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Page transition loading state
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  }, [isMobile]);
  
  // Navigation items configuration
  const navigationItems = [
    {
      id: 'assignments',
      label: 'Tasks',
      icon: Users,
      description: 'View and manage your farmer assignments'
    },
    {
      id: 'library',
      label: 'Files',
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
  // Data Library filters - hydrate from query string
  const initialParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [dataLibrarySearchTerm, setDataLibrarySearchTerm] = useState(initialParams.get('q') || '');
  const [dataLibrarySelectedDataType, setDataLibrarySelectedDataType] = useState<string>(initialParams.get('type') || 'all');
  const [dataLibrarySelectedPhase, setDataLibrarySelectedPhase] = useState<string>(initialParams.get('phase') || 'all');
  const [dataLibraryFocusedAssignment, setDataLibraryFocusedAssignment] = useState<string | null>(initialParams.get('assignmentId'));
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
  } = useQuery<SpecialistAssignmentWithData[]>({
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
        farmer_name: item.farmer_name,
        phase: item.phase,
        status: item.status,
        assigned_at: item.assigned_at,
        data_uploads_count: item.data_uploads_count,
        analysis_sessions_count: item.analysis_sessions_count,
        last_activity: item.last_activity,
        f100_doc_url: item.f100_doc_url
      })) as SpecialistAssignmentWithData[];
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds - assignments can change frequently
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
  // Sync Data Library filters to query string
  useEffect(() => {
    if (activeNavItem !== 'library') return;
    const params = new URLSearchParams(location.search);
    // set tab
    params.set('tab', 'library');
    // set filters
    if (dataLibrarySearchTerm) params.set('q', dataLibrarySearchTerm); else params.delete('q');
    if (dataLibrarySelectedDataType && dataLibrarySelectedDataType !== 'all') params.set('type', dataLibrarySelectedDataType); else params.delete('type');
    if (dataLibrarySelectedPhase && dataLibrarySelectedPhase !== 'all') params.set('phase', dataLibrarySelectedPhase); else params.delete('phase');
    if (dataLibraryFocusedAssignment) params.set('assignmentId', dataLibraryFocusedAssignment); else params.delete('assignmentId');
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  }, [activeNavItem, dataLibrarySearchTerm, dataLibrarySelectedDataType, dataLibrarySelectedPhase, dataLibraryFocusedAssignment, location.pathname, location.search, navigate]);


  // Handle navigation item change
  const handleNavItemChange = (itemId: string) => {
    // Show loading indicator
    setIsPageTransitioning(true);
    
    setActiveNavItem(itemId);
    handleTabChange(itemId);
    
    // Instantly scroll to top when changing pages
    setTimeout(() => {
      if (contentAreaRef.current) {
        contentAreaRef.current.scrollTop = 0;
      }
      // Also try window scroll as fallback
      window.scrollTo(0, 0);
      
      // Hide loading after a brief moment
      setTimeout(() => {
        setIsPageTransitioning(false);
      }, 200);
    }, 0);
  };

  // Toggle sidebar collapse
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    if (next) {
      setShowCollapsePulse(true);
      setTimeout(() => setShowCollapsePulse(false), 1800);
    } else {
      setShowCollapsePulse(false);
    }
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

  // Removed per-phase chips. Specialists should only see files for their assigned phase.

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
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors flex overflow-x-hidden">
      {/* Sidebar Navigation */}
      <div className={`hidden md:flex ${sidebarCollapsed ? 'w-16' : 'w-64'} bg-sidebar dark:bg-dark-card border-r border-sidebar-border dark:border-dark-border transition-all duration-300 flex-col light-elevated dark:shadow-neon/20 h-screen sticky top-0`}>
        {/* Sidebar Header */}
        <div className="h-[73px] px-4 border-b dark:border-dark-border flex items-center">
          <div className="flex items-center justify-between w-full">
            {!sidebarCollapsed ? (
              <>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  title="Collapse navigation"
                  aria-label="Collapse navigation"
                  className="group h-8 w-8 p-0 transition-colors rounded-md text-emerald-600 dark:text-emerald-400 border border-emerald-400/60 bg-emerald-50 dark:bg-dark-border/60 ring-1 ring-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.35)] hover:bg-emerald-100 dark:hover:bg-emerald-500/10 hover:ring-emerald-400"
                >
                  <ChevronLeft className="h-4 w-4 transition-colors text-emerald-600 dark:text-emerald-400" />
                </Button>
              </>
            ) : (
              <div 
                className="cursor-pointer hover:bg-sidebar-accent dark:hover:bg-dark-border rounded-lg p-2 transition-all duration-200 mx-auto"
                onClick={handleHeaderClick}
                title="Return to start page"
              >
                <Brain className="h-6 w-6 neon-brain" />
              </div>
            )}
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
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Header */}
        <header className="relative h-[73px] border-b bg-white dark:bg-dark-card shadow-sm dark:border-dark-border transition-colors flex items-center overflow-hidden" data-tour="welcome">
          <div className={`flex items-center justify-end w-full px-4 md:px-6 gap-3 md:gap-4 ${sidebarCollapsed ? 'pl-14' : ''}`}>
            {/* Welcome text - compact on right */}
            <div className="flex flex-col items-end">
              <p className="text-sm font-medium text-heading-primary">Welcome back, Specialist</p>
              <p className="text-xs text-body-muted">{user?.email ?? "Specialist"}</p>
            </div>
            
            <ThemeToggle variant="icon" size="sm" />
          </div>
          {sidebarCollapsed && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2 hidden md:block">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                title="Expand navigation"
                aria-label="Expand navigation"
                className={`group h-8 w-8 p-0 text-emerald-600 dark:text-emerald-400 border border-emerald-400/60 bg-emerald-50 dark:bg-dark-border/60 
                            ring-1 ring-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.35)] rounded-md 
                            hover:border-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 ${showCollapsePulse ? 'animate-pulse' : ''}`}
              >
                <ChevronRight className="h-4 w-4 transition-colors text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
              </Button>
            </div>
          )}
        </header>

        {/* Main Content Area */}
        <div ref={contentAreaRef} className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="w-full px-4 md:px-6 py-4 md:py-6 space-y-6">
        {/* Stats Cards - Only show on My Assignments page */}
        {activeNavItem === 'assignments' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full" data-tour="stats-overview">
        <Card className="dark:bg-dark-card dark:border-dark-border transition-colors hover:shadow-lg dark:hover:shadow-neon/10 min-w-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-body-secondary truncate">Total Assignments</p>
                <p className="text-2xl text-heading-primary">{totalAssignments}</p>
              </div>
              <Users className="h-8 w-8 text-accent-blue flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-dark-card dark:border-dark-border transition-colors hover:shadow-lg dark:hover:shadow-neon/10 min-w-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-body-secondary truncate">In Progress</p>
                <p className="text-2xl font-bold text-accent-blue">{totalInProgress}</p>
              </div>
              <Clock className="h-8 w-8 text-accent-blue flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-dark-card dark:border-dark-border transition-colors hover:shadow-lg dark:hover:shadow-neon/10 min-w-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-body-secondary truncate">Completed</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalCompleted}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400 transition-colors flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-dark-card dark:border-dark-border transition-colors hover:shadow-lg dark:hover:shadow-neon/10 min-w-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-body-secondary truncate">Pending Review</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{totalPendingReview}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-600 dark:text-orange-400 transition-colors flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>
        )}

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

          <Card className="min-w-0">
            <CardContent className="p-4" data-tour="search-filters">
              <div className="flex flex-col md:flex-row gap-4 w-full">
                <div className="flex-1 min-w-0">
                  <div className="relative w-full">
                    <Input
                      placeholder="Search farmers, banks, or ID numbers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full"
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
            {isLoading || (!assignments.length && !error) ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                  <p className="text-sm text-body-muted">Loading your assignments...</p>
                </div>
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
                const currentPhaseUploads = uploadsForAssignment.filter(u => {
                  const metaPhase = (u.metadata as any)?.f100_phase;
                  const phaseValue = (typeof metaPhase === 'number' ? metaPhase : undefined) ?? u.phase;
                  return phaseValue === assignment.phase;
                });
                return (
                  <Card key={assignment.assignment_id} className="hover:shadow-md dark:hover:shadow-neon/20 transition-all dark:bg-dark-card dark:border-dark-border min-w-0" data-tour={filteredAssignments.indexOf(assignment) === 0 ? "assignment-card" : undefined}>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row items-start justify-between min-w-0 gap-4">
                      <div 
                        className="flex-1 min-w-0 w-full md:w-auto cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          // Switch to Data Library with assignment-focused view
                          const params = new URLSearchParams(location.search);
                          params.set('tab', 'library');
                          params.set('assignmentId', assignment.assignment_id);
                          navigate(`${location.pathname}?${params.toString()}`, { replace: true });
                          setDataLibraryFocusedAssignment(assignment.assignment_id);
                          setActiveNavItem('library');
                        }}
                        title="Click to view files in Data Library"
                      >
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          {getPhaseIcon(assignment.phase)}
                          <h3 className="text-base md:text-lg font-semibold text-heading-secondary truncate flex items-center gap-1.5">
                            <span className="text-xs md:text-sm font-normal text-body-muted">Farmer</span>
                            {assignment.farmer_id_number}
                          </h3>
                          <Badge className={`${getStatusColor(assignment.status)} flex-shrink-0`}>
                            {getStatusLabel(assignment.status)}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                          <div className="min-w-0">
                            <p className="text-sm text-body-secondary">Crop</p>
                            <p className="font-medium text-body-primary">
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-md text-sm truncate max-w-full">
                                🌾 {assignment.crop || 'Not specified'}
                              </span>
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-body-secondary">Phase</p>
                            <p className="font-medium text-body-primary truncate">{getPhaseLabel(assignment.phase)}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-body-secondary">Files</p>
                            <p className="font-medium text-body-primary">{currentPhaseUploads.length} uploaded</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs md:text-sm text-body-muted">
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
                          
                          {/* Status Change Button with Info */}
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild data-tour={filteredAssignments.indexOf(assignment) === 0 ? "status-dropdown" : undefined}>
                                <Button variant="outline" size="sm" className="h-7 text-xs">
                                  <MoreHorizontal className="h-3 w-3 mr-1" />
                                  Change Status
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {getAllowedStatusTransitions(assignment.status).map((newStatus) => (
                                  <DropdownMenuItem
                                    key={newStatus}
                                    onClick={() => updateAssignmentStatus(assignment.assignment_id, newStatus)}
                                    className="flex items-center gap-2"
                                  >
                                    {newStatus === 'pending' && <Clock className="h-3 w-3 text-gray-500" />}
                                    {newStatus === 'in_progress' && <Play className="h-3 w-3 text-blue-600" />}
                                    {newStatus === 'pending_review' && <AlertCircle className="h-3 w-3 text-orange-600" />}
                                    {newStatus === 'completed' && <CheckCircle className="h-3 w-3 text-green-600" />}
                                    {newStatus === 'cancelled' && <XCircle className="h-3 w-3 text-red-600" />}
                                    Mark as {getStatusLabel(newStatus)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            
                            {/* Status Info Popover */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  title="Learn about assignment statuses"
                                >
                                  <Info className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-4" align="start">
                                <div className="space-y-3">
                                  <div>
                                    <h4 className="font-semibold text-sm text-heading-primary mb-2">Assignment Status Guide</h4>
                                    <p className="text-xs text-body-secondary mb-3">
                                      Track your work progress by updating the assignment status as you complete each phase.
                                    </p>
                                  </div>
                                  
                                  <div className="space-y-2.5 text-xs">
                                    <div className="flex items-start gap-2">
                                      <Clock className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="font-medium text-heading-secondary">Pending</p>
                                        <p className="text-body-muted">Assignment created, not yet started</p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-2">
                                      <Play className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="font-medium text-heading-secondary">In Progress</p>
                                        <p className="text-body-muted">Actively working on analysis and data review</p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-2">
                                      <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="font-medium text-heading-secondary">Pending Review</p>
                                        <p className="text-body-muted">Work complete, awaiting admin verification</p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-2">
                                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="font-medium text-heading-secondary">Completed</p>
                                        <p className="text-body-muted">Assignment finished and approved</p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-2">
                                      <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="font-medium text-heading-secondary">Cancelled</p>
                                        <p className="text-body-muted">Assignment stopped or no longer needed</p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="pt-2 border-t border-border">
                                    <p className="text-xs text-body-muted italic">
                                      💡 Tip: Click "Change Status" to update your progress
                                    </p>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </div>

              <div className="flex flex-col gap-2 md:ml-4 mt-4 md:mt-0 w-full md:w-auto" onClick={(e) => e.stopPropagation()}>
                <div className="relative">
                  {/* Pulsing ring for highlight */}
                  {highlightAICoPilot && (
                    <div className="absolute inset-0 animate-ping rounded-md bg-blue-400 opacity-75 pointer-events-none" />
                  )}
                  <Button 
                    size="sm" 
                      variant="default"
                      className={`w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200 dark:bg-neon-600 dark:hover:bg-neon-500 dark:shadow-neon dark:hover:shadow-neon-lg relative ${
                        highlightAICoPilot ? 'ring-4 ring-blue-300 dark:ring-blue-500 animate-pulse' : ''
                      }`}
                      data-tour={filteredAssignments.indexOf(assignment) === 0 ? "ai-chat-button" : undefined}
                      onClick={async () => {
                        // Clear highlight when clicked
                        if (highlightAICoPilot) {
                          setHighlightAICoPilot(false);
                        }
                        
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
                </div>
                        
                        <div className="mt-3 w-full md:w-auto">
                        <F100ModalSpecialist
                          farmerId={assignment.farmer_id}
                          farmerName={assignment.farmer_name || assignment.farmer_id_number}
                          farmerIdNumber={assignment.farmer_id_number}
                          phase={assignment.phase}
                          crop={assignment.crop}
                          docUrl={assignment.f100_doc_url}
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
          <Card className="dark:bg-dark-card dark:border-dark-border transition-colors min-w-0">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-heading-secondary">
                <Upload className="h-5 w-5 text-accent-blue flex-shrink-0" />
                <span className="truncate">Data Library</span>
              </CardTitle>
              <CardDescription className="text-body-secondary break-words">
                Review and download admin-uploaded documents organized by farmer assignments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 min-w-0">
              {assignments.length === 0 ? (
                <div className="text-center py-8">
                  <Upload className="h-12 w-12 text-body-muted mx-auto mb-3" />
                  <p className="text-body-secondary">You do not have any assignments yet.</p>
                  <p className="text-sm text-body-muted">Once admin uploads files for a farmer, they will appear here.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Filter Controls */}
                  <div className="bg-gray-50 dark:bg-dark-bg p-4 rounded-lg border dark:border-dark-border transition-colors min-w-0" data-tour="library-filters">
                    <div className="flex items-center gap-2 mb-3">
                      <Filter className="h-4 w-4 text-accent-blue" />
                      <span className="text-sm font-medium text-heading-tertiary">Filter Files</span>
                    </div>
                    <div className={`grid grid-cols-1 ${dataLibraryFocusedAssignment ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-3 w-full`}>
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
                      
                      {/* Phase Filter - Hide when viewing specific assignment */}
                      {!dataLibraryFocusedAssignment && (
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
                      )}
              </div>
                  </div>

                  {/* Assignment Groups - optionally focus a single assignment */}
                  {assignments
                    .filter(a => !dataLibraryFocusedAssignment || a.assignment_id === dataLibraryFocusedAssignment)
                    .map((assignment) => {
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
            <Card className="dark:bg-dark-card dark:border-dark-border">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                    <Brain className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl text-heading-primary">
                  TelAgri AI Co-Pilot
                </CardTitle>
                <CardDescription className="text-base text-body-secondary mt-3">
                  Your intelligent assistant for agricultural data analysis and insights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* How to Start Section */}
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-semibold text-sm">
                      1
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-heading-secondary mb-2">How to Start a Session</h3>
                      <p className="text-sm text-body-secondary mb-3">
                        To use the AI Co-Pilot, you need to select a farmer assignment first. This ensures the AI has access to all relevant documents and context for accurate analysis.
                      </p>
                      <Button
                        onClick={() => {
                          setHighlightAICoPilot(true);
                          setActiveNavItem('assignments');
                          const params = new URLSearchParams(location.search);
                          params.set('tab', 'assignments');
                          navigate(`${location.pathname}?${params.toString()}`, { replace: true });
                          
                          // Auto-remove highlight after 2 pulses (2 seconds)
                          setTimeout(() => setHighlightAICoPilot(false), 2000);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Clipboard className="h-4 w-4 mr-2" />
                        Go to My Assignments
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Features Grid */}
                <div>
                  <h3 className="font-semibold text-heading-secondary mb-4 text-center">What You Can Do</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border dark:border-dark-border rounded-lg bg-white dark:bg-dark-card hover:shadow-md transition-shadow">
                      <FileText className="h-8 w-8 mb-3 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-semibold text-heading-tertiary mb-2">Document Analysis</h4>
                      <p className="text-sm text-body-muted">
                        Extract insights from farmer documents, field reports, and agricultural data files.
                      </p>
                    </div>
                    <div className="p-4 border dark:border-dark-border rounded-lg bg-white dark:bg-dark-card hover:shadow-md transition-shadow">
                      <Brain className="h-8 w-8 mb-3 text-green-600 dark:text-green-400" />
                      <h4 className="font-semibold text-heading-tertiary mb-2">Smart Recommendations</h4>
                      <p className="text-sm text-body-muted">
                        Get AI-powered agricultural advice based on crop type, phase, and historical data.
                      </p>
                    </div>
                    <div className="p-4 border dark:border-dark-border rounded-lg bg-white dark:bg-dark-card hover:shadow-md transition-shadow">
                      <CheckCircle className="h-8 w-8 mb-3 text-purple-600 dark:text-purple-400" />
                      <h4 className="font-semibold text-heading-tertiary mb-2">Report Assistance</h4>
                      <p className="text-sm text-body-muted">
                        Generate summaries, extract key metrics, and prepare F-100 compliance reports.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Tip */}
                <div className="bg-gray-50 dark:bg-dark-border/30 border border-gray-200 dark:border-dark-border rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-heading-tertiary mb-1">Pro Tip</p>
                      <p className="text-sm text-body-muted">
                        Once you select an assignment and click the <span className="font-semibold text-blue-600 dark:text-blue-400">"AI Co-Pilot"</span> button, the AI will have full context of all uploaded files for that farmer, enabling more accurate and relevant responses.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
              </div>
            )}

            {/* Page Transition Loader - Fixed Overlay */}
            {isPageTransitioning && (
              <div className="fixed inset-0 bg-white/70 dark:bg-dark-bg/70 backdrop-blur-sm z-[60] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-blue-400" />
                  <p className="text-sm text-body-secondary">Loading...</p>
                </div>
              </div>
            )}

            {/* Mobile Bottom Navigation - Hidden on Desktop */}
            <div className="md:hidden">
              {/* Bottom Sheet Navigation */}
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetContent 
                  side="bottom" 
                  className="h-[70vh] rounded-t-3xl p-0 border-t-2 dark:border-dark-border"
                >
                  <div className="flex flex-col h-full">
                    {/* Handle bar */}
                    <div className="flex justify-center pt-3 pb-2">
                      <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
                    </div>

                    {/* Header */}
                    <div className="px-6 py-4 border-b dark:border-dark-border">
                      <h2 className="text-xl font-semibold text-heading-primary">Navigation</h2>
                      <p className="text-sm text-body-muted mt-1">Select a section to navigate</p>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 overflow-y-auto px-4 py-6">
                      <div className="space-y-2">
                        {navigationItems.map((item) => {
                          const Icon = item.icon;
                          const isActive = activeNavItem === item.id;
                          return (
                            <button
                              key={`mobile-bottom-${item.id}`}
                              onClick={() => {
                                handleNavItemChange(item.id);
                                setMobileNavOpen(false);
                              }}
                              className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-200 ${
                                isActive
                                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
                                  : 'text-foreground dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border active:bg-gray-100 dark:active:bg-dark-border/80'
                              }`}
                            >
                              <div className={`p-2 rounded-lg ${
                                isActive 
                                  ? 'bg-blue-100 dark:bg-blue-800/30' 
                                  : 'bg-gray-100 dark:bg-dark-border'
                              }`}>
                                <Icon className="h-6 w-6" />
                              </div>
                              <div className="flex-1 text-left">
                                <p className="font-medium">{item.label}</p>
                                <p className="text-xs text-body-muted mt-0.5">{item.description}</p>
                              </div>
                              {isActive && (
                                <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </nav>

                    {/* Footer Actions */}
                    <div className="px-4 py-4 border-t dark:border-dark-border bg-gray-50 dark:bg-dark-border/30">
                      <button
                        onClick={async () => {
                          setMobileNavOpen(false);
                          await handleSignOut();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl 
                                 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 
                                 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <LogOut className="h-5 w-5" />
                        <span className="font-medium">Sign Out</span>
                      </button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Bottom Navigation Bar */}
              <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-dark-card border-t dark:border-dark-border shadow-lg z-40">
                <div className="relative flex items-center justify-around h-16 px-4">
                  {/* My Assignments */}
                  <button
                    onClick={() => handleNavItemChange('assignments')}
                    className={`flex flex-col items-center justify-center w-16 transition-colors ${
                      activeNavItem === 'assignments'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Clipboard className="h-5 w-5 mb-1" />
                    <span className="text-[10px] font-medium">Tasks</span>
                  </button>

                  {/* Data Library */}
                  <button
                    onClick={() => handleNavItemChange('library')}
                    className={`flex flex-col items-center justify-center w-16 transition-colors ${
                      activeNavItem === 'library'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Database className="h-5 w-5 mb-1" />
                    <span className="text-[10px] font-medium">Files</span>
                  </button>

                  {/* Central FAB - Placeholder for spacing */}
                  <div className="w-16" />

                  {/* AI Co-Pilot */}
                  <button
                    onClick={() => handleNavItemChange('chat')}
                    className={`flex flex-col items-center justify-center w-16 transition-colors ${
                      activeNavItem === 'chat'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <MessageSquare className="h-5 w-5 mb-1" />
                    <div className="text-[10px] font-medium text-center leading-tight">
                      AI <span className="text-emerald-500 dark:text-emerald-400">Co-Pilot</span>
                    </div>
                  </button>

                  {/* Menu Button (opens bottom sheet) */}
                  <button
                    onClick={() => setMobileNavOpen(true)}
                    className="flex flex-col items-center justify-center w-16 text-gray-600 dark:text-gray-400 transition-colors"
                  >
                    <Settings className="h-5 w-5 mb-1" />
                    <span className="text-[10px] font-medium">More</span>
                  </button>
                </div>

                {/* Central Floating Action Button */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-8">
                  <button
                    onClick={() => setMobileNavOpen(!mobileNavOpen)}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 
                               text-white shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 
                               transition-all duration-200 flex items-center justify-center"
                    aria-label="Open navigation menu"
                  >
                    {mobileNavOpen ? (
                      <X className="h-7 w-7" />
                    ) : (
                      <Menu className="h-7 w-7" />
                    )}
                  </button>
                </div>
              </div>

              {/* Add bottom padding on mobile to account for bottom nav */}
              <div className="h-16" />
            </div>
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
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

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

  // NOTE: thumbnail prefetch moved below after filteredUploads is defined to avoid TDZ

  const getImageThumbnail = useCallback((upload: FarmerDataUpload) => {
    if (upload.file_mime?.startsWith('image/') || upload.data_type === 'photo') {
      const pub = supabase.storage.from('farmer-documents').getPublicUrl(upload.file_path);
      const imageUrl = thumbnailUrls[upload.id] || pub.data?.publicUrl;
      return (
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={upload.file_name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
              <Image className="h-6 w-6 text-gray-400" />
            </div>
          )}
          <div className="hidden w-full h-full flex items-center justify-center bg-gray-50">
            <Image className="h-6 w-6 text-gray-400" />
          </div>
        </div>
      );
    }
    return null;
  }, [thumbnailUrls]);

  // Filter uploads based on search and filters
  // Files for the assigned phase (baseline - what specialist should see)
  const assignedPhaseUploads = useMemo(() => {
    return uploads.filter(upload => {
      const effectivePhase = (upload.metadata as any)?.f100_phase ?? upload.phase;
      return effectivePhase === phase;
    });
  }, [uploads, phase]);

  // Check if user has actively applied any filters
  const hasActiveFilters = useMemo(() => {
    return searchTerm !== '' || selectedDataType !== 'all' || selectedPhase !== 'all';
  }, [searchTerm, selectedDataType, selectedPhase]);

  // Filtered uploads based on user's active filters
  const filteredUploads = useMemo(() => {
    return assignedPhaseUploads.filter(upload => {
      const matchesSearch = searchTerm === '' || 
        upload.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        upload.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDataType = selectedDataType === 'all' || upload.data_type === selectedDataType;
      const matchesPhase = selectedPhase === 'all' || upload.phase.toString() === selectedPhase;
      
      return matchesSearch && matchesDataType && matchesPhase;
    });
  }, [assignedPhaseUploads, searchTerm, selectedDataType, selectedPhase]);

  // Prefetch thumbnails ONLY for currently visible image/photo files
  useEffect(() => {
    const fetchThumbs = async () => {
      const candidates = filteredUploads.filter(u =>
        (u.file_mime?.startsWith('image/') || u.data_type === 'photo') && !thumbnailUrls[u.id]
      );
      if (candidates.length === 0) return;
      const updates: Record<string, string> = {};
      for (const u of candidates) {
        try {
          // Prefer a cached/derivative thumbnail in public bucket if available
          const thumbPath = `thumbs/${u.file_path}.png`;
          const pubThumb = supabase.storage.from('farmer-thumbs').getPublicUrl(thumbPath);
          if (pubThumb.data?.publicUrl) {
            updates[u.id] = pubThumb.data.publicUrl;
          } else {
            // Fallback to object public URL (if bucket has public set for testing) or skip
            const pub = supabase.storage.from('farmer-documents').getPublicUrl(u.file_path);
            if (pub.data?.publicUrl) {
              updates[u.id] = pub.data.publicUrl;
            } else {
              // As a final fallback, create a short-lived signed URL (visible items only)
              const { data, error } = await supabase.storage
                .from('farmer-documents')
                .createSignedUrl(u.file_path, 300);
              if (!error && data?.signedUrl) updates[u.id] = data.signedUrl;
            }
          }
        } catch {
          // ignore
        }
      }
      if (Object.keys(updates).length > 0) {
        setThumbnailUrls(prev => ({ ...prev, ...updates }));
      }
    };
    fetchThumbs();
  }, [filteredUploads, setThumbnailUrls]);

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
    <Card className="border-l-4 border-l-blue-500 dark:border-l-blue-400 dark:bg-dark-card dark:border-dark-border transition-colors min-w-0">
      <CardHeader 
        className="pb-2 md:pb-3 px-3 md:px-6 pt-3 md:pt-6 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-dark-border/30 active:bg-gray-50 dark:active:bg-dark-border/50 transition-colors"
        onClick={onToggleCollapse}
      >
        <div className="flex items-start gap-2 min-w-0">
          {/* Collapse button */}
          <div className="h-7 w-7 md:h-8 md:w-8 flex items-center justify-center flex-shrink-0">
            <ChevronDown className={`h-3.5 w-3.5 md:h-4 md:w-4 text-gray-600 dark:text-gray-400 transition-transform duration-300 ${
              isCollapsed ? '-rotate-90' : 'rotate-0'
            }`} />
          </div>
          
          {/* Content: Farmer info + badges */}
          <div className="min-w-0 flex-1">
            {/* Farmer ID - Full width for visibility */}
            <h3 className="text-xs md:text-sm font-semibold text-heading-secondary truncate flex items-center gap-1 mb-1.5">
              <span className="text-[10px] md:text-xs font-normal text-body-muted flex-shrink-0">Farmer</span>
              <span className="truncate">{farmerIdNumber}</span>
            </h3>
            
            {/* Badges row: Crop, Phase, File count */}
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              <Badge variant="secondary" className="text-[10px] md:text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800 transition-colors flex-shrink-0 px-1.5 py-0">
                🌾 {crop && crop !== 'Not specified' ? crop : 'Not specified'}
              </Badge>
              <Badge variant="secondary" className="text-[10px] md:text-xs dark:bg-dark-border dark:text-gray-300 transition-colors flex-shrink-0 px-1.5 py-0">
                {phaseLabel}
              </Badge>
              <Badge variant="secondary" className="text-[10px] md:text-xs dark:bg-dark-border dark:text-gray-300 transition-colors whitespace-nowrap px-1.5 py-0">
                {hasActiveFilters ? `${filteredUploads.length}/${assignedPhaseUploads.length}` : `${assignedPhaseUploads.length}`}
              </Badge>
              {hasActiveFilters && filteredUploads.length !== assignedPhaseUploads.length && (
                <Badge variant="outline" className="text-[10px] md:text-xs text-orange-600 border-orange-600 dark:text-orange-400 dark:border-orange-400 transition-colors px-1.5 py-0">
                  Filtered
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'
        }`}
      >
        <CardContent className="pt-0 px-3 md:px-6 pb-3 md:pb-6 min-w-0">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filteredUploads.map((upload) => {
                const thumbnail = getImageThumbnail(upload);
                return (
                  <div
                    key={upload.id}
                    className={`border dark:border-dark-border rounded-lg p-3 md:p-4 hover:shadow-md dark:hover:shadow-neon/20 transition-all cursor-pointer ${getFileTypeColor(upload)} dark:bg-dark-card min-w-0`}
                    onClick={() => openFileViewer(upload, filteredUploads, `Farmer ${farmerIdNumber} - Data Library`)}
                    title={`Click to preview: ${upload.file_name}`}
                  >
                    <div className="flex items-start gap-2 md:gap-3 min-w-0">
                      {/* Thumbnail or Icon */}
                      <div className="flex-shrink-0">
                    {thumbnail || (
                          <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-white dark:bg-dark-bg border-2 border-dashed border-gray-300 dark:border-dark-border flex items-center justify-center transition-colors">
                            {getFileTypeIcon(upload)}
                          </div>
                        )}
                      </div>
                      
                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs md:text-sm font-medium text-body-primary truncate text-accent-interactive mb-1">
                          {upload.file_name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-1">
                          <Badge variant="secondary" className="text-[10px] md:text-xs dark:bg-dark-border dark:text-gray-300 transition-colors px-1.5 py-0.5">
                            {upload.data_type}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] md:text-xs dark:border-blue-500/30 dark:text-blue-300 transition-colors px-1.5 py-0.5">
                            Phase {upload.phase}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs text-body-muted">
                          <span className="whitespace-nowrap">{formatFileSize(upload.file_size_bytes)}</span>
                          <span className="whitespace-nowrap">{new Date(upload.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </div>
      
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