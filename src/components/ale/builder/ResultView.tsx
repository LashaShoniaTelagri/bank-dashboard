import { useState } from "react";
import { Snowflake, Flame, Calendar, TrendingDown, History, GitCompare } from "lucide-react";
import { Badge } from "../../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { fmt } from "../aleShared";

// Locked result schema (specs/modules/ale.md § Result schema). The Edge Function
// returns this shape from both the TS engine and the R parity service.
interface ChillModel { value: number | null; required: number | null; met: boolean; }
interface WindowRow {
  id: number; name: string; stage: string; start: string; end: string;
  events: number | null; worst_t_c: number | null; damage: number | null; status: string;
}
interface HistRow {
  season: string; bloom_md: string | null;
  w1: number | null; w2: number | null; w3: number | null; w4: number | null; w5: number | null;
  cumulative_damage: number; yield: number; error?: string;
}
export interface RunResult {
  meta: { lat: number; lon: number; variety: string; crop: string; analysis_date: string; season: string };
  expected_stages_for_month: string[];
  chill: { biofix_start: string; utah: ChillModel; weinberger: ChillModel; dynamic: ChillModel; met_on: string | null; model_used: string | null };
  heat: { gdh: number | null; required: number | null; bloom_estimate: string | null };
  windows: WindowRow[];
  cumulative: { damage: number; yield_remaining: number };
  historical: HistRow[];
}
export interface DiffEntry { path: string; ts: unknown; r: unknown; }
export interface EvalResponse { ts_result: RunResult; r_result: unknown; diff: DiffEntry[] | null; parity_note?: string; }

export const ResultView = ({ data }: { data: EvalResponse }) => {
  const [view, setView] = useState<"ts" | "r">("ts");
  const rResult = data.r_result && typeof data.r_result === "object" && (data.r_result as RunResult).chill
    ? (data.r_result as RunResult) : null;
  const r = view === "r" && rResult ? rResult : data.ts_result;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-body-secondary">Showing:</span>
        <div className="inline-flex overflow-hidden rounded-md border">
          <button
            onClick={() => setView("ts")}
            className={`px-3 py-1 text-xs font-medium ${view === "ts" ? "bg-emerald-600 text-white" : "bg-background text-body-secondary"}`}
          >TS engine</button>
          <button
            onClick={() => rResult && setView("r")}
            disabled={!rResult}
            title={rResult ? "Show R script result" : "R result unavailable (parity disabled or service down)"}
            className={`px-3 py-1 text-xs font-medium ${view === "r" ? "bg-emerald-600 text-white" : "bg-background text-body-secondary"} ${!rResult ? "cursor-not-allowed opacity-40" : ""}`}
          >R script</button>
        </div>
        {view === "r" && <span className="text-[10px] text-amber-600 dark:text-amber-400">Showing R reference output</span>}
        {!rResult && data.parity_note && <span className="text-[10px] text-body-secondary">({data.parity_note})</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-heading-primary">{r.meta.crop} · {r.meta.variety}</span>
        <Badge variant="outline" className="text-[10px]">season {r.chill.biofix_start.slice(0, 4)}</Badge>
        <span className="text-xs text-body-secondary">{r.meta.lat.toFixed(4)}°, {r.meta.lon.toFixed(4)}° · {r.meta.analysis_date}</span>
      </div>

      {r.expected_stages_for_month.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-body-secondary">Expected this month:</span>
          {r.expected_stages_for_month.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
        </div>
      )}

      <Section icon={Snowflake} title="Chill accumulation">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <ChillCard label="Utah (CU)" m={r.chill.utah} />
          <ChillCard label="Weinberger (CH)" m={r.chill.weinberger} />
          <ChillCard label="Dynamic (CP)" m={r.chill.dynamic} />
        </div>
        <p className="mt-2 text-xs text-body-secondary">
          Biofix {r.chill.biofix_start} ·{" "}
          {r.chill.met_on ? <>chill met {r.chill.met_on} ({r.chill.model_used})</> : "chill not yet fulfilled"}
        </p>
      </Section>

      <Section icon={Flame} title="Heat & bloom">
        <p className="text-sm">
          GDH <strong>{r.heat.gdh ?? "—"}</strong> / {r.heat.required ?? "—"} required ·{" "}
          {r.heat.bloom_estimate ? <>bloom estimate <strong>{r.heat.bloom_estimate}</strong></> : "bloom not yet determined"}
        </p>
      </Section>

      {r.windows.length > 0 && (
        <Section icon={Calendar} title="Frost windows">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Window</TableHead><TableHead>Stage</TableHead>
                <TableHead>Start</TableHead><TableHead>End</TableHead>
                <TableHead className="text-right">Events</TableHead>
                <TableHead className="text-right">Worst T</TableHead>
                <TableHead className="text-right">Damage</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.windows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{w.stage}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{w.start}</TableCell>
                  <TableCell className="font-mono text-xs">{w.end}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{w.events ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{w.worst_t_c == null ? "—" : `${w.worst_t_c}°`}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{w.damage == null ? "—" : `${(w.damage * 100).toFixed(1)}%`}</TableCell>
                  <TableCell><StatusBadge status={w.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      )}

      <Section icon={TrendingDown} title="Cumulative outcome">
        <div className="flex gap-6 text-sm">
          <div>Yield reduction: <strong className="text-red-600 dark:text-red-400">{(r.cumulative.damage * 100).toFixed(1)}%</strong></div>
          <div>Yield remaining: <strong className="text-emerald-600 dark:text-emerald-400">{(r.cumulative.yield_remaining * 100).toFixed(1)}%</strong></div>
        </div>
      </Section>

      {r.historical.length > 0 && (
        <Section icon={History} title="Historical (5 seasons)">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Season</TableHead><TableHead>Bloom</TableHead>
                <TableHead className="text-right">W1</TableHead><TableHead className="text-right">W2</TableHead>
                <TableHead className="text-right">W3</TableHead><TableHead className="text-right">W4</TableHead>
                <TableHead className="text-right">W5</TableHead>
                <TableHead className="text-right">Cum.Dmg</TableHead><TableHead className="text-right">Yield</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.historical.map((h) => (
                <TableRow key={h.season}>
                  <TableCell className="font-mono text-xs">{h.season}</TableCell>
                  {h.error
                    ? <TableCell colSpan={8} className="text-xs text-red-500">Error: {h.error}</TableCell>
                    : <>
                        <TableCell className="font-mono text-xs">{h.bloom_md ?? "—"}</TableCell>
                        {[h.w1, h.w2, h.w3, h.w4, h.w5].map((wv, i) => (
                          <TableCell key={i} className="text-right font-mono text-xs">{wv ?? "—"}</TableCell>
                        ))}
                        <TableCell className="text-right font-mono text-xs">{(h.cumulative_damage * 100).toFixed(1)}%</TableCell>
                        <TableCell className="text-right font-mono text-xs">{(h.yield * 100).toFixed(1)}%</TableCell>
                      </>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      )}

      <Section icon={GitCompare} title="R parity comparison">
        {data.parity_note
          ? <p className="text-xs text-body-secondary">{data.parity_note}</p>
          : data.diff == null
            ? <p className="text-xs text-body-secondary">No comparison available.</p>
            : data.diff.length === 0
              ? <p className="text-sm text-emerald-600 dark:text-emerald-400">✓ TS matches R within tolerance.</p>
              : (
                <div className="space-y-1">
                  <p className="text-xs text-amber-600 dark:text-amber-400">{data.diff.length} field(s) differ from R:</p>
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Path</TableHead><TableHead className="text-right">TS</TableHead><TableHead className="text-right">R</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.diff.slice(0, 50).map((d) => (
                        <TableRow key={d.path}>
                          <TableCell className="font-mono text-xs">{d.path}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{String(d.ts)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{String(d.r)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {data.diff.length > 50 && <p className="text-[10px] text-body-secondary">…and {data.diff.length - 50} more.</p>}
                </div>
              )}
      </Section>
    </div>
  );
};

const Section = ({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-body-secondary">
      <Icon className="h-3.5 w-3.5" /> {title}
    </h4>
    {children}
  </section>
);

const ChillCard = ({ label, m }: { label: string; m: ChillModel }) => (
  <div className="rounded border border-border/50 bg-background p-2">
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-wider text-body-secondary">{label}</span>
      {m.met
        ? <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[9px]">met</Badge>
        : <Badge variant="outline" className="text-[9px]">not met</Badge>}
    </div>
    <div className="font-mono text-sm">{fmt(m.value)} <span className="text-xs text-body-secondary">/ {m.required ?? "—"}</span></div>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const cls = status === "Complete" ? "bg-slate-500" : status === "In progress" ? "bg-amber-500" : "bg-blue-500";
  return <Badge className={`${cls} text-[10px] hover:opacity-90`}>{status}</Badge>;
};
