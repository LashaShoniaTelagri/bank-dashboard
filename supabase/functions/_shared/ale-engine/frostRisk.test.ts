// Engine verification. Run: deno test supabase/functions/_shared/ale-engine/
//
// Two layers:
//  1. Kernel unit tests — exact values from the R reference formulas.
//  2. A deterministic end-to-end run over synthetic weather, asserting the full
//     locked-schema pipeline (chill → bloom → frost window → cumulative damage).
//
// NOTE: R-derived golden fixtures (real Open-Meteo cases run through the R
// script) are curated separately per specs/modules/ale.md and added under
// fixtures/ once available; this file pins the port's internal correctness.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { utahCU, calculateDamage, accumulateGdh, accumulateDynamic } from "./compute.ts";
import { runFrostAnalysis } from "./frostRisk.ts";
import type { CropParams, GlobalPhysics, HourlyPoint } from "./types.ts";

const UTAH = [
  { t_lower: null, t_upper: 1.4, cu: 0.0 },
  { t_lower: 1.4, t_upper: 2.4, cu: 0.5 },
  { t_lower: 2.4, t_upper: 9.1, cu: 1.0 },
  { t_lower: 9.1, t_upper: 12.4, cu: 0.5 },
  { t_lower: 12.4, t_upper: 15.9, cu: 0.0 },
  { t_lower: 15.9, t_upper: 18.0, cu: -0.5 },
  { t_lower: 18.0, t_upper: null, cu: -1.0 },
];

const GP: GlobalPhysics = {
  utah_breakpoints: UTAH,
  dynamic_params: { e0: 4153.5, e1: 12888.8, a0: 139500, a1: 2.567e18, slp: 1.28, tetmlt: 277 },
  weinberger_params: { t_min: 0, t_max: 7.2 },
  richardson_gdh_params: { t_base: 4.5, t_opt: 25.0, t_crit: 36.0 },
  frost_threshold_c: 0,
};

Deno.test("utahCU — bucket boundaries match R if/else chain", () => {
  assertEquals(utahCU(0, UTAH), 0);      // < 1.4
  assertEquals(utahCU(1.4, UTAH), 0.5);  // R: not < 1.4, so <= 2.4 bucket
  assertEquals(utahCU(2.4, UTAH), 0.5);
  assertEquals(utahCU(5, UTAH), 1.0);
  assertEquals(utahCU(10, UTAH), 0.5);
  assertEquals(utahCU(14, UTAH), 0);
  assertEquals(utahCU(17, UTAH), -0.5);
  assertEquals(utahCU(20, UTAH), -1.0);
});

Deno.test("calculateDamage — 0 above kill_10, 0.10 at kill_10, slope below", () => {
  assertEquals(calculateDamage(0, -2, -5, 0.5), 0);          // warmer than kill_10
  assertEquals(calculateDamage(-2, -2, -5, 0.5), 0.10);      // exactly kill_10
  assertEquals(calculateDamage(-3, -2, -5, 0.5), 0.6);       // 0.10 + 1*0.5
  assertEquals(calculateDamage(-10, -2, -5, 0.5), 1.0);      // capped at 1
});

Deno.test("accumulateGdh — Richardson piecewise", () => {
  const g = accumulateGdh([3, 5, 30, 40], GP.richardson_gdh_params);
  // 3<=base→0 ; 5→0.5 ; 30 in (opt,crit]→ (20.5)*(1-(30-25)/(36-25)) ; 40>crit→0
  const piece = 20.5 * (1 - 5 / 11);
  assertEquals(g[0], 0);
  assertEquals(g[1], 0.5);
  assertEquals(Math.round(g[2] * 1e6) / 1e6, Math.round((0.5 + piece) * 1e6) / 1e6);
  assertEquals(g[3], g[2]); // crit hour adds 0
});

Deno.test("accumulateDynamic — monotonic non-negative", () => {
  const d = accumulateDynamic([5, 5, 5, 5, 5], GP.dynamic_params);
  for (let i = 1; i < d.length; i++) assert(d[i] >= d[i - 1]);
  assert(d[d.length - 1] >= 0);
});

// ── Deterministic end-to-end ─────────────────────────────────────────────────

const CROP: CropParams = {
  slug: "test",
  display_name: "Test",
  chill_biofix_month: 1,
  chill_biofix_day: 1,
  insufficient_chill_penalty: 0.2,
  varieties: [{ display_name: "V1", chill_portions_cp: 1, chill_hours_ch: 1, chill_units_cu: 1, gdh_to_bloom: 1 }],
  frost_thresholds: [{ stage: "S", kill_10_pct_c: -2, kill_90_pct_c: -5, slope_frac: 0.5 }],
  bloom_windows: [{ window_id: 1, window_name: "W", stage: "S", offset_start_days: 0, offset_end_days: 5 }],
  monthly_stages: { "5": ["Bloom"] },
};

function synthetic(): HourlyPoint[] {
  const pts: HourlyPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, "0");
    pts.push({ datetime: `2024-01-01T${hh}:00`, tempC: 5, date: "2024-01-01", hour: h });
  }
  pts.push({ datetime: "2024-01-03T03:00", tempC: -3, date: "2024-01-03", hour: 3 });
  return pts;
}

Deno.test("runFrostAnalysis — full pipeline on synthetic weather", async () => {
  const res = await runFrostAnalysis(CROP, GP, { lat: 40, lon: 45, variety: "V1", crop: "test" }, {
    today: "2024-05-01",
    fetchClimate: async () => synthetic(),
  });

  assertEquals(res.chill.met_on, "2024-01-01");
  assertEquals(res.chill.model_used, "Utah");
  assertEquals(res.chill.utah.met, true);
  assertEquals(res.heat.bloom_estimate, "2024-01-01");

  assertEquals(res.windows.length, 1);
  const w = res.windows[0];
  assertEquals(w.status, "Complete");
  assertEquals(w.events, 1);
  assertEquals(w.worst_t_c, -3);
  assertEquals(w.damage, 0.6);

  assertEquals(res.cumulative.damage, 0.6);
  assertEquals(res.cumulative.yield_remaining, 0.4);
  assertEquals(res.expected_stages_for_month, ["Bloom"]); // today month = 5 → monthly_stages["5"]
  assertEquals(res.historical.length, 5);
});
