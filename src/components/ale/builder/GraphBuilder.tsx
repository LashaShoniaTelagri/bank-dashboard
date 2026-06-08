import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, useReactFlow,
  type Node, type Edge, type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Play, Save, FolderOpen, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { NodePalette } from "./NodePalette";
import { nodeTypes } from "./nodes";
import { ResultView, type EvalResponse } from "./ResultView";
import { GenericResultView } from "../GenericResultView";
import { useGraphs } from "./useGraphs";
import {
  ALGORITHM_TYPES,
  type AleAlgorithm, type AleNodeType, type InputsNodeData, type PersistedGraph,
  type HeatStressNodeData, type InsufficientChillNodeData,
} from "./graphTypes";

interface RunResponse {
  ts_result: unknown;
  r_result: unknown;
  diff: { path: string; ts: unknown; r: unknown }[] | null;
  algorithm?: AleAlgorithm;
  parity_note?: string;
}

const ALGO_LABEL: Record<AleAlgorithm, string> = {
  "frost-risk": "Frost-risk",
  "heat-stress": "Heat-stress",
  "insufficient-chill": "Insufficient-chill",
};

// One algorithm node traced through its canvas pipeline (Inputs → Weather → algo → Result).
interface Pipeline {
  nodeId: string;
  algorithm: AleAlgorithm;
  inputs: Record<string, unknown> | null;   // null when errors present
  resultNodeId: string | null;
  errors: string[];
}

// One rendered result card (a pipeline's outcome).
interface ResultEntry {
  algorithm: AleAlgorithm;
  resultNodeId: string | null;
  data?: RunResponse;
  error?: string;
}

const initialNodes: Node[] = [
  { id: "inputs-1", type: "inputs", position: { x: 20, y: 140 }, data: {} },
  { id: "weather-1", type: "weather", position: { x: 290, y: 150 }, data: {} },
  { id: "frost-1", type: "frost-risk", position: { x: 540, y: 150 }, data: {} },
  { id: "result-1", type: "result", position: { x: 790, y: 160 }, data: {} },
];
const initialEdges: Edge[] = [
  { id: "e1", source: "inputs-1", target: "weather-1" },
  { id: "e2", source: "weather-1", target: "frost-1" },
  { id: "e3", source: "frost-1", target: "result-1" },
];

const Flow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();
  const { list, save, loadGraph } = useGraphs();

  const [name, setName] = useState("My analysis");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ResultEntry[] | null>(null);
  const [issues, setIssues] = useState<Pipeline[]>([]);   // pipelines with errors (inline feedback)

  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge(c, eds)), [setEdges]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/ale-node") as AleNodeType;
    if (!type) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setNodes((nds) => nds.concat({ id: `${type}-${crypto.randomUUID().slice(0, 8)}`, type, position, data: {} }));
  }, [screenToFlowPosition, setNodes]);

  const serialize = (): PersistedGraph => ({
    schema_version: "1.0.0",
    nodes: nodes.map((n) => ({ id: n.id, type: n.type as AleNodeType, position: n.position, data: n.data })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  });

  const inputsCfg = nodes.find((n) => n.type === "inputs")?.data as InputsNodeData | undefined;
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const sourceTypeInto = (nodeId: string, type: AleNodeType) =>
    edges.some((e) => e.target === nodeId && byId.get(e.source)?.type === type);
  const firstResultTarget = (nodeId: string): string | null => {
    for (const e of edges) if (e.source === nodeId && byId.get(e.target)?.type === "result") return e.target;
    return null;
  };

  // Algorithm-specific inputs: location + crop/variety from the Inputs node, plus the
  // algorithm node's own params. Returns the missing-field list when incomplete.
  const buildInputs = (algoNode: Node, algorithm: AleAlgorithm): { inputs: Record<string, unknown> | null; missing: string[] } => {
    const missing: string[] = [];
    const loc = inputsCfg?.location;
    if (!inputsCfg?.crop) missing.push("crop on Inputs");
    if (!loc) missing.push("location on Inputs");
    if ((algorithm === "frost-risk" || algorithm === "heat-stress") && !inputsCfg?.variety) missing.push("variety on Inputs");
    if (algorithm === "heat-stress" && !((algoNode.data ?? {}) as HeatStressNodeData).year) missing.push("year on Heat-stress");
    if (missing.length) return { inputs: null, missing };

    const base = { lat: loc!.lat, lon: loc!.lng, crop: inputsCfg!.crop };
    if (algorithm === "frost-risk") return { inputs: { ...base, variety: inputsCfg!.variety }, missing };
    if (algorithm === "heat-stress") {
      const d = algoNode.data as HeatStressNodeData;
      return { inputs: { ...base, cultivar: inputsCfg!.variety, year: d.year }, missing };
    }
    const d = (algoNode.data ?? {}) as InsufficientChillNodeData;   // insufficient-chill (variety optional)
    return { inputs: { ...base, variety: inputsCfg?.variety, n_years: d.n_years, climate_type: d.climate_type }, missing };
  };

  // Trace every algorithm node into a pipeline + its validation errors.
  const analyzePipelines = (): Pipeline[] =>
    nodes.filter((n) => ALGORITHM_TYPES.includes(n.type as AleAlgorithm)).map((n) => {
      const algorithm = n.type as AleAlgorithm;
      const errors: string[] = [];
      if (!sourceTypeInto(n.id, "weather")) errors.push("connect a Weather source");
      const resultNodeId = firstResultTarget(n.id);
      if (!resultNodeId) errors.push("connect to a Result node");
      const { inputs, missing } = buildInputs(n, algorithm);
      errors.push(...missing);
      return { nodeId: n.id, algorithm, inputs: errors.length ? null : inputs, resultNodeId, errors };
    });

  const pipelines = analyzePipelines();
  const canRun = pipelines.some((p) => p.errors.length === 0);

  // Run every complete pipeline in parallel (one Edge call per algorithm, no graph_jsonb —
  // the canvas is the composition layer; each algorithm dispatches independently).
  const run = async () => {
    const ps = analyzePipelines();
    const runnable = ps.filter((p) => p.errors.length === 0 && p.inputs);
    setIssues(ps.filter((p) => p.errors.length > 0));
    if (runnable.length === 0) {
      toast({ title: "Nothing to run", description: "Wire Inputs → Weather → an algorithm → Result (see notes below).", variant: "destructive" });
      setResults(null);
      return;
    }
    setRunning(true);
    setResults(null);
    const settled = await Promise.allSettled(runnable.map((p) =>
      supabase.functions.invoke("ale-evaluate", { body: { algorithm: p.algorithm, inputs: p.inputs } }).then(({ data, error }) => {
        if (error) throw error;
        if (data?.error) throw new Error(Array.isArray(data.details) ? data.details.join("; ") : (data.details ?? data.error));
        return data as RunResponse;
      })
    ));
    setResults(runnable.map((p, i) => {
      const s = settled[i];
      return {
        algorithm: p.algorithm, resultNodeId: p.resultNodeId,
        data: s.status === "fulfilled" ? s.value : undefined,
        error: s.status === "rejected" ? (s.reason instanceof Error ? s.reason.message : String(s.reason)) : undefined,
      };
    }));
    setRunning(false);
  };

  const doSave = () => {
    if (!name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    save.mutate({ name: name.trim(), graph: serialize() }, {
      onSuccess: () => toast({ title: "Saved", description: `"${name.trim()}" saved.` }),
      onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
    });
  };

  const doLoad = async (id: string) => {
    try {
      const g = await loadGraph(id);
      setNodes(g.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data ?? {} })));
      setEdges(g.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })));
      const picked = list.data?.find((x) => x.id === id);
      if (picked?.name) setName(picked.name);
      setResults(null); setIssues([]);
    } catch (e) {
      toast({ title: "Load failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const reset = () => { setNodes(initialNodes); setEdges(initialEdges); setResults(null); setIssues([]); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Analysis name" className="h-9 w-48" />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={doSave} disabled={save.isPending}>
          <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save"}
        </Button>
        <Select onValueChange={doLoad}>
          <SelectTrigger className="h-9 w-44"><span className="inline-flex items-center gap-1.5"><FolderOpen className="h-4 w-4" /><SelectValue placeholder="Load…" /></span></SelectTrigger>
          <SelectContent>
            {(list.data ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.name} (v{g.version})</SelectItem>)}
            {list.data?.length === 0 && <div className="px-2 py-1.5 text-xs text-body-secondary">No saved graphs</div>}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={reset} title="Reset to default pipeline">
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
        <div className="ml-auto">
          <Button size="sm" className="gap-1.5" onClick={run} disabled={!canRun || running}>
            <Play className="h-4 w-4" /> {running ? "Running…" : "Run"}
          </Button>
        </div>
      </div>

      <div className="flex h-[520px] overflow-hidden rounded-lg border">
        <NodePalette />
        <div className="flex-1" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      </div>

      {!canRun && (
        <p className="text-xs text-body-secondary">
          Wire Inputs → Weather → an algorithm → Result, then Run. Add several algorithms (each into its own Result) to run them together.
        </p>
      )}

      {issues.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950/20">
          <p className="font-medium text-amber-700 dark:text-amber-400">Some pipelines aren't ready:</p>
          {issues.map((p) => (
            <p key={p.nodeId} className="text-amber-700 dark:text-amber-400">• {ALGO_LABEL[p.algorithm]}: {p.errors.join("; ")}.</p>
          ))}
        </div>
      )}

      {results?.map((r, i) => (
        <div key={i} className="space-y-2 rounded-lg border bg-muted/20 p-4">
          <div className="text-sm font-semibold text-heading-primary">{ALGO_LABEL[r.algorithm]}</div>
          {r.error
            ? <p className="text-sm text-red-600 dark:text-red-400">{r.error}</p>
            : r.algorithm === "frost-risk"
              ? <ResultView data={r.data as unknown as EvalResponse} />
              : <GenericResult result={r.data!} />}
        </div>
      ))}
    </div>
  );
};

/** Result panel for non-frost algorithms: schema-agnostic view + R parity. */
const GenericResult = ({ result }: { result: RunResponse }) => {
  const body = result.ts_result ?? result.r_result;
  return (
    <div className="space-y-4">
      {body != null && <GenericResultView algorithm={result.algorithm ?? "heat-stress"} data={body} />}
      <div className="border-t pt-3 text-xs">
        {result.parity_note
          ? <p className="text-body-secondary">R parity: {result.parity_note}</p>
          : result.diff == null
            ? <p className="text-body-secondary">R parity: no comparison available.</p>
            : result.diff.length === 0
              ? <p className="text-emerald-600 dark:text-emerald-400">✓ TS matches R within tolerance.</p>
              : (
                <div className="space-y-1">
                  <p className="text-amber-600 dark:text-amber-400">{result.diff.length} field(s) differ from R:</p>
                  <ul className="space-y-0.5 font-mono">
                    {result.diff.slice(0, 30).map((d) => (
                      <li key={d.path} className="text-body-secondary">{d.path}: TS={String(d.ts)} · R={String(d.r)}</li>
                    ))}
                  </ul>
                </div>
              )}
      </div>
    </div>
  );
};

/** ALE canvas analysis builder — drag components, wire a pipeline, save & run. */
export const GraphBuilder = () => {
  // memoize provider subtree boundary
  const flow = useMemo(() => <Flow />, []);
  return <ReactFlowProvider>{flow}</ReactFlowProvider>;
};
