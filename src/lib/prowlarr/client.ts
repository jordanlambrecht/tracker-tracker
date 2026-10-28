// src/lib/prowlarr/client.ts
//
// Functions: prowlarrUrlError, normalizeProwlarrUrl, sanitizeProwlarrError, parseSystemStatus,
//            parseIndexers, parseIndexerStatuses, parseIndexerStats, fetchSystemStatus,
//            fetchIndexers, fetchIndexerStatuses, fetchIndexerStats
//
// Read-only client for Prowlarr's v1 API. An indexer's settings include its site
// credentials, so only its URLs are read from them, and the indexer list is
// fetched far less often than the status (see prowlarr/sync.ts).

import "server-only"

import { classifyFetchError, sanitizeNetworkError } from "@/lib/error-utils"
import {
  ADAPTER_FETCH_TIMEOUT_MS,
  PROWLARR_RESPONSE_MAX_BYTES,
  TRACKER_URL_MAX,
} from "@/lib/limits"
import { hostsFromUrls } from "@/lib/prowlarr/matching"
import type { ProwlarrIndexerStats } from "@/types/api"

export interface ProwlarrConnection {
  url: string
  apiKey: string
}

export interface ParsedIndexer {
  indexerId: number
  name: string
  enabled: boolean
  hosts: string[]
}

export interface ParsedIndexerStatus {
  indexerId: number
  disabledTill: Date | null
  mostRecentFailure: Date | null
  initialFailure: Date | null
}

/**
 * Why a Prowlarr URL is refused, or null when it is usable. Private and local
 * hosts are allowed, since that is where Prowlarr runs. Userinfo is refused
 * because the API key has its own encrypted column.
 */
export function prowlarrUrlError(url: string): string | null {
  if (url.length > TRACKER_URL_MAX) return `URL must be ${TRACKER_URL_MAX} characters or fewer`
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return "Invalid URL format"
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "URL must use http:// or https://"
  }
  if (parsed.username || parsed.password) {
    return "URL must not contain a username or password. Enter the API key in its own field"
  }
  // A bare "?" or "#" parses to an empty search or hash, so the raw string is checked.
  if (/[?#]/.test(url)) return "URL must not contain a query or fragment"
  return null
}

/** Trims and drops trailing slashes, so endpoint paths append cleanly after a URL base. */
export function normalizeProwlarrUrl(url: string): string {
  return url.trim().replace(/\/+$/, "")
}

/**
 * The message stored and shown for a failed request. This module's own errors
 * are matched first, because sanitizeNetworkError would map some of them to the
 * wrong message. Only the remaining errors mean Prowlarr could not be reached.
 */
export function sanitizeProwlarrError(raw: string): string {
  const status = raw.match(/Prowlarr API error: (\d{3})/)
  if (status) {
    const code = Number(status[1])
    if (code === 401 || code === 403) return "API key rejected by Prowlarr"
    if (code >= 300 && code < 400) {
      return "Prowlarr redirected the request. Check the URL, including any URL base"
    }
    if (code === 404) return "Prowlarr's API was not found at this URL. Check the URL base"
    return `Prowlarr returned HTTP ${code}`
  }
  if (/Prowlarr response exceeded/.test(raw)) return "Prowlarr returned an oversized response"
  if (/Prowlarr sent/.test(raw)) return "Prowlarr returned an unexpected response"
  return `Prowlarr unreachable: ${sanitizeNetworkError(raw)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function dateOrNull(value: unknown): Date | null {
  if (typeof value !== "string") return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

function unexpected(what: string): Error {
  return new Error(`Prowlarr sent an unexpected ${what} response`)
}

export function parseSystemStatus(body: unknown): { version: string | null } {
  if (!isRecord(body)) throw unexpected("system status")
  return { version: stringOrNull(body.version) }
}

/** Entries without a usable id or name are skipped rather than failing the whole list. */
export function parseIndexers(body: unknown): ParsedIndexer[] {
  if (!Array.isArray(body)) throw unexpected("indexer")
  const out: ParsedIndexer[] = []
  for (const item of body) {
    if (!isRecord(item) || !isId(item.id) || typeof item.name !== "string") continue
    const fields = Array.isArray(item.fields) ? item.fields : []
    const baseUrl = fields.find((f) => isRecord(f) && f.name === "baseUrl")
    out.push({
      indexerId: item.id,
      name: item.name.slice(0, 255),
      enabled: item.enable !== false,
      hosts: hostsFromUrls([
        isRecord(baseUrl) && typeof baseUrl.value === "string" ? baseUrl.value : null,
        ...stringArray(item.indexerUrls),
        ...stringArray(item.legacyUrls),
      ]),
    })
  }
  return out
}

export function parseIndexerStatuses(body: unknown): ParsedIndexerStatus[] {
  if (!Array.isArray(body)) throw unexpected("indexer status")
  const out: ParsedIndexerStatus[] = []
  for (const item of body) {
    if (!isRecord(item) || !isId(item.indexerId)) continue
    out.push({
      indexerId: item.indexerId,
      disabledTill: dateOrNull(item.disabledTill),
      mostRecentFailure: dateOrNull(item.mostRecentFailure),
      initialFailure: dateOrNull(item.initialFailure),
    })
  }
  return out
}

export function parseIndexerStats(body: unknown): Map<number, ProwlarrIndexerStats> {
  if (!isRecord(body) || !Array.isArray(body.indexers)) throw unexpected("indexer stats")
  const out = new Map<number, ProwlarrIndexerStats>()
  for (const item of body.indexers) {
    if (!isRecord(item) || !isId(item.indexerId)) continue
    out.set(item.indexerId, {
      averageResponseTime: count(item.averageResponseTime),
      queries: count(item.numberOfQueries),
      grabs: count(item.numberOfGrabs),
      rssQueries: count(item.numberOfRssQueries),
      authQueries: count(item.numberOfAuthQueries),
      failedQueries: count(item.numberOfFailedQueries),
      failedGrabs: count(item.numberOfFailedGrabs),
      failedRssQueries: count(item.numberOfFailedRssQueries),
      failedAuthQueries: count(item.numberOfFailedAuthQueries),
    })
  }
  return out
}

async function readCappedJson(response: Response): Promise<unknown> {
  const body = response.body
  let text: string
  if (body && typeof body.getReader === "function") {
    const reader = body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue
        total += value.length
        if (total > PROWLARR_RESPONSE_MAX_BYTES) {
          await reader.cancel()
          throw new Error(`Prowlarr response exceeded ${PROWLARR_RESPONSE_MAX_BYTES} bytes`)
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    text = new TextDecoder().decode(Buffer.concat(chunks))
  } else {
    text = await response.text()
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error("Prowlarr sent a response that is not JSON")
  }
}

/**
 * One request to an API path. Redirects are not followed, because following
 * one would send the X-Api-Key header to the redirect target. Error messages
 * name the host only.
 */
async function prowlarrGet(conn: ProwlarrConnection, path: string): Promise<unknown> {
  const base = normalizeProwlarrUrl(conn.url)
  const hostname = new URL(base).hostname
  let response: Response
  try {
    response = await fetch(`${base}/api/v1/${path}`, {
      headers: { "X-Api-Key": conn.apiKey, Accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    throw classifyFetchError(err, hostname)
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    throw new Error(`Prowlarr API error: ${response.status}`)
  }
  return readCappedJson(response)
}

export async function fetchSystemStatus(conn: ProwlarrConnection) {
  return parseSystemStatus(await prowlarrGet(conn, "system/status"))
}

export async function fetchIndexers(conn: ProwlarrConnection) {
  return parseIndexers(await prowlarrGet(conn, "indexer"))
}

export async function fetchIndexerStatuses(conn: ProwlarrConnection) {
  return parseIndexerStatuses(await prowlarrGet(conn, "indexerstatus"))
}

export async function fetchIndexerStats(conn: ProwlarrConnection, start: Date, end: Date) {
  const qs = `startDate=${encodeURIComponent(start.toISOString())}&endDate=${encodeURIComponent(end.toISOString())}`
  return parseIndexerStats(await prowlarrGet(conn, `indexerstats?${qs}`))
}
