// src/lib/adapters/unit3d.ts
//
// Functions: isUnlimitedBuffer, toBytes, toNumber, toSignedBytes, Unit3dAdapter

import {
  computeBufferBytes,
  computeRatio,
  floatBytesToBigInt,
  signedFloatBytesToBigInt,
} from "@/lib/data-transforms"
import { parseBytes, parseSignedBytes } from "@/lib/parser"
import { adapterFetch } from "./adapter-fetch"
import type {
  DebugApiCall,
  FetchOptions,
  TrackerAdapter,
  TrackerStats,
  Unit3dAuthStyle,
} from "./types"

/** True when a UNIT3D build reports an unbounded buffer rather than a byte value. */
function isUnlimitedBuffer(raw: string | number): boolean {
  // Only the humanized string form can say "unbounded", JSON has no literal
  // for Infinity, so a numeric buffer is always a real byte count.
  if (typeof raw !== "string") return false
  const trimmed = raw?.trim().toLowerCase() ?? ""
  return trimmed === "∞" || trimmed === "-∞" || trimmed === "inf" || trimmed === "-inf"
}

// ---------------------------------------------------------------------------
// Older UNIT3D builds humanize them ("500.25 GiB"); newer ones (Blutopia,
// Upload.cx) send raw byte integers.
// ---------------------------------------------------------------------------

/** Unsigned byte field (uploaded, downloaded), clamped at zero. */
function toBytes(value: string | number): bigint {
  return typeof value === "number" ? floatBytesToBigInt(value) : parseBytes(value)
}

/** Decimal field (seedbonus), a bare number on newer builds, "964533.23" on older ones. */
function toNumber(value: string | number): number {
  return (typeof value === "number" ? value : parseFloat(value)) || 0
}

/** Signed byte field (buffer only), a deficit account must keep its sign. */
function toSignedBytes(value: string | number): bigint {
  return typeof value === "number" ? signedFloatBytesToBigInt(value) : parseSignedBytes(value)
}

interface Unit3dApiResponse {
  username: string
  group: string
  uploaded: string | number
  downloaded: string | number
  ratio: string | number
  buffer: string | number
  seeding: number
  leeching: number
  seedbonus: string | number
  hit_and_runs: number
}

// ---------------------------------------------------------------------------
// Auth
//
// UNIT3D's newer auth guard reads *only* `Authorization: Bearer`, the legacy
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
  // Deliberately not `err instanceof Error`, that check is unreliable across
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

    const uploadedBytes = toBytes(data.uploaded)
    const downloadedBytes = toBytes(data.downloaded)

    return {
      username: data.username,
      group: data.group,
      uploadedBytes,
      downloadedBytes,
      // Derived from byte totals, not data.ratio. UNIT3D sends "∞" for a
      // zero-download account and parseFloat turns that into 0.
      ratio: computeRatio(uploadedBytes, downloadedBytes),
      // Some UNIT3D builds (i.e. Zenith) report an unlimited buffer as "∞",
      // which parseBytes rejects. Derive it from the totals instead: the same
      // fallback avistaz.ts uses.
      //
      // Otherwise parse it SIGNED: buffer is the one field here that can
      // legitimately arrive negative ("-1.23 TiB"), and plain parseBytes throws
      // on a leading minus, which fails the whole poll (uploaded, downloaded
      // and every other stat with it) instead of recording one negative value.
      // parseBytes stays strict for every other caller.
      bufferBytes: isUnlimitedBuffer(data.buffer)
        ? computeBufferBytes(uploadedBytes, downloadedBytes)
        : toSignedBytes(data.buffer),
      seedingCount: data.seeding,
      leechingCount: data.leeching,
      seedbonus: toNumber(data.seedbonus),
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
