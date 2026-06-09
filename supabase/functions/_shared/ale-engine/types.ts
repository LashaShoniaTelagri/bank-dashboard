// ALE engine types. Pure data — no Deno / React / Vite deps so the engine runs
// in both the Edge Function (Deno) and (optionally) the browser.
// Mirrors the DB shapes (ale_crops / ale_crop_varieties / ale_frost_thresholds /
// ale_bloom_windows / ale_global_physics) and the locked result schema
// (specs/modules/ale.md § Result schema).

export interface UtahBreakpoint { t_lower: number | null; t_upper: number | null; cu: number; }
export interface DynamicParams { e0: number; e1: number; a0: number; a1: number; slp: number; tetmlt: number; }
export interface WeinbergerParams { t_min: number; t_max: number; }
export interface RichardsonParams { t_base: number; t_opt: number; t_crit: number; }

export interface GlobalPhysics {
  utah_breakpoints: UtahBreakpoint[];
  dynamic_params: DynamicParams;
  weinberger_params: WeinbergerParams;
  richardson_gdh_params: RichardsonParams;
  frost_threshold_c: number;
}

export interface Variety {
  display_name: string;
  chill_portions_cp: number | null;
  chill_hours_ch: number | null;
  chill_units_cu: number | null;
  gdh_to_bloom: number | null;
}

export interface FrostThreshold {
  stage: string;
  kill_10_pct_c: number;
  kill_90_pct_c: number;
  slope_frac: number;
}

export interface BloomWindow {
  window_id: number;
  window_name: string;
  stage: string;
  offset_start_days: number;
  offset_end_days: number;
}

export interface CropParams {
  slug: string;
  display_name: string;
  chill_biofix_month: number;
  chill_biofix_day: number;
  insufficient_chill_penalty: number;
  varieties: Variety[];
  frost_thresholds: FrostThreshold[];
  bloom_windows: BloomWindow[];
  monthly_stages: Record<string, string[]>;   // "1".."12" -> stage labels
}

export interface RunInputs {
  lat: number;
  lon: number;
  variety: string;
  crop: string;
}

/** One hourly observation. `date` is 'YYYY-MM-DD', `hour` 0-23 (local, per Open-Meteo timezone=auto). */
export interface HourlyPoint { datetime: string; tempC: number; date: string; hour: number; }

/** Injected IO + clock so the engine itself stays pure and testable. */
export interface EngineDeps {
  /** Return combined, de-duplicated, sorted hourly temps for [startDate, endDate]. */
  fetchClimate: (lat: number, lon: number, startDate: string, endDate: string) => Promise<HourlyPoint[]>;
  /** Today as 'YYYY-MM-DD'. */
  today: string;
}

// ── Locked result schema ────────────────────────────────────────────────────

export interface ChillModelResult { value: number | null; required: number | null; met: boolean; }

export interface WindowResult {
  id: number;
  name: string;
  stage: string;
  start: string;
  end: string;
  events: number | null;
  worst_t_c: number | null;
  damage: number | null;
  status: 'Complete' | 'In progress' | 'Future';
}

export interface HistoricalSeason {
  season: string;            // "2024-2025"
  bloom_md: string | null;   // "04-28"
  w1: number | null;
  w2: number | null;
  w3: number | null;
  w4: number | null;
  w5: number | null;
  cumulative_damage: number;
  yield: number;
  error?: string;
}

export interface RunResult {
  meta: { lat: number; lon: number; variety: string; crop: string; analysis_date: string; season: string };
  expected_stages_for_month: string[];
  chill: {
    biofix_start: string;
    utah: ChillModelResult;
    weinberger: ChillModelResult;
    dynamic: ChillModelResult;
    met_on: string | null;
    model_used: 'Utah' | 'Dynamic' | null;
  };
  heat: { gdh: number | null; required: number | null; bloom_estimate: string | null };
  windows: WindowResult[];
  cumulative: { damage: number; yield_remaining: number };
  historical: HistoricalSeason[];
}
