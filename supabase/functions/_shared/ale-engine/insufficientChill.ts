// Insufficient-chill yield loss — pure-TS port of
// gis-scripts/scripts/insufficient-chill/insufficient_chill_yield_loss.R
// (+ data/chill_parameters.R). Parity target: that algorithm's fixtures/*.json.
//
// The Utah CU and Dynamic CP models are EXACT ports of ChillModels::utah_model
// and ChillModels::dynamic_model (Fishman) — NOT the frost-risk port's variants
// (see specs: divergent chill implementations). Weinberger CH is local.
//
// run_date is injected (deps.today) rather than read from the clock, so runs are
// reproducible and match the R fixture's pinned meta.run_date.

import { makeDate } from "./compute.ts";

// Per-variety chill requirements come from the DB (ale_crop_varieties), resolved
// by the caller and passed in as `cr` — not hardcoded here. The model constants
// below (season window, severity bands, tier coefficients) mirror chill_parameters.R.

const SEASON_START_MONTH = 9, SEASON_START_DAY = 1;
const SEASON_END_MONTH = 3, SEASON_END_DAY = 31;
const WEINBERGER_MIN = 0.0, WEINBERGER_MAX = 7.2;
const SEVERITY_MARGINAL = 20.0, SEVERITY_MODERATE = 40.0;
const BINARY_YIELD_LOSS_COEFFICIENT = 0.26;
const T_THRESHOLD = 0.20, K_SLOPE = 0.013, MAX_LOSS = 0.80;

// ── Chill models ─────────────────────────────────────────────────────────────

// EXACT port of ChillModels::utah_model (total).
function utahModelTotal(temps: number[]): number {
  let sum = 0;
  for (const x of temps) {
    if (x <= 1.4) sum += 0;
    else if (x <= 2.4) sum += 0.5;
    else if (x <= 9.1) sum += 1;
    else if (x <= 12.4) sum += 0.5;
    else if (x <= 15.9) sum += 0;
    else if (x <= 18) sum += -0.5;
    else sum += -1;
  }
  return sum;
}

// Weinberger (1950): hours with 0 ≤ T ≤ 7.2.
function weinbergerTotal(temps: number[]): number {
  let n = 0;
  for (const x of temps) if (x >= WEINBERGER_MIN && x <= WEINBERGER_MAX) n += 1;
  return n;
}

// EXACT port of ChillModels::dynamic_model (Fishman). Note TK = x + 273.
function dynamicModelTotal(temps: number[]): number {
  const n = temps.length;
  if (n === 0) return NaN;
  const e0 = 4153.5, e1 = 12888.8, a0 = 139500, a1 = 2.567e18, slp = 1.6, tetmlt = 277;
  const aa = a0 / a1, ee = e1 - e0;
  const xi = new Array<number>(n), xs = new Array<number>(n), ak1 = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const TK = temps[i] + 273;
    const ftmprt = (slp * tetmlt * (TK - tetmlt)) / TK;
    const sr = Math.exp(ftmprt);
    xi[i] = sr / (1 + sr);
    xs[i] = aa * Math.exp(ee / TK);
    ak1[i] = a1 * Math.exp(-e1 / TK);
  }
  const E = new Array<number>(n), S = new Array<number>(n);
  E[0] = 0; S[0] = 0;
  for (let l = 1; l < n; l++) {
    if (E[l - 1] < 1) S[l] = E[l - 1];
    else S[l] = E[l - 1] - E[l - 1] * xi[l - 1];
    E[l] = xs[l] - (xs[l] - S[l]) * Math.exp(-ak1[l]);
  }
  let total = 0;
  for (let i = 0; i < n; i++) if (E[i] >= 1) total += E[i] * xi[i];
  return total;
}

// ── Deficit / severity / agreement / tiers ───────────────────────────────────

interface ModelDeficit { cd: number | null; cdPct: number | null; met: boolean | null; }
const makeDeficit = (acc: number | null, cr: number | null): ModelDeficit => {
  if (cr == null || acc == null || Number.isNaN(acc)) return { cd: null, cdPct: null, met: null };
  const cd = cr - acc;
  return { cd, cdPct: (cd / cr) * 100, met: cd <= 0 };
};

function classifySeverity(cdPct: number | null): string {
  if (cdPct == null || cdPct <= 0) return "SUFFICIENT";
  if (cdPct <= SEVERITY_MARGINAL) return "MARGINAL";
  if (cdPct <= SEVERITY_MODERATE) return "MODERATE";
  return "SEVERE";
}

function checkAgreement(met: (boolean | null)[]): string {
  const m = met.filter((v): v is boolean => v != null);
  if (m.length < 2) return "INSUFFICIENT_DATA";
  if (m.every((v) => v)) return "ALL_SUFFICIENT";
  if (m.every((v) => !v)) return "ALL_DEFICIT";
  return "DISAGREEMENT";
}

interface Tier { yield_reduction: number | null; yield_reduction_pct: number | null; confidence: string; }
function computeBinaryTier(agreement: string, primaryMet: boolean | null): Tier {
  if (primaryMet == null) return { yield_reduction: null, yield_reduction_pct: null, confidence: "NO_DATA" };
  if (!primaryMet || agreement === "ALL_DEFICIT") {
    return { yield_reduction: BINARY_YIELD_LOSS_COEFFICIENT, yield_reduction_pct: BINARY_YIELD_LOSS_COEFFICIENT * 100, confidence: "LOW" };
  }
  if (agreement === "DISAGREEMENT") {
    return { yield_reduction: BINARY_YIELD_LOSS_COEFFICIENT * 0.5, yield_reduction_pct: BINARY_YIELD_LOSS_COEFFICIENT * 0.5 * 100, confidence: "VERY_LOW" };
  }
  return { yield_reduction: 0, yield_reduction_pct: 0, confidence: "MEDIUM" };
}

const round = (x: number, dp: number): number => { const f = 10 ** dp; return Math.round(x * f) / f; };

function computeProportionalTier(cdPct: number | null): Tier {
  if (cdPct == null || cdPct <= 0) return { yield_reduction: 0, yield_reduction_pct: 0, confidence: "MEDIUM" };
  const cdFraction = cdPct / 100;
  const tPct = T_THRESHOLD * 100;
  if (cdFraction <= T_THRESHOLD) return { yield_reduction: 0, yield_reduction_pct: 0, confidence: "MEDIUM" };
  const loss = Math.min(K_SLOPE * (cdPct - tPct), MAX_LOSS);
  return { yield_reduction: round(loss, 3), yield_reduction_pct: round(loss * 100, 1), confidence: "LOW" };
}

function selectPrimary(d: { cdPctCU: number | null; metCU: boolean | null; cdPctCP: number | null; metCP: boolean | null }, climate: string) {
  if (climate === "continental") {
    if (d.cdPctCU != null) return { pct: d.cdPctCU, met: d.metCU, model: "Utah CU" };
    return { pct: d.cdPctCP, met: d.metCP, model: "Dynamic CP (fallback)" };
  }
  if (d.cdPctCP != null) return { pct: d.cdPctCP, met: d.metCP, model: "Dynamic CP" };
  return { pct: d.cdPctCU, met: d.metCU, model: "Utah CU (fallback)" };
}

// ── IO contract + result ─────────────────────────────────────────────────────

export interface InsufficientChillInputs {
  lat: number; lon: number; variety?: string | null; n_years?: number; climate_type?: string;
}
/** Variety chill requirements, resolved from ale_crop_varieties by the caller.
 *  `found=false` (+ median CR values) when the variety is unknown — the caller
 *  computes the median across the crop's varieties. */
export interface ChillCR { cr_cu: number | null; cr_ch: number | null; cr_cp: number | null; found: boolean; variety_used: string; }
export interface InsufficientChillDeps {
  /** Hourly temps (°C, chronological) for [startDate, endDate]. */
  fetchSeasonTemps: (lat: number, lon: number, startDate: string, endDate: string) => Promise<number[]>;
  /** run_date as 'YYYY-MM-DD'. */
  today: string;
}

export interface InsufficientChillResult {
  meta: { lat: number; lon: number; variety: string; variety_found: boolean; climate_type: string; run_date: string; season_complete: boolean; current_season: string };
  chill: { cu_accumulated: number | null; ch_accumulated: number | null; cp_accumulated: number | null; cr_cu: number | null; cr_ch: number | null; cr_cp: number | null };
  deficit: { cd_cu: number | null; cd_ch: number | null; cd_cp: number | null; cd_pct_primary: number | null; primary_model: string; severity: string; model_agreement: string };
  tiers: {
    tier1: { prob_sufficient: number; yield_risk_prob: number; risk_label: string; n_seasons: number; n_sufficient: number };
    tier2: Tier; tier3: Tier;
  };
  recommended: { yield_reduction: number; output_tier: string };
  historical: Array<{ season: string; cd_pct: number | null; severity: string; tier2_pct: number | null; tier3_pct: number | null; chill_met: boolean | null }>;
  projection: null;
}

// ── Orchestration ────────────────────────────────────────────────────────────

export async function runInsufficientChill(inputs: InsufficientChillInputs, cr: ChillCR, deps: InsufficientChillDeps): Promise<InsufficientChillResult> {
  const nYears = inputs.n_years ?? 5;
  const climate = inputs.climate_type ?? "continental";
  const runDate = deps.today;

  const [ry, rm] = runDate.split("-").map(Number);
  const seaEndYr = rm >= SEASON_START_MONTH ? ry + 1 : ry;
  const seasonComplete = runDate >= makeDate(seaEndYr, SEASON_END_MONTH, SEASON_END_DAY);

  const seasons = Array.from({ length: nYears }, (_, i) => {
    const yr = seaEndYr - i;
    const start = makeDate(yr - 1, SEASON_START_MONTH, SEASON_START_DAY);
    let end = makeDate(yr, SEASON_END_MONTH, SEASON_END_DAY);
    if (i === 0 && end > runDate) end = runDate;   // cap current season at run_date
    return { name: `season_${yr}`, start, end };
  });


  interface SeasonResult {
    name: string; chill: { CU: number | null; CH: number | null; CP: number | null };
    deficit: ReturnType<typeof buildDeficit>; primaryPct: number | null; primaryMet: boolean | null;
    primaryModel: string; severity: string; agreement: string; tier2: Tier; tier3: Tier;
  }

  function buildDeficit(chill: { CU: number | null; CH: number | null; CP: number | null }) {
    const cu = makeDeficit(chill.CU, cr.cr_cu), ch = makeDeficit(chill.CH, cr.cr_ch), cp = makeDeficit(chill.CP, cr.cr_cp);
    return { cu, ch, cp };
  }

  const results: SeasonResult[] = [];
  for (const s of seasons) {
    let temps: number[];
    try {
      temps = interpolateNa(await deps.fetchSeasonTemps(inputs.lat, inputs.lon, s.start, s.end));
    } catch {
      continue;   // skip seasons that fail to fetch (matches R tryCatch)
    }
    if (temps.length === 0 || temps.every((t) => Number.isNaN(t))) continue;

    const chill = { CU: utahModelTotal(temps), CH: weinbergerTotal(temps), CP: dynamicModelTotal(temps) };
    const d = buildDeficit(chill);
    const primary = selectPrimary({ cdPctCU: d.cu.cdPct, metCU: d.cu.met, cdPctCP: d.cp.cdPct, metCP: d.cp.met }, climate);
    const agreement = checkAgreement([d.cu.met, d.ch.met, d.cp.met]);
    results.push({
      name: s.name, chill, deficit: d, primaryPct: primary.pct, primaryMet: primary.met,
      primaryModel: primary.model, severity: classifySeverity(primary.pct), agreement,
      tier2: computeBinaryTier(agreement, primary.met), tier3: computeProportionalTier(primary.pct),
    });
  }
  if (results.length === 0) throw new Error("No seasons processed successfully.");

  const current = results[0];

  // Tier 1: probability across seasons.
  const histPcts = results.map((r) => r.primaryPct);
  const nSeasons = histPcts.length;
  const nSufficient = histPcts.filter((p) => p != null && p <= 0).length;
  const pSufficient = nSufficient / nSeasons;
  const riskLabel = pSufficient >= 0.90 ? "LOW_RISK" : pSufficient >= 0.70 ? "MODERATE_RISK" : pSufficient >= 0.50 ? "HIGH_RISK" : "CRITICAL";
  const yieldRiskProb = 1 - pSufficient;

  const tier2 = computeBinaryTier(current.agreement, current.primaryMet);
  const tier3 = computeProportionalTier(current.primaryPct);

  const recommendedYr = nSeasons >= 3 ? yieldRiskProb : (tier2.yield_reduction ?? 0);
  const recommendedTier = nSeasons >= 3 ? "Tier1_Probability" : "Tier2_Binary";

  return {
    meta: {
      lat: inputs.lat, lon: inputs.lon, variety: cr.variety_used, variety_found: cr.found,
      climate_type: climate, run_date: runDate, season_complete: seasonComplete, current_season: current.name,
    },
    chill: {
      cu_accumulated: current.chill.CU, ch_accumulated: current.chill.CH, cp_accumulated: current.chill.CP,
      cr_cu: cr.cr_cu, cr_ch: cr.cr_ch, cr_cp: cr.cr_cp,
    },
    deficit: {
      cd_cu: current.deficit.cu.cd, cd_ch: current.deficit.ch.cd, cd_cp: current.deficit.cp.cd,
      cd_pct_primary: current.primaryPct, primary_model: current.primaryModel,
      severity: current.severity, model_agreement: current.agreement,
    },
    tiers: {
      tier1: { prob_sufficient: pSufficient, yield_risk_prob: yieldRiskProb, risk_label: riskLabel, n_seasons: nSeasons, n_sufficient: nSufficient },
      tier2, tier3,
    },
    recommended: { yield_reduction: recommendedYr, output_tier: recommendedTier },
    historical: results.map((r) => ({
      season: r.name, cd_pct: r.primaryPct, severity: r.severity,
      tier2_pct: r.tier2.yield_reduction_pct, tier3_pct: r.tier3.yield_reduction_pct, chill_met: r.primaryMet,
    })),
    projection: null,
  };
}

// Linear interpolation of interior NaN gaps (matches R approx default rule=1).
function interpolateNa(temps: number[]): number[] {
  const out = [...temps];
  for (let i = 0; i < out.length; i++) {
    if (!Number.isNaN(out[i])) continue;
    let j = i + 1;
    while (j < out.length && Number.isNaN(out[j])) j++;
    const left = i - 1, right = j;
    if (left >= 0 && right < out.length) {
      const span = right - left;
      for (let k = i; k < j; k++) out[k] = out[left] + (out[right] - out[left]) * ((k - left) / span);
    }
    i = j - 1;
  }
  return out;
}
