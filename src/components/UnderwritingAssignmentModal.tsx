import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, UserPlus, X, Users } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  useAssignedSpecialists,
  useAssignSpecialist,
  useRemoveSpecialistAssignment,
  useListSpecialists,
  useActiveCropTypes,
} from "@/hooks/useUnderwriting";
import type { UnderwritingApplication } from "@/types/underwriting";
import { formatAppNumber, STATUS_LABELS, STATUS_COLORS, CROP_TYPES } from "@/types/underwriting";

interface Props {
  application: UnderwritingApplication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UnderwritingAssignmentModal = ({ application, open, onOpenChange }: Props) => {
  const { data: assigned, isLoading: loadingAssigned } = useAssignedSpecialists(application?.id ?? "");
  const { data: allSpecialists, isLoading: loadingSpecialists } = useListSpecialists(application?.bank_id);
  const assignMutation = useAssignSpecialist();
  const removeMutation = useRemoveSpecialistAssignment();
  const { data: dbCrops } = useActiveCropTypes();

  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) setPendingIds(new Set());
  }, [open]);

  const assignedIds = useMemo(
    () => new Set((assigned ?? []).map((a) => a.specialist_id)),
    [assigned]
  );

  const availableSpecialists = useMemo(
    () => (allSpecialists ?? []).filter((s) => !assignedIds.has(s.user_id)),
    [allSpecialists, assignedIds]
  );

  const togglePending = (userId: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleAssignSelected = async () => {
    if (!application || pendingIds.size === 0) return;

    try {
      for (const specialistId of pendingIds) {
        await assignMutation.mutateAsync({
          applicationId: application.id,
          specialistId,
        });
      }
      toast({
        title: "Specialists Assigned",
        description: `${pendingIds.size} specialist${pendingIds.size > 1 ? "s" : ""} assigned to ${formatAppNumber(application.id)}.`,
      });
      setPendingIds(new Set());
    } catch (error: any) {
      toast({
        title: "Assignment Failed",
        description: error.message || "Could not assign specialists.",
        variant: "destructive",
      });
    }
  };

  const handleRemove = async (assignmentId: string) => {
    if (!application) return;
    try {
      await removeMutation.mutateAsync({
        assignmentId,
        applicationId: application.id,
      });
      toast({ title: "Removed", description: "Specialist removed from application." });
    } catch (error: any) {
      toast({
        title: "Removal Failed",
        description: error.message || "Could not remove specialist.",
        variant: "destructive",
      });
    }
  };

  if (!application) return null;

  const cropLabel = (dbCrops && dbCrops.length > 0
    ? dbCrops.find((c) => c.value === application.crop_type)?.label
    : CROP_TYPES.find((c) => c.value === application.crop_type)?.label
  ) || application.crop_type;
  const isAssigning = assignMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            Assign Specialists
          </DialogTitle>
          <DialogDescription>
            {formatAppNumber(application.id)} - {cropLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Application summary */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground font-mono">
                {formatAppNumber(application.id)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cropLabel} - Submitted {new Date(application.submitted_at).toLocaleDateString()}
              </p>
            </div>
            <Badge className={STATUS_COLORS[application.status]}>
              {STATUS_LABELS[application.status]}
            </Badge>
          </div>

          {/* Currently assigned */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Assigned ({(assigned ?? []).length})
            </h4>
            {loadingAssigned ? (
              <div className="flex items-center gap-2 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : (assigned ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No specialists assigned yet.
              </p>
            ) : (
              <div className="space-y-2">
                {(assigned ?? []).map((a) => {
                  const spec = allSpecialists?.find((s) => s.user_id === a.specialist_id);
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between p-2 rounded-md bg-background border border-border/50"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          {(spec?.email ?? a.specialist_id).charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-foreground">
                          {spec?.email ?? a.specialist_id.slice(0, 8) + "..."}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemove(a.id)}
                        disabled={removeMutation.isPending}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Available specialists */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Available Specialists ({availableSpecialists.length})
            </h4>
            {loadingSpecialists ? (
              <div className="flex items-center gap-2 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading specialists...</span>
              </div>
            ) : availableSpecialists.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                {(allSpecialists ?? []).length === 0
                  ? "No specialists available for this bank."
                  : "All specialists are already assigned."}
              </p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {availableSpecialists.map((spec) => (
                  <label
                    key={spec.user_id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted dark:hover:bg-muted/80 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={pendingIds.has(spec.user_id)}
                      onCheckedChange={() => togglePending(spec.user_id)}
                    />
                    <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                      {spec.email.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-foreground">{spec.email}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Assign button */}
          {pendingIds.size > 0 && (
            <Button
              onClick={handleAssignSelected}
              disabled={isAssigning}
              className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white"
            >
              {isAssigning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Assign {pendingIds.size} Specialist{pendingIds.size > 1 ? "s" : ""}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
