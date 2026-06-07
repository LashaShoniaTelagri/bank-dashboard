// Heat-stress TS↔R parity. Runs the TS port against the SAME live Open-Meteo
// data the R wrapper used, and compares to the committed R fixtures within
// tolerance (counts/derived fractions: 1e-3).
//
// Requires network: deno test --allow-net --allow-read.
// Fixtures: gis-scripts/algorithms/heat-stress/fixtures/*.json (generated from R).

import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runHeatStress, type HeatWeather, type HeatStressInputs } from "./heatStress.ts";

const FIXTURE_DIR = new URL("../../../../gis-scripts/algorithms/heat-stress/fixtures/", import.meta.url);
const FIXTURES = ["fuji_ro_2024", "lory_ge_2023", "story_ro_2022", "pinklady_ge_2024"];
const TOL = 1e-3;

// Live fetch mirroring fetch_weather() in heat_stress_yield_reduction.R.
async function fetchHeatWeather(lat: number, lon: number, startDate: string, endDate: string): Promise<HeatWeather> {
  const p = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    start_date: startDate, end_date: endDate,
    hourly: "temperature_2m,shortwave_radiation,windspeed_10m,relativehumidity_2m",
    daily: "temperature_2m_max,temperature_2m_mean",
    timezone: "auto", wind_speed_unit: "ms",
  });
  const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${p}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const j = await res.json();
  const ht: string[] = j.hourly.time;
  const hourly = ht.map((t: string, i: number) => ({
    datetime: t, date: t.slice(0, 10), hour: Number(t.slice(11, 13)),
    temp: Number(j.hourly.temperature_2m[i]),
    rad: Number(j.hourly.shortwave_radiation[i]),
    wind: Number(j.hourly.windspeed_10m[i]),
    rh: Number(j.hourly.relativehumidity_2m[i]),
  }));
  const dt: string[] = j.daily.time;
  const daily = dt.map((d: string, i: number) => ({
    date: d, tMax: Number(j.daily.temperature_2m_max[i]), tMean: Number(j.daily.temperature_2m_mean[i]),
  }));
  return { hourly, daily };
}

async function loadFixture(name: string) {
  const txt = await Deno.readTextFile(new URL(`${name}.json`, FIXTURE_DIR));
  return JSON.parse(txt) as { inputs: HeatStressInputs; result: { yield_reduction: Record<string, number> } };
}

for (const name of FIXTURES) {
  Deno.test(`heat-stress parity — ${name}`, async () => {
    const { inputs, result } = await loadFixture(name);
    const ts = await runHeatStress(inputs, { fetchWeather: fetchHeatWeather });
    for (const k of Object.keys(result.yield_reduction)) {
      const r = result.yield_reduction[k];
      const t = (ts.yield_reduction as Record<string, number>)[k];
      assert(Math.abs(t - r) <= TOL, `${name}.${k}: TS=${t} R=${r} (Δ=${Math.abs(t - r)})`);
    }
  });
}
