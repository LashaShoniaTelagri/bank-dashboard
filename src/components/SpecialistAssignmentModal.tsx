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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
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
import { SpecialistAssignmentForm, F100Phase, getPhaseLabel } from "../types/specialist";

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
    phase: 1 as F100Phase,
    notes: ''
  });
  const [selectedSpecialists, setSelectedSpecialists] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<string | null>(null);

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
    enabled: isOpen && !!profile?.user_id, // Only fetch when modal is open and user is authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes - specialists don't change frequently
    cacheTime: 10 * 60 * 1000, // 10 minutes cache
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
    enabled: isOpen && !!farmerId, // Only fetch when modal is open
    staleTime: 2 * 60 * 1000, // 2 minutes - assignments change more frequently
    cacheTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Delete assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { data, error } = await supabase
        .rpc('delete_specialist_assignment', { p_assignment_id: assignmentId });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Assignment deleted",
        description: "Specialist assignment has been removed",
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['specialist-assignments', farmerId] });
      queryClient.invalidateQueries({ queryKey: ['specialist-assignments'] });
      
      onAssignmentComplete?.();
    },
    onError: (error) => {
      console.error('Delete assignment error:', error);
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
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
        phase: 1 as F100Phase,
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

  // Handle delete confirmation
  const handleDeleteClick = (assignmentId: string) => {
    setAssignmentToDelete(assignmentId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (assignmentToDelete) {
      deleteAssignmentMutation.mutate(assignmentToDelete);
    }
    setDeleteConfirmOpen(false);
    setAssignmentToDelete(null);
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
  const getPhaseIcon = (phase: F100Phase) => {
    if (phase <= 4) return <CheckCircle className="h-4 w-4" />;
    if (phase <= 8) return <Brain className="h-4 w-4" />;
    if (phase <= 11) return <AlertCircle className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
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
              value={assignmentData.phase.toString()}
              onValueChange={(value) => setAssignmentData(prev => ({ ...prev, phase: parseInt(value) as F100Phase }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select analysis phase" />
              </SelectTrigger>
              <SelectContent>
                {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as F100Phase[]).map((phase) => (
                  <SelectItem key={phase} value={phase.toString()}>
                    <div className="flex items-center gap-2">
                      {getPhaseIcon(phase)}
                      <div>
                        <div className="font-medium">{getPhaseLabel(phase)}</div>
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
                <CardTitle className="text-sm">Current Assignments for {getPhaseLabel(assignmentData.phase)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {currentPhaseAssignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {specialists.find(s => s.id === assignment.specialist_id)?.email || 'Unknown Specialist'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {assignment.status}
                        </Badge>
                        {profile?.role === 'admin' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(assignment.id)}
                            disabled={deleteAssignmentMutation.isPending}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
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
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-body-secondary">No specialists available</p>
                  <p className="text-xs text-muted-foreground">Contact your administrator to add specialists</p>
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
                      className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                        isSelected 
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-400' 
                          : isAlreadyAssigned
                          ? 'border-border bg-muted/50 cursor-not-allowed opacity-60'
                          : 'border-border hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20'
                      }`}
                      onClick={() => !isAlreadyAssigned && handleSpecialistToggle(specialist.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected 
                              ? 'border-emerald-500 bg-emerald-500 dark:border-emerald-400 dark:bg-emerald-400' 
                              : 'border-muted-foreground dark:border-muted-foreground'
                          }`}>
                            {isSelected && <CheckCircle className="h-3 w-3 text-white dark:text-emerald-950" />}
                          </div>
                          <div>
                            <p className={`font-medium text-sm transition-colors ${
                              isSelected 
                                ? 'text-emerald-900 dark:text-emerald-100' 
                                : 'text-foreground'
                            }`}>{specialist.email}</p>
                            <p className={`text-xs transition-colors ${
                              isSelected 
                                ? 'text-emerald-700 dark:text-emerald-300' 
                                : 'text-muted-foreground'
                            }`}>Agricultural Data Specialist</p>
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
                      <div key={specialistId} className="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">{specialist?.email}</span>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Specialist Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this specialist assignment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete Assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};