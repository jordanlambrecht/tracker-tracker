// src/lib/tracker-platforms/adapters/unit3d.ts
//
// Functions: isUnlimitedBuffer, toBytes, toNumber, toSignedBytes, isPlainObject,
//            missingByteFields, quoteList, describeKeys, readApiKeyExpiry,
//            unwrapUnit3dResponse, readUnit3dUser, readAuthStyle, rememberAuthStyle,
//            buildRequest, unit3dFetch, Unit3dAdapter

import {
  computeBufferBytes,
  computeRatio,
  floatBytesToBigInt,
  signedFloatBytesToBigInt,
} from "@/lib/data-transforms"
import { parseBytes, parseSignedBytes } from "@/lib/parser"
import { validateHeaderToken } from "@/lib/tracker-credentials/header-token"
import type {
  DebugApiCall,
  FetchOptions,
  TrackerAdapter,
  TrackerStats,
  Unit3dAuthStyle,
  Unit3dPlatformMeta,
} from "../contract"
import { adapterRequest } from "../helpers/adapter-fetch"
import { presentClass } from "../helpers/class-name"
import { pollError } from "../helpers/poll-error"

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

/**
 * Decimal field (seedbonus), a bare number on newer builds, "964533.23" on
 * older ones. Absent or unparseable reads as null, never 0: the shape guard
 * below requires only the byte fields, so a fork that omits this one still
 * reaches here, and "∞" is a spelling this API is already known to use.
 */
function toNumber(value: string | number | undefined): number | null {
  if (value == null) return null
  const parsed = typeof value === "number" ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
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
  // Optional because unwrapUnit3dResponse requires only the byte fields.
  seeding?: number
  leeching?: number
  seedbonus?: string | number
  hit_and_runs?: number
}

// ---------------------------------------------------------------------------
// Auth
//
// UNIT3D past v9.2.0 reads only `Authorization: Bearer` and released versions
// accept it, so bearer goes first. A 401 falls back once to `?api_token=` and
// the working style is remembered per tracker; `unit3dAuthStyle` pins one and
// skips the probe.
// ---------------------------------------------------------------------------

// The remembered style expires, so one wrong probe cannot keep the token in
// the query string for good and a move to bearer is noticed.
const AUTH_STYLE_TTL_MS = 24 * 60 * 60 * 1000

const gU3d = globalThis as typeof globalThis & {
  __unit3dAuthStyle?: Map<string, { style: Unit3dAuthStyle; at: number }>
}
if (!gU3d.__unit3dAuthStyle) gU3d.__unit3dAuthStyle = new Map()
const authStyleCache = gU3d.__unit3dAuthStyle

function rememberAuthStyle(baseUrl: string, style: Unit3dAuthStyle): void {
  const entry = authStyleCache.get(baseUrl)
  // The clock runs from when the style was learned, not from the last success.
  // Refreshing it on every poll would pin a query entry forever on a tracker
  // that accepts both styles, which is exactly the case worth re-testing.
  if (entry?.style === style) return
  authStyleCache.set(baseUrl, { style, at: Date.now() })
}

function readAuthStyle(baseUrl: string): Unit3dAuthStyle | undefined {
  const entry = authStyleCache.get(baseUrl)
  if (!entry) return undefined
  if (Date.now() - entry.at >= AUTH_STYLE_TTL_MS) {
    authStyleCache.delete(baseUrl)
    return undefined
  }
  return entry.style
}

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

/**
 * Fetch with the tracker's known-good auth style, probing bearer then query
 * once when none is known. Only a 401 status probes; a 403 is a block page or
 * a WAF, not the wrong auth style.
 */
async function unit3dFetch<T>(
  baseUrl: string,
  apiPath: string,
  apiToken: string,
  hostname: string,
  options?: FetchOptions
): Promise<T> {
  const pinned = options?.unit3dAuthStyle
  const remembered = readAuthStyle(baseUrl)
  const first: Unit3dAuthStyle = pinned ?? remembered ?? "bearer"

  const attempt = (style: Unit3dAuthStyle) => {
    const { url, headers } = buildRequest(apiPath, baseUrl, apiToken, style)
    return adapterRequest(url, hostname, options, headers)
  }

  // A connection failure throws out of here, so it can never reach the probe.
  let response = await attempt(first)

  if (response.status === 401 && !pinned && !remembered && first === "bearer") {
    response = await attempt("query")
    if (response.ok) rememberAuthStyle(baseUrl, "query")
  } else if (response.ok && !pinned) {
    rememberAuthStyle(baseUrl, first)
  }

  // Same wording adapterFetch throws, which sanitizeNetworkError matches on.
  if (!response.ok) {
    throw new Error(`Tracker API error: ${response.status} ${response.statusText}`)
  }
  return response.json<T>()
}

// ---------------------------------------------------------------------------
// Shape check. A fork can change what /api/user returns without changing the
// status (issue #214, LST), so only the byte fields whose absence crashes are
// required and a {"data": ...} envelope is accepted. Errors open with
// "Unexpected response from", which sanitizeNetworkError keys on, and name
// keys, never values, since a value could be a username.
// ---------------------------------------------------------------------------

const REQUIRED_BYTE_FIELDS = ["uploaded", "downloaded", "buffer"] as const
const MAX_REPORTED_KEYS = 12

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function missingByteFields(record: Record<string, unknown>): string[] {
  return REQUIRED_BYTE_FIELDS.filter((field) => record[field] == null)
}

function quoteList(fields: string[]): string {
  return fields.map((f) => `"${f}"`).join(", ")
}

function describeKeys(record: Record<string, unknown>): string {
  const keys = Object.keys(record)
  if (keys.length === 0) return "(none)"
  const shown = keys.slice(0, MAX_REPORTED_KEYS).join(", ")
  return keys.length > MAX_REPORTED_KEYS ? `${shown}, …` : shown
}

/** LST's `api_key.expires_at`, when the body carries one that parses as a date. */
function readApiKeyExpiry(record: Record<string, unknown>): string | undefined {
  const key = record.api_key
  if (!isPlainObject(key)) return undefined
  const raw = key.expires_at
  if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) return undefined
  return raw
}

interface UnwrappedUnit3dResponse {
  user: Unit3dApiResponse
  apiKeyExpiresAt?: string
}

/** The user body out of a 2xx payload, or an error that says what arrived instead. */
function unwrapUnit3dResponse(data: unknown, hostname: string): UnwrappedUnit3dResponse {
  if (!isPlainObject(data)) {
    const kind = data === null ? "null" : Array.isArray(data) ? "array" : typeof data
    throw new Error(`Unexpected response from ${hostname}: expected a JSON object, got ${kind}`)
  }

  const apiKeyExpiresAt = readApiKeyExpiry(data)
  const missing = missingByteFields(data)
  if (missing.length === 0) return { user: data as unknown as Unit3dApiResponse, apiKeyExpiresAt }

  const inner = data.data
  if (isPlainObject(inner)) {
    const innerMissing = missingByteFields(inner)
    if (innerMissing.length === 0) {
      return { user: inner as unknown as Unit3dApiResponse, apiKeyExpiresAt }
    }
    throw new Error(
      `Unexpected response from ${hostname}: missing ${quoteList(innerMissing)}; top-level keys: ${describeKeys(data)}; data keys: ${describeKeys(inner)}`
    )
  }

  throw new Error(
    `Unexpected response from ${hostname}: missing ${quoteList(missing)}; top-level keys: ${describeKeys(data)}`
  )
}

interface Unit3dUser extends UnwrappedUnit3dResponse {
  uploadedBytes: bigint
  downloadedBytes: bigint
  bufferBytes: bigint
}

/** The user body and its three byte figures, or the error fetchStats fails the poll with. */
function readUnit3dUser(data: unknown, hostname: string): Unit3dUser {
  const { user, apiKeyExpiresAt } = unwrapUnit3dResponse(data, hostname)
  const uploadedBytes = toBytes(user.uploaded)
  const downloadedBytes = toBytes(user.downloaded)

  return {
    user,
    apiKeyExpiresAt,
    uploadedBytes,
    downloadedBytes,
    // Some UNIT3D builds (i.e. Zenith) report an unlimited buffer as "∞",
    // which parseBytes rejects. Derive it from the totals instead: the same
    // fallback avistaz.ts uses.
    //
    // Otherwise parse it signed: buffer is the one field here that can
    // legitimately arrive negative ("-1.23 TiB"), and plain parseBytes throws
    // on a leading minus, which fails the whole poll (uploaded, downloaded
    // and every other stat with it) instead of recording one negative value.
    // parseBytes stays strict for every other caller.
    bufferBytes: isUnlimitedBuffer(user.buffer)
      ? computeBufferBytes(uploadedBytes, downloadedBytes)
      : toSignedBytes(user.buffer),
  }
}

export class Unit3dAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const trimmedToken = validateHeaderToken(apiToken)
    const hostname = new URL(baseUrl).hostname

    const {
      user: data,
      apiKeyExpiresAt,
      uploadedBytes,
      downloadedBytes,
      bufferBytes,
    } = readUnit3dUser(
      await unit3dFetch<unknown>(baseUrl, apiPath, trimmedToken, hostname, options),
      hostname
    )

    return {
      username: data.username,
      group: presentClass(data.group),
      uploadedBytes,
      downloadedBytes,
      // Derived from byte totals, not data.ratio. UNIT3D sends "∞" for a
      // zero-download account and parseFloat turns that into 0.
      ratio: computeRatio(uploadedBytes, downloadedBytes),
      bufferBytes,
      seedingCount: data.seeding ?? null,
      leechingCount: data.leeching ?? null,
      seedbonus: toNumber(data.seedbonus),
      hitAndRuns: data.hit_and_runs ?? null,
      requiredRatio: null,
      warned: null,
      freeleechTokens: null,
      // Always an object, even without an expiry, so a poll that stops reporting
      // one overwrites the stale date instead of leaving the card counting down
      // to it. JSON.stringify drops the undefined member.
      platformMeta: { apiKeyExpiresAt } satisfies Unit3dPlatformMeta,
    }
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const trimmedToken = validateHeaderToken(apiToken)
    const hostname = new URL(baseUrl).hostname

    try {
      const data = await unit3dFetch<Record<string, unknown>>(
        baseUrl,
        apiPath,
        trimmedToken,
        hostname,
        options
      )
      return [
        {
          label: "User Stats",
          endpoint: apiPath,
          data,
          error: pollError(() => readUnit3dUser(data, hostname)),
        },
      ]
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
