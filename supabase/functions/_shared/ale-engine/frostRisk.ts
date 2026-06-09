// Orchestrator — ports analyze_season + run_historical_analysis from the R
// algorithm and assembles the locked result schema (specs/modules/ale.md).

import type {
  CropParams, GlobalPhysics, RunInputs, RunResult, HourlyPoint, Variety,
  WindowResult, HistoricalSeason, EngineDeps,
} from "./types.ts";
import {
  makeDate, addDays, round, accumulateUtah, accumulateWeinberger, accumulateDynamic,
  accumulateGdh, findFulfillmentIndex, computeDailyTmin, calculateDamage,
} from "./compute.ts";

interface SeasonResult {
  variety: Variety;
  season: string;
  biofixStart: string;
  expectedStages: string[];
  utahTotal: number;
  weinbergerTotal: number;
  dynamicTotal: number;
  fulfillmentDate: string | null;
  modelUsed: "Utah" | "Dynamic" | null;
  gdhTotal: number | null;
  bloomDate: string | null;
  windows: WindowResult[];
  cumulativeDamage: number;
  yieldRemaining: number;
}

function findVariety(crop: CropParams, name: string): Variety {
  const v = crop.varieties.find((x) => x.display_name.toLowerCase() === name.toLowerCase());
  if (!v) throw new Error(`Variety '${name}' not found for crop '${crop.slug}'.`);
  if (v.gdh_to_bloom == null) throw new Error(`GDH requirement unavailable for ${name}. Cannot predict bloom date.`);
  return v;
}

function analyzeSeason(
  crop: CropParams, gp: GlobalPhysics, varietyName: string, analysisDate: string, hourly: HourlyPoint[],
): SeasonResult {
  const variety = findVariety(crop, varietyName);
  if (hourly.length === 0) throw new Error("No climate data returned for the requested period.");

  const year = Number(analysisDate.slice(0, 4));
  const month = Number(analysisDate.slice(5, 7));
  const seasonStartYear = month >= crop.chill_biofix_month ? year : year - 1;
  const biofixStart = makeDate(seasonStartYear, crop.chill_biofix_month, crop.chill_biofix_day);
  const season = `${seasonStartYear}-${seasonStartYear + 1}`;

  const temps = hourly.map((h) => h.tempC);
  const utahCum = accumulateUtah(temps, gp.utah_breakpoints);
  const weinbergerCum = accumulateWeinberger(temps, gp.weinberger_params);
  const dynamicCum = accumulateDynamic(temps, gp.dynamic_params);
  const last = (a: number[]) => (a.length ? a[a.length - 1] : 0);

  // --- Chill fulfillment: Utah primary, fall back to Dynamic ---
  let fulfilled = false;
  let fulfillmentDate: string | null = null;
  let modelUsed: "Utah" | "Dynamic" | null = null;

  if (variety.chill_units_cu != null) {
    const idx = findFulfillmentIndex(utahCum, variety.chill_units_cu);
    if (idx >= 0) { fulfillmentDate = hourly[idx].date; fulfilled = true; modelUsed = "Utah"; }
  }
  if (!fulfilled && variety.chill_portions_cp != null) {
    const idx = findFulfillmentIndex(dynamicCum, variety.chill_portions_cp);
    if (idx >= 0) { fulfillmentDate = hourly[idx].date; fulfilled = true; modelUsed = "Dynamic"; }
  }

  const typicalChillEnd = makeDate(seasonStartYear + 1, 3, 15);
  const insufficient = !fulfilled && analysisDate > typicalChillEnd;

  // --- GDH accumulation & bloom prediction ---
  let bloomDate: string | null = null;
  let gdhTotal: number | null = null;
  if (fulfilled && fulfillmentDate && variety.gdh_to_bloom != null) {
    const gdhStart = hourly.findIndex((h) => h.date >= fulfillmentDate!);
    if (gdhStart >= 0) {
      const gdhCum = accumulateGdh(temps.slice(gdhStart), gp.richardson_gdh_params);
      gdhTotal = last(gdhCum);
      const bloomRel = findFulfillmentIndex(gdhCum, variety.gdh_to_bloom);
      if (bloomRel >= 0) bloomDate = hourly[gdhStart + bloomRel].date;
    }
  }

  // --- Frost window analysis ---
  const windows: WindowResult[] = [];
  let yieldRemaining = 1.0;
  let cumulativeDamage = 0;

  if (bloomDate) {
    const daily = computeDailyTmin(hourly);
    for (const win of crop.bloom_windows) {
      const th = crop.frost_thresholds.find((t) => t.stage === win.stage);
      if (!th) continue;   // R: skip window whose stage has no threshold row

      const winStart = addDays(bloomDate, win.offset_start_days);
      const winEnd = addDays(bloomDate, win.offset_end_days);

      if (winStart > analysisDate) {
        windows.push({
          id: windows.length + 1, name: win.window_name, stage: win.stage,
          start: winStart, end: winEnd, events: null, worst_t_c: null, damage: null, status: "Future",
        });
        continue;
      }

      const effectiveEnd = winEnd < analysisDate ? winEnd : analysisDate;
      const status = winEnd > analysisDate ? "In progress" : "Complete";
      const winDaily = daily.filter((d) => d.date >= winStart && d.date <= effectiveEnd);
      const frostDays = winDaily.filter((d) => !Number.isNaN(d.tmin) && d.tmin <= gp.frost_threshold_c);

      let worstT: number | null;
      let maxDamage: number;
      if (frostDays.length > 0) {
        worstT = Math.min(...frostDays.map((d) => d.tmin));
        maxDamage = Math.max(...frostDays.map((d) =>
          calculateDamage(d.tmin, th.kill_10_pct_c, th.kill_90_pct_c, th.slope_frac)));
      } else {
        worstT = winDaily.length > 0 ? Math.min(...winDaily.map((d) => d.tmin)) : null;
        maxDamage = 0;
      }

      windows.push({
        id: windows.length + 1, name: win.window_name, stage: win.stage,
        start: winStart, end: winEnd,
        events: frostDays.length,
        worst_t_c: worstT == null ? null : round(worstT, 1),
        damage: round(maxDamage, 4),
        status,
      });
      yieldRemaining *= 1 - maxDamage;
    }
    cumulativeDamage = round(1 - yieldRemaining, 4);
    yieldRemaining = round(yieldRemaining, 4);
  }

  // Insufficient-chill penalty layered on top of frost damage.
  if (insufficient) {
    yieldRemaining = round(yieldRemaining * (1 - crop.insufficient_chill_penalty), 4);
    cumulativeDamage = round(1 - yieldRemaining, 4);
  }

  return {
    variety, season, biofixStart,
    expectedStages: crop.monthly_stages[String(month)] ?? [],
    utahTotal: last(utahCum),
    weinbergerTotal: last(weinbergerCum),
    dynamicTotal: last(dynamicCum),
    fulfillmentDate, modelUsed,
    gdhTotal, bloomDate, windows, cumulativeDamage, yieldRemaining,
  };
}

const met = (value: number, required: number | null) => required != null && value >= required;

/** Run current-season + 5-season historical analysis, returning the locked schema. */
export async function runFrostAnalysis(
  crop: CropParams, gp: GlobalPhysics, inputs: RunInputs, deps: EngineDeps,
): Promise<RunResult> {
  const analysisDate = deps.today;
  const year = Number(analysisDate.slice(0, 4));
  const month = Number(analysisDate.slice(5, 7));

  const chillStart = makeDate(
    month >= crop.chill_biofix_month ? year : year - 1,
    crop.chill_biofix_month, crop.chill_biofix_day,
  );
  const hourly = await deps.fetchClimate(inputs.lat, inputs.lon, chillStart, analysisDate);
  const cur = analyzeSeason(crop, gp, inputs.variety, analysisDate, hourly);

  const historical: HistoricalSeason[] = [];
  for (let y = 1; y <= 5; y++) {
    const seasonYear = month >= crop.chill_biofix_month ? year - y : year - y - 1;
    const seasonLabel = `${seasonYear}-${seasonYear + 1}`;
    const analysisEnd = makeDate(seasonYear + 1, 8, 31);
    try {
      const cs = makeDate(seasonYear, crop.chill_biofix_month, crop.chill_biofix_day);
      const h = await deps.fetchClimate(inputs.lat, inputs.lon, cs, analysisEnd);
      const res = analyzeSeason(crop, gp, inputs.variety, analysisEnd, h);
      const ev = (i: number) => res.windows[i]?.events ?? null;
      historical.push({
        season: res.season,
        bloom_md: res.bloomDate ? res.bloomDate.slice(5) : null,
        w1: ev(0), w2: ev(1), w3: ev(2), w4: ev(3), w5: ev(4),
        cumulative_damage: res.cumulativeDamage,
        yield: res.yieldRemaining,
      });
    } catch (e) {
      historical.push({
        season: seasonLabel, bloom_md: null,
        w1: null, w2: null, w3: null, w4: null, w5: null,
        cumulative_damage: 0, yield: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const utahVal = round(cur.utahTotal, 1);
  const weinVal = round(cur.weinbergerTotal, 0);
  const dynVal = round(cur.dynamicTotal, 1);

  return {
    meta: {
      lat: inputs.lat, lon: inputs.lon, variety: inputs.variety, crop: inputs.crop,
      analysis_date: analysisDate, season: String(year),
    },
    expected_stages_for_month: cur.expectedStages,
    chill: {
      biofix_start: cur.biofixStart,
      utah: { value: utahVal, required: cur.variety.chill_units_cu, met: met(utahVal, cur.variety.chill_units_cu) },
      weinberger: { value: weinVal, required: cur.variety.chill_hours_ch, met: met(weinVal, cur.variety.chill_hours_ch) },
      dynamic: { value: dynVal, required: cur.variety.chill_portions_cp, met: met(dynVal, cur.variety.chill_portions_cp) },
      met_on: cur.fulfillmentDate,
      model_used: cur.modelUsed,
    },
    heat: {
      gdh: cur.gdhTotal == null ? null : round(cur.gdhTotal, 0),
      required: cur.variety.gdh_to_bloom,
      bloom_estimate: cur.bloomDate,
    },
    windows: cur.windows,
    cumulative: { damage: cur.cumulativeDamage, yield_remaining: cur.yieldRemaining },
    historical,
  };
}
