// Shared types + palette metadata for the ALE canvas builder. Node `type`
// strings mirror NodeType in supabase/functions/_shared/ale-engine/graph.ts —
// keep the two in sync (the runner validates/executes by these strings).

export type AleAlgorithm = "frost-risk" | "heat-stress" | "insufficient-chill";
export type AleNodeType = "inputs" | "weather" | "satellite" | AleAlgorithm | "result";

export const ALGORITHM_TYPES: AleAlgorithm[] = ["frost-risk", "heat-stress", "insufficient-chill"];

export interface LocationValue { name: string; lat: number; lng: number; }

/** Data carried by the Inputs node — the run-time context (saved as graph defaults). */
export interface InputsNodeData {
  crop?: string;
  variety?: string;
  location?: LocationValue | null;
  [k: string]: unknown;
}

/** Per-algorithm params live on the algorithm node (Inputs provides location). */
export interface HeatStressNodeData {
  cultivar?: string;
  year?: number;
  [k: string]: unknown;
}
export interface InsufficientChillNodeData {
  variety?: string;
  n_years?: number;
  climate_type?: string;
  [k: string]: unknown;
}

export type PaletteGroup = "Input" | "Source" | "Algorithm" | "Output";

export interface PaletteItem {
  type: AleNodeType;
  label: string;
  group: PaletteGroup;
  description: string;
  disabled?: boolean;   // satellite is a stub for now
}

export const PALETTE: PaletteItem[] = [
  { type: "inputs",     label: "Inputs",     group: "Input",     description: "Crop, variety & location" },
  { type: "weather",    label: "Weather",    group: "Source",    description: "Open-Meteo hourly temps" },
  { type: "satellite",  label: "Satellite",  group: "Source",    description: "Coming soon", disabled: true },
  { type: "frost-risk", label: "Frost-risk", group: "Algorithm", description: "Frost damage estimation" },
  { type: "heat-stress", label: "Heat-stress", group: "Algorithm", description: "Heat yield reduction" },
  { type: "insufficient-chill", label: "Insufficient-chill", group: "Algorithm", description: "Chill-deficit yield loss" },
  { type: "result",     label: "Result",     group: "Output",    description: "Show analysis output" },
];

export const NODE_ACCENT: Record<AleNodeType, string> = {
  inputs: "border-l-sky-500",
  weather: "border-l-cyan-500",
  satellite: "border-l-slate-400",
  "frost-risk": "border-l-amber-500",
  "heat-stress": "border-l-red-500",
  "insufficient-chill": "border-l-indigo-500",
  result: "border-l-emerald-500",
};

/** The trimmed graph shape persisted to ale_logic_graphs.graph_jsonb. */
export interface PersistedGraph {
  schema_version: string;
  nodes: Array<{ id: string; type: AleNodeType; position: { x: number; y: number }; data?: Record<string, unknown> }>;
  edges: Array<{ id: string; source: string; target: string }>;
}
