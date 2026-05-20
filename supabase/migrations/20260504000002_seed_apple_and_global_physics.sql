-- ALE V1 baseline data: Apple crop + global physics.
-- Mirrors gis-scripts/scripts/frost-risk/data/crop_data.R verbatim (per ADR 0014).
-- This is committed as a migration (not seed.sql) because Apple is the canonical
-- baseline that must exist on dev/prod, not just local.
--
-- Idempotent: ON CONFLICT DO NOTHING on every insert so re-running is safe.

BEGIN;

-- =============================================================================
-- 1. Apple crop core
-- =============================================================================

INSERT INTO public.ale_crops (
  id, slug, display_name, description, hemisphere, is_active,
  chill_biofix_month, chill_biofix_day,
  insufficient_chill_penalty,
  insufficient_chill_cutoff_month, insufficient_chill_cutoff_day
) VALUES (
  '00000000-0000-0000-0000-00000000a001',
  'apple',
  'Apple',
  'Initial V1 seed; agronomic parameters mirror crop_data.R from frost-risk module.',
  'north',
  true,
  9, 1,                  -- chill biofix: September 1
  0.26,                  -- 26% penalty when chill not met (Zainab analysis)
  3, 15                  -- chill cutoff: March 15
) ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 2. Apple varieties (11 rows from crop_data.R)
-- =============================================================================

INSERT INTO public.ale_crop_varieties (
  crop_id, display_name,
  chill_portions_cp, chill_hours_ch, chill_units_cu, gdh_to_bloom,
  dafb_harvest_min, dafb_harvest_max, source, sort_order
)
SELECT
  '00000000-0000-0000-0000-00000000a001',
  v.name, v.cp, v.ch, v.cu, v.gdh, v.hmin, v.hmax, v.src, v.sort
FROM (VALUES
  ('Lory',             31.9::numeric,  340::numeric,    506.5::numeric, 9782::numeric,  NULL::int, NULL::int, 'Gonzalez-Martinez et al. 2025', 1),
  ('Pink Lady',        40.7,           504,             643.0,          9241,           NULL,      NULL,      'Gonzalez-Martinez et al. 2025', 2),
  ('Luiza',            40.7,           504,             643.0,          9241,           NULL,      NULL,      'Gonzalez-Martinez et al. 2025', 3),
  ('Galy',             40.7,           504,             643.0,          9584,           NULL,      NULL,      'Gonzalez-Martinez et al. 2025', 4),
  ('Story',            51.5,           716,             887.5,          8866,           NULL,      NULL,      'Gonzalez-Martinez et al. 2025', 5),
  ('HOT84A1',          60.7,           960,            1153.0,         10009,           NULL,      NULL,      'Gonzalez-Martinez et al. 2025', 6),
  ('Fuji',             62.5,           938,            1114.5,          8733,           160,       180,       'Gonzalez-Martinez et al. 2025', 7),
  ('Gala',             71.3,          1137,            1348.5,          8333,           120,       135,       'Gonzalez-Martinez et al. 2025', 8),
  ('Isadora',          71.3,          1137,            1348.5,          7392,           NULL,      NULL,      'Gonzalez-Martinez et al. 2025', 9),
  ('Venice',           71.3,          1137,            1348.5,          7392,           NULL,      NULL,      'Gonzalez-Martinez et al. 2025', 10),
  ('Golden Delicious', 50.0,          NULL,            NULL,            NULL,           NULL,      NULL,      'Noorazar et al. 2020',          11)
) AS v(name, cp, ch, cu, gdh, hmin, hmax, src, sort)
ON CONFLICT (crop_id, display_name) DO NOTHING;

-- =============================================================================
-- 3. Apple frost thresholds (9 stages, Penn State Extension)
-- =============================================================================

INSERT INTO public.ale_frost_thresholds (
  crop_id, stage, kill_10_pct_c, kill_90_pct_c, slope_frac, sort_order
)
SELECT
  '00000000-0000-0000-0000-00000000a001',
  t.stage, t.k10, t.k90, t.slope, t.sort
FROM (VALUES
  ('Silver tip',       -9.4::numeric,  -16.7::numeric, 0.1096::numeric, 1),
  ('Green tip',        -7.8,           -12.2,          0.1818,          2),
  ('Half-inch green',  -5.0,            -9.4,          0.1818,          3),
  ('Tight cluster',    -2.8,            -6.1,          0.2424,          4),
  ('First pink',       -2.2,            -4.4,          0.3636,          5),
  ('Full pink',        -2.2,            -3.9,          0.4706,          6),
  ('First bloom',      -2.2,            -3.9,          0.4706,          7),
  ('Full bloom',       -2.2,            -3.9,          0.4706,          8),
  ('Post bloom',       -2.2,            -3.9,          0.4706,          9)
) AS t(stage, k10, k90, slope, sort)
ON CONFLICT (crop_id, stage) DO NOTHING;

-- =============================================================================
-- 4. Apple bloom windows (5 windows relative to full bloom)
-- =============================================================================

INSERT INTO public.ale_bloom_windows (
  crop_id, window_id, window_name, stage, offset_start_days, offset_end_days
)
SELECT
  '00000000-0000-0000-0000-00000000a001',
  w.id, w.name, w.stage, w.s, w.e
FROM (VALUES
  (1, 'Bloom -3wk to -2wk',  'Green tip',     -21, -14),
  (2, 'Bloom -2wk to -1wk',  'Tight cluster', -14,  -7),
  (3, 'Bloom -1wk to Bloom', 'First pink',     -7,   0),
  (4, 'Bloom to +4wk',       'Full bloom',      0,  28),
  (5, 'Bloom +4wk to +8wk',  'Post bloom',     28,  56)
) AS w(id, name, stage, s, e)
ON CONFLICT (crop_id, window_id) DO NOTHING;

-- =============================================================================
-- 5. Apple monthly stages (12 rows; matches crop_data.R monthly_stages)
-- =============================================================================

INSERT INTO public.ale_crop_monthly_stages (crop_id, month, stages)
VALUES
  ('00000000-0000-0000-0000-00000000a001',  1, '["Dormancy"]'::jsonb),
  ('00000000-0000-0000-0000-00000000a001',  2, '["Dormancy"]'::jsonb),
  ('00000000-0000-0000-0000-00000000a001',  3, '["Dormancy","Full Bloom"]'::jsonb),
  ('00000000-0000-0000-0000-00000000a001',  4, '["Dormancy","Full Bloom","Fruit Development - Bud Development"]'::jsonb),
  ('00000000-0000-0000-0000-00000000a001',  5, '["Dormancy","Bud Break","Full Bloom","Fruit Development - Bud Development","Fruit Development +3 Weeks"]'::jsonb),
  ('00000000-0000-0000-0000-00000000a001',  6, '["Bud Break","Full Bloom","Fruit Development - Bud Development","Fruit Development +3 Weeks"]'::jsonb),
  ('00000000-0000-0000-0000-00000000a001',  7, '["Bud Break","Full Bloom","Fruit Development - Bud Development","Fruit Development +3 Weeks"]'::jsonb),
  ('00000000-0000-0000-0000-00000000a001',  8, '["Fruit Development - Bud Development","Fruit Development +3 Weeks","Maturity/Harvest - Post Harvest"]'::jsonb),
  ('00000000-0000-0000-0000-00000000a001',  9, '["Fruit Development +3 Weeks","Maturity/Harvest - Post Harvest"]'::jsonb),
  ('00000000-0000-0000-0000-00000000a001', 10, '["Dormancy"]'::jsonb),
  ('00000000-0000-0000-0000-00000000a001', 11, '["Dormancy"]'::jsonb),
  ('00000000-0000-0000-0000-00000000a001', 12, '["Dormancy"]'::jsonb)
ON CONFLICT (crop_id, month) DO NOTHING;

-- =============================================================================
-- 6. Global physics v1 (Utah / Dynamic / Weinberger / Richardson + frost cutoff)
-- =============================================================================
-- Sources: Richardson et al. 1974 (Utah), Fishman et al. 1987 (Dynamic),
-- Weinberger 1950, Anderson et al. (Richardson GDH).

INSERT INTO public.ale_global_physics (
  id, version, is_active,
  utah_breakpoints, dynamic_params, weinberger_params, richardson_gdh_params,
  frost_threshold_c,
  notes,
  activated_at
) VALUES (
  '00000000-0000-0000-0000-000000000901',
  1,
  true,
  '[
    {"t_lower": null,  "t_upper": 1.4,  "cu":  0.0},
    {"t_lower": 1.4,   "t_upper": 2.4,  "cu":  0.5},
    {"t_lower": 2.4,   "t_upper": 9.1,  "cu":  1.0},
    {"t_lower": 9.1,   "t_upper": 12.4, "cu":  0.5},
    {"t_lower": 12.4,  "t_upper": 15.9, "cu":  0.0},
    {"t_lower": 15.9,  "t_upper": 18.0, "cu": -0.5},
    {"t_lower": 18.0,  "t_upper": null, "cu": -1.0}
  ]'::jsonb,
  '{"e0": 4153.5, "e1": 12888.8, "a0": 139500, "a1": 2.567e18, "slp": 1.28, "tetmlt": 277}'::jsonb,
  '{"t_min": 0, "t_max": 7.2}'::jsonb,
  '{"t_base": 4.5, "t_opt": 25.0, "t_crit": 36.0}'::jsonb,
  0,
  'V1 baseline — values mirror crop_data.R exactly. Do not edit; create a new version instead.',
  NOW()
) ON CONFLICT (version) DO NOTHING;

COMMIT;
