import { useQuery } from "@tanstack/react-query";
import { ScanEye, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Parity dashboard. Lists curated fixtures with their frozen R results.
 * Phase 1.5 — read-only table. Phase 4 wires a "Run TS" button per row that
 * fans out to the in-browser engine + diff display.
 *
 * After EC2 decommission this page keeps working: r_result_jsonb is frozen
 * in the DB and the column always renders. See ADR 0013.
 */
export const ParitySection = () => {
  const { data: fixtures, isLoading, error } = useQuery({
    queryKey: ["ale-parity-fixtures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ale_parity_fixtures")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScanEye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              R parity dashboard
              <Badge variant="outline" className="text-[10px]">{fixtures?.length ?? 0} fixtures</Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              Curated cases with frozen R outputs. TS engine results land in Phase 4.
              Persists past EC2 decommission as a regression dashboard.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-body-secondary">Loading fixtures…</p>}
        {error && <p className="text-sm text-red-500">Failed to load: {(error as Error).message}</p>}
        {fixtures?.length === 0 && (
          <p className="text-sm text-body-secondary italic">
            No fixtures yet. The GIS specialist will add curated (lat, lon, variety, date) cases here.
          </p>
        )}

        {fixtures && fixtures.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Inputs</TableHead>
                <TableHead className="text-right">R: damage</TableHead>
                <TableHead className="text-right">R: yield</TableHead>
                <TableHead className="text-right">R: frost events</TableHead>
                <TableHead>R run state</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fixtures.map((f) => {
                const r = (f.r_result_jsonb ?? {}) as RFixtureSummary;
                const damage = r?.cumulative?.damage;
                const yieldRem = r?.cumulative?.yield_remaining;
                const events = (r?.windows ?? []).reduce(
                  (sum, w) => sum + (w?.events ?? 0), 0
                );
                const inputs = f.inputs_jsonb as { lat?: number; lon?: number; variety?: string; crop?: string };
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.label}</TableCell>
                    <TableCell className="text-xs font-mono text-body-secondary">
                      {inputs?.crop}/{inputs?.variety} @ {inputs?.lat?.toFixed(2)},{inputs?.lon?.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {damage == null ? "—" : damage.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {yieldRem == null ? "—" : yieldRem.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{events ?? "—"}</TableCell>
                    <TableCell>
                      {r && Object.keys(r).length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" /> R captured
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs">
                          <AlertTriangle className="h-3.5 w-3.5" /> empty
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-body-secondary max-w-[20rem] truncate">
                      {f.notes}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

// Minimal shape we read off r_result_jsonb. Full schema lives in specs/modules/ale.md.
type RFixtureSummary = {
  cumulative?: { damage?: number; yield_remaining?: number };
  windows?: Array<{ events?: number }>;
};
