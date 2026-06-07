// Heat-stress yield-reduction — pure-TS port of
// gis-scripts/algorithms/heat-stress/heat_stress_yield_reduction.R (+ crop_parameters.R).
// Parity target: gis-scripts/algorithms/heat-stress/fixtures/*.json (R-on-EC2 / local R).
//
// Faithful port — replicates the R behaviour exactly, including:
//  * its OWN Utah weighting (strict-< cascade) which DIFFERS from ChillModels
//    and from the frost-risk port (see specs: 3 divergent Utah implementations);
//  * the quirk that FB_prev and FB are found over the same fetched window
//    (the R fetches Sep1(yr-1)→Sep30(yr) but asks FB_prev to start Sep1(yr-2),
//    so both effectively start at the first available row);
//  * per-component round() before summing the total.
//
// No Deno / React deps. Weather IO is injected (HeatStressDeps) so the engine
// stays pure and testable.

import { makeDate, addDays } from "./compute.ts";

// ── Model constants (mirror crop_parameters.R) ───────────────────────────────
// Per-cultivar requirements (CU/GDH) are NOT hardcoded here — they come from the
// DB (ale_crop_varieties.chill_units_cu / gdh_to_bloom), passed in as params, so
// the agronomist-managed crop catalogue is the single source of truth.

const GDH_BASE_TEMP = 4.0;

const PTF_TARGET = 72.0;
const PTF_MAX_LOSS = 0.20;

const LRATE_BASE_TEMP = 7.0;
const LRATE_COEFF = 0.04;
const L_THRESHOLD = 16.0;
const BUD_WINDOW_DAFB = 84;
const FLOWER_A = -(0.76 ** 2);   // -0.5776
const FLOWER_B = 30.15;
const FLOWER_C = -246.5;
const TARGET_FLOWERS = 376.0;
const BUD_MULTIPLIER_FLOOR = 0.80;
const BUD_MAX_LOSS = 0.20;

const SUNBURN_WINDOW_DAFB = 60;
const TMAX_NO_SUNBURN = 30.0;
const TMAX_CONFIRM_SD = 35.0;
const FST_BROWNING_THRESH = 45.0;
const FST_NECROSIS_THRESH = 52.0;
const SD_RATE = 0.005;
const SD_MAX_LOSS = 0.20;
const SN_RATE = 0.10;

interface PfstParam { variable: "T_max" | "S" | "W" | "RH"; slope: number; intercept: number; rWeight: number; }
const PFST_PARAMS: PfstParam[] = [
  { variable: "T_max", slope: 1.17,    intercept: 6.21,   rWeight: 0.90 },
  { variable: "S",     slope: 0.03,    intercept: 22.83,  rWeight: 0.65 },
  { variable: "W",     slope: -1.8069, intercept: 42.317, rWeight: 0.24 },
  { variable: "RH",    slope: -0.4012, intercept: 53.031, rWeight: 0.66 },
];

// Utah hourly weight — heat-stress variant (crop_parameters.R utah_chill_weight).
function utahChillWeight(t: number): number {
  if (t < 2.4) return 0.0;
  if (t < 9.1) return 1.0;
  if (t < 12.5) return 0.5;
  if (t < 16.0) return 0.0;
  if (t < 18.0) return -0.5;
  return -1.0;
}

// PTF hourly score (crop_parameters.R ptf_hourly_score).
function ptfHourlyScore(t: number): number {
  if (t < 15.0) return 0;
  if (t <= 18.5) return 0.286 * (t - 15.0);
  if (t <= 22.0) return 1.0 + 0.143 * (t - 18.5);
  if (t <= 28.0) return 1.5;
  if (t <= 30.0) return 1.5 - 0.25 * (t - 28.0);
  if (t <= 32.0) return 1.0 - 0.5 * (t - 30.0);
  return 0;
}

const round = (x: number, dp: number): number => { const f = 10 ** dp; return Math.round(x * f) / f; };

// ── IO contract ──────────────────────────────────────────────────────────────

export interface HeatStressInputs { lat: number; lon: number; cultivar: string; year: number; }
/** Per-cultivar requirements, loaded from ale_crop_varieties (cu = chill_units_cu, gdh = gdh_to_bloom). */
export interface HeatStressParams { cu: number; gdh: number; }
export interface HeatHourly { datetime: string; date: string; hour: number; temp: number; rad: number; wind: number; rh: number; }
export interface HeatDaily { date: string; tMax: number; tMean: number; }
export interface HeatWeather { hourly: HeatHourly[]; daily: HeatDaily[]; }
export interface HeatStressDeps {
  /** Fetch hourly (temp/rad/wind/rh) + daily (tMax/tMean) for [startDate, endDate]. */
  fetchWeather: (lat: number, lon: number, startDate: string, endDate: string) => Promise<HeatWeather>;
}

export interface HeatStressResult {
  meta: { lat: number; lon: number; cultivar: string; year: number };
  yield_reduction: {
    ptf: number; bud_formation: number; sunburn_sd: number; sunburn_sn: number;
    total: number; retained_yield: number;
  };
}

// ── Phenology: Full Bloom (Utah CU → Richardson GDH) ─────────────────────────

function findFullBloom(hourly: HeatHourly[], startDate: string, cuReq: number, gdhReq: number): string {
  const df = hourly.filter((h) => h.date >= startDate).sort((a, b) => (a.datetime < b.datetime ? -1 : 1));
  if (df.length === 0) throw new Error(`No hourly data from ${startDate}`);

  let cumCU = 0;
  let chillEnd = -1;
  for (let i = 0; i < df.length; i++) {
    cumCU += utahChillWeight(df[i].temp);
    if (cumCU >= cuReq) { chillEnd = i; break; }
  }
  if (chillEnd === -1) throw new Error(`Chill requirement (${cuReq} CU) never met.`);

  let cumGDH = 0;
  for (let i = chillEnd + 1; i < df.length; i++) {
    cumGDH += Math.max(0, df[i].temp - GDH_BASE_TEMP);
    if (cumGDH >= gdhReq) return df[i].date;
  }
  throw new Error(`GDH requirement (${gdhReq} GDH) never met.`);
}

// ── Sub-model A: Pollen Tube Formation ───────────────────────────────────────

function calcPTF(hourly: HeatHourly[], fb: string): number {
  const start = fb, end = addDays(fb, 6);
  const win = hourly.filter((h) => h.date >= start && h.date <= end);
  if (win.length === 0) return PTF_MAX_LOSS;
  const hTotal = win.reduce((s, h) => s + ptfHourlyScore(h.temp), 0);
  const yr = hTotal >= PTF_TARGET ? 0.0 : Math.min(1 - hTotal / PTF_TARGET, PTF_MAX_LOSS);
  return round(yr, 4);
}

// ── Sub-model B: Bud development / flower formation (previous season) ─────────

function calcBudDevelopment(daily: HeatDaily[], fbPrev: string): number {
  const endWindow = addDays(fbPrev, BUD_WINDOW_DAFB);
  const df = daily.filter((d) => d.date >= fbPrev && d.date <= endWindow).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (df.length === 0) return BUD_MAX_LOSS;

  let cumL = 0;
  let dL16: string | null = null;
  for (const d of df) {
    cumL += Math.max(0, LRATE_COEFF * (d.tMean - LRATE_BASE_TEMP));
    if (cumL >= L_THRESHOLD) { dL16 = d.date; break; }
  }
  if (dL16 === null) dL16 = endWindow;

  const flowerDf = df.filter((d) => d.date >= dL16! && d.date <= endWindow);
  const nDays = flowerDf.length;
  const flowersSum = flowerDf.reduce((s, d) => s + Math.max(0, FLOWER_A * d.tMean ** 2 + FLOWER_B * d.tMean + FLOWER_C), 0);
  const flowersAvg = nDays > 0 ? flowersSum / nDays : 0;

  const rawMultiplier = (flowersAvg / TARGET_FLOWERS) * 1.5;
  const multiplier = Math.min(Math.max(rawMultiplier, BUD_MULTIPLIER_FLOOR), 1.0);
  return round(Math.min(1 - multiplier, BUD_MAX_LOSS), 4);
}

// ── Sub-model C: Sunburn during fruit development ────────────────────────────

function calcPfst(tMax: number, s: number, w: number, rh: number): number | null {
  const vals: Record<string, number> = { T_max: tMax, S: s, W: w, RH: rh };
  let weighted = 0, denom = 0;
  for (const p of PFST_PARAMS) {
    const val = vals[p.variable];
    if (val == null || Number.isNaN(val)) continue;
    weighted += (p.slope * val + p.intercept) * p.rWeight;
    denom += p.rWeight;
  }
  return denom > 0 ? weighted / denom : null;
}

function calcSunburn(hourly: HeatHourly[], daily: HeatDaily[], fb: string, year: number): { sd: number; sn: number } {
  const windowStart = addDays(fb, SUNBURN_WINDOW_DAFB);
  const windowEnd = makeDate(year, 9, 30);
  if (windowStart > windowEnd) return { sd: 0, sn: 0 };

  const dailySub = daily.filter((d) => d.date >= windowStart && d.date <= windowEnd).sort((a, b) => (a.date < b.date ? -1 : 1));

  // Means of rad/wind/rh from the 11:00-17:00 window, per date.
  const acc = new Map<string, { rad: number; wind: number; rh: number; n: number }>();
  for (const h of hourly) {
    if (h.date < windowStart || h.date > windowEnd || h.hour < 11 || h.hour > 17) continue;
    const a = acc.get(h.date) ?? { rad: 0, wind: 0, rh: 0, n: 0 };
    a.rad += h.rad; a.wind += h.wind; a.rh += h.rh; a.n += 1;
    acc.set(h.date, a);
  }

  let sdCount = 0, snCount = 0;
  for (const d of dailySub) {
    const tMax = d.tMax;
    if (tMax == null || Number.isNaN(tMax)) continue;
    if (tMax < TMAX_NO_SUNBURN) continue;
    if (tMax > TMAX_CONFIRM_SD) sdCount += 1;

    const m = acc.get(d.date);
    const sMean = m && m.n > 0 ? m.rad / m.n : NaN;
    const wMean = m && m.n > 0 ? m.wind / m.n : NaN;
    const rhMean = m && m.n > 0 ? m.rh / m.n : NaN;
    const pfst = calcPfst(tMax, sMean, wMean, rhMean);
    if (pfst != null && !Number.isNaN(pfst)) {
      if (tMax <= TMAX_CONFIRM_SD && pfst > FST_BROWNING_THRESH) sdCount += 1;
      if (pfst >= FST_NECROSIS_THRESH) snCount += 1;
    }
  }

  return {
    sd: round(Math.min(sdCount * SD_RATE, SD_MAX_LOSS), 4),
    sn: round(snCount * SN_RATE, 4),
  };
}

// ── Orchestration ────────────────────────────────────────────────────────────

export async function runHeatStress(inputs: HeatStressInputs, params: HeatStressParams, deps: HeatStressDeps): Promise<HeatStressResult> {
  if (params.cu == null || params.gdh == null) {
    throw new Error(`Cultivar '${inputs.cultivar}' is missing CU/GDH requirements (chill_units_cu / gdh_to_bloom).`);
  }

  const startDate = makeDate(inputs.year - 1, 9, 1);
  const endDate = makeDate(inputs.year, 9, 30);
  const { hourly, daily } = await deps.fetchWeather(inputs.lat, inputs.lon, startDate, endDate);

  // FB_prev asks to start Sep1(yr-2) but the fetched data begins Sep1(yr-1);
  // replicate the R: both effectively start at the first available row.
  const fbPrev = findFullBloom(hourly, makeDate(inputs.year - 2, 9, 1), params.cu, params.gdh);
  const fb = findFullBloom(hourly, makeDate(inputs.year - 1, 9, 1), params.cu, params.gdh);

  const ptf = calcPTF(hourly, fb);
  const budFormation = calcBudDevelopment(daily, fbPrev);
  const { sd, sn } = calcSunburn(hourly, daily, fb, inputs.year);

  const total = round(ptf + budFormation + sd + sn, 4);
  const retainedYield = round(Math.max(0, 1 - total), 4);

  return {
    meta: { lat: inputs.lat, lon: inputs.lon, cultivar: inputs.cultivar, year: inputs.year },
    yield_reduction: { ptf, bud_formation: budFormation, sunburn_sd: sd, sunburn_sn: sn, total, retained_yield: retainedYield },
  };
}
