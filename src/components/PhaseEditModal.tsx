import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar } from "lucide-react";
import { FarmerPhase } from "@/types/phase";

interface PhaseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmerId: string;
  phaseNumber: number;
  existingPhase: FarmerPhase | null;
}

export const PhaseEditModal = ({
  isOpen,
  onClose,
  farmerId,
  phaseNumber,
  existingPhase
}: PhaseEditModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [score, setScore] = useState<string>(existingPhase?.score?.toString() || "");
  const [issueDate, setIssueDate] = useState<string>(existingPhase?.issue_date || "");
  const [notes, setNotes] = useState<string>(existingPhase?.notes || "");
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existingPhase) {
      setScore(existingPhase.score?.toString() || "");
      setIssueDate(existingPhase.issue_date || "");
      setNotes(existingPhase.notes || "");
    } else {
      setScore("");
      setIssueDate("");
      setNotes("");
    }
  }, [existingPhase, isOpen]);

  const upsertPhaseMutation = useMutation({
    mutationFn: async () => {
      const scoreValue = score ? parseFloat(score) : null;
      
      if (scoreValue !== null && (scoreValue < 0 || scoreValue > 10)) {
        throw new Error("Score must be between 0 and 10");
      }

      const phaseData = {
        farmer_id: farmerId,
        phase_number: phaseNumber,
        score: scoreValue,
        issue_date: issueDate || null,
        notes: notes || null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('farmer_phases')
        .upsert(phaseData, {
          onConflict: 'farmer_id,phase_number'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmer-phases', farmerId] });
      toast({
        title: "Success",
        description: `Phase ${phaseNumber} has been updated successfully`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update phase",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertPhaseMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-[500px]"
        aria-describedby="phase-edit-description"
      >
        <DialogHeader>
          <DialogTitle>Edit Phase {phaseNumber}</DialogTitle>
          <DialogDescription id="phase-edit-description">
            Update the score and information for Phase {phaseNumber}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Score Input */}
          <div className="space-y-2">
            <Label htmlFor="score">
              Score (0-10)
            </Label>
            <Input
              id="score"
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="e.g., 7.5"
            />
            <p className="text-xs text-muted-foreground">
              Enter a score between 0 and 10 (e.g., 8.4 for green, 7.2 for yellow, 6.3 for red)
            </p>
          </div>

          {/* Issue Date */}
          <div className="space-y-2">
            <Label htmlFor="issue_date">
              Issue Date
            </Label>
            <div 
              className="relative cursor-pointer"
              onClick={() => dateInputRef.current?.showPicker?.()}
            >
              <Input
                ref={dateInputRef}
                id="issue_date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="pr-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this phase..."
              rows={4}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={upsertPhaseMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={upsertPhaseMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {upsertPhaseMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

