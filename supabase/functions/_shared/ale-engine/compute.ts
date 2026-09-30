// Numeric kernels + date helpers — faithful ports of the R routines in
// gis-scripts/scripts/frost-risk/frost_damage_algorithm.R. Pure functions only.

import type {
  HourlyPoint, UtahBreakpoint, DynamicParams, WeinbergerParams, RichardsonParams,
} from "./types.ts";

// ── Dates (all 'YYYY-MM-DD'; ISO strings compare lexically) ──────────────────

export function makeDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDays(s: string, n: number): string {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  const ta = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const tb = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((tb - ta) / 86400000);
}

/** Banker-agnostic round to dp decimals (matches R within the ±1e-3 tolerance). */
export function round(x: number, dp = 0): number {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}

// ── Chill: Utah (Richardson et al. 1974) ─────────────────────────────────────
// R uses `t < 1.4` for the first bucket then `t <= upper` for the rest. Replicate
// exactly: first breakpoint is strict-<, subsequent ones inclusive-<=, final
// (t_upper null) is the else branch.

export function utahCU(t: number, breakpoints: UtahBreakpoint[]): number {
  for (let i = 0; i < breakpoints.length; i++) {
    const bp = breakpoints[i];
    if (bp.t_upper == null) return bp.cu;
    if (i === 0) { if (t < bp.t_upper) return bp.cu; }
    else if (t <= bp.t_upper) return bp.cu;
  }
  return breakpoints[breakpoints.length - 1].cu;
}

export function accumulateUtah(temps: (number | null)[], breakpoints: UtahBreakpoint[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const t of temps) {
    acc += t == null ? 0 : utahCU(t, breakpoints);
    out.push(acc);
  }
  return out;
}

// ── Chill: Weinberger (1950) — count hours in [t_min, t_max] ──────────────────

export function accumulateWeinberger(temps: (number | null)[], p: WeinbergerParams): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const t of temps) {
    if (t != null && t >= p.t_min && t <= p.t_max) acc += 1;
    out.push(acc);
  }
  return out;
}

// ── Chill: Dynamic (Fishman et al. 1987) ─────────────────────────────────────

export function accumulateDynamic(temps: (number | null)[], p: DynamicParams): number[] {
  const out: number[] = [];
  let interS = 0;
  let total = 0;
  for (const t of temps) {
    if (t == null) { out.push(total); continue; }
    const Tk = t + 273.0;
    const xs = (p.a0 / p.a1) * Math.exp((p.e1 - p.e0) / Tk);
    const ak1 = p.a1 * Math.exp(-p.e1 / Tk);
    interS = xs - (xs - interS) * Math.exp(-ak1);
    if (interS >= 1.0) {
      const ftmprt = (p.slp * p.tetmlt * (Tk - p.tetmlt)) / Tk;
      const sr = Math.exp(ftmprt);
      const xi = sr / (1.0 + sr);
      const delt = xi * interS;
      total += delt;
      interS -= delt;
    }
    out.push(total);
  }
  return out;
}

// ── Heat: Richardson GDH ─────────────────────────────────────────────────────

export function accumulateGdh(temps: (number | null)[], p: RichardsonParams): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const t of temps) {
    let g = 0;
    if (t != null) {
      if (t <= p.t_base) g = 0;
      else if (t <= p.t_opt) g = t - p.t_base;
      else if (t <= p.t_crit) g = (p.t_opt - p.t_base) * (1 - (t - p.t_opt) / (p.t_crit - p.t_opt));
      else g = 0;
    }
    acc += g;
    out.push(acc);
  }
  return out;
}

// ── Threshold detection ──────────────────────────────────────────────────────

/** First index where cumulative >= threshold, or -1. */
export function findFulfillmentIndex(cumulative: number[], threshold: number): number {
  for (let i = 0; i < cumulative.length; i++) if (cumulative[i] >= threshold) return i;
  return -1;
}

// ── Daily minimum temperature ────────────────────────────────────────────────

export interface DailyTmin { date: string; tmin: number; }

export function computeDailyTmin(hourly: HourlyPoint[]): DailyTmin[] {
  const byDate = new Map<string, number>();
  for (const h of hourly) {
    if (h.tempC == null || Number.isNaN(h.tempC)) continue;
    const cur = byDate.get(h.date);
    if (cur === undefined || h.tempC < cur) byDate.set(h.date, h.tempC);
  }
  return [...byDate.entries()]
    .map(([date, tmin]) => ({ date, tmin }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// ── Single frost-event damage (0–1) ──────────────────────────────────────────

export function calculateDamage(tmin: number, kill10: number, _kill90: number, slopeFrac: number): number {
  if (Number.isNaN(tmin) || tmin > kill10) return 0;
  const damage = 0.10 + (kill10 - tmin) * slopeFrac;
  return Math.min(damage, 1.0);
}
