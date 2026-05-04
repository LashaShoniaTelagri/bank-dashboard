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
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

// =============================================================================
// Schema — mirrors specs/modules/ale.md / spec §5.4
// =============================================================================

const varietyFormSchema = z.object({
  display_name: z.string().trim().min(1, "Required").max(120),
  chill_portions_cp: z.coerce.number().min(0).nullable(),
  chill_hours_ch: z.coerce.number().min(0).nullable(),
  chill_units_cu: z.coerce.number().min(0).nullable(),
  gdh_to_bloom: z.coerce.number().min(0).nullable(),
  dafb_harvest_min: z.coerce.number().int().min(0).max(365).nullable(),
  dafb_harvest_max: z.coerce.number().int().min(0).max(365).nullable(),
  source: z.string().trim().max(500).nullable(),
  is_active: z.boolean(),
}).refine(
  (v) => v.dafb_harvest_min == null || v.dafb_harvest_max == null || v.dafb_harvest_min <= v.dafb_harvest_max,
  { message: "min must be ≤ max", path: ["dafb_harvest_max"] }
);

type VarietyFormValues = z.infer<typeof varietyFormSchema>;

export type EditableVariety = {
  id: string;
  crop_id: string;
  display_name: string;
  chill_portions_cp: number | null;
  chill_hours_ch: number | null;
  chill_units_cu: number | null;
  gdh_to_bloom: number | null;
  dafb_harvest_min: number | null;
  dafb_harvest_max: number | null;
  source: string | null;
  sort_order: number;
  is_active: boolean;
};

// `null` variety = creating new for the given cropId
interface Props {
  cropId: string | null;                  // non-null when dialog open
  variety: EditableVariety | null;
  onClose: () => void;
  onSaved?: (id: string) => void;         // notify parent so it can flash the row
}

export const VarietyEditDialog = ({ cropId, variety, onClose, onSaved }: Props) => {
  const open = cropId !== null;
  const isCreate = variety === null;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<VarietyFormValues>({
    resolver: zodResolver(varietyFormSchema),
    defaultValues: getDefaults(variety),
  });

  useEffect(() => {
    if (open) form.reset(getDefaults(variety));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variety?.id, cropId, open]);

  const mutation = useMutation({
    mutationFn: async (values: VarietyFormValues) => {
      if (!cropId) throw new Error("No crop in scope");

      // Common fields (sort_order is not user-edited; arrows handle reorder).
      const commonPayload = {
        display_name: values.display_name,
        chill_portions_cp: values.chill_portions_cp,
        chill_hours_ch: values.chill_hours_ch,
        chill_units_cu: values.chill_units_cu,
        gdh_to_bloom: values.gdh_to_bloom,
        dafb_harvest_min: values.dafb_harvest_min,
        dafb_harvest_max: values.dafb_harvest_max,
        source: values.source?.trim() ? values.source.trim() : null,
        is_active: values.is_active,
      };

      let savedId: string;
      if (isCreate) {
        // New rows go to the end. sort_order = max(existing) + 1.
        const { data: maxRow } = await supabase
          .from("ale_crop_varieties")
          .select("sort_order")
          .eq("crop_id", cropId)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

        const { data, error } = await supabase
          .from("ale_crop_varieties")
          .insert({ crop_id: cropId, ...commonPayload, sort_order: nextSortOrder })
          .select()
          .single();
        if (error) throw error;
        savedId = data.id;

        await writeAudit({
          user_id: user?.id ?? null,
          action: "ale_crop_variety_insert",
          record_id: data.id,
          old_values: null,
        });
      } else {
        if (!variety) throw new Error("variety missing in update");
        const before = stripVariety(variety);
        savedId = variety.id;

        // Update doesn't touch sort_order — that's owned by the up/down arrows.
        const { error } = await supabase
          .from("ale_crop_varieties")
          .update(commonPayload)
          .eq("id", variety.id);
        if (error) throw error;

        await writeAudit({
          user_id: user?.id ?? null,
          action: "ale_crop_variety_update",
          record_id: variety.id,
          old_values: before,
        });
      }
      return { savedId };
    },
    onSuccess: async ({ savedId }) => {
      toast({ title: "Saved", description: isCreate ? "Variety added." : "Variety updated." });
      await queryClient.invalidateQueries({ queryKey: ["ale-crop-varieties", cropId] });
      if (onSaved) onSaved(savedId);
      onClose();
    },
    onError: (e: Error) => {
      // Surface PG unique-violation as a friendly message when possible.
      const msg = /duplicate key|unique/i.test(e.message)
        ? "A variety with this name already exists for this crop."
        : e.message;
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Add variety" : `Edit variety — ${variety?.display_name}`}</DialogTitle>
          <DialogDescription>
            CP, CH, CU, GDH map directly to chill/heat columns. Leave any field blank if unknown.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Variety name *</FormLabel>
                    <FormControl><Input {...field} placeholder="Gala" /></FormControl>
                    <FormDescription className="text-[10px]">Unique within this crop.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(["chill_portions_cp", "chill_hours_ch", "chill_units_cu", "gdh_to_bloom"] as const).map((name) => (
                <FormField key={name} control={form.control} name={name} render={({ field }) => (
                  <FormItem>
                    <FormLabel>{labelFor(name)}</FormLabel>
                    <FormControl>
                      <Input
                        type="number" step="0.01" min={0}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ))}

              <FormField control={form.control} name="dafb_harvest_min" render={({ field }) => (
                <FormItem>
                  <FormLabel>DAFB harvest min</FormLabel>
                  <FormControl>
                    <Input
                      type="number" step="1" min={0} max={365}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="dafb_harvest_max" render={({ field }) => (
                <FormItem>
                  <FormLabel>DAFB harvest max</FormLabel>
                  <FormControl>
                    <Input
                      type="number" step="1" min={0} max={365}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="source" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Source</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Citation, e.g. Gonzalez-Martinez et al. 2025" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="is_active" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border px-3 py-2 md:col-span-2">
                  <FormLabel className="m-0">Active</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
            </div>

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

// =============================================================================
// Helpers
// =============================================================================

const labelFor = (name: string) => ({
  chill_portions_cp: "Chill Portions (CP)",
  chill_hours_ch: "Chill Hours (CH)",
  chill_units_cu: "Chill Units (CU)",
  gdh_to_bloom: "GDH → Bloom",
}[name] ?? name);

const getDefaults = (v: EditableVariety | null): VarietyFormValues => ({
  display_name: v?.display_name ?? "",
  chill_portions_cp: v?.chill_portions_cp ?? null,
  chill_hours_ch: v?.chill_hours_ch ?? null,
  chill_units_cu: v?.chill_units_cu ?? null,
  gdh_to_bloom: v?.gdh_to_bloom ?? null,
  dafb_harvest_min: v?.dafb_harvest_min ?? null,
  dafb_harvest_max: v?.dafb_harvest_max ?? null,
  source: v?.source ?? null,
  is_active: v?.is_active ?? true,
});

const stripVariety = (v: EditableVariety) => ({
  display_name: v.display_name,
  chill_portions_cp: v.chill_portions_cp,
  chill_hours_ch: v.chill_hours_ch,
  chill_units_cu: v.chill_units_cu,
  gdh_to_bloom: v.gdh_to_bloom,
  dafb_harvest_min: v.dafb_harvest_min,
  dafb_harvest_max: v.dafb_harvest_max,
  source: v.source,
  is_active: v.is_active,
});

const writeAudit = async (row: {
  user_id: string | null;
  action: string;
  record_id: string;
  old_values: Record<string, unknown> | null;
}) => {
  const { error } = await supabase.from("audit_log").insert({
    user_id: row.user_id,
    action: row.action,
    table_name: "ale_crop_varieties",
    record_id: row.record_id,
    old_values: row.old_values,
  });
  if (error) console.warn("audit_log insert failed:", error);
};
