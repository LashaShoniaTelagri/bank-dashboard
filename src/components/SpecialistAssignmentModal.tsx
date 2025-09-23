import React, { useState } from "react";
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
import { 
  Users, 
  Brain, 
  Calendar, 
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Plus,
  X
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "./ui/use-toast";
import { SpecialistAssignmentForm, AnalysisPhase } from "../types/specialist";
import { ANALYSIS_PHASES } from "../types/specialist";

interface SpecialistAssignmentModalProps {
  farmerId: string;
  farmerName: string;
  onAssignmentComplete?: () => void;
  bankId?: string;
}

interface Specialist {
  id: string;
  email: string;
  role: string;
  bank_id: string;
}

export const SpecialistAssignmentModal: React.FC<SpecialistAssignmentModalProps> = ({
  farmerId,
  farmerName,
  onAssignmentComplete,
  bankId
}) => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [assignmentData, setAssignmentData] = useState<SpecialistAssignmentForm>({
    farmer_id: farmerId,
    specialist_id: '',
    phase: 'initial_assessment',
    notes: ''
  });
  const [selectedSpecialists, setSelectedSpecialists] = useState<string[]>([]);

  const queryClient = useQueryClient();

  // Fetch available specialists via secure RPC (uses SECURITY DEFINER on backend)
  const { data: specialists = [], isLoading: specialistsLoading } = useQuery({
    queryKey: ['specialists', bankId || null],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('list_specialists', { p_bank_id: bankId || null });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.user_id,
        email: row.email as string,
        role: 'specialist',
        bank_id: row.bank_id as string | null,
      })) as Specialist[];
    },
    enabled: true,
  });

  // Fetch existing assignments for this farmer
  const { data: existingAssignments = [] } = useQuery({
    queryKey: ['specialist-assignments', farmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('specialist_assignments')
        .select('*')
        .eq('farmer_id', farmerId);

      if (error) throw error;
      return data;
    },
    enabled: !!farmerId,
  });

  // Assignment mutation
  const assignmentMutation = useMutation({
    mutationFn: async (assignments: SpecialistAssignmentForm[]) => {
      const { data, error } = await supabase
        .from('specialist_assignments')
        .insert(assignments.map(assignment => ({
          farmer_id: assignment.farmer_id,
          bank_id: bankId || profile?.bank_id || '',
          specialist_id: assignment.specialist_id,
          phase: assignment.phase,
          assigned_by: profile?.user_id || '',
          notes: assignment.notes
        })))
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Assignments created",
        description: `${data.length} specialist assignment(s) created for ${farmerName}`,
      });
      
      // Reset form
      setAssignmentData({
        farmer_id: farmerId,
        specialist_id: '',
        phase: 'initial_assessment',
        notes: ''
      });
      setSelectedSpecialists([]);
      setIsOpen(false);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['specialist-assignments', farmerId] });
      queryClient.invalidateQueries({ queryKey: ['specialist-assignments'] });
      
      onAssignmentComplete?.();
    },
    onError: (error) => {
      console.error('Assignment error:', error);
      toast({
        title: "Assignment failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle specialist selection
  const handleSpecialistToggle = (specialistId: string) => {
    setSelectedSpecialists(prev => 
      prev.includes(specialistId)
        ? prev.filter(id => id !== specialistId)
        : [...prev, specialistId]
    );
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedSpecialists.length === 0) {
      toast({
        title: "No specialists selected",
        description: "Please select at least one specialist to assign",
        variant: "destructive",
      });
      return;
    }

    // Check for existing assignments
    const conflictingAssignments = existingAssignments.filter(assignment => 
      selectedSpecialists.includes(assignment.specialist_id) && 
      assignment.phase === assignmentData.phase
    );

    if (conflictingAssignments.length > 0) {
      toast({
        title: "Conflicting assignments",
        description: "Some specialists are already assigned to this phase",
        variant: "destructive",
      });
      return;
    }

    // Create assignments for all selected specialists
    const assignments = selectedSpecialists.map(specialistId => ({
      ...assignmentData,
      specialist_id: specialistId
    }));

    assignmentMutation.mutate(assignments);
  };

  // Get phase icon
  const getPhaseIcon = (phase: AnalysisPhase) => {
    switch (phase) {
      case 'initial_assessment':
        return <CheckCircle className="h-4 w-4" />;
      case 'crop_analysis':
        return <Brain className="h-4 w-4" />;
      case 'soil_analysis':
        return <Brain className="h-4 w-4" />;
      case 'irrigation_analysis':
        return <Brain className="h-4 w-4" />;
      case 'harvest_analysis':
        return <CheckCircle className="h-4 w-4" />;
      case 'financial_analysis':
        return <Brain className="h-4 w-4" />;
      case 'compliance_review':
        return <AlertCircle className="h-4 w-4" />;
      case 'final_report':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  // Get existing assignments for current phase
  const currentPhaseAssignments = existingAssignments.filter(
    assignment => assignment.phase === assignmentData.phase
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4 mr-2" />
          Assign Specialists
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Specialists to {farmerName}</DialogTitle>
          <DialogDescription>
            Assign specialists to analyze farmer data for specific phases
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Phase Selection */}
          <div className="space-y-2">
            <Label htmlFor="phase">Analysis Phase</Label>
            <Select
              value={assignmentData.phase}
              onValueChange={(value) => setAssignmentData(prev => ({ ...prev, phase: value as AnalysisPhase }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select analysis phase" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ANALYSIS_PHASES).map(([key, phase]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      {getPhaseIcon(key as AnalysisPhase)}
                      <div>
                        <div className="font-medium">{phase.name}</div>
                        <div className="text-xs text-gray-500">{phase.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Current Phase Assignments */}
          {currentPhaseAssignments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Current Assignments for {ANALYSIS_PHASES[assignmentData.phase].name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {currentPhaseAssignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">
                          {specialists.find(s => s.id === assignment.specialist_id)?.email || 'Unknown Specialist'}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {assignment.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Specialist Selection */}
          <div className="space-y-2">
            <Label>Select Specialists</Label>
            {specialistsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : specialists.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No specialists available</p>
                  <p className="text-xs text-gray-500">Contact your administrator to add specialists</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {specialists.map((specialist) => {
                  const isSelected = selectedSpecialists.includes(specialist.id);
                  const isAlreadyAssigned = currentPhaseAssignments.some(
                    assignment => assignment.specialist_id === specialist.id
                  );
                  
                  return (
                    <div
                      key={specialist.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : isAlreadyAssigned
                          ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => !isAlreadyAssigned && handleSpecialistToggle(specialist.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{specialist.email}</p>
                            <p className="text-xs text-gray-500">Agricultural Data Specialist</p>
                          </div>
                        </div>
                        {isAlreadyAssigned && (
                          <Badge variant="outline" className="text-xs">
                            Already Assigned
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Specialists Summary */}
          {selectedSpecialists.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Selected Specialists ({selectedSpecialists.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedSpecialists.map((specialistId) => {
                    const specialist = specialists.find(s => s.id === specialistId);
                    return (
                      <div key={specialistId} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">{specialist?.email}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSpecialistToggle(specialistId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Assignment Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any specific instructions or context for the specialists..."
              value={assignmentData.notes}
              onChange={(e) => setAssignmentData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={assignmentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={selectedSpecialists.length === 0 || assignmentMutation.isPending}
            >
              {assignmentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Assignments...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create {selectedSpecialists.length} Assignment{selectedSpecialists.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};