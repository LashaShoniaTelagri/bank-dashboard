import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sprout, Atom, Plus, Trash2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { CropEditDialog } from "./CropEditDialog";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { ParitySection } from "./ParitySection";
import { fmt, type Crop } from "./aleShared";

/**
 * Crop list for the ALE Crop Management module: the catalogue landing view.
 * Add a crop, click a row to drill into its detail, or delete a crop (which
 * cascades all of its varieties / thresholds / windows / monthly stages).
 */
export const CropListView = ({
  crops, isLoading, error, onSelect,
}: {
  crops: Crop[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onSelect: (cropId: string) => void;
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Crop | null>(null);

  // Variety counts per crop in one query, tallied client-side.
  const { data: varietyCounts } = useQuery({
    queryKey: ["ale-variety-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ale_crop_varieties").select("crop_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data) counts[row.crop_id] = (counts[row.crop_id] ?? 0) + 1;
      return counts;
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (crop: Crop) => {
      const { error } = await supabase.from("ale_crops").delete().eq("id", crop.id);
      if (error) throw error;
      const { error: auditErr } = await supabase.from("audit_log").insert({
        user_id: user?.id ?? null,
        action: "ale_crop_delete",
        table_name: "ale_crops",
        record_id: crop.id,
        old_values: crop,
      });
      if (auditErr) console.warn("audit_log insert failed:", auditErr);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Crop and all its parameters removed." });
      queryClient.invalidateQueries({ queryKey: ["ale-crops"] });
      queryClient.invalidateQueries({ queryKey: ["ale-variety-counts"] });
      setPendingDelete(null);
    },
    onError: (e: Error) => {
      const msg = /violates foreign key/i.test(e.message)
        ? "Cannot delete: another record references this crop."
        : e.message;
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
      setPendingDelete(null);
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Sprout className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Crops
              {crops && <Badge variant="outline" className="text-[10px]">{crops.length}</Badge>}
            </CardTitle>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add crop
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-body-secondary">Loading crops…</p>}
          {error && <p className="text-sm text-red-500">Failed to load: {error.message}</p>}
          {crops?.length === 0 && <p className="text-sm text-body-secondary">No crops yet. Click “Add crop” to create one.</p>}

          {crops && crops.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Hemisphere</TableHead>
                  <TableHead className="text-right">Varieties</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crops.map((crop) => (
                  <TableRow
                    key={crop.id}
                    className="cursor-pointer"
                    onClick={() => onSelect(crop.id)}
                  >
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <ChevronRight className="h-3.5 w-3.5 text-body-secondary" />
                        {crop.display_name}
                      </span>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] font-mono">{crop.slug}</Badge></TableCell>
                    <TableCell className="text-xs text-body-secondary">{crop.hemisphere}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{varietyCounts?.[crop.id] ?? 0}</TableCell>
                    <TableCell>
                      {crop.is_active
                        ? <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px]">active</Badge>
                        : <Badge variant="destructive" className="text-[10px]">inactive</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm" variant="ghost" title="Delete crop"
                        disabled={deleteMut.isPending}
                        onClick={(e) => { e.stopPropagation(); setPendingDelete(crop); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <GlobalPhysicsCard />

      <ParitySection />

      <CropEditDialog
        open={createOpen}
        crop={null}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => { setCreateOpen(false); onSelect(id); }}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete crop?"
        description={
          <>
            Delete <strong>{pendingDelete?.display_name}</strong> and <strong>all</strong> of its varieties,
            frost thresholds, bloom windows, and monthly stages? This cannot be undone.
          </>
        }
        busy={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

// =============================================================================
// Global physics card (admin-relevant; one active version)
// =============================================================================

const GlobalPhysicsCard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["ale-global-physics-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ale_global_physics")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return null;
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Atom className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Global physics
          </CardTitle>
        </CardHeader>
        <CardContent><p className="text-sm text-body-secondary">No active version.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Atom className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Global physics <Badge variant="outline">v{data.version}</Badge>
            <Badge className="bg-emerald-600 hover:bg-emerald-700">active</Badge>
          </CardTitle>
          {data.notes && (
            <p className="text-xs text-body-secondary max-w-md">{data.notes}</p>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <PhysicsSubsection title="Frost detection cutoff">
          <code className="text-xs">frost_threshold_c = {fmt(data.frost_threshold_c)}</code>
        </PhysicsSubsection>

        <PhysicsSubsection title="Utah breakpoints (Richardson 1974)">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">t_lower</TableHead>
                <TableHead className="text-right">t_upper</TableHead>
                <TableHead className="text-right">cu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.utah_breakpoints as Array<{ t_lower: number | null; t_upper: number | null; cu: number }>).map((bp, i) => (
                <TableRow key={i}>
                  <TableCell className="text-right font-mono text-xs">{bp.t_lower ?? "−∞"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{bp.t_upper ?? "+∞"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{bp.cu}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PhysicsSubsection>

        <PhysicsSubsection title="Dynamic model (Fishman 1987)">
          <pre className="text-xs font-mono p-2 bg-muted/30 rounded border">{JSON.stringify(data.dynamic_params, null, 2)}</pre>
        </PhysicsSubsection>

        <PhysicsSubsection title="Weinberger model (1950)">
          <pre className="text-xs font-mono p-2 bg-muted/30 rounded border">{JSON.stringify(data.weinberger_params, null, 2)}</pre>
        </PhysicsSubsection>

        <PhysicsSubsection title="Richardson GDH">
          <pre className="text-xs font-mono p-2 bg-muted/30 rounded border">{JSON.stringify(data.richardson_gdh_params, null, 2)}</pre>
        </PhysicsSubsection>
      </CardContent>
    </Card>
  );
};

const PhysicsSubsection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-1.5">
    <h4 className="text-xs uppercase tracking-wider text-body-secondary font-semibold">{title}</h4>
    {children}
  </section>
);
