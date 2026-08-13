// src/lib/adapters/unit3d.ts
//
// Functions: isUnlimitedBuffer, Unit3dAdapter

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { parseBytes } from "@/lib/parser"
import { adapterFetch } from "./adapter-fetch"
import type {
  DebugApiCall,
  FetchOptions,
  TrackerAdapter,
  TrackerStats,
  Unit3dAuthStyle,
} from "./types"

/** True when a UNIT3D build reports an unbounded buffer rather than a byte value. */
function isUnlimitedBuffer(raw: string): boolean {
  const trimmed = raw?.trim().toLowerCase() ?? ""
  return trimmed === "∞" || trimmed === "-∞" || trimmed === "inf" || trimmed === "-inf"
}

interface Unit3dApiResponse {
  username: string
  group: string
  uploaded: string
  downloaded: string
  ratio: string
  buffer: string
  seeding: number
  leeching: number
  seedbonus: string
  hit_and_runs: number
}


// ---------------------------------------------------------------------------
// Auth
//
// UNIT3D's newer auth guard reads *only* `Authorization: Bearer` — the legacy
// `?api_token=` query form stops authenticating once a tracker upgrades past
// v9.2.0. Released versions accept bearer today (config/auth.php uses the
// stock Laravel `token` driver, whose TokenGuard falls through to
// bearerToken()), so bearer is the one form that works on both.
//
// It is still transport, not spec: a reverse proxy that strips Authorization,
// or a fork that swapped the guard, would reject it. So we try bearer, and on
// a 401 fall back once to the legacy query param. Whichever succeeds is
// remembered per tracker so we don't pay for two requests on every poll.
// `unit3dAuthStyle` pins a style explicitly and skips the probing entirely.
// ---------------------------------------------------------------------------

const gU3d = globalThis as typeof globalThis & {
  __unit3dAuthStyleCache?: Map<string, Unit3dAuthStyle>
}
if (!gU3d.__unit3dAuthStyleCache) gU3d.__unit3dAuthStyleCache = new Map()
const authStyleCache = gU3d.__unit3dAuthStyleCache

function buildRequest(
  apiPath: string,
  baseUrl: string,
  apiToken: string,
  style: Unit3dAuthStyle
): { url: string; headers: Record<string, string> } {
  const url = new URL(apiPath, baseUrl)
  if (style === "query") {
    url.searchParams.set("api_token", apiToken)
    return { url: url.toString(), headers: {} }
  }
  return { url: url.toString(), headers: { Authorization: `Bearer ${apiToken}` } }
}

function isAuthRejection(err: unknown): boolean {
  // Deliberately not `err instanceof Error` — that check is unreliable across
  // module realms (it returns false under vitest), which would make this
  // fallback silently never fire.
  const message =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err)
  return /\b40[13]\b/.test(message)
}

/**
 * Fetch with the tracker's known-good auth style, probing bearer→query once if
 * we don't have one yet.
 */
async function unit3dFetch<T>(
  baseUrl: string,
  apiPath: string,
  apiToken: string,
  hostname: string,
  options?: FetchOptions
): Promise<T> {
  const pinned = options?.unit3dAuthStyle
  const remembered = authStyleCache.get(baseUrl)
  const first: Unit3dAuthStyle = pinned ?? remembered ?? "bearer"

  const attempt = async (style: Unit3dAuthStyle): Promise<T> => {
    const { url, headers } = buildRequest(apiPath, baseUrl, apiToken, style)
    return adapterFetch<T>(url, hostname, options, headers)
  }

  try {
    const result = await attempt(first)
    if (!pinned) authStyleCache.set(baseUrl, first)
    return result
  } catch (err) {
    // Only probe the other style when the style wasn't pinned, we haven't
    // already settled on one, and the failure actually looks like auth.
    const shouldFallBack = !pinned && !remembered && first === "bearer" && isAuthRejection(err)
    if (!shouldFallBack) throw err

    const result = await attempt("query")
    authStyleCache.set(baseUrl, "query")
    return result
  }
}

export class Unit3dAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const hostname = new URL(baseUrl).hostname

    const data = await unit3dFetch<Unit3dApiResponse>(baseUrl, apiPath, apiToken, hostname, options)

    const uploadedBytes = parseBytes(data.uploaded)
    const downloadedBytes = parseBytes(data.downloaded)

    return {
      username: data.username,
      group: data.group,
      uploadedBytes,
      downloadedBytes,
      // Derived from byte totals, not data.ratio — UNIT3D sends "∞" for a
      // zero-download account and parseFloat turns that into 0.
      ratio: computeRatio(uploadedBytes, downloadedBytes),
      // Some UNIT3D builds (i.e. Zenith) report an unlimited buffer as "∞",
      // which parseBytes rejects. Derive it from the totals instead — the
      // same fallback avistaz.ts uses. Only the buffer field does this;
      // parseBytes stays strict for every other caller.
      bufferBytes: isUnlimitedBuffer(data.buffer)
        ? computeBufferBytes(uploadedBytes, downloadedBytes)
        : parseBytes(data.buffer),
      seedingCount: data.seeding,
      leechingCount: data.leeching,
      seedbonus: parseFloat(data.seedbonus) || 0,
      hitAndRuns: data.hit_and_runs,
      requiredRatio: null,
      warned: null,
      freeleechTokens: null,
    }
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const hostname = new URL(baseUrl).hostname

    try {
      const data = await unit3dFetch<Record<string, unknown>>(
        baseUrl,
        apiPath,
        apiToken,
        hostname,
        options
      )
      return [{ label: "User Stats", endpoint: apiPath, data, error: null }]
    } catch (err) {
      return [
        {
          label: "User Stats",
          endpoint: apiPath,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
