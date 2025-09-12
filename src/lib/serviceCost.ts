export type TariffCode = 'T1' | 'T2'

export type Selection = {
  crop: string
  area: string
  reservoirs: string
  outermostDistance: string
  plantAges: string
  varieties: string
  roadDistance: string
}

export type PartsBreakdown = {
  crop_base: number
  area: number
  reservoirs: number
  outermost_distance: number
  plant_age_groups: number
  varieties: number
  road_distance: number
}

export type CalculationResult = {
  tariff: TariffCode
  parts: PartsBreakdown
  total: number
}

// Crop groups by tariff
export const T1_CROPS = new Set([
  'Blueberry', 'Blackberry', 'Raspberry',
  'Apple (super-intensive, with support system)',
  'Pear (super-intensive, with support system)',
  'Peach (super-intensive, with support system)',
  'Cherry (super-intensive, with support system)',
  'Plum (super-intensive, with support system)',
  'Nectarine (super-intensive, with support system)',
  'Almond (super-intensive)',
  'Grapes',
])

export const T2_CROPS = new Set([
  'Almond (semi-intensive and intensive)', 'Hazelnut', 'Walnut',
  'Apple (semi-intensive and intensive)', 'Pear (semi-intensive and intensive)',
  'Peach (semi-intensive and intensive)', 'Cherry (semi-intensive and intensive)',
  'Plum (semi-intensive and intensive)', 'Nectarine (semi-intensive and intensive)',
  'Pomegranate', 'Apricot',
])

export const ALLOWED_CROPS = [
  'Walnut', 'Hazelnut', 'Almond', 'Blueberry', 'Apple', 'Cherry', 'Pear', 'Peach', 'Nectarine', 'Plum', 'Grapes', 'Pomegranate', 'Apricot', 'Raspberry', 'Blackberry'
]

export function resolveTariff(crop: string): TariffCode {
  if (T1_CROPS.has(crop)) return 'T1'
  if (T2_CROPS.has(crop)) return 'T2'
  // Fallback: map base crop names to default tariffs when presented without qualifiers
  const base = crop.trim().toLowerCase()
  switch (base) {
    case 'blueberry':
    case 'blackberry':
    case 'raspberry':
    case 'grapes':
      return 'T1'
    case 'walnut':
    case 'hazelnut':
    case 'pomegranate':
    case 'apricot':
      return 'T2'
    case 'apple':
    case 'pear':
    case 'peach':
    case 'cherry':
    case 'plum':
    case 'nectarine':
    case 'almond':
      // ambiguous crops default to T2 unless specified otherwise
      return 'T2'
    default:
      return 'T2'
  }
}

// Fee tables
const FEES = {
  T1: {
    crop_base: 500,
    area_fee: {
      '0–5 ha': 200, '6–10 ha': 400, '11–15 ha': 600, '16–20 ha': 800, '21–30 ha': 1000,
      '31–40 ha': 1200, '41–50 ha': 1400, '51–70 ha': 1600, '71–100 ha': 1800, '101–150 ha': 2000,
      '151–200 ha': 2200, '201–300 ha': 2400, '301–500 ha': 2600, 'Over 500 hectares': 2800,
    } as Record<string, number>,
    reservoirs_fee: {
      '0–1': 500, '2': 1000, '3': 1500, '4': 2000, '5': 2500, '6 or more': 5000,
    } as Record<string, number>,
    outermost_distance_fee: {
      'Less than 100 m.': 100, '100–300 m.': 250, '300 m – 1 km': 500, '1–3 km': 1000, 'More than 3 km': 3000,
    } as Record<string, number>,
    plant_age_groups_fee: labelRange(1, 9, 200, 200, 'More than 10', 2000),
    variety_count_fee: labelRange(1, 9, 200, 200, 'More than 10', 2000),
    road_distance_fee: {
      'Up to 1 km': 50, '1–3 km': 100, '3–10 km': 200, 'More than 10 km': 300,
    } as Record<string, number>,
  },
  T2: {
    crop_base: 500,
    area_fee: {
      '0–5 ha': 100, '6–10 ha': 200, '11–15 ha': 300, '16–20 ha': 400, '21–30 ha': 500, '31–40 ha': 600,
      '41–50 ha': 700, '51–70 ha': 800, '71–100 ha': 900, '101–150 ha': 1000, '151–200 ha': 1100,
      '201–300 ha': 1200, '301–500 ha': 1300, '> 500 ha': 1400,
    } as Record<string, number>,
    reservoirs_fee: {
      '0–1': 500, '2': 1000, '3': 1500, '4': 2000, '5': 2500,
      // if '6 or more' selected under T2, it should be treated as 0
    } as Record<string, number>,
    outermost_distance_fee: {
      'Less than 100 m': 100, '100–300 m': 250, '300 m – 1 km': 500, '1 km – 3 km': 1000, 'More than 3 km': 3000,
    } as Record<string, number>,
    plant_age_groups_fee: labelRange(1, 9, 100, 100, 'More than 10', 1000),
    variety_count_fee: labelRange(1, 9, 100, 100, 'More than 10', 1000),
    road_distance_fee: {
      'Up to 1 km': 50, '1–3 km': 100, '3–10 km': 200, 'More than 10 km': 300,
    } as Record<string, number>,
  },
} as const

function labelRange(start: number, end: number, base: number, step: number, moreLabel: string, moreValue: number) {
  const map: Record<string, number> = {}
  for (let i = start; i <= end; i += 1) {
    map[String(i)] = base + (i - start) * step
  }
  map[moreLabel] = moreValue
  return map
}

function priceOf(tariff: TariffCode, tableName: keyof typeof FEES.T1 | keyof typeof FEES.T2, label: string | undefined | null): number {
  if (!label) return 0
  const tables = FEES[tariff] as any
  const table = tables[tableName]
  const value = table?.[label]
  return typeof value === 'number' ? value : 0
}

export function calculate(selection: Selection): CalculationResult {
  const tariff = resolveTariff(selection.crop)
  const parts: PartsBreakdown = {
    crop_base: (FEES as any)[tariff].crop_base,
    area: priceOf(tariff, 'area_fee', selection.area),
    reservoirs: priceOf(tariff, 'reservoirs_fee', selection.reservoirs),
    outermost_distance: priceOf(tariff, 'outermost_distance_fee', selection.outermostDistance),
    plant_age_groups: priceOf(tariff, 'plant_age_groups_fee', selection.plantAges),
    varieties: priceOf(tariff, 'variety_count_fee', selection.varieties),
    road_distance: priceOf(tariff, 'road_distance_fee', selection.roadDistance),
  }
  const total = Object.values(parts).reduce((a, b) => a + b, 0)
  return { tariff, parts, total }
}

