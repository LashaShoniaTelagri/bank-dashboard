import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sprout, Snowflake, Calendar, Activity, Pencil, Plus, Trash2, ArrowUp, ArrowDown, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { CropEditDialog, type EditableCrop } from "./CropEditDialog";
import { VarietyEditDialog, type EditableVariety } from "./VarietyEditDialog";
import { FrostThresholdEditDialog, type EditableThreshold } from "./FrostThresholdEditDialog";
import { BloomWindowEditDialog, type EditableWindow } from "./BloomWindowEditDialog";
import { MonthlyStagesEditDialog, type EditableMonthlyStage } from "./MonthlyStagesEditDialog";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import {
  FLASH_CLS, NO_FLASH_CLS, MONTH_LABELS, type Crop, monthDay, fmt, SortableHead, SectionShell,
} from "./aleShared";

/**
 * Per-crop detail view for the ALE Crop Management module. Shows core crop
 * metadata plus the four editable sub-tables (varieties, frost thresholds,
 * bloom windows, monthly stages). Reached by clicking a crop in CropListView.
 */
export const CropDetailView = ({ crop, onBack }: { crop: Crop; onBack: () => void }) => {
  const [editingCrop, setEditingCrop] = useState<EditableCrop | null>(null);
  const [varietyDialog, setVarietyDialog] = useState<{ cropId: string; variety: EditableVariety | null } | null>(null);
  const [thresholdDialog, setThresholdDialog] = useState<{ cropId: string; threshold: EditableThreshold | null } | null>(null);
  const [windowDialog, setWindowDialog] = useState<{ cropId: string; window: EditableWindow | null } | null>(null);
  const [monthlyDialog, setMonthlyDialog] = useState<{ cropId: string; monthlyStage: EditableMonthlyStage } | null>(null);
  const [flashedRowIds, setFlashedRowIds] = useState<Set<string>>(new Set());
  const [flashedStages, setFlashedStages] = useState<Set<string>>(new Set());

  // Flash a single row by id for ~1.5s after any edit/insert.
  const flashRow = (id: string) => {
    setFlashedRowIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setFlashedRowIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 1500);
  };

  const flashCascadedStage = (newStage: string) => {
    setFlashedStages(new Set([newStage]));
    setTimeout(() => setFlashedStages(new Set()), 1500);
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
        <ArrowLeft className="h-4 w-4" /> All crops
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sprout className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                {crop.display_name}
                <Badge variant="outline" className="text-[10px] font-mono">{crop.slug}</Badge>
                {!crop.is_active && <Badge variant="destructive" className="text-[10px]">inactive</Badge>}
              </CardTitle>
              {crop.description && <CardDescription className="mt-1">{crop.description}</CardDescription>}
            </div>
            <div className="flex items-start gap-3">
              <div className="text-xs text-body-secondary text-right space-y-0.5">
                <div>Biofix: <strong>{monthDay(crop.chill_biofix_month, crop.chill_biofix_day)}</strong></div>
                <div>Chill cutoff: <strong>{monthDay(crop.insufficient_chill_cutoff_month, crop.insufficient_chill_cutoff_day)}</strong></div>
                <div>Penalty: <strong>{(crop.insufficient_chill_penalty * 100).toFixed(1)}%</strong></div>
                <div>Hemisphere: <strong>{crop.hemisphere}</strong></div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditingCrop(crop)} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <VarietiesSection cropId={crop.id} onAdd={() => setVarietyDialog({ cropId: crop.id, variety: null })} onEdit={(variety) => setVarietyDialog({ cropId: crop.id, variety })} flashedRowIds={flashedRowIds} />
          <FrostThresholdsSection cropId={crop.id} onAdd={() => setThresholdDialog({ cropId: crop.id, threshold: null })} onEdit={(threshold) => setThresholdDialog({ cropId: crop.id, threshold })} flashedRowIds={flashedRowIds} />
          <BloomWindowsSection cropId={crop.id} onAdd={() => setWindowDialog({ cropId: crop.id, window: null })} onEdit={(window) => setWindowDialog({ cropId: crop.id, window })} flashedRowIds={flashedRowIds} flashedStages={flashedStages} />
          <MonthlyStagesSection cropId={crop.id} onEdit={(monthlyStage) => setMonthlyDialog({ cropId: crop.id, monthlyStage })} flashedRowIds={flashedRowIds} />
        </CardContent>
      </Card>

      <CropEditDialog open={editingCrop !== null} crop={editingCrop} onClose={() => setEditingCrop(null)} onSaved={flashRow} />
      <VarietyEditDialog
        cropId={varietyDialog?.cropId ?? null}
        variety={varietyDialog?.variety ?? null}
        onClose={() => setVarietyDialog(null)}
        onSaved={flashRow}
      />
      <FrostThresholdEditDialog
        cropId={thresholdDialog?.cropId ?? null}
        threshold={thresholdDialog?.threshold ?? null}
        onClose={() => setThresholdDialog(null)}
        onCascadeRename={flashCascadedStage}
        onSaved={flashRow}
      />
      <BloomWindowEditDialog
        cropId={windowDialog?.cropId ?? null}
        window={windowDialog?.window ?? null}
        onClose={() => setWindowDialog(null)}
        onSaved={flashRow}
      />
      <MonthlyStagesEditDialog
        cropId={monthlyDialog?.cropId ?? null}
        monthlyStage={monthlyDialog?.monthlyStage ?? null}
        onClose={() => setMonthlyDialog(null)}
        onSaved={flashRow}
      />
    </div>
  );
};

// =============================================================================
// Sub-table sections
// =============================================================================

type VarietySortKey =
  | 'display_name'
  | 'chill_portions_cp'
  | 'chill_hours_ch'
  | 'chill_units_cu'
  | 'gdh_to_bloom'
  | 'dafb_harvest_min'
  | 'source';

const VarietiesSection = ({
  cropId, onAdd, onEdit, flashedRowIds,
}: { cropId: string; onAdd: () => void; onEdit: (v: EditableVariety) => void; flashedRowIds: Set<string> }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sortKey, setSortKey] = useState<VarietySortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [pendingDelete, setPendingDelete] = useState<EditableVariety | null>(null);

  const { data: rawData } = useQuery({
    queryKey: ["ale-crop-varieties", cropId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ale_crop_varieties")
        .select("*")
        .eq("crop_id", cropId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // Apply column sort if active; otherwise keep DB sort_order.
  const data = useMemo(() => {
    if (!rawData) return rawData;
    if (!sortKey) return rawData;
    const sorted = [...rawData].sort((a, b) => {
      const av = a[sortKey] as string | number | null;
      const bv = b[sortKey] as string | number | null;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;   // nulls always last
      if (bv == null) return -1;
      const cmp = typeof av === 'string'
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rawData, sortKey, sortDir]);

  // 3-state cycle: asc → desc → none → asc
  const handleHeaderClick = (key: VarietySortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir('asc');
    }
  };

  const isReorderable = sortKey === null;

  const deleteMut = useMutation({
    mutationFn: async (variety: EditableVariety) => {
      const { error } = await supabase.from("ale_crop_varieties").delete().eq("id", variety.id);
      if (error) throw error;
      const { error: auditErr } = await supabase.from("audit_log").insert({
        user_id: user?.id ?? null,
        action: "ale_crop_variety_delete",
        table_name: "ale_crop_varieties",
        record_id: variety.id,
        old_values: variety,
      });
      if (auditErr) console.warn("audit_log insert failed:", auditErr);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Variety removed." });
      queryClient.invalidateQueries({ queryKey: ["ale-crop-varieties", cropId] });
      setPendingDelete(null);
    },
    onError: (e: Error) => {
      const msg = /violates foreign key/i.test(e.message)
        ? "Cannot delete: a logic graph references this variety."
        : e.message;
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
      setPendingDelete(null);
    },
  });

  // Swap sort_order between two rows via 2 UPDATEs.
  // Safe because sort_order has no UNIQUE constraint on this table.
  const swapMut = useMutation({
    mutationFn: async ({ a, b }: { a: { id: string; sort_order: number }; b: { id: string; sort_order: number } }) => {
      const { error: e1 } = await supabase.from("ale_crop_varieties").update({ sort_order: b.sort_order }).eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("ale_crop_varieties").update({ sort_order: a.sort_order }).eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ale-crop-varieties", cropId] }),
    onError: (e: Error) => toast({ title: "Reorder failed", description: e.message, variant: "destructive" }),
  });

  return (
    <SectionShell
      icon={Sprout} title="Varieties" count={data?.length}
      action={
        <Button size="sm" variant="outline" onClick={onAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add variety
        </Button>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead column="display_name"      label="Name"          sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} />
            <SortableHead column="chill_portions_cp" label="CP"            sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} align="right" />
            <SortableHead column="chill_hours_ch"    label="CH"            sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} align="right" />
            <SortableHead column="chill_units_cu"    label="CU"            sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} align="right" />
            <SortableHead column="gdh_to_bloom"      label="GDH→Bloom"     sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} align="right" />
            <SortableHead column="dafb_harvest_min"  label="DAFB min/max"  sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} align="right" />
            <SortableHead column="source"            label="Source"        sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} />
            <TableHead className="text-right w-[160px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((v, i) => {
            const prev = isReorderable && i > 0 ? data[i - 1] : null;
            const next = isReorderable && i < data.length - 1 ? data[i + 1] : null;
            const isFlashing = flashedRowIds.has(v.id);
            return (
              <TableRow
                key={v.id}
                className={`${isFlashing ? FLASH_CLS : NO_FLASH_CLS} ${v.is_active ? "" : "opacity-60"}`}
              >
                <TableCell className="font-medium">{v.display_name}</TableCell>
                <TableCell className="text-right font-mono text-xs">{fmt(v.chill_portions_cp)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{fmt(v.chill_hours_ch)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{fmt(v.chill_units_cu)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{fmt(v.gdh_to_bloom)}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {v.dafb_harvest_min == null ? "—" : `${v.dafb_harvest_min}/${v.dafb_harvest_max}`}
                </TableCell>
                <TableCell className="text-xs text-body-secondary">{v.source}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      size="sm" variant="ghost"
                      title={isReorderable ? "Move up" : "Clear column sort to reorder"}
                      disabled={!isReorderable || !prev || swapMut.isPending}
                      onClick={() => prev && swapMut.mutate({
                        a: { id: v.id, sort_order: v.sort_order },
                        b: { id: prev.id, sort_order: prev.sort_order },
                      })}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      title={isReorderable ? "Move down" : "Clear column sort to reorder"}
                      disabled={!isReorderable || !next || swapMut.isPending}
                      onClick={() => next && swapMut.mutate({
                        a: { id: v.id, sort_order: v.sort_order },
                        b: { id: next.id, sort_order: next.sort_order },
                      })}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onEdit(v as EditableVariety)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" title="Delete"
                      disabled={deleteMut.isPending}
                      onClick={() => setPendingDelete(v as EditableVariety)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete variety?"
        description={<>Delete variety <strong>{pendingDelete?.display_name}</strong>? This cannot be undone.</>}
        busy={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </SectionShell>
  );
};

type ThresholdSortKey = 'stage' | 'kill_10_pct_c' | 'kill_90_pct_c' | 'slope_frac';

const FrostThresholdsSection = ({
  cropId, onAdd, onEdit, flashedRowIds,
}: { cropId: string; onAdd: () => void; onEdit: (t: EditableThreshold) => void; flashedRowIds: Set<string> }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sortKey, setSortKey] = useState<ThresholdSortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [pendingDelete, setPendingDelete] = useState<EditableThreshold | null>(null);

  const { data: rawData } = useQuery({
    queryKey: ["ale-frost-thresholds", cropId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ale_frost_thresholds")
        .select("*")
        .eq("crop_id", cropId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const data = useMemo(() => {
    if (!rawData) return rawData;
    if (!sortKey) return rawData;
    const sorted = [...rawData].sort((a, b) => {
      const av = a[sortKey] as string | number | null;
      const bv = b[sortKey] as string | number | null;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'string'
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rawData, sortKey, sortDir]);

  const handleHeaderClick = (key: ThresholdSortKey) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortKey(null); setSortDir('asc'); }
  };

  const isReorderable = sortKey === null;

  const deleteMut = useMutation({
    mutationFn: async (t: EditableThreshold) => {
      const { error } = await supabase.from("ale_frost_thresholds").delete().eq("id", t.id);
      if (error) throw error;
      const { error: auditErr } = await supabase.from("audit_log").insert({
        user_id: user?.id ?? null,
        action: "ale_frost_threshold_delete",
        table_name: "ale_frost_thresholds",
        record_id: t.id,
        old_values: t,
      });
      if (auditErr) console.warn("audit_log insert failed:", auditErr);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Frost stage removed." });
      queryClient.invalidateQueries({ queryKey: ["ale-frost-thresholds", cropId] });
      setPendingDelete(null);
    },
    onError: (e: Error) => {
      const msg = /violates foreign key/i.test(e.message)
        ? "Cannot delete: bloom windows reference this stage. Reassign or delete those windows first."
        : e.message;
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
      setPendingDelete(null);
    },
  });

  const swapMut = useMutation({
    mutationFn: async ({ a, b }: { a: { id: string; sort_order: number }; b: { id: string; sort_order: number } }) => {
      const { error: e1 } = await supabase.from("ale_frost_thresholds").update({ sort_order: b.sort_order }).eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("ale_frost_thresholds").update({ sort_order: a.sort_order }).eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ale-frost-thresholds", cropId] }),
    onError: (e: Error) => toast({ title: "Reorder failed", description: e.message, variant: "destructive" }),
  });

  return (
    <SectionShell
      icon={Snowflake} title="Frost thresholds" count={data?.length}
      action={<Button size="sm" variant="outline" onClick={onAdd} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add stage</Button>}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead column="stage"          label="Stage"             sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} />
            <SortableHead column="kill_10_pct_c"  label="Kill 10% (°C)"    sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} align="right" />
            <SortableHead column="kill_90_pct_c"  label="Kill 90% (°C)"    sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} align="right" />
            <SortableHead column="slope_frac"     label="Slope (frac/°C)"  sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} align="right" />
            <TableHead className="text-right w-[160px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((t, i) => {
            const prev = isReorderable && i > 0 ? data[i - 1] : null;
            const next = isReorderable && i < data.length - 1 ? data[i + 1] : null;
            const isFlashing = flashedRowIds.has(t.id);
            return (
              <TableRow key={t.id} className={isFlashing ? FLASH_CLS : NO_FLASH_CLS}>
                <TableCell className="font-medium">{t.stage}</TableCell>
                <TableCell className="text-right font-mono text-xs">{fmt(t.kill_10_pct_c)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{fmt(t.kill_90_pct_c)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{fmt(t.slope_frac, 4)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      size="sm" variant="ghost"
                      title={isReorderable ? "Move up" : "Clear column sort to reorder"}
                      disabled={!isReorderable || !prev || swapMut.isPending}
                      onClick={() => prev && swapMut.mutate({
                        a: { id: t.id, sort_order: t.sort_order },
                        b: { id: prev.id, sort_order: prev.sort_order },
                      })}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      title={isReorderable ? "Move down" : "Clear column sort to reorder"}
                      disabled={!isReorderable || !next || swapMut.isPending}
                      onClick={() => next && swapMut.mutate({
                        a: { id: t.id, sort_order: t.sort_order },
                        b: { id: next.id, sort_order: next.sort_order },
                      })}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onEdit(t as EditableThreshold)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" title="Delete"
                      disabled={deleteMut.isPending}
                      onClick={() => setPendingDelete(t as EditableThreshold)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete frost stage?"
        description={<>Delete frost stage <strong>{pendingDelete?.stage}</strong>? This cannot be undone.</>}
        busy={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </SectionShell>
  );
};

type WindowSortKey = 'window_id' | 'window_name' | 'stage' | 'offset_start_days' | 'offset_end_days';

const BloomWindowsSection = ({
  cropId, onAdd, onEdit, flashedRowIds, flashedStages,
}: {
  cropId: string;
  onAdd: () => void;
  onEdit: (w: EditableWindow) => void;
  flashedRowIds: Set<string>;
  flashedStages: Set<string>;
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sortKey, setSortKey] = useState<WindowSortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [pendingDelete, setPendingDelete] = useState<EditableWindow | null>(null);

  const { data: rawData } = useQuery({
    queryKey: ["ale-bloom-windows", cropId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ale_bloom_windows")
        .select("*")
        .eq("crop_id", cropId)
        .order("window_id");
      if (error) throw error;
      return data;
    },
  });

  const data = useMemo(() => {
    if (!rawData) return rawData;
    if (!sortKey) return rawData;
    const sorted = [...rawData].sort((a, b) => {
      const av = a[sortKey] as string | number | null;
      const bv = b[sortKey] as string | number | null;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'string'
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rawData, sortKey, sortDir]);

  const handleHeaderClick = (key: WindowSortKey) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortKey(null); setSortDir('asc'); }
  };

  const deleteMut = useMutation({
    mutationFn: async (w: EditableWindow) => {
      const { error } = await supabase.from("ale_bloom_windows").delete().eq("id", w.id);
      if (error) throw error;
      const { error: auditErr } = await supabase.from("audit_log").insert({
        user_id: user?.id ?? null,
        action: "ale_bloom_window_delete",
        table_name: "ale_bloom_windows",
        record_id: w.id,
        old_values: w,
      });
      if (auditErr) console.warn("audit_log insert failed:", auditErr);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Window removed." });
      queryClient.invalidateQueries({ queryKey: ["ale-bloom-windows", cropId] });
      setPendingDelete(null);
    },
    onError: (e: Error) => {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
      setPendingDelete(null);
    },
  });

  return (
    <SectionShell
      icon={Calendar} title="Bloom windows" count={data?.length}
      action={<Button size="sm" variant="outline" onClick={onAdd} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add window</Button>}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead column="window_id"         label="#"                    sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} />
            <SortableHead column="window_name"       label="Window"               sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} />
            <SortableHead column="stage"             label="Stage"                sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} />
            <SortableHead column="offset_start_days" label="Offset start (days)"  sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} align="right" />
            <SortableHead column="offset_end_days"   label="Offset end (days)"    sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderClick} align="right" />
            <TableHead className="text-right w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((w) => {
            const isFlashing = flashedRowIds.has(w.id) || flashedStages.has(w.stage);
            return (
              <TableRow
                key={w.id}
                className={isFlashing ? FLASH_CLS : NO_FLASH_CLS}
              >
                <TableCell className="font-mono text-xs">{w.window_id}</TableCell>
                <TableCell className="font-medium">{w.window_name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{w.stage}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{w.offset_start_days}</TableCell>
                <TableCell className="text-right font-mono text-xs">{w.offset_end_days}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(w as EditableWindow)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" title="Delete"
                      disabled={deleteMut.isPending}
                      onClick={() => setPendingDelete(w as EditableWindow)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete bloom window?"
        description={<>Delete window <strong>{pendingDelete?.window_name}</strong>? This cannot be undone.</>}
        busy={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </SectionShell>
  );
};

const MonthlyStagesSection = ({
  cropId, onEdit, flashedRowIds,
}: {
  cropId: string;
  onEdit: (m: EditableMonthlyStage) => void;
  flashedRowIds: Set<string>;
}) => {
  const { data } = useQuery({
    queryKey: ["ale-crop-monthly-stages", cropId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ale_crop_monthly_stages")
        .select("*")
        .eq("crop_id", cropId)
        .order("month");
      if (error) throw error;
      return data;
    },
  });

  return (
    <SectionShell icon={Activity} title="Monthly stages" count={data?.length}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {data?.map((m) => {
          const isFlashing = flashedRowIds.has(m.id);
          const stages = m.stages as string[];
          return (
            <div
              key={m.id}
              className={`group p-2 rounded border border-border/50 ${isFlashing ? FLASH_CLS : "bg-muted/20 transition-all duration-700"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] uppercase tracking-wider text-body-secondary">
                  {MONTH_LABELS[m.month - 1]} ({m.month})
                </div>
                <Button
                  size="sm" variant="ghost" title={`Edit ${MONTH_LABELS[m.month - 1]} stages`}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onEdit({ id: m.id, crop_id: m.crop_id, month: m.month, stages })}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 min-h-[1.25rem]">
                {stages.length === 0
                  ? <span className="text-[10px] text-body-secondary italic">no stages</span>
                  : stages.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                    ))
                }
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
};
