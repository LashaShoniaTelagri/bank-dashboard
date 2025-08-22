import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Upload, Eye, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ComprehensiveFarmerModal } from "@/components/ComprehensiveFarmerModal";
import { F100Modal } from "@/components/F100Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface FarmerWithF100 {
  farmer_id: string;
  bank_id: string;
  name: string;
  id_number: string;
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
  // Comprehensive fields
  company_name?: string;
  first_name?: string;
  last_name?: string;
  farm_location?: string;
  total_area_hectares?: number;
  crop_type?: string;
  crop_varieties?: any[];
  irrigation_type?: string;
  has_reservoir?: boolean;
  reservoir_count?: number;
  reservoir_volumes?: any[];
  water_source?: string;
  last_year_harvest_quantity?: number;
  last_year_harvest_unit?: string;
  irrigation_sectors_count?: number;
  irrigation_system_schema_path?: string;
  equipment_list?: string;
  lab_analysis_path?: string;
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
  const [farmerModal, setFarmerModal] = useState<{ open: boolean; farmer?: Farmer }>({ open: false });
  const [f100Modal, setF100Modal] = useState<{ 
    open: boolean; 
    farmerId?: string; 
    farmerName?: string; 
    editMode?: boolean; 
    phaseData?: { 
      phase: number; 
      issue_date: string; 
      score: number; 
      file_path: string; 
    } 
  }>({ open: false });
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; type?: 'farmer' | 'f100'; id?: string; title?: string; description?: string }>({ open: false });

  const queryClient = useQueryClient();

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
      toast({ title: "Farmer deleted successfully" });
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

  const openFileInNewTab = async (filePath: string) => {
    try {
      const { data } = await supabase.storage.from('f100').createSignedUrl(filePath, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      toast({
        title: "Error opening file",
        description: "Could not generate file URL",
        variant: "destructive",
      });
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Farmers & F-100 Reports</h2>
        {isAdmin && (
          <Button 
            onClick={() => setFarmerModal({ open: true })}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Farmer
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Farmers List ({farmers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 bg-background p-2 text-left font-medium z-10 border-r min-w-[200px]">Name</th>
                  <th className="sticky left-[200px] bg-background p-2 text-left font-medium z-10 border-r">ID Number</th>
                  {phases.map((phase) => (
                    <th key={phase} className="p-2 text-center font-medium min-w-[120px] border-r">
                      Phase {phase}
                    </th>
                  ))}
                  {isAdmin && (
                    <th className="sticky right-0 bg-background p-2 text-center font-medium z-10 border-l">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {farmers.map((farmer) => (
                  <tr key={farmer.farmer_id} className="border-b hover:bg-muted/50">
                    <td className="sticky left-0 bg-background p-2 font-medium z-10 border-r min-w-[200px] max-w-[200px]" title={farmer.name}>
                      <div className="truncate">{farmer.name}</div>
                    </td>
                    <td className="sticky left-[200px] bg-background p-2 z-10 border-r">
                      {farmer.id_number}
                    </td>
                    {phases.map((phase) => {
                      const phaseData = farmer.latest[phase.toString()];
                      return (
                        <td key={phase} className="p-2 text-center border-r">
                          <div className="flex flex-col items-center justify-center h-16 space-y-1">
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
                                <Button
                                  variant="default"
                                  size="sm"
                                  className={`h-8 w-20 text-xs font-medium flex items-center justify-center gap-1 transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg ${
                                    isAdmin 
                                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white' 
                                      : 'bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white'
                                  }`}
                                  onClick={() => setF100Modal({
                                    open: true,
                                    farmerId: farmer.farmer_id,
                                    farmerName: farmer.name,
                                    editMode: isAdmin, // Only admins can edit
                                    phaseData: {
                                      phase: phase,
                                      issue_date: phaseData.issue_date,
                                      score: phaseData.score,
                                      file_path: phaseData.file_path
                                    }
                                  })}
                                  title={isAdmin ? "Edit F-100 Report" : "View F-100 Report"}
                                >
                                  {isAdmin ? (
                                    <>
                                      <Edit className="h-3 w-3" />
                                      F-100
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="h-3 w-3" />
                                      F-100
                                    </>
                                  )}
                                </Button>
                              </>
                            ) : (
                              <>
                                <div className="h-5 flex items-center">
                                  <div className="text-muted-foreground text-xs">No data</div>
                                </div>
                                <div className="h-4"></div>
                                {isAdmin ? (
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
                    {isAdmin && (
                      <td className="sticky right-0 bg-background p-2 z-10 border-l">
                        <div className="flex gap-1 justify-center">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditFarmer(farmer.farmer_id)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteFarmer(farmer.farmer_id, farmer.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {farmers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No farmers found. {isAdmin && "Click 'Add Farmer' to create your first farmer."}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ComprehensiveFarmerModal
        isOpen={farmerModal.open}
        onClose={() => setFarmerModal({ open: false })}
        farmer={farmerModal.farmer}
      />

      <F100Modal
        isOpen={f100Modal.open}
        onClose={() => setF100Modal({ open: false })}
        farmerId={f100Modal.farmerId || ''}
        farmerName={f100Modal.farmerName || ''}
        editMode={f100Modal.editMode}
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
    </div>
  );
};