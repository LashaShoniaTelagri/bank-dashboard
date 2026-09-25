// Graph runner tests. Run: deno test supabase/functions/_shared/ale-engine/
//
// Verifies: (1) a well-formed Inputs->Weather->Frost-risk->Result graph runs
// and matches runFrostAnalysis exactly, and (2) validation rejects the bad
// shapes the UI must guard (no source, satellite-only, missing nodes).

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runGraph, validateGraph, type GraphSpec } from "./graph.ts";
import { runFrostAnalysis } from "./frostRisk.ts";
import type { CropParams, GlobalPhysics, HourlyPoint } from "./types.ts";

const GP: GlobalPhysics = {
  utah_breakpoints: [
    { t_lower: null, t_upper: 1.4, cu: 0.0 }, { t_lower: 1.4, t_upper: 2.4, cu: 0.5 },
    { t_lower: 2.4, t_upper: 9.1, cu: 1.0 }, { t_lower: 9.1, t_upper: 12.4, cu: 0.5 },
    { t_lower: 12.4, t_upper: 15.9, cu: 0.0 }, { t_lower: 15.9, t_upper: 18.0, cu: -0.5 },
    { t_lower: 18.0, t_upper: null, cu: -1.0 },
  ],
  dynamic_params: { e0: 4153.5, e1: 12888.8, a0: 139500, a1: 2.567e18, slp: 1.28, tetmlt: 277 },
  weinberger_params: { t_min: 0, t_max: 7.2 },
  richardson_gdh_params: { t_base: 4.5, t_opt: 25.0, t_crit: 36.0 },
  frost_threshold_c: 0,
};

const CROP: CropParams = {
  slug: "test", display_name: "Test", chill_biofix_month: 1, chill_biofix_day: 1,
  insufficient_chill_penalty: 0.2,
  varieties: [{ display_name: "V1", chill_portions_cp: 1, chill_hours_ch: 1, chill_units_cu: 1, gdh_to_bloom: 1 }],
  frost_thresholds: [{ stage: "S", kill_10_pct_c: -2, kill_90_pct_c: -5, slope_frac: 0.5 }],
  bloom_windows: [{ window_id: 1, window_name: "W", stage: "S", offset_start_days: 0, offset_end_days: 5 }],
  monthly_stages: {},
};

function synthetic(): HourlyPoint[] {
  const pts: HourlyPoint[] = [];
  for (let h = 0; h < 24; h++) {
    pts.push({ datetime: `2024-01-01T${String(h).padStart(2, "0")}:00`, tempC: 5, date: "2024-01-01", hour: h });
  }
  pts.push({ datetime: "2024-01-03T03:00", tempC: -3, date: "2024-01-03", hour: 3 });
  return pts;
}

const GOOD: GraphSpec = {
  schema_version: "1.0.0",
  nodes: [
    { id: "i1", type: "inputs" }, { id: "w1", type: "weather" },
    { id: "a1", type: "frost-risk" }, { id: "r1", type: "result" },
  ],
  edges: [
    { source: "i1", target: "w1" }, { source: "w1", target: "a1" }, { source: "a1", target: "r1" },
  ],
};

Deno.test("validateGraph — accepts a well-formed pipeline", () => {
  const v = validateGraph(GOOD);
  assertEquals(v.ok, true);
  assertEquals(v.errors, []);
});

Deno.test("validateGraph — frost-risk with no source is rejected", () => {
  const v = validateGraph({ nodes: [
    { id: "i1", type: "inputs" }, { id: "a1", type: "frost-risk" }, { id: "r1", type: "result" },
  ], edges: [{ source: "i1", target: "a1" }, { source: "a1", target: "r1" }] });
  assert(!v.ok);
  assert(v.badNodeIds.includes("a1"));
});

Deno.test("validateGraph — satellite-only source is rejected (not supported yet)", () => {
  const v = validateGraph({ nodes: [
    { id: "i1", type: "inputs" }, { id: "s1", type: "satellite" },
    { id: "a1", type: "frost-risk" }, { id: "r1", type: "result" },
  ], edges: [{ source: "i1", target: "s1" }, { source: "s1", target: "a1" }, { source: "a1", target: "r1" }] });
  assert(!v.ok);
  assert(v.errors.some((e) => /Satellite/.test(e)));
});

Deno.test("validateGraph — missing nodes reported", () => {
  const v = validateGraph({ nodes: [{ id: "i1", type: "inputs" }], edges: [] });
  assert(!v.ok);
  assert(v.errors.some((e) => /algorithm/i.test(e)));
  assert(v.errors.some((e) => /Result/.test(e)));
});

Deno.test("runGraph — matches runFrostAnalysis for the same inputs", async () => {
  const deps = { today: "2024-05-01", fetchClimate: async () => synthetic() };
  const inputs = { lat: 40, lon: 45, variety: "V1", crop: "test" };

  const direct = await runFrostAnalysis(CROP, GP, inputs, deps);
  const viaGraph = await runGraph(GOOD, CROP, GP, inputs, deps);

  assertEquals(viaGraph.errors, []);
  assertEquals(viaGraph.algorithm, "frost-risk");
  assertEquals(viaGraph.result, direct);
});

Deno.test("runGraph — invalid graph returns errors, no result", async () => {
  const out = await runGraph({ nodes: [{ id: "r1", type: "result" }], edges: [] },
    CROP, GP, { lat: 40, lon: 45, variety: "V1", crop: "test" },
    { today: "2024-05-01", fetchClimate: async () => synthetic() });
  assertEquals(out.result, null);
  assert(out.errors.length > 0);
});
