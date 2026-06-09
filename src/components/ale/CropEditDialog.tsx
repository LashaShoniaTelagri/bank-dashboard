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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

// =============================================================================
// Schema — mirrors specs/modules/ale.md § ale_crops + spec §5.1-5.3
// =============================================================================

const cropFormSchema = z.object({
  // Only used in create mode; immutable once set. Empty => derived from display_name.
  slug: z.string().trim().regex(/^[a-z0-9_-]*$/, "lowercase letters, digits, - or _ only").max(60).optional(),
  display_name: z.string().trim().min(1, "Required").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  hemisphere: z.enum(["north", "south"]),
  is_active: z.boolean(),
  chill_biofix_month: z.coerce.number().int().min(1).max(12),
  chill_biofix_day: z.coerce.number().int().min(1).max(31),
  insufficient_chill_penalty: z.coerce.number().min(0).max(1),
  insufficient_chill_cutoff_month: z.coerce.number().int().min(1).max(12).nullable(),
  insufficient_chill_cutoff_day: z.coerce.number().int().min(1).max(31).nullable(),
}).refine(
  (v) => (v.insufficient_chill_cutoff_month == null) === (v.insufficient_chill_cutoff_day == null),
  { message: "Cutoff month and day must both be set or both empty", path: ["insufficient_chill_cutoff_day"] }
);

type CropFormValues = z.infer<typeof cropFormSchema>;

// =============================================================================
// Crop type — kept local; AleManagement also has its own copy
// =============================================================================

export type EditableCrop = {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  hemisphere: string;
  is_active: boolean;
  chill_biofix_month: number;
  chill_biofix_day: number;
  insufficient_chill_penalty: number;
  insufficient_chill_cutoff_month: number | null;
  insufficient_chill_cutoff_day: number | null;
};

// =============================================================================
// Dialog component
// =============================================================================

interface Props {
  open: boolean;
  crop: EditableCrop | null;          // null + open => create mode
  onClose: () => void;
  onSaved?: (id: string) => void;     // edit: notify parent so it can flash the row
  onCreated?: (id: string) => void;   // create: notify parent (e.g. open the new crop's detail)
}

export const CropEditDialog = ({ open, crop, onClose, onSaved, onCreated }: Props) => {
  const isCreate = crop === null;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<CropFormValues>({
    resolver: zodResolver(cropFormSchema),
    defaultValues: getDefaults(crop),
  });

  // Reset the form whenever the dialog (re)opens — covers both editing a
  // different crop and reopening the create form after a previous create.
  useEffect(() => {
    if (open) form.reset(getDefaults(crop));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, crop?.id]);

  const mutation = useMutation({
    mutationFn: async (values: CropFormValues): Promise<string> => {
      const description = values.description?.trim() ? values.description.trim() : null;

      // ── Create ──────────────────────────────────────────────────────────
      if (isCreate) {
        const slug = (values.slug?.trim() || slugify(values.display_name));
        if (!slug) throw new Error("Could not derive a slug — set one explicitly.");
        const { data, error: insertErr } = await supabase
          .from("ale_crops")
          .insert({
            slug,
            display_name: values.display_name,
            description,
            hemisphere: values.hemisphere,
            is_active: values.is_active,
            chill_biofix_month: values.chill_biofix_month,
            chill_biofix_day: values.chill_biofix_day,
            insufficient_chill_penalty: values.insufficient_chill_penalty,
            insufficient_chill_cutoff_month: values.insufficient_chill_cutoff_month,
            insufficient_chill_cutoff_day: values.insufficient_chill_cutoff_day,
            created_by: user?.id ?? null,
            updated_by: user?.id ?? null,
          })
          .select("id")
          .single();
        if (insertErr) throw insertErr;

        const { error: auditErr } = await supabase.from("audit_log").insert({
          user_id: user?.id ?? null,
          action: "ale_crop_create",
          table_name: "ale_crops",
          record_id: data.id,
          new_values: { slug, display_name: values.display_name },
        });
        if (auditErr) console.warn("audit_log insert failed:", auditErr);
        return data.id;
      }

      // ── Update ──────────────────────────────────────────────────────────
      if (!crop) throw new Error("No crop in scope");

      // Build the update payload (normalize empty description to null)
      const next = {
        display_name: values.display_name,
        description: values.description?.trim() ? values.description.trim() : null,
        hemisphere: values.hemisphere,
        is_active: values.is_active,
        chill_biofix_month: values.chill_biofix_month,
        chill_biofix_day: values.chill_biofix_day,
        insufficient_chill_penalty: values.insufficient_chill_penalty,
        insufficient_chill_cutoff_month: values.insufficient_chill_cutoff_month,
        insufficient_chill_cutoff_day: values.insufficient_chill_cutoff_day,
        updated_by: user?.id ?? null,
      };

      // Snapshot before-values for audit
      const before = {
        display_name: crop.display_name,
        description: crop.description,
        hemisphere: crop.hemisphere,
        is_active: crop.is_active,
        chill_biofix_month: crop.chill_biofix_month,
        chill_biofix_day: crop.chill_biofix_day,
        insufficient_chill_penalty: crop.insufficient_chill_penalty,
        insufficient_chill_cutoff_month: crop.insufficient_chill_cutoff_month,
        insufficient_chill_cutoff_day: crop.insufficient_chill_cutoff_day,
      };

      const { error: updateErr } = await supabase
        .from("ale_crops")
        .update(next)
        .eq("id", crop.id);
      if (updateErr) throw updateErr;

      // Best-effort audit row. RLS allows inserts to audit_log from any authenticated user.
      const { error: auditErr } = await supabase.from("audit_log").insert({
        user_id: user?.id ?? null,
        action: "ale_crop_update",
        table_name: "ale_crops",
        record_id: crop.id,
        old_values: before,
      });
      if (auditErr) {
        // Audit failure shouldn't block the save; log and continue.
        console.warn("audit_log insert failed:", auditErr);
      }
      return crop.id;
    },
    onSuccess: async (id) => {
      toast({ title: "Saved", description: isCreate ? "Crop created." : "Crop updated." });
      await queryClient.invalidateQueries({ queryKey: ["ale-crops"] });
      if (isCreate) onCreated?.(id);
      else onSaved?.(id);
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Add crop" : `Edit crop${crop?.display_name ? ` — ${crop.display_name}` : ""}`}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "The slug is permanent — leave it blank to derive it from the display name."
              : <>Slug <code className="text-xs font-mono">{crop?.slug}</code> is immutable.</>}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">

            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name *</FormLabel>
                  <FormControl><Input {...field} placeholder="Apple" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isCreate && (
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="apple (auto from name if blank)" />
                    </FormControl>
                    <FormDescription className="text-[10px]">Lowercase letters, digits, - or _. Permanent.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} placeholder="Optional notes for agronomists" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="hemisphere"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hemisphere *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="north">North</SelectItem>
                        <SelectItem value="south">South</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div>
                      <FormLabel className="m-0">Active</FormLabel>
                      <FormDescription className="text-[10px]">Hide from default UI when off.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <fieldset className="rounded-md border p-3 space-y-3">
              <legend className="text-xs uppercase tracking-wider text-body-secondary px-1">Chill biofix</legend>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="chill_biofix_month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Month (1–12) *</FormLabel>
                      <FormControl><Input type="number" min={1} max={12} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="chill_biofix_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Day (1–31) *</FormLabel>
                      <FormControl><Input type="number" min={1} max={31} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </fieldset>

            <fieldset className="rounded-md border p-3 space-y-3">
              <legend className="text-xs uppercase tracking-wider text-body-secondary px-1">Insufficient-chill policy</legend>
              <FormField
                control={form.control}
                name="insufficient_chill_penalty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yield penalty (0–1) *</FormLabel>
                    <FormControl><Input type="number" step="0.01" min={0} max={1} {...field} /></FormControl>
                    <FormDescription className="text-[10px]">e.g. 0.26 = 26% yield loss.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="insufficient_chill_cutoff_month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cutoff month (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number" min={1} max={12}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="insufficient_chill_cutoff_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cutoff day (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number" min={1} max={31}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const getDefaults = (crop: EditableCrop | null): CropFormValues => ({
  slug: crop?.slug ?? "",
  display_name: crop?.display_name ?? "",
  description: crop?.description ?? "",
  hemisphere: (crop?.hemisphere as "north" | "south") ?? "north",
  is_active: crop?.is_active ?? true,
  chill_biofix_month: crop?.chill_biofix_month ?? 9,
  chill_biofix_day: crop?.chill_biofix_day ?? 1,
  insufficient_chill_penalty: crop?.insufficient_chill_penalty ?? 0.26,
  insufficient_chill_cutoff_month: crop?.insufficient_chill_cutoff_month ?? null,
  insufficient_chill_cutoff_day: crop?.insufficient_chill_cutoff_day ?? null,
});
