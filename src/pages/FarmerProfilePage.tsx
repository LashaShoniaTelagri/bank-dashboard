import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FarmerModal } from "@/components/FarmerModal";
import { OrchardMapUploadModal } from "@/components/OrchardMapUploadModal";
import { OrchardMapViewer } from "@/components/OrchardMapViewer";
import { PhaseCard } from "@/components/PhaseCard";
import { PhaseEditModal } from "@/components/PhaseEditModal";
import { ComparisonPanel } from "@/components/ComparisonPanel";
import { MonitoredIssueEditor } from "@/components/MonitoredIssueEditor";
import { F100Modal } from "@/components/F100Modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar,
  Wheat,
  Droplet,
  BarChart3,
  Map as MapIcon,
  Edit,
  Download,
  Building2,
  Upload,
  Info,
  ListChecks,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartDisplay } from "@/components/ChartDisplay";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FarmerPhase, MonitoredIssue, ComparisonSelection } from "@/types/phase";
import { LocationMapViewer } from "@/components/LocationMapViewer";

interface Farmer {
  id: string;
  bank_id: string;
  type: 'person' | 'company';
  name: string;
  id_number: string;
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  farmer_location?: string;
  // Company-specific fields
  ltd_name?: string;
  full_name?: string;
  mobile?: string;
  // Agricultural fields
  area?: number;
  crop?: string;
  variety?: string;
  variety_cultivation_year?: number;
  variety_cultivation_area?: number;
  irrigation_type?: string;
  has_reservoir?: boolean;
  reservoir_amount?: number;
  reservoir_capacity?: number;
  water_source?: string;
  last_year_harvest_amount?: number;
  irrigation_sectors_count?: number;
  equipment_list?: string;
  // Service cost fields
  service_cost_tariff?: string;
  service_cost_total_eur?: number;
  service_cost_breakdown?: Record<string, number>;
  service_cost_selections?: any;
  // Location fields
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  cadastral_codes?: string[];
  // Other fields
  registration_date?: string;
  bank_comment?: string;
  other_comment?: string;
}

const FarmerProfilePage = () => {
  const { farmerId } = useParams<{ farmerId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [farmerModalOpen, setFarmerModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [phaseEditModalOpen, setPhaseEditModalOpen] = useState(false);
  const [selectedPhaseNumber, setSelectedPhaseNumber] = useState<number | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  
  // F-100 Modal state
  const [f100ModalOpen, setF100ModalOpen] = useState(false);
  const [f100PhaseNumber, setF100PhaseNumber] = useState<number | null>(null);
  
  // Comparison state
  const [comparisonSelections, setComparisonSelections] = useState<ComparisonSelection[]>([]);
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  
  // Monitored issue editor state
  const [issueEditorOpen, setIssueEditorOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<MonitoredIssue | null>(null);
  
  // Issue details dialog state
  const [issueDetailsOpen, setIssueDetailsOpen] = useState(false);
  const [viewingIssue, setViewingIssue] = useState<MonitoredIssue | null>(null);

  const isAdmin = profile?.role === 'admin';

  // Fetch farmer details
  const { data: farmer, isLoading: farmerLoading } = useQuery({
    queryKey: ['farmer-profile', farmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farmers')
        .select('*')
        .eq('id', farmerId)
        .single();
      
      if (error) throw error;
      return data as Farmer;
    },
    enabled: !!farmerId,
  });

  // Fetch bank details (name and logo)
  const { data: bankInfo } = useQuery({
    queryKey: ['farmer-bank', farmer?.bank_id],
    queryFn: async () => {
      if (!farmer?.bank_id) return null;
      const { data, error } = await supabase
        .from('banks')
        .select('name, logo_url')
        .eq('id', farmer.bank_id)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: !!farmer?.bank_id,
  });

  // Fetch loans
  const { data: loans = [] } = useQuery({
    queryKey: ['farmer-loans', farmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farmer_loans')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('issuance_date', { ascending: false });
      
      if (error) return [];
      return data;
    },
    enabled: !!farmerId,
  });

  // Fetch orchard maps
  const { data: orchardMaps = [] } = useQuery({
    queryKey: ['farmer-orchard-maps', farmerId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('farmer_orchard_maps')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false });
      
      if (error) return [];
      return data;
    },
    enabled: !!farmerId,
  });

  // Fetch monitored issues (default configuration list)
  const { data: monitoredIssues = [], refetch: refetchMonitoredIssues } = useQuery<MonitoredIssue[]>({
    queryKey: ['monitored-issues'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('monitored_issues')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (error) return [];
      return data as MonitoredIssue[];
    },
    staleTime: 0, // Always refetch to ensure fresh data
    refetchOnMount: 'always', // Refetch when component mounts
  });

  // Fetch farmer phases (scores and data for all 12 phases)
  const { data: farmerPhases = [] } = useQuery<FarmerPhase[]>({
    queryKey: ['farmer-phases', farmerId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('farmer_phases')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('phase_number');
      
      if (error) return [];
      return data as FarmerPhase[];
    },
    enabled: !!farmerId,
  });

  // Fetch F100 reports to check which phases have reports
  // Note: f100 table doesn't have phase_number column yet, so we'll default to empty array
  const { data: f100Reports = [] } = useQuery({
    queryKey: ['farmer-f100-reports', farmerId],
    queryFn: async () => {
      // TODO: Update this query when f100 table has phase_number column
      // const { data, error } = await supabase
      //   .from('f100')
      //   .select('phase_number')
      //   .eq('farmer_id', farmerId);
      // 
      // if (error) return [];
      // return data;
      
      // For now, return empty array until schema is updated
      return [];
    },
    enabled: !!farmerId,
  });

  // Helper functions
  const getPhaseData = (phaseNumber: number) => {
    return Array.isArray(farmerPhases) ? farmerPhases.find(p => p.phase_number === phaseNumber) || null : null;
  };

  const hasF100Report = (phaseNumber: number) => {
    return f100Reports.some(report => report.phase_number === phaseNumber);
  };

  const handleEditPhase = (phaseNumber: number) => {
    setSelectedPhaseNumber(phaseNumber);
    setPhaseEditModalOpen(true);
  };

  const handleViewF100 = (phaseNumber: number) => {
    setF100PhaseNumber(phaseNumber);
    setF100ModalOpen(true);
  };

  // Comparison handlers
  const handleToggleSelection = (phaseNumber: number, issueId: string) => {
    const selectionKey = `${phaseNumber}-${issueId}`;
    
    console.log('Toggle selection:', { phaseNumber, issueId, selectionKey, currentSelections: Array.from(selectedIssues) });
    
    setSelectedIssues(prev => {
      const newSet = new Set(prev);
      
      if (newSet.has(selectionKey)) {
        // Remove from selection
        newSet.delete(selectionKey);
        setComparisonSelections(current => 
          current.filter(s => !(s.phaseNumber === phaseNumber && s.issueId === issueId))
        );
      } else {
        // Add to selection
        newSet.add(selectionKey);
        const issue = Array.isArray(monitoredIssues) ? monitoredIssues.find(i => i.id === issueId) : undefined;
        const phase = getPhaseData(phaseNumber);
        if (issue) {
          setComparisonSelections(current => [...current, {
            phaseNumber,
            issueId,
            issueName: issue.name,
            phaseScore: phase?.score
          }]);
        }
      }
      
      console.log('New selections:', Array.from(newSet));
      return newSet;
    });
  };

  const handleRemoveSelection = (phaseNumber: number, issueId: string) => {
    const selectionKey = `${phaseNumber}-${issueId}`;
    const newSelectedIssues = new Set(selectedIssues);
    newSelectedIssues.delete(selectionKey);
    setSelectedIssues(newSelectedIssues);
    setComparisonSelections(prev => 
      prev.filter(s => !(s.phaseNumber === phaseNumber && s.issueId === issueId))
    );
  };

  const handleClearComparison = () => {
    setSelectedIssues(new Set());
    setComparisonSelections([]);
  };

  const handleViewIssueDetails = (issueId: string) => {
    const issue = Array.isArray(monitoredIssues) ? monitoredIssues.find(i => i.id === issueId) : undefined;
    if (issue) {
      setViewingIssue(issue);
      setIssueDetailsOpen(true);
    }
  };

  const handleEditIssue = (issue: MonitoredIssue, phaseNumber: number) => {
    setSelectedIssue(issue);
    setSelectedPhaseNumber(phaseNumber);
    setIssueEditorOpen(true);
  };

  const handleViewIssue = (issue: MonitoredIssue, phaseNumber: number) => {
    setSelectedIssue(issue);
    setSelectedPhaseNumber(phaseNumber);
    setIssueEditorOpen(true);
  };

  if (farmerLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-[600px]" />
            <Skeleton className="h-[600px] lg:col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Farmer not found</p>
            <Button onClick={() => navigate(-1)} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full px-4 py-6 max-w-[2000px] mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(isAdmin ? '/admin' : '/bank')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Farmers
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground font-medium">{farmer.name}</span>
        </div>

        {/* Header with Compact Info */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4">
              {/* Top Row: Name, Bank Info, and Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                    <Wheat className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-3xl font-bold text-heading-primary mb-1">
                      {farmer.name}
                    </h1>
                    <p className="text-sm text-muted-foreground mb-2">
                      ID: {farmer.id_number} • {farmer.type === 'person' ? 'Individual' : 'Company'}
                    </p>
                    
                    {/* Bank Info - Always visible for admins */}
                    {isAdmin && bankInfo && (
                      <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-muted/50 border border-border/50 max-w-fit">
                        {bankInfo.logo_url ? (
                          <img 
                            src={bankInfo.logo_url} 
                            alt={bankInfo.name}
                            className="h-6 w-auto max-w-[100px] object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <Building2 
                          className={`h-4 w-4 text-emerald-600 dark:text-emerald-400 ${bankInfo.logo_url ? 'hidden' : ''}`} 
                        />
                        <span className="text-sm font-medium text-foreground">
                          {bankInfo.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {isAdmin && (
                    <>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/charts/new?farmerId=${farmerId}`)}
                      >
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Add Chart
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setFarmerModalOpen(true)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Farmer
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              {/* Compact Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Contact */}
                {(farmer.contact_phone || farmer.contact_email) && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Contact
                    </p>
                    {farmer.contact_phone && (
                      <p className="text-sm font-medium truncate">{farmer.contact_phone}</p>
                    )}
                    {farmer.contact_email && (
                      <p className="text-xs text-muted-foreground truncate">{farmer.contact_email}</p>
                    )}
                  </div>
                )}

                {/* Location */}
                {farmer.farmer_location && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Location
                    </p>
                    <p className="text-sm font-medium truncate">{farmer.farmer_location}</p>
                  </div>
                )}

                {/* Crop & Area */}
                {farmer.crop && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Wheat className="h-3 w-3" />
                      Crop & Area
                    </p>
                    <p className="text-sm font-medium">{farmer.crop}</p>
                    {farmer.area && (
                      <p className="text-xs text-muted-foreground">{farmer.area} hectares</p>
                    )}
                  </div>
                )}

                {/* Irrigation */}
                {farmer.irrigation_type && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Droplet className="h-3 w-3" />
                      Irrigation
                    </p>
                    <p className="text-sm font-medium truncate">{farmer.irrigation_type}</p>
                    {farmer.has_reservoir && (
                      <Badge variant="outline" className="text-xs">
                        Reservoir: {farmer.reservoir_capacity || 0}m³
                      </Badge>
                    )}
                  </div>
                )}

                {/* Loan */}
                {loans.length > 0 && loans[0] && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      Active Loan
                    </p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {loans[0].currency} {loans[0].amount?.toLocaleString()}
                    </p>
                    {loans[0].end_date && (
                      <p className="text-xs text-muted-foreground">
                        Until {new Date(loans[0].end_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Last Harvest */}
                {farmer.last_year_harvest_amount && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Last Harvest
                    </p>
                    <p className="text-sm font-medium">
                      {farmer.last_year_harvest_amount.toLocaleString()} Tone
                    </p>
                  </div>
                )}
              </div>

              {/* Collapsible Detailed Information */}
              <Collapsible open={detailsExpanded} onOpenChange={setDetailsExpanded}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full mt-4 flex items-center justify-between h-auto py-3 px-4 rounded-md text-sm font-medium transition-colors hover:bg-muted dark:hover:bg-muted/80 text-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      <span>Full Farmer Details</span>
                    </div>
                    {detailsExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-heading-primary">
                      Detailed Farmer Information
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFarmerModalOpen(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Details
                    </Button>
                  </div>

                  {/* 1. Company/Person Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {farmer.type === 'company' ? 'Company Information' : 'Personal Information'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Type</p>
                          <p className="text-sm font-medium">{farmer.type === 'person' ? 'Individual' : 'Company'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {farmer.type === 'company' ? 'Company Name' : 'Name'}
                          </p>
                          <p className="text-sm font-medium">{farmer.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {farmer.type === 'company' ? 'Identification Code' : 'ID Number'}
                          </p>
                          <p className="text-sm font-medium">{farmer.id_number}</p>
                        </div>
                        {farmer.type === 'company' && farmer.full_name && (
                          <div>
                            <p className="text-sm text-muted-foreground">Director Name</p>
                            <p className="text-sm font-medium">{farmer.full_name}</p>
                          </div>
                        )}
                        {farmer.type === 'company' && farmer.mobile && (
                          <div>
                            <p className="text-sm text-muted-foreground">Director Mobile</p>
                            <p className="text-sm font-medium">{farmer.mobile}</p>
                          </div>
                        )}
                        {farmer.type === 'company' && farmer.ltd_name && (
                          <div>
                            <p className="text-sm text-muted-foreground">Contact Person</p>
                            <p className="text-sm font-medium">{farmer.ltd_name}</p>
                          </div>
                        )}
                        {farmer.contact_phone && (
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {farmer.type === 'company' ? 'Contact Phone' : 'Phone'}
                            </p>
                            <p className="text-sm font-medium">{farmer.contact_phone}</p>
                          </div>
                        )}
                        {farmer.contact_email && (
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {farmer.type === 'company' ? 'Company Email' : 'Email'}
                            </p>
                            <p className="text-sm font-medium">{farmer.contact_email}</p>
                          </div>
                        )}
                        {farmer.contact_address && (
                          <div className="md:col-span-2">
                            <p className="text-sm text-muted-foreground">Address</p>
                            <p className="text-sm font-medium">{farmer.contact_address}</p>
                          </div>
                        )}
                        {farmer.registration_date && (
                          <div>
                            <p className="text-sm text-muted-foreground">Registration Date</p>
                            <p className="text-sm font-medium">
                              {new Date(farmer.registration_date).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 2. Farm Overview */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Farm Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {farmer.location_lat && farmer.location_lng && (
                        <LocationMapViewer
                          key={detailsExpanded ? 'map-expanded' : 'map-collapsed'}
                          locationName={farmer.location_name}
                          lat={farmer.location_lat}
                          lng={farmer.location_lng}
                        />
                      )}
                      {farmer.location_name && !farmer.location_lat && (
                        <div>
                          <p className="text-sm text-muted-foreground">Location Name</p>
                          <p className="text-sm font-medium">{farmer.location_name}</p>
                        </div>
                      )}
                      {farmer.farmer_location && (
                        <div>
                          <p className="text-sm text-muted-foreground">Farm Location</p>
                          <p className="text-sm font-medium">{farmer.farmer_location}</p>
                        </div>
                      )}
                      {farmer.cadastral_codes && farmer.cadastral_codes.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Cadastral Codes</p>
                          <div className="flex flex-wrap gap-2">
                            {farmer.cadastral_codes.map((code, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {code}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 3. Agricultural Details */}
                  {(farmer.area || farmer.crop || farmer.variety || farmer.variety_cultivation_year || farmer.variety_cultivation_area) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Agricultural Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {farmer.area && (
                            <div>
                              <p className="text-sm text-muted-foreground">Total Area</p>
                              <p className="text-sm font-medium">{farmer.area} hectares</p>
                            </div>
                          )}
                          {farmer.crop && (
                            <div>
                              <p className="text-sm text-muted-foreground">Crop</p>
                              <p className="text-sm font-medium">{farmer.crop}</p>
                            </div>
                          )}
                          {farmer.variety && (
                            <div>
                              <p className="text-sm text-muted-foreground">Variety</p>
                              <p className="text-sm font-medium">{farmer.variety}</p>
                            </div>
                          )}
                          {farmer.variety_cultivation_year && (
                            <div>
                              <p className="text-sm text-muted-foreground">Cultivation Year</p>
                              <p className="text-sm font-medium">{farmer.variety_cultivation_year}</p>
                            </div>
                          )}
                          {farmer.variety_cultivation_area && (
                            <div>
                              <p className="text-sm text-muted-foreground">Cultivation Area</p>
                              <p className="text-sm font-medium">{farmer.variety_cultivation_area} hectares</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 4. Last Yield */}
                  {farmer.last_year_harvest_amount && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Last Yield</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div>
                          <p className="text-sm text-muted-foreground">Last Yield Amount</p>
                          <p className="text-sm font-medium">{farmer.last_year_harvest_amount.toLocaleString()} kg</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 5. Irrigation System */}
                  {(farmer.irrigation_type || farmer.irrigation_sectors_count || farmer.has_reservoir !== undefined || farmer.water_source) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Irrigation System</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {farmer.irrigation_type && (
                            <div>
                              <p className="text-sm text-muted-foreground">Irrigation Type</p>
                              <p className="text-sm font-medium">{farmer.irrigation_type}</p>
                            </div>
                          )}
                          {farmer.irrigation_sectors_count && (
                            <div>
                              <p className="text-sm text-muted-foreground">Sectors Count</p>
                              <p className="text-sm font-medium">{farmer.irrigation_sectors_count}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-sm text-muted-foreground">Has Reservoir</p>
                            <p className="text-sm font-medium">{farmer.has_reservoir ? 'Yes' : 'No'}</p>
                          </div>
                          {farmer.has_reservoir && farmer.reservoir_amount && (
                            <div>
                              <p className="text-sm text-muted-foreground">Reservoir Amount</p>
                              <p className="text-sm font-medium">{farmer.reservoir_amount} m³</p>
                            </div>
                          )}
                          {farmer.has_reservoir && farmer.reservoir_capacity && (
                            <div>
                              <p className="text-sm text-muted-foreground">Reservoir Capacity</p>
                              <p className="text-sm font-medium">{farmer.reservoir_capacity} m³</p>
                            </div>
                          )}
                          {farmer.water_source && (
                            <div>
                              <p className="text-sm text-muted-foreground">Water Source</p>
                              <p className="text-sm font-medium">{farmer.water_source}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 6. Service Cost (Admin Only for Breakdown) */}
                  {(farmer.service_cost_tariff || farmer.service_cost_total_eur || (isAdmin && farmer.service_cost_breakdown)) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Service Cost</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {farmer.service_cost_tariff && (
                          <div>
                            <p className="text-sm text-muted-foreground">Service Cost Tariff</p>
                            <p className="text-sm font-medium">{farmer.service_cost_tariff}</p>
                          </div>
                        )}
                        {farmer.service_cost_total_eur && (
                          <div>
                            <p className="text-sm text-muted-foreground">Service Cost Total</p>
                            <p className="text-sm font-medium">€{farmer.service_cost_total_eur.toLocaleString()}</p>
                          </div>
                        )}
                        {isAdmin && farmer.service_cost_breakdown && Object.keys(farmer.service_cost_breakdown).length > 0 && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Service Cost Breakdown</p>
                            <div className="space-y-1">
                              {Object.entries(farmer.service_cost_breakdown).map(([key, value]) => (
                                <div key={key} className="flex justify-between text-sm">
                                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                                  <span className="font-medium">€{value.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* 7. Equipment */}
                  {farmer.equipment_list && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Equipment</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-medium whitespace-pre-wrap">{farmer.equipment_list}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* 8. Loan Details */}
                  {loans.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Loan Details</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {loans.map((loan, idx) => (
                            <div key={idx} className="border rounded-lg p-4 space-y-2">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {loan.amount && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Amount</p>
                                    <p className="text-sm font-medium">
                                      {loan.currency} {loan.amount.toLocaleString()}
                                    </p>
                                  </div>
                                )}
                                {loan.issuance_date && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Issuance Date</p>
                                    <p className="text-sm font-medium">
                                      {new Date(loan.issuance_date).toLocaleDateString()}
                                    </p>
                                  </div>
                                )}
                                {loan.end_date && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">End Date</p>
                                    <p className="text-sm font-medium">
                                      {new Date(loan.end_date).toLocaleDateString()}
                                    </p>
                                  </div>
                                )}
                                {(loan as any).interest_rate && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Interest Rate</p>
                                    <p className="text-sm font-medium">{(loan as any).interest_rate}%</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 9. Farm Comments */}
                  {(farmer.bank_comment || farmer.other_comment) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Farm Comments</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {farmer.bank_comment && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Bank Comment</p>
                            <p className="text-sm font-medium whitespace-pre-wrap">{farmer.bank_comment}</p>
                          </div>
                        )}
                        {farmer.other_comment && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Other Comments</p>
                            <p className="text-sm font-medium whitespace-pre-wrap">{farmer.other_comment}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* 10. Orchard Sector Maps */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Orchard Sector Maps</CardTitle>
                        {isAdmin && (
                          <Button 
                            onClick={() => setUploadModalOpen(true)}
                            size="sm"
                            variant="outline"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Map
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {farmerId && <OrchardMapViewer farmerId={farmerId} isAdmin={isAdmin} />}
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardHeader>
        </Card>

        {/* Main Content - Analytics & Monitoring */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-8">
                {/* Phases Section with Horizontal Scroll */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-heading-primary">Phases & Monitoring</h2>
                    {isAdmin && (
                      <p className="text-sm text-muted-foreground">
                        Click "Edit" on any phase card to update scores
                      </p>
                    )}
                  </div>
                  
                  <div className="relative">
                    <div className="overflow-x-auto pb-4">
                      <div className="flex gap-4 min-w-max">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((phaseNumber) => (
                          <PhaseCard
                            key={phaseNumber}
                            phase={getPhaseData(phaseNumber)}
                            phaseNumber={phaseNumber}
                            monitoredIssues={Array.isArray(monitoredIssues) ? monitoredIssues : []}
                            onEditPhase={() => handleEditPhase(phaseNumber)}
                            onViewF100={() => handleViewF100(phaseNumber)}
                            onEditIssue={isAdmin ? handleEditIssue : undefined}
                            onViewIssue={!isAdmin ? handleViewIssue : undefined}
                            onToggleSelection={(issueId) => handleToggleSelection(phaseNumber, issueId)}
                            selectedIssues={selectedIssues}
                            isAdmin={isAdmin}
                            hasF100={hasF100Report(phaseNumber)}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
                  </div>
                </div>

                <Separator />

                {/* Charts Section */}
                <div>
                  <ChartDisplay farmerId={farmerId || ''} />
                </div>

                <Separator />

                {/* Orchard Maps Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-heading-primary">
                      Orchard Sector Maps
                    </h3>
                    {isAdmin && (
                      <Button 
                        onClick={() => setUploadModalOpen(true)}
                        size="sm"
                        variant="outline"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Map
                      </Button>
                    )}
                  </div>
                  
                  {farmerId && <OrchardMapViewer farmerId={farmerId} isAdmin={isAdmin} />}
                </div>
            </div>
          </CardContent>
        </Card>

        {/* Modals */}
        {farmer && (
          <>
            {/* Farmer Edit Modal - Available to all users */}
            <FarmerModal
              isOpen={farmerModalOpen}
              onClose={() => setFarmerModalOpen(false)}
              farmer={farmer}
            />
            
            {/* Admin-only modals */}
            {isAdmin && (
              <>
                <OrchardMapUploadModal
                  isOpen={uploadModalOpen}
                  onClose={() => setUploadModalOpen(false)}
                  farmerId={farmerId || ''}
                />
                <PhaseEditModal
                  isOpen={phaseEditModalOpen}
                  onClose={() => {
                    setPhaseEditModalOpen(false);
                    setSelectedPhaseNumber(null);
                    // Invalidate queries to refresh dashboard data
                    queryClient.invalidateQueries({ queryKey: ['farmer-phases', farmerId] });
                    queryClient.invalidateQueries({ queryKey: ['farmers'] });
                  }}
                  farmerId={farmerId || ''}
                  phaseNumber={selectedPhaseNumber || 1}
                  existingPhase={selectedPhaseNumber ? getPhaseData(selectedPhaseNumber) : null}
                />
              </>
            )}
            
            {/* Monitored Issue Editor - Available to both Admin (edit) and Bank Viewer (view-only) */}
            <MonitoredIssueEditor
              isOpen={issueEditorOpen}
              onClose={() => {
                setIssueEditorOpen(false);
                setSelectedIssue(null);
                setSelectedPhaseNumber(null);
              }}
              issue={selectedIssue}
              farmerId={farmerId || undefined}
              phaseNumber={selectedPhaseNumber || undefined}
              readOnly={!isAdmin}
            />
          </>
        )}
        
        {/* Comparison Panel (Always available) */}
        {comparisonSelections.length > 0 && (
          <ComparisonPanel
            selections={comparisonSelections}
            monitoredIssues={Array.isArray(monitoredIssues) ? monitoredIssues : []}
            farmerId={farmerId}
            onRemove={handleRemoveSelection}
            onClear={handleClearComparison}
            onViewDetails={handleViewIssueDetails}
          />
        )}
        
        {/* Issue Details Dialog (For bank viewers) */}
        <Dialog open={issueDetailsOpen} onOpenChange={setIssueDetailsOpen}>
          <DialogContent 
            className="max-w-3xl w-[90vw] transition-all duration-300 animate-in fade-in-0 zoom-in-95"
            aria-describedby="issue-details-description"
          >
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold transition-colors duration-200">
                {viewingIssue?.name}
              </DialogTitle>
              <DialogDescription id="issue-details-description" className="sr-only">
                Detailed information about the selected monitoring issue
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 transition-all duration-300">
              {viewingIssue?.description ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none animate-in fade-in-0 slide-in-from-top-2 duration-500"
                  dangerouslySetInnerHTML={{ __html: viewingIssue.description }}
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12 animate-in fade-in-0 duration-300">
                  No detailed description available for this monitoring issue.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* F-100 Modal */}
        {farmer && f100PhaseNumber && (
          <F100Modal
            isOpen={f100ModalOpen}
            onClose={() => {
              setF100ModalOpen(false);
              setF100PhaseNumber(null);
            }}
            farmerId={farmerId || ''}
            farmerName={farmer.name}
            phaseNumber={f100PhaseNumber}
          />
        )}
      </div>
    </div>
  );
};

export default FarmerProfilePage;

