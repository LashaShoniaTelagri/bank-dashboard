// Insufficient-chill TS↔R parity. Runs the TS port against the SAME live
// Open-Meteo data the R wrapper used (per-season archive fetch), pinning
// run_date to the fixture's meta.run_date so season windows match, and compares
// to the committed R fixtures within tolerance.
//
// Requires network: deno test --allow-net --allow-read.
// Fixtures: gis-scripts/algorithms/insufficient-chill/fixtures/*.json.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runInsufficientChill, type InsufficientChillInputs } from "./insufficientChill.ts";

const FIXTURE_DIR = new URL("../../../../gis-scripts/algorithms/insufficient-chill/fixtures/", import.meta.url);
const FIXTURES = ["gala_ge_5y", "fuji_ro_5y", "unknown_ge_4y"];
const TOL = 1e-3;

// Live per-season fetch mirroring fetch_hourly_temp() in the R algorithm.
async function fetchSeasonTemps(lat: number, lon: number, startDate: string, endDate: string): Promise<number[]> {
  const p = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    start_date: startDate, end_date: endDate,
    hourly: "temperature_2m", timezone: "auto", temperature_unit: "celsius",
  });
  const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${p}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const j = await res.json();
  return (j.hourly.temperature_2m as (number | null)[]).map((t) => (t == null ? NaN : Number(t)));
}

interface Fixture {
  inputs: InsufficientChillInputs;
  result: {
    meta: { run_date: string; variety: string; variety_found: boolean; season_complete: boolean; current_season: string };
    chill: Record<string, number | null>;
    deficit: Record<string, number | string | null>;
    tiers: { tier1: Record<string, number | string>; tier2: Record<string, number | string | null>; tier3: Record<string, number | string | null> };
    recommended: { yield_reduction: number; output_tier: string };
    historical: Array<Record<string, number | string | boolean | null>>;
  };
}

async function loadFixture(name: string): Promise<Fixture> {
  return JSON.parse(await Deno.readTextFile(new URL(`${name}.json`, FIXTURE_DIR)));
}

// Numbers compare within tolerance; strings/booleans exact.
function expectClose(label: string, ts: unknown, r: unknown) {
  if (typeof r === "number" && typeof ts === "number") {
    assert(Math.abs(ts - r) <= TOL, `${label}: TS=${ts} R=${r} (Δ=${Math.abs(ts - r)})`);
  } else {
    assertEquals(ts, r, `${label}: TS=${ts} R=${r}`);
  }
}

for (const name of FIXTURES) {
  Deno.test(`insufficient-chill parity — ${name}`, async () => {
    const { inputs, result } = await loadFixture(name);
    // The Edge loads CR from ale_crop_varieties; here we feed the SAME CR the R
    // fixture used (recorded in result.chill) so the port reproduces R exactly —
    // including the unknown-variety median case, whose CR R computed itself.
    const cr = {
      cr_cu: result.chill.cr_cu as number | null,
      cr_ch: result.chill.cr_ch as number | null,
      cr_cp: result.chill.cr_cp as number | null,
      found: result.meta.variety_found,
      variety_used: result.meta.variety,
    };
    const ts = await runInsufficientChill(inputs, cr, { fetchSeasonTemps, today: result.meta.run_date });

    expectClose("meta.variety", ts.meta.variety, result.meta.variety);
    expectClose("meta.current_season", ts.meta.current_season, result.meta.current_season);

    for (const k of Object.keys(result.chill)) expectClose(`chill.${k}`, (ts.chill as Record<string, unknown>)[k], result.chill[k]);
    for (const k of Object.keys(result.deficit)) expectClose(`deficit.${k}`, (ts.deficit as Record<string, unknown>)[k], result.deficit[k]);

    for (const k of Object.keys(result.tiers.tier1)) expectClose(`tier1.${k}`, (ts.tiers.tier1 as Record<string, unknown>)[k], result.tiers.tier1[k]);
    for (const k of Object.keys(result.tiers.tier2)) expectClose(`tier2.${k}`, (ts.tiers.tier2 as unknown as Record<string, unknown>)[k], result.tiers.tier2[k]);
    for (const k of Object.keys(result.tiers.tier3)) expectClose(`tier3.${k}`, (ts.tiers.tier3 as unknown as Record<string, unknown>)[k], result.tiers.tier3[k]);

    expectClose("recommended.yield_reduction", ts.recommended.yield_reduction, result.recommended.yield_reduction);
    expectClose("recommended.output_tier", ts.recommended.output_tier, result.recommended.output_tier);

    assertEquals(ts.historical.length, result.historical.length, "historical length");
    for (let i = 0; i < result.historical.length; i++) {
      for (const k of Object.keys(result.historical[i])) {
        expectClose(`historical[${i}].${k}`, (ts.historical[i] as Record<string, unknown>)[k], result.historical[i][k]);
      }
    }
  });
}
