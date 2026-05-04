import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

const windowSchema = z.object({
  window_id: z.coerce.number().int().min(1).max(999),
  window_name: z.string().trim().min(1, "Required").max(200),
  stage: z.string().trim().min(1, "Required"),
  offset_start_days: z.coerce.number().int(),
  offset_end_days: z.coerce.number().int(),
}).refine((v) => v.offset_start_days <= v.offset_end_days, {
  message: "start must be ≤ end",
  path: ["offset_end_days"],
});

type WindowFormValues = z.infer<typeof windowSchema>;

export type EditableWindow = {
  id: string;
  crop_id: string;
  window_id: number;
  window_name: string;
  stage: string;
  offset_start_days: number;
  offset_end_days: number;
};

interface Props {
  cropId: string | null;
  window: EditableWindow | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

export const BloomWindowEditDialog = ({ cropId, window, onClose, onSaved }: Props) => {
  const open = cropId !== null;
  const isCreate = window === null;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Stage dropdown sourced from this crop's frost_thresholds — guards against FK errors.
  // NOTE: distinct query key from the section's full-row query — they must NOT
  // share a cache, since this query selects only `stage` and would otherwise
  // overwrite the section's cached rows, breaking id/numeric fields. (Same
  // collision pattern as MonthlyStagesEditDialog suggestions query.)
  const { data: stages } = useQuery({
    queryKey: ["ale-frost-thresholds-stages", cropId],
    queryFn: async () => {
      if (!cropId) return [];
      const { data, error } = await supabase
        .from("ale_frost_thresholds")
        .select("stage")
        .eq("crop_id", cropId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!cropId,
  });

  const form = useForm<WindowFormValues>({
    resolver: zodResolver(windowSchema),
    defaultValues: getDefaults(window),
  });

  useEffect(() => {
    if (open) form.reset(getDefaults(window));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window?.id, cropId, open]);

  const mutation = useMutation({
    mutationFn: async (values: WindowFormValues) => {
      if (!cropId) throw new Error("No crop in scope");
      const payload = {
        crop_id: cropId,
        window_id: values.window_id,
        window_name: values.window_name,
        stage: values.stage,
        offset_start_days: values.offset_start_days,
        offset_end_days: values.offset_end_days,
      };

      let savedId: string;
      if (isCreate) {
        const { data, error } = await supabase
          .from("ale_bloom_windows")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        savedId = data.id;
        await audit({ user_id: user?.id ?? null, action: "ale_bloom_window_insert", record_id: data.id, old_values: null });
      } else {
        if (!window) throw new Error("window missing");
        const before = strip(window);
        savedId = window.id;
        const { error } = await supabase
          .from("ale_bloom_windows")
          .update(payload)
          .eq("id", window.id);
        if (error) throw error;
        await audit({ user_id: user?.id ?? null, action: "ale_bloom_window_update", record_id: window.id, old_values: before });
      }
      return { savedId };
    },
    onSuccess: async ({ savedId }) => {
      toast({ title: "Saved", description: isCreate ? "Window added." : "Window updated." });
      await queryClient.invalidateQueries({ queryKey: ["ale-bloom-windows", cropId] });
      if (onSaved) onSaved(savedId);
      onClose();
    },
    onError: (e: Error) => {
      const msg =
        /duplicate key|unique/i.test(e.message)
          ? "A window with this id already exists for this crop."
          : /violates foreign key/i.test(e.message)
            ? "Stage doesn't exist for this crop. Add the frost stage first."
            : e.message;
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Add bloom window" : `Edit window — ${window?.window_name}`}</DialogTitle>
          <DialogDescription>
            Stage must reference an existing frost threshold (composite FK).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="window_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Window # *</FormLabel>
                  <FormControl><Input type="number" min={1} max={999} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="window_name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Window name *</FormLabel>
                  <FormControl><Input {...field} placeholder="Bloom to +4wk" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="stage" render={({ field }) => (
              <FormItem>
                <FormLabel>Stage *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={stages?.length ? "Select stage" : "No frost stages defined yet"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {stages?.map((s) => (
                      <SelectItem key={s.stage} value={s.stage}>{s.stage}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription className="text-[10px]">Sourced from this crop's frost thresholds.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="offset_start_days" render={({ field }) => (
                <FormItem>
                  <FormLabel>Offset start (days) *</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormDescription className="text-[10px]">Negative = before bloom.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="offset_end_days" render={({ field }) => (
                <FormItem>
                  <FormLabel>Offset end (days) *</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending || !stages?.length}>
                {mutation.isPending ? "Saving…" : isCreate ? "Add" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const getDefaults = (w: EditableWindow | null): WindowFormValues => ({
  window_id: w?.window_id ?? 1,
  window_name: w?.window_name ?? "",
  stage: w?.stage ?? "",
  offset_start_days: w?.offset_start_days ?? 0,
  offset_end_days: w?.offset_end_days ?? 7,
});

const strip = (w: EditableWindow) => ({
  window_id: w.window_id,
  window_name: w.window_name,
  stage: w.stage,
  offset_start_days: w.offset_start_days,
  offset_end_days: w.offset_end_days,
});

const audit = async (row: { user_id: string | null; action: string; record_id: string; old_values: Record<string, unknown> | null }) => {
  const { error } = await supabase.from("audit_log").insert({
    user_id: row.user_id,
    action: row.action,
    table_name: "ale_bloom_windows",
    record_id: row.record_id,
    old_values: row.old_values,
  });
  if (error) console.warn("audit_log insert failed:", error);
};
