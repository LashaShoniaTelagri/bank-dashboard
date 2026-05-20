// HMAC-signed client for the ALE R parity service.
//
// Hosted at https://algo.telagri.com/evaluate/<algorithm-id> (see
// gis-scripts/parity-service/). Generic dispatcher — pass the algorithm id and
// the algorithm-specific inputs.

const PARITY_BASE_URL = Deno.env.get("PARITY_URL") ?? "https://algo.telagri.com";
const HMAC_SECRET = Deno.env.get("PARITY_HMAC_SECRET") ?? "";
const DEFAULT_TIMEOUT_MS = 60_000;  // R compute + Open-Meteo can take >10s

/**
 * Whether the parity service is configured. When false, callers should skip
 * the R fan-out (e.g. after EC2 decommission post sign-off).
 */
export function parityEnabled(): boolean {
  return HMAC_SECRET.length > 0;
}

/**
 * Run an algorithm on the parity service.
 *
 * @param algorithm  algorithm id (matches a folder in gis-scripts/algorithms/)
 * @param inputs     algorithm-specific input object (see manifest.json per algo)
 * @returns          algorithm-specific result (locked schema for this algorithm)
 */
export async function callParity(
  algorithm: string,
  inputs: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<unknown> {
  if (!parityEnabled()) {
    throw new Error("PARITY_HMAC_SECRET not set; parity service disabled.");
  }
  if (!algorithm.match(/^[a-z0-9][a-z0-9-]*$/)) {
    throw new Error(`Invalid algorithm id: ${algorithm}`);
  }

  const body = JSON.stringify(inputs);
  const signature = await hmacSha256Hex(HMAC_SECRET, body);

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${PARITY_BASE_URL}/evaluate/${algorithm}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": signature,
      },
      body,
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`parity service ${res.status}: ${text}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Convenience: list registered algorithms on the parity service.
 * Useful for diagnostics / building UI.
 */
export async function listParityAlgorithms(): Promise<unknown> {
  const res = await fetch(`${PARITY_BASE_URL}/algorithms`);
  if (!res.ok) throw new Error(`parity service ${res.status}`);
  return await res.json();
}

// -----------------------------------------------------------------------------
// HMAC-SHA256 hex via WebCrypto. Must match digest::hmac(..., algo='sha256') in
// gis-scripts/parity-service/api.R.
// -----------------------------------------------------------------------------

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
