import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  runFrostAnalysis, runGraph, planClimateFetch, combineHourly, parseHourly,
  buildArchiveUrl, buildForecastUrl, addDays,
  runHeatStress, runInsufficientChill,
  type CropParams, type GlobalPhysics, type HourlyPoint, type RunResult, type GraphSpec,
  type HeatWeather, type ChillCR,
} from "../_shared/ale-engine/index.ts";
import { callParity, parityEnabled } from "../_shared/r-parity-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface RunInputsBody { lat: number; lon: number; variety: string; crop?: string; }
interface Body extends Partial<RunInputsBody> {
  // Algorithm id (defaults to "frost-risk"). Non-frost ids run R-only via parity.
  algorithm?: string;
  // Graph mode (canvas builder): run a saved graph by id, or an inline graph.
  graph_id?: string;
  graph_jsonb?: GraphSpec;
  inputs?: RunInputsBody | Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // --- Auth: verify JWT + ALE access (server-side, don't trust the client) ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json({ error: "Invalid token" }, 401);

    const { data: hasAccess, error: accessErr } = await supabase.rpc("has_ale_access", { uid: user.id });
    if (accessErr) return json({ error: "Access check failed", details: accessErr.message }, 500);
    if (!hasAccess) return json({ error: "ALE access denied" }, 403);

    const body: Body = await req.json();

    // --- Generic dispatch: non-frost algorithms ---
    // heat-stress / insufficient-chill have TS ports (run as the production
    // runtime, with best-effort R parity + field diff). Any other id is R-only.
    // All carry algorithm-specific inputs, forwarded untouched.
    const algorithm = body.algorithm ?? "frost-risk";
    if (algorithm !== "frost-risk") {
      return await runNonFrost(supabase, user.id, algorithm, (body.inputs ?? {}) as Record<string, unknown>);
    }

    // --- Inputs (graph mode supplies them under `inputs`; legacy mode at top level) ---
    const inp = (body.inputs ?? { lat: body.lat as number, lon: body.lon as number, variety: body.variety as string, crop: body.crop }) as RunInputsBody;
    const cropSlug = inp.crop ?? "apple";
    if (typeof inp.lat !== "number" || typeof inp.lon !== "number" || !inp.variety) {
      return json({ error: "Required inputs: lat (number), lon (number), variety (string)" }, 400);
    }
    const runInputs = { lat: inp.lat, lon: inp.lon, variety: inp.variety, crop: cropSlug };

    // --- Resolve graph (by id, inline, or none = legacy direct frost run) ---
    let graph: GraphSpec | null = null;
    let graphId: string | null = body.graph_id ?? null;
    if (body.graph_id) {
      const { data, error } = await supabase.from("ale_logic_graphs").select("graph_jsonb").eq("id", body.graph_id).maybeSingle();
      if (error || !data) return json({ error: "Graph not found" }, 404);
      graph = data.graph_jsonb as GraphSpec;
    } else if (body.graph_jsonb) {
      graph = body.graph_jsonb;
    }

    // --- Load crop params + active global physics ---
    const { crop, gp, gpRow, error: loadErr } = await loadCropParams(supabase, cropSlug);
    if (loadErr || !crop || !gp) return json({ error: loadErr ?? "Crop not found" }, 404);

    // --- Run frost-risk: graph (canvas) or direct (legacy) ---
    const today = new Date().toISOString().slice(0, 10);
    const deps = { today, fetchClimate: (la: number, lo: number, s: string, e: string) => fetchClimate(supabase, la, lo, s, e, today) };
    let ts_result: RunResult;
    try {
      if (graph) {
        const out = await runGraph(graph, crop, gp, runInputs, deps);
        if (out.errors.length || !out.result) {
          await recordRun(supabase, user.id, cropSlug, inp.variety, runInputs, graphId, graph, gpRow, null, null, null, "failed", out.errors.join("; "));
          return json({ error: "Invalid graph", details: out.errors }, 400);
        }
        ts_result = out.result;
      } else {
        ts_result = await runFrostAnalysis(crop, gp, runInputs, deps);
      }
    } catch (e) {
      await recordRun(supabase, user.id, cropSlug, inp.variety, runInputs, graphId, graph, gpRow, null, null, null, "failed", errMsg(e));
      return json({ error: "Engine failed", details: errMsg(e) }, 400);
    }

    // --- R parity (best-effort; never blocks TS) ---
    let r_result: unknown = null;
    let diff: DiffEntry[] | null = null;
    let parityNote: string | undefined;
    if (parityEnabled()) {
      try {
        r_result = await callParity("frost-risk", runInputs);
        diff = diffResults(ts_result, r_result);
      } catch (e) {
        parityNote = `parity unavailable: ${errMsg(e)}`;
      }
    } else {
      parityNote = "parity disabled (PARITY_HMAC_SECRET unset)";
    }

    await recordRun(supabase, user.id, cropSlug, inp.variety, runInputs, graphId, graph, gpRow, ts_result, r_result, diff, "succeeded", null);

    return json({ ts_result, r_result, diff, algorithm, parity_note: parityNote });
  } catch (e) {
    console.error("ale-evaluate error:", e);
    return json({ error: "Internal server error", details: errMsg(e) }, 500);
  }
});

// ── Crop params loader ───────────────────────────────────────────────────────

async function loadCropParams(supabase: any, slug: string): Promise<{
  crop?: CropParams; gp?: GlobalPhysics; gpRow?: unknown; error?: string;
}> {
  const { data: cropRow, error: cropErr } = await supabase
    .from("ale_crops").select("*").eq("slug", slug).maybeSingle();
  if (cropErr) return { error: cropErr.message };
  if (!cropRow) return { error: `Crop '${slug}' not found` };

  const [varieties, thresholds, windows, monthly, gpRow] = await Promise.all([
    supabase.from("ale_crop_varieties").select("*").eq("crop_id", cropRow.id).order("sort_order"),
    supabase.from("ale_frost_thresholds").select("*").eq("crop_id", cropRow.id).order("sort_order"),
    supabase.from("ale_bloom_windows").select("*").eq("crop_id", cropRow.id).order("window_id"),
    supabase.from("ale_crop_monthly_stages").select("*").eq("crop_id", cropRow.id),
    supabase.from("ale_global_physics").select("*").eq("is_active", true).maybeSingle(),
  ]);

  if (!gpRow.data) return { error: "No active global physics version" };

  const monthly_stages: Record<string, string[]> = {};
  for (const m of monthly.data ?? []) monthly_stages[String(m.month)] = (m.stages as string[]) ?? [];

  const crop: CropParams = {
    slug: cropRow.slug,
    display_name: cropRow.display_name,
    chill_biofix_month: cropRow.chill_biofix_month,
    chill_biofix_day: cropRow.chill_biofix_day,
    insufficient_chill_penalty: Number(cropRow.insufficient_chill_penalty),
    varieties: (varieties.data ?? []).map((v: any) => ({
      display_name: v.display_name,
      chill_portions_cp: num(v.chill_portions_cp),
      chill_hours_ch: num(v.chill_hours_ch),
      chill_units_cu: num(v.chill_units_cu),
      gdh_to_bloom: num(v.gdh_to_bloom),
    })),
    frost_thresholds: (thresholds.data ?? []).map((t: any) => ({
      stage: t.stage,
      kill_10_pct_c: Number(t.kill_10_pct_c),
      kill_90_pct_c: Number(t.kill_90_pct_c),
      slope_frac: Number(t.slope_frac),
    })),
    bloom_windows: (windows.data ?? []).map((w: any) => ({
      window_id: w.window_id,
      window_name: w.window_name,
      stage: w.stage,
      offset_start_days: w.offset_start_days,
      offset_end_days: w.offset_end_days,
    })),
    monthly_stages,
  };

  const g = gpRow.data;
  const gp: GlobalPhysics = {
    utah_breakpoints: g.utah_breakpoints,
    dynamic_params: g.dynamic_params,
    weinberger_params: g.weinberger_params,
    richardson_gdh_params: g.richardson_gdh_params,
    frost_threshold_c: Number(g.frost_threshold_c),
  };

  return { crop, gp, gpRow: g };
}

const num = (x: unknown): number | null => (x == null ? null : Number(x));

// ── Weather: read-through cache (archive cached per-day; recent always fresh) ──

async function fetchClimate(
  supabase: any, lat: number, lon: number, startDate: string, endDate: string, today: string,
): Promise<HourlyPoint[]> {
  const plan = planClimateFetch(startDate, endDate, today);
  const archive = plan.archive ? await getArchive(supabase, lat, lon, plan.archive.start, plan.archive.end) : [];
  const recent = plan.recent ? parseHourly(await fetchJson(buildForecastUrl(lat, lon, plan.recent.pastDays))) : [];
  return combineHourly(archive, recent, endDate);
}

async function getArchive(supabase: any, lat: number, lon: number, start: string, end: string): Promise<HourlyPoint[]> {
  const latR = Number(lat.toFixed(4));
  const lonR = Number(lon.toFixed(4));

  const { data: cached } = await supabase
    .from("ale_weather_cache")
    .select("date, hourly_jsonb")
    .eq("lat_round", latR).eq("lon_round", lonR).eq("source", "archive")
    .gte("date", start).lte("date", end);

  const expected = enumerateDates(start, end);
  const cachedDates = new Set((cached ?? []).map((r: any) => r.date));
  const allCached = cached && cached.length > 0 && expected.every((d) => cachedDates.has(d));

  if (allCached) {
    return (cached as any[]).flatMap((r) => r.hourly_jsonb as HourlyPoint[]);
  }

  // Cache miss: fetch the whole archive range, parse, and upsert per-day.
  const points = parseHourly(await fetchJson(buildArchiveUrl(lat, lon, start, end)));
  const byDate = new Map<string, HourlyPoint[]>();
  for (const p of points) {
    const arr = byDate.get(p.date);
    if (arr) arr.push(p);
    else byDate.set(p.date, [p]);
  }

  const rows = [...byDate.entries()].map(([date, pts]) => ({
    lat_round: latR, lon_round: lonR, date, source: "archive", hourly_jsonb: pts,
  }));
  if (rows.length) {
    await supabase.from("ale_weather_cache").upsert(rows, { onConflict: "lat_round,lon_round,date,source" });
  }
  return points;
}

async function fetchJson(url: string): Promise<any> {
  const r = await fetch(url);
  if (!r.ok) {
    let reason = "";
    try { const b = await r.json(); if (b?.reason) reason = `: ${b.reason}`; } catch { /* non-JSON error body */ }
    throw new Error(`Open-Meteo ${r.status}${reason}`);
  }
  return r.json();
}

function enumerateDates(start: string, end: string): string[] {
  const out: string[] = [];
  let d = start;
  while (d <= end) { out.push(d); d = addDays(d, 1); }
  return out;
}

// ── Field-by-field diff (numeric tolerance 1e-3) ──────────────────────────────

interface DiffEntry { path: string; ts: unknown; r: unknown; }

function diffResults(ts: unknown, r: unknown): DiffEntry[] {
  const out: DiffEntry[] = [];
  walk(ts, r, "", out);
  return out;
}

function walk(a: unknown, b: unknown, path: string, out: DiffEntry[]): void {
  if (typeof a === "number" && typeof b === "number") {
    if (Math.abs(a - b) > 1e-3) out.push({ path, ts: a, r: b });
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push({ path: `${path}.length`, ts: a.length, r: b.length });
    for (let i = 0; i < Math.min(a.length, b.length); i++) walk(a[i], b[i], `${path}[${i}]`, out);
    return;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) walk((a as any)[k], (b as any)[k], path ? `${path}.${k}` : k, out);
    return;
  }
  if (a !== b) out.push({ path, ts: a, r: b });
}

// ── Run history ──────────────────────────────────────────────────────────────

async function recordRun(
  supabase: any, userId: string, cropSlug: string | null, variety: string | null, inputs: unknown,
  graphId: string | null, graphSnapshot: unknown,
  gpRow: unknown, result: unknown, rResult: unknown, diff: unknown,
  status: string, errorText: string | null, algorithm = "frost-risk",
): Promise<void> {
  const { error } = await supabase.from("ale_runs").insert({
    algorithm,
    graph_id: graphId,
    graph_snapshot_jsonb: graphSnapshot,
    crop_slug: cropSlug,
    variety_name: variety,
    inputs_jsonb: inputs,
    global_physics_snapshot_jsonb: gpRow,
    result_jsonb: result,
    r_result_jsonb: rResult,
    diff_jsonb: diff,
    status,
    error_text: errorText,
    finished_at: new Date().toISOString(),
    created_by: userId,
  });
  if (error) console.warn("ale_runs insert failed:", error.message);
}

// ── Non-frost algorithms: TS port (heat-stress / insufficient-chill) + R parity ──

async function runNonFrost(
  supabase: any, userId: string, algorithm: string, inputs: Record<string, unknown>,
): Promise<Response> {
  const today = new Date().toISOString().slice(0, 10);
  const variety = (inputs.variety ?? inputs.cultivar ?? null) as string | null;
  const cropSlug = (inputs.crop as string) ?? "apple";

  // Fail fast on a not-yet-complete heat-stress season: it needs weather through
  // Sep 30 of `year` (the sunburn window), and the archive only holds past data.
  if (algorithm === "heat-stress") {
    const yr = Number(inputs.year);
    if (!Number.isFinite(yr)) return json({ error: "heat-stress: 'year' is required" }, 400);
    if (`${yr}-09-30` > today) {
      return json({ error: `heat-stress: season ${yr} isn't complete yet — it needs weather through ${yr}-09-30, but only past data is available. Choose a completed season (e.g. ${yr - 1}).` }, 400);
    }
  }

  // Run the TS port if one exists; otherwise the algorithm is R-only.
  let ts_result: unknown = null;
  try {
    if (algorithm === "heat-stress") {
      // Per-cultivar CU/GDH come from the crop catalogue (ale_crop_varieties).
      const varieties = await loadCropVarieties(supabase, cropSlug);
      const v = resolveVariety(varieties, String(inputs.cultivar));
      if (!v || v.chill_units_cu == null || v.gdh_to_bloom == null) {
        throw new Error(`Cultivar '${inputs.cultivar}' not found in ${cropSlug} catalogue, or missing CU/GDH.`);
      }
      ts_result = await runHeatStress(
        { lat: Number(inputs.lat), lon: Number(inputs.lon), cultivar: String(inputs.cultivar), year: Number(inputs.year) },
        { cu: Number(v.chill_units_cu), gdh: Number(v.gdh_to_bloom) },
        { fetchWeather: fetchHeatWeather },
      );
    } else if (algorithm === "insufficient-chill") {
      const varieties = await loadCropVarieties(supabase, cropSlug);
      const cr = resolveChillCR(varieties, (inputs.variety as string) ?? null);
      ts_result = await runInsufficientChill(
        {
          lat: Number(inputs.lat), lon: Number(inputs.lon),
          variety: (inputs.variety as string) ?? null,
          n_years: inputs.n_years == null ? undefined : Number(inputs.n_years),
          climate_type: (inputs.climate_type as string) ?? undefined,
        },
        cr,
        { fetchSeasonTemps, today },
      );
    }
  } catch (e) {
    await recordRun(supabase, userId, null, variety, inputs, null, null, null, null, null, null, "failed", errMsg(e), algorithm);
    return json({ error: `Algorithm '${algorithm}' failed`, details: errMsg(e) }, 400);
  }

  // Best-effort R parity (never blocks the TS result).
  let r_result: unknown = null;
  let diff: DiffEntry[] | null = null;
  let parityNote: string | undefined;
  if (parityEnabled()) {
    try {
      r_result = await callParity(algorithm, inputs);
      if (ts_result) diff = diffResults(ts_result, r_result);
    } catch (e) {
      parityNote = `parity unavailable: ${errMsg(e)}`;
    }
  } else {
    parityNote = "parity disabled (PARITY_HMAC_SECRET unset)";
  }

  if (ts_result == null && r_result == null) {
    return json({ error: `No runtime for '${algorithm}': no TS port and parity disabled/unreachable` }, 503);
  }
  if (ts_result == null) parityNote = "R-only (no TS port for this algorithm)";

  await recordRun(supabase, userId, null, variety, inputs, null, null, null, ts_result, r_result, diff, "succeeded", null, algorithm);
  return json({ ts_result, r_result, diff, algorithm, parity_note: parityNote });
}

// ── Crop catalogue (ale_crop_varieties) — per-variety algorithm params ────────

interface VarietyRow { display_name: string; chill_units_cu: number | null; chill_hours_ch: number | null; chill_portions_cp: number | null; gdh_to_bloom: number | null; }

async function loadCropVarieties(supabase: any, cropSlug: string): Promise<VarietyRow[]> {
  const { data: crop } = await supabase.from("ale_crops").select("id").eq("slug", cropSlug).maybeSingle();
  if (!crop) return [];
  const { data } = await supabase
    .from("ale_crop_varieties")
    .select("display_name, chill_units_cu, chill_hours_ch, chill_portions_cp, gdh_to_bloom")
    .eq("crop_id", crop.id);
  return (data ?? []) as VarietyRow[];
}

// Match a variety name: exact (case-insensitive) → substring (mirrors the R lookup).
function resolveVariety(varieties: VarietyRow[], name: string | null): VarietyRow | null {
  if (!name) return null;
  const lc = name.toLowerCase();
  return varieties.find((v) => v.display_name.toLowerCase() === lc)
    ?? varieties.find((v) => v.display_name.toLowerCase().includes(lc))
    ?? null;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Resolve chill requirements for insufficient-chill. Unknown variety → median
// across the crop's varieties (DB-driven; differs from the R script's median over
// its own hardcoded reference set, so the unknown path is not R-parity-tested).
function resolveChillCR(varieties: VarietyRow[], name: string | null): ChillCR {
  const v = resolveVariety(varieties, name);
  if (v) {
    return { cr_cu: num(v.chill_units_cu), cr_ch: num(v.chill_hours_ch), cr_cp: num(v.chill_portions_cp), found: true, variety_used: v.display_name };
  }
  const col = (pick: (r: VarietyRow) => number | null) => varieties.map(pick).filter((x): x is number => x != null);
  const med = (xs: number[]) => (xs.length ? median(xs) : null);
  return {
    cr_cu: med(col((r) => r.chill_units_cu)),
    cr_ch: med(col((r) => r.chill_hours_ch)),
    cr_cp: med(col((r) => r.chill_portions_cp)),
    found: false, variety_used: "UNKNOWN_MEDIAN_FALLBACK",
  };
}

// Open-Meteo fetch for heat-stress (hourly temp/rad/wind/rh + daily max/mean).
async function fetchHeatWeather(lat: number, lon: number, startDate: string, endDate: string): Promise<HeatWeather> {
  const p = new URLSearchParams({
    latitude: String(lat), longitude: String(lon), start_date: startDate, end_date: endDate,
    hourly: "temperature_2m,shortwave_radiation,windspeed_10m,relativehumidity_2m",
    daily: "temperature_2m_max,temperature_2m_mean", timezone: "auto", wind_speed_unit: "ms",
  });
  const j = await fetchJson(`https://archive-api.open-meteo.com/v1/archive?${p}`);
  const ht: string[] = j.hourly.time;
  const hourly = ht.map((t, i) => ({
    datetime: t, date: t.slice(0, 10), hour: Number(t.slice(11, 13)),
    temp: Number(j.hourly.temperature_2m[i]), rad: Number(j.hourly.shortwave_radiation[i]),
    wind: Number(j.hourly.windspeed_10m[i]), rh: Number(j.hourly.relativehumidity_2m[i]),
  }));
  const dt: string[] = j.daily.time;
  const daily = dt.map((d, i) => ({ date: d, tMax: Number(j.daily.temperature_2m_max[i]), tMean: Number(j.daily.temperature_2m_mean[i]) }));
  return { hourly, daily };
}

// Open-Meteo per-season hourly temperature fetch for insufficient-chill.
async function fetchSeasonTemps(lat: number, lon: number, startDate: string, endDate: string): Promise<number[]> {
  const p = new URLSearchParams({
    latitude: String(lat), longitude: String(lon), start_date: startDate, end_date: endDate,
    hourly: "temperature_2m", timezone: "auto", temperature_unit: "celsius",
  });
  const j = await fetchJson(`https://archive-api.open-meteo.com/v1/archive?${p}`);
  return (j.hourly.temperature_2m as (number | null)[]).map((t) => (t == null ? NaN : Number(t)));
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
