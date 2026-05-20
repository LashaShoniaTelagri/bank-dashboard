import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

const thresholdSchema = z.object({
  stage: z.string().trim().min(1, "Required").max(100),
  kill_10_pct_c: z.coerce.number(),
  kill_90_pct_c: z.coerce.number(),
  slope_frac: z.coerce.number().gt(0, "Must be > 0"),
}).refine((v) => v.kill_90_pct_c <= v.kill_10_pct_c, {
  message: "kill_90 must be ≤ kill_10 (more negative = more kill)",
  path: ["kill_90_pct_c"],
});

type ThresholdFormValues = z.infer<typeof thresholdSchema>;

export type EditableThreshold = {
  id: string;
  crop_id: string;
  stage: string;
  kill_10_pct_c: number;
  kill_90_pct_c: number;
  slope_frac: number;
  sort_order: number;
};

interface Props {
  cropId: string | null;
  threshold: EditableThreshold | null;
  onClose: () => void;
  /** Called when an edit renamed the stage; parent can flash dependent UI. */
  onCascadeRename?: (newStage: string) => void;
  /** Called with the saved row id so parent can flash the edited row. */
  onSaved?: (id: string) => void;
}

export const FrostThresholdEditDialog = ({ cropId, threshold, onClose, onCascadeRename, onSaved }: Props) => {
  const open = cropId !== null;
  const isCreate = threshold === null;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<ThresholdFormValues>({
    resolver: zodResolver(thresholdSchema),
    defaultValues: getDefaults(threshold),
  });

  useEffect(() => {
    if (open) form.reset(getDefaults(threshold));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold?.id, cropId, open]);

  const mutation = useMutation({
    mutationFn: async (values: ThresholdFormValues) => {
      if (!cropId) throw new Error("No crop in scope");

      const commonPayload = {
        stage: values.stage,
        kill_10_pct_c: values.kill_10_pct_c,
        kill_90_pct_c: values.kill_90_pct_c,
        slope_frac: values.slope_frac,
      };

      let renamedTo: string | null = null;
      let savedId: string;

      if (isCreate) {
        // New rows go to the end. sort_order = max(existing) + 1.
        const { data: maxRow } = await supabase
          .from("ale_frost_thresholds")
          .select("sort_order")
          .eq("crop_id", cropId)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

        const { data, error } = await supabase
          .from("ale_frost_thresholds")
          .insert({ crop_id: cropId, ...commonPayload, sort_order: nextSortOrder })
          .select()
          .single();
        if (error) throw error;
        savedId = data.id;
        await audit({ user_id: user?.id ?? null, action: "ale_frost_threshold_insert", record_id: data.id, old_values: null });
      } else {
        if (!threshold) throw new Error("threshold missing");
        const before = strip(threshold);
        if (before.stage !== values.stage) renamedTo = values.stage;
        savedId = threshold.id;
        // Update doesn't touch sort_order — that's owned by the up/down arrows.
        const { error } = await supabase
          .from("ale_frost_thresholds")
          .update(commonPayload)
          .eq("id", threshold.id);
        if (error) throw error;
        await audit({ user_id: user?.id ?? null, action: "ale_frost_threshold_update", record_id: threshold.id, old_values: before });
      }
      return { renamedTo, savedId };
    },
    onSuccess: async ({ renamedTo, savedId }) => {
      toast({
        title: "Saved",
        description: isCreate
          ? "Frost stage added."
          : renamedTo
            ? "Frost stage renamed. Bloom windows referencing it cascaded automatically."
            : "Frost stage updated.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ale-frost-thresholds", cropId] }),
        queryClient.invalidateQueries({ queryKey: ["ale-bloom-windows", cropId] }),
      ]);
      if (onSaved) onSaved(savedId);
      if (renamedTo && onCascadeRename) onCascadeRename(renamedTo);
      onClose();
    },
    onError: (e: Error) => {
      const msg = /duplicate key|unique/i.test(e.message)
        ? "A stage with this name already exists for this crop."
        : e.message;
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Add frost stage" : `Edit frost stage — ${threshold?.stage}`}</DialogTitle>
          <DialogDescription>
            Renaming a stage cascades automatically to bloom windows that reference it (composite FK ON UPDATE CASCADE).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField control={form.control} name="stage" render={({ field }) => (
              <FormItem>
                <FormLabel>Stage *</FormLabel>
                <FormControl><Input {...field} placeholder="Full bloom" /></FormControl>
                <FormDescription className="text-[10px]">Unique within this crop.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="kill_10_pct_c" render={({ field }) => (
                <FormItem>
                  <FormLabel>kill_10 (°C) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormDescription className="text-[10px]">~10% kill threshold (typically negative).</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="kill_90_pct_c" render={({ field }) => (
                <FormItem>
                  <FormLabel>kill_90 (°C) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormDescription className="text-[10px]">Must be ≤ kill_10.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="slope_frac" render={({ field }) => (
              <FormItem>
                <FormLabel>Slope (frac/°C) *</FormLabel>
                <FormControl><Input type="number" step="0.0001" min={0.0001} {...field} /></FormControl>
                <FormDescription className="text-[10px]">Damage per 1°C below kill_10.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : isCreate ? "Add" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const getDefaults = (t: EditableThreshold | null): ThresholdFormValues => ({
  stage: t?.stage ?? "",
  kill_10_pct_c: t?.kill_10_pct_c ?? -2.2,
  kill_90_pct_c: t?.kill_90_pct_c ?? -3.9,
  slope_frac: t?.slope_frac ?? 0.4,
});

const strip = (t: EditableThreshold) => ({
  stage: t.stage,
  kill_10_pct_c: t.kill_10_pct_c,
  kill_90_pct_c: t.kill_90_pct_c,
  slope_frac: t.slope_frac,
});

const audit = async (row: { user_id: string | null; action: string; record_id: string; old_values: Record<string, unknown> | null }) => {
  const { error } = await supabase.from("audit_log").insert({
    user_id: row.user_id,
    action: row.action,
    table_name: "ale_frost_thresholds",
    record_id: row.record_id,
    old_values: row.old_values,
  });
  if (error) console.warn("audit_log insert failed:", error);
};
