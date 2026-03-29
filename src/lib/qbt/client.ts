// src/lib/qbt/client.ts
//
// Available functions:
//   buildBaseUrl          - Construct base URL from host/port/ssl
//   login                 - Authenticate with qBittorrent Web API, returns SID cookie
//   getSession            - Return cached SID or perform a fresh login
//   invalidateSession     - Remove a cached SID (i.e after 403)
//   clearAllSessions      - Remove all cached SIDs (called on logout)
//   withSessionRetry      - Run an operation with automatic session retry on expiry
//   qbtFetch              - Shared fetch + error handler for authenticated qBT requests
//   parseCachedTorrents   - Safely parse JSONB cachedTorrents column (string or object)
//   getTorrents           - Fetch torrent info from qBittorrent (optionally filtered by tag)
//   getTransferInfo       - Fetch global transfer stats from qBittorrent

import { isQbtTorrent, type QbtTorrent, type QbtTransferInfo } from "./types"

/** Extract a human-readable detail string from a fetch error.
 *  Node's fetch wraps the real error in `cause`, i.e
 *  TypeError("fetch failed") { cause: Error("ECONNREFUSED ...") }
 */
function describeFetchError(err: unknown): string {
  const cause =
    err !== null && typeof err === "object" && "cause" in (err as object)
      ? (err as { cause: unknown }).cause
      : undefined
  if (cause instanceof Error) {
    const code = "code" in cause ? (cause as NodeJS.ErrnoException).code : undefined
    if (code) return code
    if (cause.message) return cause.message
  }

  if (err instanceof Error) {
    const code = "code" in err ? (err as NodeJS.ErrnoException).code : undefined
    if (code) return code
    if (err.message && err.message !== "fetch failed") return err.message
  }

  return "Unknown network error"
}

export function buildBaseUrl(host: string, port: number, ssl: boolean): string {
  // Strip any protocol the user may have included (i.e "http://myhost")
  const cleanHost = host.replace(/^https?:\/\//, "")
  return `${ssl ? "https" : "http"}://${cleanHost}:${port}`
}

// ---------------------------------------------------------------------------
// SID session cache to avoid re-authenticating on every poll cycle.
// ---------------------------------------------------------------------------

const gSid = globalThis as typeof globalThis & {
  __qbtSidCache?: Map<string, string>
}
if (!gSid.__qbtSidCache) gSid.__qbtSidCache = new Map()
const sidCache = gSid.__qbtSidCache

/** Get a cached SID or perform a fresh login. */
export async function getSession(
  host: string,
  port: number,
  ssl: boolean,
  username: string,
  password: string
): Promise<{ baseUrl: string; sid: string }> {
  const baseUrl = buildBaseUrl(host, port, ssl)
  const cached = sidCache.get(baseUrl)
  if (cached) return { baseUrl, sid: cached }

  const sid = await login(host, port, ssl, username, password)
  sidCache.set(baseUrl, sid)
  return { baseUrl, sid }
}

/** Invalidate a cached SID (i.e after a 403). */
export function invalidateSession(baseUrl: string): void {
  sidCache.delete(baseUrl)
}

/** Clear all cached SIDs (called on logout). */
export function clearAllSessions(): void {
  sidCache.clear()
}

/**
 * Run an operation that requires a qBT session, retrying once if the session
 * expires (i.e. the operation throws "Session expired").
 *
 * The caller supplies `op`, a function that receives the resolved baseUrl and
 * sid and returns a Promise. On expiry the SID is invalidated, a fresh session
 * is obtained, and op is called a second time. Any other error propagates
 * immediately.
 */
export async function withSessionRetry<T>(
  host: string,
  port: number,
  ssl: boolean,
  username: string,
  password: string,
  op: (baseUrl: string, sid: string) => Promise<T>
): Promise<T> {
  const { baseUrl, sid } = await getSession(host, port, ssl, username, password)
  try {
    return await op(baseUrl, sid)
  } catch (err) {
    if (err instanceof Error && err.message === "Session expired") {
      invalidateSession(baseUrl)
      const fresh = await getSession(host, port, ssl, username, password)
      return await op(baseUrl, fresh.sid)
    }
    throw err
  }
}

export async function login(
  host: string,
  port: number,
  ssl: boolean,
  username: string,
  password: string
): Promise<string> {
  const baseUrl = buildBaseUrl(host, port, ssl)
  const url = `${baseUrl}/api/v2/auth/login`
  const body = new URLSearchParams({ username, password }).toString()

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15000),
    })
  } catch (err) {
    const errName =
      err !== null && typeof err === "object" && "name" in (err as object)
        ? String((err as { name: unknown }).name)
        : ""
    if (errName === "TimeoutError" || errName === "AbortError") {
      throw new Error(`Request to ${host} timed out after 15s`)
    }
    throw new Error(`Failed to connect to ${baseUrl}: ${describeFetchError(err)}`)
  }

  if (!response.ok) {
    throw new Error(`qBittorrent API error: ${response.status} ${response.statusText}`)
  }

  const text = await response.text()
  if (text !== "Ok.") {
    throw new Error("Authentication failed — check username and password")
  }

  const setCookie = response.headers.get("set-cookie") ?? ""
  const match = setCookie.match(/SID=([^;]+)/)
  if (!match) {
    throw new Error("Authentication failed — SID cookie not found in response")
  }

  return match[1]
}

async function qbtFetch(
  url: string,
  host: string,
  baseUrl: string,
  sid: string
): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: { Cookie: `SID=${sid}` },
      signal: AbortSignal.timeout(15000),
    })
  } catch (err) {
    const errName =
      err !== null && typeof err === "object" && "name" in (err as object)
        ? String((err as { name: unknown }).name)
        : ""
    if (errName === "TimeoutError" || errName === "AbortError") {
      throw new Error(`Request to ${host} timed out after 15s`)
    }
    throw new Error(`Failed to connect to ${host}: ${describeFetchError(err)}`)
  }

  if (response.status === 403) {
    invalidateSession(baseUrl)
    throw new Error("Session expired")
  }

  if (!response.ok) {
    throw new Error(`qBittorrent API error: ${response.status} ${response.statusText}`)
  }

  return response
}

/**
 * Parses the cachedTorrents JSONB column
 */
export function parseCachedTorrents(raw: unknown): QbtTorrent[] {
  if (!raw) return []
  let arr: unknown[]
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      arr = parsed
    } catch {
      return []
    }
  } else if (Array.isArray(raw)) {
    arr = raw
  } else {
    return []
  }
  if (arr.length === 0) return arr as QbtTorrent[]
  if (!isQbtTorrent(arr[0])) return []
  return arr as QbtTorrent[]
}

export async function getTorrents(
  baseUrl: string,
  sid: string,
  tag?: string,
  filter?: string
): Promise<QbtTorrent[]> {
  const parts: string[] = []
  if (tag) parts.push(`tag=${encodeURIComponent(tag)}`)
  if (filter) parts.push(`filter=${encodeURIComponent(filter)}`)
  const qs = parts.join("&")
  const url = `${baseUrl}/api/v2/torrents/info${qs ? `?${qs}` : ""}`
  const host = new URL(baseUrl).hostname
  const response = await qbtFetch(url, host, baseUrl, sid)
  return response.json() as Promise<QbtTorrent[]>
}

export async function getTransferInfo(baseUrl: string, sid: string): Promise<QbtTransferInfo> {
  const url = `${baseUrl}/api/v2/transfer/info`
  const host = new URL(baseUrl).hostname
  const response = await qbtFetch(url, host, baseUrl, sid)
  return response.json() as Promise<QbtTransferInfo>
}
