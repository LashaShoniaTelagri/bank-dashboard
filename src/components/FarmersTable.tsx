import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Edit, Trash2, Upload, Eye, FileText, User, MoreVertical, Brain, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { FarmerModal } from "@/components/FarmerModal";
import { F100Modal } from "@/components/F100Modal";
import { FarmerProfileModal } from "@/components/FarmerProfileModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FileViewer } from "@/components/FileViewer";
import { DataUploadModal } from "@/components/DataUploadModal";
import { SpecialistAssignmentModal } from "@/components/SpecialistAssignmentModal";

interface FarmerWithF100 {
  farmer_id: string;
  bank_id: string;
  name: string;
  id_number: string;
  created_at: string;
  bank_name: string;
  bank_logo_url: string;
  latest: Record<string, {
    issue_date: string;
    score: number;
    file_path: string;
  }>;
}

interface Farmer {
  id: string;
  bank_id: string;
  type: 'person' | 'company';
  name: string;
  id_number: string;
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
}

interface FarmersTableProps {
  filters: {
    search: string;
    fromDate: string;
    toDate: string;
    bankId?: string;
  };
  isAdmin: boolean;
}

export const FarmersTable = ({ filters, isAdmin }: FarmersTableProps) => {
  const { profile } = useAuth();
  const [farmerModal, setFarmerModal] = useState<{ open: boolean; farmer?: Farmer }>({ open: false });
  const [farmerProfileModal, setFarmerProfileModal] = useState<{ 
    open: boolean; 
    farmerId?: string; 
    farmerName?: string; 
  }>({ open: false });
  const [f100Modal, setF100Modal] = useState<{ 
    open: boolean; 
    farmerId?: string; 
    farmerName?: string; 
    editMode?: boolean; 
    deleteMode?: boolean;
    phaseData?: { 
      phase: number; 
      issue_date: string; 
      score: number; 
      file_path: string; 
    } 
  }>({ open: false });
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; type?: 'farmer' | 'f100'; id?: string; title?: string; description?: string }>({ open: false });
  
  // FileViewer state for F-100 reports
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileViewerFiles, setFileViewerFiles] = useState<any[]>([]);
  const [fileViewerInitialIndex, setFileViewerInitialIndex] = useState(0);
  const [fileViewerSectionName, setFileViewerSectionName] = useState('');
  const [isLoadingFile, setIsLoadingFile] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Determine if current user can edit farmers
  const canEditFarmers = isAdmin || profile?.role === 'bank_viewer';
  // Only admins can delete farmers (based on RLS policies)
  const canDeleteFarmers = isAdmin;
  // Only admins can upload F-100, data, and assign specialists
  const canUploadF100 = isAdmin;
  const canUploadData = isAdmin;
  const canAssignSpecialists = isAdmin;

  const { data: farmers = [], isLoading, refetch } = useQuery({
    queryKey: ['farmers', filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_farmers_with_latest_f100', {
        search: filters.search || null,
        from_date: filters.fromDate || null,
        to_date: filters.toDate || null,
        filter_bank_id: filters.bankId || null,
      });

      if (error) throw error;
      return data as FarmerWithF100[];
    },
  });

  const deleteFarmerMutation = useMutation({
    mutationFn: async (farmerId: string) => {
      const { error } = await supabase.from('farmers').delete().eq('id', farmerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      toast({ 
        title: "Farmer deleted successfully",
        variant: "success"
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting farmer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-500 hover:bg-green-500";
    if (score >= 6) return "bg-yellow-500 hover:bg-yellow-500";
    return "bg-red-500 hover:bg-red-500";
  };

  const handleFileViewerClose = () => {
    console.log('🔒 Closing F-100 file viewer');
    setFileViewerOpen(false);
    setFileViewerFiles([]);
    setFileViewerSectionName('');
  };

  const openF100InLightbox = async (filePath: string, farmerName: string, phase: string) => {
    try {
      console.log('🔍 Opening F-100 report in lightbox:', filePath);
      
      // Set loading state for this specific file
      setIsLoadingFile(filePath);
      
      // Generate signed URL for the F-100 report
      const { data, error } = await supabase.storage.from('f100').createSignedUrl(filePath, 3600);
      
      if (error) {
        console.error('❌ Storage error:', error);
        toast({
          title: "Access Error",
          description: `Could not access F-100 report: ${error.message}`,
          variant: "destructive",
        });
        return;
      }
      
      if (data?.signedUrl) {
        console.log('✅ Successfully generated signed URL for F-100 report');
        
        // Create a mock document object for the FileViewer
        const fileName = `F-100_Phase_${phase}_${farmerName}.pdf`;
        const mockDocument = {
          id: `f100-${filePath}`,
          file_name: fileName,
          file_path: filePath,
          file_mime: 'application/pdf',
          file_size_bytes: 0, // We don't have the actual size, but it's not critical for viewing
          created_at: new Date().toISOString(),
          signedUrl: data.signedUrl // Add the signed URL directly
        };
        
        // Open in FileViewer
        setFileViewerFiles([mockDocument]);
        setFileViewerInitialIndex(0);
        setFileViewerSectionName(`F-100 Report - Phase ${phase}`);
        setFileViewerOpen(true);
      } else {
        console.error('❌ No signed URL returned');
        toast({
          title: "Error opening file",
          description: "Could not generate file URL",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      toast({
        title: "Error opening file",
        description: error instanceof Error ? error.message : "Could not access F-100 report",
        variant: "destructive",
      });
    } finally {
      // Clear loading state
      setIsLoadingFile(null);
    }
  };

  const handleEditFarmer = async (farmerId: string) => {
    try {
      const { data, error } = await supabase
        .from('farmers')
        .select('*')
        .eq('id', farmerId)
        .single();
      
      if (error) throw error;
      
      setFarmerModal({ open: true, farmer: data as Farmer });
    } catch (error) {
      toast({
        title: "Error loading farmer",
        description: "Could not load farmer details",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFarmer = (farmerId: string, farmerName: string) => {
    setConfirmDialog({
      open: true,
      type: 'farmer',
      id: farmerId,
      title: "Delete Farmer",
      description: `Are you sure you want to delete "${farmerName}"? This action cannot be undone and will also delete all F-100 reports for this farmer.`,
    });
  };

  const handleConfirmDelete = () => {
    if (confirmDialog.id && confirmDialog.type === 'farmer') {
      deleteFarmerMutation.mutate(confirmDialog.id);
    }
  };

  const handleViewFarmerProfile = (farmerId: string, farmerName: string) => {
    setFarmerProfileModal({
      open: true,
      farmerId,
      farmerName,
    });
  };

  const phases = Array.from({ length: 12 }, (_, i) => i + 1);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading farmers...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <h2 className="text-lg sm:text-xl font-semibold">Farmers & F-100 Reports</h2>
        <Button 
          onClick={() => setFarmerModal({ open: true })}
          className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Farmer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <span>Farmers List ({farmers.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="md:sticky md:left-0 bg-background p-2 text-left font-medium md:z-10 border-r min-w-[200px]" title="Click on farmer names to view their profiles">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-emerald-600" />
                      <span>Name</span>
                    </div>
                  </th>
                  <th className="md:sticky md:left-[200px] bg-background p-2 text-left font-medium md:z-10 border-r">Identification Code</th>
                  {phases.map((phase) => (
                    <th key={phase} className="p-2 text-center font-medium min-w-[120px] border-r">
                      Phase {phase}
                    </th>
                  ))}
                  {canEditFarmers && (
                    <th className="md:sticky md:right-0 bg-background p-2 text-center font-medium md:z-10 border-l">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {farmers.map((farmer) => (
                  <tr key={farmer.farmer_id} className="border-b hover:bg-muted/50">
                    <td className="md:sticky md:left-0 bg-background p-2 font-medium md:z-10 border-r min-w-[200px] max-w-[200px]" title={`Click to view ${farmer.name}'s profile`}>
                      <button
                        onClick={() => handleViewFarmerProfile(farmer.farmer_id, farmer.name)}
                        className="group flex flex-col gap-1.5 text-left w-full p-2 -m-2 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all duration-200 cursor-pointer border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-sm active:scale-95"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400 opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          <span className="truncate font-medium group-hover:underline">
                            {farmer.name}
                          </span>
                          <Eye className="h-3 w-3 text-emerald-500 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                        </div>
                        
                        {/* Separator line */}
                        <div className="h-px bg-border/50 my-0.5" />
                        
                        {/* Bank info first */}
                        {farmer.bank_name && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
                            {farmer.bank_logo_url && (
                              <img 
                                src={farmer.bank_logo_url} 
                                alt={farmer.bank_name}
                                className="h-3 w-auto object-contain flex-shrink-0"
                              />
                            )}
                            <span className="truncate font-medium">{farmer.bank_name}</span>
                          </div>
                        )}
                        
                        {/* Creation time second */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
                          <span className="truncate">
                            {new Date(farmer.created_at).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </button>
                    </td>
                    <td className="md:sticky md:left-[200px] bg-background p-2 md:z-10 border-r">
                      {farmer.id_number}
                    </td>
                    {phases.map((phase) => {
                      const phaseData = farmer.latest[phase.toString()];
                      return (
                        <td key={phase} className="p-2 text-center border-r relative">
                          <div className="flex flex-col items-center justify-center h-16 space-y-1">
                            {/* Admin-only dropdown menu - positioned at top-right of cell */}
                            {isAdmin && phaseData && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="absolute top-1 right-1 h-5 w-5 p-0 hover:bg-slate-100 transition-colors z-10"
                                    title="Admin actions"
                                  >
                                    <MoreVertical className="h-3 w-3 text-slate-600" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    onClick={() => setF100Modal({
                                      open: true,
                                      farmerId: farmer.farmer_id,
                                      farmerName: farmer.name,
                                      editMode: true,
                                      deleteMode: false,
                                      phaseData: {
                                        phase: phase,
                                        issue_date: phaseData.issue_date,
                                        score: phaseData.score,
                                        file_path: phaseData.file_path
                                      }
                                    })}
                                    className="cursor-pointer"
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit F-100 Report
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setF100Modal({
                                        open: true,
                                        farmerId: farmer.farmer_id,
                                        farmerName: farmer.name,
                                        editMode: false,
                                        deleteMode: true,
                                        phaseData: {
                                          phase: phase,
                                          issue_date: phaseData.issue_date,
                                          score: phaseData.score,
                                          file_path: phaseData.file_path
                                        }
                                      });
                                    }}
                                    className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete F-100 Report
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            
                            {phaseData ? (
                              <>
                                <Badge 
                                  className={`${getScoreColor(phaseData.score)} text-white text-xs`}
                                >
                                  {phaseData.score}
                                </Badge>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(phaseData.issue_date).toLocaleDateString()}
                                </div>
                                {/* View F-100 Report button - visible for all users */}
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-8 w-16 text-xs font-medium flex items-center justify-center gap-1 transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                  onClick={() => openF100InLightbox(phaseData.file_path, farmer.name, phase.toString())}
                                  disabled={isLoadingFile === phaseData.file_path}
                                  title="View F-100 Report"
                                >
                                  {isLoadingFile === phaseData.file_path ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                  ) : (
                                    <Eye className="h-3 w-3" />
                                  )}
                                  F-100
                                </Button>
                              </>
                            ) : (
                              <>
                                <div className="h-5 flex items-center">
                                  <div className="text-muted-foreground text-xs">No data</div>
                                </div>
                                <div className="h-4"></div>
                                {canUploadF100 ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-20 text-xs font-medium border-2 border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-500 hover:text-emerald-700 hover:shadow-lg transition-all duration-200 hover:scale-105 shadow-md flex items-center justify-center gap-1"
                                    onClick={() => setF100Modal({ 
                                      open: true, 
                                      farmerId: farmer.farmer_id, 
                                      farmerName: farmer.name 
                                    })}
                                    title="Upload F-100 Report"
                                  >
                                    <Upload className="h-3 w-3" />
                                    Upload
                                  </Button>
                                ) : (
                                  <div className="h-8"></div>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    {canEditFarmers && (
                      <td className="md:sticky md:right-0 bg-background p-2 md:z-10 border-l">
                        <div className="flex gap-1 justify-center">
                          {canUploadData && (
                            <DataUploadModal
                              farmerId={farmer.farmer_id}
                              farmerName={farmer.name}
                              bankId={farmer.bank_id}
                              onUploadComplete={() => {
                                // Refresh data if needed
                              }}
                            />
                          )}
                          {canAssignSpecialists && (
                            <SpecialistAssignmentModal
                              farmerId={farmer.farmer_id}
                              farmerName={farmer.name}
                              bankId={farmer.bank_id}
                              onAssignmentComplete={() => {
                                // Refresh data if needed
                              }}
                            />
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditFarmer(farmer.farmer_id)}
                            title="Edit farmer"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {canDeleteFarmers && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteFarmer(farmer.farmer_id, farmer.name)}
                              title="Delete farmer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {farmers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No farmers found. {canEditFarmers && "Click 'Add Farmer' to create your first farmer."}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <FarmerModal
        isOpen={farmerModal.open}
        onClose={() => setFarmerModal({ open: false })}
        farmer={farmerModal.farmer}
      />

      <FarmerProfileModal
        isOpen={farmerProfileModal.open}
        onClose={() => setFarmerProfileModal({ open: false })}
        farmerId={farmerProfileModal.farmerId || ''}
        farmerName={farmerProfileModal.farmerName || ''}
      />

      <F100Modal
        isOpen={f100Modal.open}
        onClose={() => setF100Modal({ open: false })}
        farmerId={f100Modal.farmerId || ''}
        farmerName={f100Modal.farmerName || ''}
        editMode={f100Modal.editMode}
        deleteMode={f100Modal.deleteMode}
        isAdmin={isAdmin}
        phaseData={f100Modal.phaseData}
      />

      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false })}
        onConfirm={handleConfirmDelete}
        title={confirmDialog.title || ''}
        description={confirmDialog.description || ''}
        confirmText="Delete"
        isDestructive={true}
      />

      {/* FileViewer for F-100 reports */}
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