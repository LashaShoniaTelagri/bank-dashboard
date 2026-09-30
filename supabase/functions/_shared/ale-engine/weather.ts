// Open-Meteo access — URL construction, response parsing, and the archive/recent
// split + merge logic (ported from fetch_climate_data in the R algorithm). All
// pure: the caller performs the actual HTTP (and caching). Open-Meteo is the V1
// source but is fully isolated here so it can be swapped later.

import type { HourlyPoint } from "./types.ts";
import { addDays, daysBetween } from "./compute.ts";

const ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";

export function buildArchiveUrl(lat: number, lon: number, startDate: string, endDate: string): string {
  const p = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start_date: startDate,
    end_date: endDate,
    hourly: "temperature_2m",
    timezone: "auto",
  });
  return `${ARCHIVE_BASE}?${p.toString()}`;
}

export function buildForecastUrl(lat: number, lon: number, pastDays: number): string {
  const p = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    past_days: String(pastDays),
    forecast_days: "1",
    hourly: "temperature_2m",
    timezone: "auto",
  });
  return `${FORECAST_BASE}?${p.toString()}`;
}

/** Parse an Open-Meteo hourly response into points. Throws on API error payloads. */
export function parseHourly(json: any): HourlyPoint[] {
  if (json?.error) throw new Error(`Open-Meteo error: ${json.reason ?? "unknown"}`);
  const times: string[] = json?.hourly?.time ?? [];
  const temps: (number | null)[] = json?.hourly?.temperature_2m ?? [];
  const out: HourlyPoint[] = [];
  for (let i = 0; i < times.length; i++) {
    const t = temps[i];
    const datetime = times[i];               // e.g. "2024-09-01T00:00"
    out.push({
      datetime,
      tempC: t == null ? NaN : Number(t),
      date: datetime.slice(0, 10),
      hour: Number(datetime.slice(11, 13)),
    });
  }
  return out;
}

export interface ClimatePlan {
  archive: { start: string; end: string } | null;
  recent: { pastDays: number } | null;
}

/**
 * Decide which Open-Meteo endpoints to hit for [startDate, endDate] given today.
 * Mirrors fetch_climate_data: archive covers up to today-7; the recent/forecast
 * endpoint fills the gap (capped at 16 past days).
 */
export function planClimateFetch(startDate: string, endDate: string, today: string): ClimatePlan {
  const archiveEnd = endDate < addDays(today, -7) ? endDate : addDays(today, -7);
  const plan: ClimatePlan = { archive: null, recent: null };
  if (startDate <= archiveEnd) plan.archive = { start: startDate, end: archiveEnd };
  if (endDate > archiveEnd) {
    const gapDays = daysBetween(archiveEnd, today);
    plan.recent = { pastDays: Math.min(gapDays, 16) };
  }
  return plan;
}

/**
 * Merge archive + recent points: drop recent beyond endDate, de-duplicate by
 * datetime (archive wins), drop NaN temps, sort ascending by datetime.
 */
export function combineHourly(archive: HourlyPoint[], recent: HourlyPoint[], endDate: string): HourlyPoint[] {
  const recentTrimmed = recent.filter((p) => p.date <= endDate);
  const seen = new Set<string>();
  const out: HourlyPoint[] = [];
  for (const p of [...archive, ...recentTrimmed]) {
    if (seen.has(p.datetime)) continue;
    seen.add(p.datetime);
    if (Number.isNaN(p.tempC)) continue;
    out.push(p);
  }
  out.sort((a, b) => (a.datetime < b.datetime ? -1 : a.datetime > b.datetime ? 1 : 0));
  return out;
}
