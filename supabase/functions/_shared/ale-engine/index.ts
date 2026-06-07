// ALE engine — pure TypeScript frost-risk algorithm (port of the R reference in
// gis-scripts/scripts/frost-risk/). Consumed by the ale-evaluate Edge Function
// and importable in the browser for preview. No Deno / React deps.

export * from "./types.ts";
export * from "./compute.ts";
export * from "./weather.ts";
export { runFrostAnalysis } from "./frostRisk.ts";
export { runHeatStress } from "./heatStress.ts";
export type { HeatStressInputs, HeatWeather, HeatStressResult } from "./heatStress.ts";
export { runInsufficientChill } from "./insufficientChill.ts";
export type { InsufficientChillInputs, InsufficientChillResult } from "./insufficientChill.ts";
export * from "./graph.ts";
