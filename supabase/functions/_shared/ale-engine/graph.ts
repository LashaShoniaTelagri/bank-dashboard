// Graph runner for the ALE canvas builder. A graph is a small pipeline of
// coarse nodes: Inputs -> Source(s) -> Algorithm -> Result. V1 supports one
// data source (weather) and one algorithm (frost-risk), so execution dispatches
// to runFrostAnalysis; the topological structure is the extensibility scaffold
// for satellite sources and additional algorithms (each = a new node type +
// evaluator, no rewiring of this runner's shape).

import type { CropParams, GlobalPhysics, RunInputs, RunResult, EngineDeps } from "./types.ts";
import { runFrostAnalysis } from "./frostRisk.ts";

export type NodeType = "inputs" | "weather" | "satellite" | "frost-risk" | "result";

export interface GraphNode {
  id: string;
  type: NodeType;
  data?: Record<string, unknown>;
}
export interface GraphEdge {
  id?: string;
  source: string;   // node id
  target: string;   // node id
}
export interface GraphSpec {
  schema_version?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphValidation {
  ok: boolean;
  errors: string[];
  /** Node ids implicated in errors — lets the UI highlight them. */
  badNodeIds: string[];
}

export interface GraphRunOutput {
  result: RunResult | null;
  algorithm: "frost-risk" | null;   // which algorithm produced `result` (for R parity dispatch)
  errors: string[];
}

const sourcesOf = (spec: GraphSpec, nodeId: string): GraphNode[] => {
  const byId = new Map(spec.nodes.map((n) => [n.id, n]));
  return spec.edges.filter((e) => e.target === nodeId).map((e) => byId.get(e.source)).filter(Boolean) as GraphNode[];
};

/**
 * Structural validation for the V1 coarse model: one Inputs node, at least one
 * frost-risk algorithm fed by a Weather source, and a Result node consuming it.
 */
export function validateGraph(spec: GraphSpec): GraphValidation {
  const errors: string[] = [];
  const bad: string[] = [];
  const byType = (t: NodeType) => spec.nodes.filter((n) => n.type === t);

  const inputs = byType("inputs");
  const algos = byType("frost-risk");
  const results = byType("result");

  if (inputs.length === 0) errors.push("Add an Inputs node (crop, variety, location).");
  if (algos.length === 0) errors.push("Add an algorithm node (Frost-risk).");
  if (results.length === 0) errors.push("Add a Result node.");

  for (const algo of algos) {
    const srcs = sourcesOf(spec, algo.id);
    const hasWeather = srcs.some((s) => s.type === "weather");
    const hasSatellite = srcs.some((s) => s.type === "satellite");
    if (!hasWeather) {
      bad.push(algo.id);
      errors.push(hasSatellite
        ? "Satellite source is not supported yet — connect a Weather source to Frost-risk."
        : "Frost-risk needs a Weather source connected to it.");
    }
  }

  // A result node must consume an algorithm.
  for (const res of results) {
    const srcs = sourcesOf(spec, res.id);
    if (!srcs.some((s) => s.type === "frost-risk")) {
      bad.push(res.id);
      errors.push("Connect an algorithm (Frost-risk) into the Result node.");
    }
  }

  // Inputs must feed into the pipeline (weather or algorithm).
  if (inputs.length > 0) {
    const targets = new Set(spec.edges.filter((e) => inputs.some((i) => i.id === e.source)).map((e) => e.target));
    if (targets.size === 0) {
      bad.push(inputs[0].id);
      errors.push("Connect the Inputs node into a Weather or Frost-risk node.");
    }
  }

  return { ok: errors.length === 0, errors: [...new Set(errors)], badNodeIds: [...new Set(bad)] };
}

/**
 * Evaluate a graph. V1: validate, then run the single frost-risk algorithm
 * (which fetches its own cached weather via deps). Returns the frost result for
 * the Result node + the algorithm id so the caller can run R parity.
 */
export async function runGraph(
  spec: GraphSpec,
  crop: CropParams,
  gp: GlobalPhysics,
  inputs: RunInputs,
  deps: EngineDeps,
): Promise<GraphRunOutput> {
  const v = validateGraph(spec);
  if (!v.ok) return { result: null, algorithm: null, errors: v.errors };

  const result = await runFrostAnalysis(crop, gp, inputs, deps);
  return { result, algorithm: "frost-risk", errors: [] };
}
