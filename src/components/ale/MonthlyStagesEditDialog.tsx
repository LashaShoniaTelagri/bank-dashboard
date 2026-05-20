import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type EditableMonthlyStage = {
  id: string;
  crop_id: string;
  month: number;
  stages: string[];
};

interface Props {
  cropId: string | null;
  monthlyStage: EditableMonthlyStage | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

export const MonthlyStagesEditDialog = ({ cropId, monthlyStage, onClose, onSaved }: Props) => {
  const open = cropId !== null && monthlyStage !== null;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [stages, setStages] = useState<string[]>(monthlyStage?.stages ?? []);
  const [input, setInput] = useState("");

  // Fetch all months for this crop to derive stage suggestions (consistency hint).
  // NOTE: distinct query key from the section's full-row query — they must NOT
  // share a cache, since this query selects only `stages` and would otherwise
  // overwrite the section's cached rows, breaking month/id fields.
  const { data: allMonthly } = useQuery({
    queryKey: ["ale-crop-monthly-stages-suggestions", cropId],
    queryFn: async () => {
      if (!cropId) return [];
      const { data, error } = await supabase
        .from("ale_crop_monthly_stages")
        .select("stages")
        .eq("crop_id", cropId);
      if (error) throw error;
      return data;
    },
    enabled: !!cropId && open,
  });

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    allMonthly?.forEach((row) => (row.stages as string[]).forEach((s) => set.add(s)));
    stages.forEach((s) => set.delete(s));
    return Array.from(set).sort();
  }, [allMonthly, stages]);

  // Reset state whenever dialog opens with a new month.
  useEffect(() => {
    if (open && monthlyStage) {
      setStages(monthlyStage.stages ?? []);
      setInput("");
    }
  }, [open, monthlyStage?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (stages.includes(trimmed)) return;
    setStages([...stages, trimmed]);
    setInput("");
  };

  const remove = (s: string) => setStages(stages.filter((x) => x !== s));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!cropId || !monthlyStage) throw new Error("No month in scope");
      const before = monthlyStage.stages;

      // Upsert by (crop_id, month) so this works whether the row was seeded or not.
      const { error } = await supabase
        .from("ale_crop_monthly_stages")
        .upsert(
          { crop_id: cropId, month: monthlyStage.month, stages },
          { onConflict: "crop_id,month" }
        );
      if (error) throw error;

      const { error: auditErr } = await supabase.from("audit_log").insert({
        user_id: user?.id ?? null,
        action: "ale_crop_monthly_stages_update",
        table_name: "ale_crop_monthly_stages",
        record_id: monthlyStage.id,
        old_values: { month: monthlyStage.month, stages: before },
      });
      if (auditErr) console.warn("audit_log insert failed:", auditErr);

      return { savedId: monthlyStage.id };
    },
    onSuccess: async ({ savedId }) => {
      toast({ title: "Saved", description: `${MONTH_LABELS[(monthlyStage?.month ?? 1) - 1]} stages updated.` });
      await queryClient.invalidateQueries({ queryKey: ["ale-crop-monthly-stages", cropId] });
      if (onSaved) onSaved(savedId);
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    },
  });

  if (!monthlyStage) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Edit stages — {MONTH_LABELS[monthlyStage.month - 1]} ({monthlyStage.month})
          </DialogTitle>
          <DialogDescription>
            Phenological stages typically active during this calendar month. Free-text labels.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-body-secondary font-semibold">
              Active stages
            </label>
            <div className="flex flex-wrap gap-1.5 min-h-[2rem] p-2 rounded-md border bg-muted/20">
              {stages.length === 0 && (
                <span className="text-xs text-body-secondary italic">No stages — month has no active phenology.</span>
              )}
              {stages.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs flex items-center gap-1 pr-1">
                  {s}
                  <button
                    type="button"
                    onClick={() => remove(s)}
                    className="hover:text-red-500 transition-colors"
                    title={`Remove ${s}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-body-secondary font-semibold">
              Add stage
            </label>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); add(input); }
                }}
                placeholder="e.g. Bud Break"
              />
              <Button type="button" variant="outline" onClick={() => add(input)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </section>

          {suggestions.length > 0 && (
            <section className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-body-secondary font-semibold">
                From other months
              </label>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="text-[10px] cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors"
                    onClick={() => add(s)}
                  >
                    + {s}
                  </Badge>
                ))}
              </div>
            </section>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
