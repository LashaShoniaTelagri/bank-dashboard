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
  const [result, setResult] = useState<RunResponse | null>(null);

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
  const algoNode = nodes.find((n) => ALGORITHM_TYPES.includes(n.type as AleAlgorithm));
  const algorithm = (algoNode?.type ?? "frost-risk") as AleAlgorithm;

  // Build the algorithm-specific inputs from the Inputs node (location) + the
  // algorithm node's own params. Returns null if anything required is missing.
  const buildInputs = (): Record<string, unknown> | null => {
    const loc = inputsCfg?.location;
    if (!loc) return null;
    const base = { lat: loc.lat, lon: loc.lng };
    if (algorithm === "frost-risk") {
      if (!inputsCfg?.crop || !inputsCfg?.variety) return null;
      return { ...base, variety: inputsCfg.variety, crop: inputsCfg.crop };
    }
    if (algorithm === "heat-stress") {
      // cultivar = the Inputs-node variety (DB-managed); year is heat-stress-specific.
      const d = (algoNode!.data ?? {}) as HeatStressNodeData;
      if (!inputsCfg?.crop || !inputsCfg?.variety || !d.year) return null;
      return { ...base, crop: inputsCfg.crop, cultivar: inputsCfg.variety, year: d.year };
    }
    // insufficient-chill — variety from Inputs (optional → median fallback); n_years/climate default server-side.
    const d = (algoNode!.data ?? {}) as InsufficientChillNodeData;
    if (!inputsCfg?.crop) return null;
    return { ...base, crop: inputsCfg.crop, variety: inputsCfg?.variety, n_years: d.n_years, climate_type: d.climate_type };
  };

  const hasChain = !!algoNode
    && nodes.some((n) => n.type === "weather")
    && nodes.some((n) => n.type === "result");
  const canRun = hasChain && buildInputs() != null;

  const requirementHint = algorithm === "heat-stress"
    ? "Set crop, variety & location on the Inputs node, and year on the Heat-stress node."
    : algorithm === "insufficient-chill"
      ? "Set crop, variety & location on the Inputs node (variety optional)."
      : "Set crop, variety and location on the Inputs node.";

  const run = async () => {
    const inputs = buildInputs();
    if (!inputs) {
      toast({ title: "Inputs incomplete", description: requirementHint, variant: "destructive" });
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ale-evaluate", {
        body: { algorithm, graph_jsonb: serialize(), inputs },
      });
      if (error) throw error;
      if (data?.error) throw new Error(Array.isArray(data.details) ? data.details.join("; ") : (data.details ?? data.error));
      setResult(data as RunResponse);
    } catch (e) {
      toast({ title: "Run failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setRunning(false);
    }
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
      setResult(null);
    } catch (e) {
      toast({ title: "Load failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const reset = () => { setNodes(initialNodes); setEdges(initialEdges); setResult(null); };

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
          To run: keep an Inputs → Weather → algorithm → Result chain. {requirementHint}
        </p>
      )}

      {result && (
        <div className="rounded-lg border bg-muted/20 p-4">
          {(result.algorithm ?? "frost-risk") === "frost-risk"
            ? <ResultView data={result as unknown as EvalResponse} />
            : <GenericResult result={result} />}
        </div>
      )}
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
