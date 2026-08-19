// src/lib/download-clients/qbt/transport.ts
//
// Available functions:
//   buildBaseUrl          - Construct base URL from host/port/ssl
//   credentialFingerprint - Non-reversible hash identifying some secret material
//   blockKeyFor           - Compose the auth-block map key from baseUrl + fingerprint
//   clearAuthBlocks       - Drop auth blocks for one baseUrl (explicit user retry)
//   login                 - Authenticate with qBittorrent Web API, returns SID cookie
//   getSession            - Return cached SID or perform a fresh login
//   invalidateSession     - Remove a cached SID (i.e after 403)
//   clearAllSessions      - Remove all cached SIDs and auth blocks (called on logout)
//   withSessionRetry      - Run an operation with automatic session retry on expiry
//   authHeaders           - Build the request headers for a QbtAuth value
//   qbtFetch              - Shared fetch + error handler for authenticated qBT requests
//   parseCachedTorrents   - Parse cachedTorrents column (string or object)
//   getTorrents           - Fetch torrent info from qBittorrent (optionally filtered by tag)
//   getTransferInfo       - Fetch global transfer stats from qBittorrent
//   syncMaindata          - Fetch delta sync data from qBittorrent (maindata endpoint)

import { createHash } from "node:crypto"
import { sanitizeHost } from "@/lib/data-transforms"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { log } from "@/lib/logger"
import { clearAllStores, resetStore } from "../sync-store"
import type { SlimTorrent } from "../transforms"
import {
  isQbtMaindataResponse,
  isQbtTorrent,
  type QbtMaindataResponse,
  type QbtTorrent,
  type QbtTransferInfo,
} from "./types"

// Extract detail string from a fetch error.
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
  const cleanHost = sanitizeHost(host)
  return `${ssl ? "https" : "http"}://${cleanHost}:${port}`
}

// ---------------------------------------------------------------------------
// SID session cache to avoid re-authenticating on every poll cycle.
// ---------------------------------------------------------------------------

/** The session cookie qBittorrent assigns at login — name varies by version/port. */
export type SidCookie = { name: string; value: string }

/**
 * How a request authenticates. qBittorrent 5.2.0 (WebAPI 2.14.1) added
 * stateless API-key auth alongside the cookie session, so every endpoint
 * helper takes one of these instead of a bare cookie. Keeping it a union means
 * the endpoints never branch on a mode, and session-only operations such as
 * invalidateSession are unreachable from the key path by construction.
 */
export type QbtAuth = { mode: "session"; sid: SidCookie } | { mode: "apikey"; key: string }

const gSid = globalThis as typeof globalThis & {
  __qbtSidCache?: Map<string, SidCookie>
}
if (!gSid.__qbtSidCache) gSid.__qbtSidCache = new Map()
const sidCache = gSid.__qbtSidCache

/** Get a cached session cookie or perform a fresh login. */
export async function getSession(
  host: string,
  port: number,
  ssl: boolean,
  username: string,
  password: string
): Promise<{ baseUrl: string; sid: SidCookie }> {
  const baseUrl = buildBaseUrl(host, port, ssl)
  const cached = sidCache.get(baseUrl)
  if (cached) return { baseUrl, sid: cached }

  const sid = await login(host, port, ssl, username, password)
  sidCache.set(baseUrl, sid)
  return { baseUrl, sid }
}

/** Invalidate a cached SID */
export function invalidateSession(baseUrl: string): void {
  sidCache.delete(baseUrl)
  resetStore(baseUrl)
}

/** Clear all cached SIDs, auth blocks, and torrent stores (called on logout/scheduler stop). */
export function clearAllSessions(): void {
  sidCache.clear()
  authBlocks.clear()
  clearAllStores()
}

// ---------------------------------------------------------------------------
// Auth-failure circuit breaker.
//
// qBittorrent bans the calling IP for MaxAuthenticationFailCount (default 5)
// failed logins and keeps rejecting for BanDuration (default 3600s) even once
// the correct password is supplied. The heartbeat runs every 5 seconds, so a
// client saved with bad credentials would be banned within ~25 seconds and the
// user locked out for an hour after fixing it. Once a login is rejected we
// therefore stop attempting it — no timer, no backoff, just "don't ask again".
//
// The block is keyed by baseUrl AND a fingerprint of the credentials, so a
// user who edits the username or password is never stuck: different
// credentials hash to a different key and simply are not blocked. It also
// clears on process restart and on an explicit Test Connection.
//
// Deliberately NOT applied to the 403 ban response. A ban is only ever
// observed after this app has already stopped trying, so re-attempting cannot
// prolong it — and requests made during a ban are rejected before credentials
// are validated, so they cannot trip the counter again. Leaving the ban
// unblocked is what lets a user who fixes their password mid-ban recover
// automatically the moment the ban expires.
// ---------------------------------------------------------------------------

const gBlocks = globalThis as typeof globalThis & {
  __qbtAuthBlocks?: Map<string, string>
}
if (!gBlocks.__qbtAuthBlocks) gBlocks.__qbtAuthBlocks = new Map()
/** Maps `${baseUrl}\0${credentialFingerprint}` to the error message to replay. */
const authBlocks = gBlocks.__qbtAuthBlocks

/**
 * Non-reversible identifier for a credential pair. Only ever compared, never
 * logged or persisted — it exists so a credential edit is detectable without
 * holding the plaintext.
 *
 * ── SHA-256 IS CORRECT HERE. Do not "upgrade" this to a slow KDF. ──────────
 * CodeQL flags this as "use of password hash with insufficient computational
 * effort" and suggests PBKDF2. That alert has been reviewed and dismissed as a
 * false positive; the rule is aimed at a threat model this code does not have.
 *
 * That rule protects CREDENTIAL STORAGE: you persist hash(password), an
 * attacker steals the store, and brute-forces it offline. A slow KDF makes that
 * expensive. None of that shape applies:
 *
 *   - The digest is a key in an in-memory Map (`authBlocks`) whose values are
 *     error strings to replay. It is never persisted, never logged, never sent.
 *   - It authenticates nobody. It answers one question — "are these the same
 *     credentials that were just rejected?" — so a user who fixes a password is
 *     not held by the circuit breaker.
 *   - Anyone able to read that Map has this process's memory, where the
 *     plaintext password already lives (login() builds it into a URLSearchParams
 *     body a few lines below). The digest discloses nothing new.
 *
 * And the suggested fix has a real cost. blockKeyFor() runs inside qbtFetch(),
 * which every qBittorrent API call passes through. Measured: SHA-256 is
 * ~0.0026 ms/call, PBKDF2 at 210k iterations is ~31.8 ms — about 12,000x
 * slower. That is ~32 ms of CPU added to every poll, permanently, to defend
 * against an attacker who by construction already holds the plaintext.
 *
 * If this ever needs to satisfy the scanner, the right move is HMAC-SHA256 under
 * a random per-process key (fast, and unbruteforceable even in principle — the
 * Map does not outlive the process, so a per-process key loses nothing). NOT a
 * slow KDF on a per-request path.
 */
function credentialFingerprint(username: string, password: string): string {
  return createHash("sha256").update(`${username}\u0000${password}`).digest("hex")
}

function blockKeyFor(baseUrl: string, username: string, password: string): string {
  return `${baseUrl}\u0000${credentialFingerprint(username, password)}`
}

/**
 * Drop every auth block recorded for a baseUrl regardless of credentials.
 * Called when the user explicitly asks to test the connection — an explicit
 * retry should always reach the network, since the fix may have been on the
 * qBittorrent side (enabling localhost bypass, or waiting out a ban).
 */
export function clearAuthBlocks(baseUrl: string): void {
  const prefix = `${baseUrl}\u0000`
  for (const key of authBlocks.keys()) {
    if (key.startsWith(prefix)) authBlocks.delete(key)
  }
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
  op: (baseUrl: string, sid: SidCookie) => Promise<T>
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

/**
 * Credentials qBittorrent rejected. Both strings start with "Authentication
 * failed" so callers matching on that keep working, and both carry wording
 * distinctive enough for sanitizeNetworkError to tell them apart from a
 * transient network fault.
 */
const BLANK_CREDENTIALS_REJECTED =
  "Authentication failed — qBittorrent rejected the blank credentials. Blank credentials only " +
  'work when "Bypass authentication for clients on localhost" is enabled in qBittorrent'
const CREDENTIALS_REJECTED = "Authentication failed — qBittorrent rejected the username and password"
const IP_BANNED =
  "qBittorrent has temporarily banned this IP after too many failed login attempts"
const API_KEY_REJECTED =
  "Authentication failed — qBittorrent rejected the API key. Check that it has not been " +
  "rotated, and that the server is running qBittorrent 5.2.0 or newer"

export async function login(
  host: string,
  port: number,
  ssl: boolean,
  username: string,
  password: string
): Promise<SidCookie> {
  const baseUrl = buildBaseUrl(host, port, ssl)
  const url = `${baseUrl}/api/v2/auth/login`
  const body = new URLSearchParams({ username, password }).toString()

  // Replay a previous rejection instead of asking again — see the auth-failure
  // circuit breaker above. Editing either credential changes the key, so a user
  // who fixes their password is never held here.
  const blockKey = blockKeyFor(baseUrl, username, password)
  const blocked = authBlocks.get(blockKey)
  if (blocked) throw new Error(blocked)

  const rejection = username === "" && password === ""
    ? BLANK_CREDENTIALS_REJECTED
    : CREDENTIALS_REJECTED

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    const errName =
      err !== null && typeof err === "object" && "name" in (err as object)
        ? String((err as { name: unknown }).name)
        : ""
    if (errName === "TimeoutError" || errName === "AbortError") {
      throw new Error(`Request to ${host} timed out after ${ADAPTER_FETCH_TIMEOUT_MS / 1000}s`)
    }
    throw new Error(`Failed to connect to ${baseUrl}: ${describeFetchError(err)}`)
  }

  if (!response.ok) {
    // 401 is a definitive credential rejection: stop attempting this pair.
    if (response.status === 401) {
      authBlocks.set(blockKey, rejection)
      throw new Error(rejection)
    }
    // qBittorrent answers 403 with a plain-text ban notice once the IP has
    // tripped MaxAuthenticationFailCount. Not blocked deliberately — the ban
    // expires on its own and re-attempting cannot extend it.
    if (response.status === 403) {
      const banBody = await response.text().catch(() => "")
      if (/banned/i.test(banBody)) throw new Error(IP_BANNED)
      throw new Error(`qBittorrent API error: ${response.status} ${response.statusText}`)
    }
    throw new Error(`qBittorrent API error: ${response.status} ${response.statusText}`)
  }

  const text = await response.text()
  if (text !== "Ok." && response.status !== 204) {
    // Older qBittorrent answers a bad login with 200 + "Fails." rather than 401.
    authBlocks.set(blockKey, rejection)
    throw new Error(rejection)
  }

  // qBittorrent 5.2+ names its session cookie `QBT_SID_<port>` (the WebUI's
  // own listen port baked into the name) instead of the legacy plain `SID`,
  // so match that pattern specifically — the server rejects the value if sent
  // back under a different cookie name (confirmed live: sending the correct
  // value under the wrong name returns 403). `getSetCookie()` returns each
  // Set-Cookie response header as its own array element, unlike `.get()`
  // which comma-joins them into a single string that's unsafe to regex
  // across (cookie values can legally contain commas).
  const sid = response.headers
    .getSetCookie()
    .map((cookie): SidCookie | null => {
      const eq = cookie.indexOf("=")
      if (eq === -1) return null
      const name = cookie.slice(0, eq).trim()
      const value = cookie.slice(eq + 1).split(";", 1)[0].trim()
      return { name, value }
    })
    .find((cookie): cookie is SidCookie => {
      if (!cookie) return false
      return cookie.name === "SID" || /^QBT_SID_\d+$/.test(cookie.name)
    })

  if (!sid) {
    throw new Error("Authentication failed — SID cookie not found in response")
  }

  return sid
}

function authHeaders(auth: QbtAuth): Record<string, string> {
  return auth.mode === "session"
    ? { Cookie: `${auth.sid.name}=${auth.sid.value}` }
    : { Authorization: `Bearer ${auth.key}` }
}

async function qbtFetch(
  url: string,
  host: string,
  baseUrl: string,
  auth: QbtAuth
): Promise<Response> {
  // API keys never pass through login(), so the circuit breaker that guards
  // password auth has to be applied here instead. Without it a rotated key
  // would be retried by every heartbeat forever — the same runaway the
  // password breaker exists to stop. Keyed through blockKeyFor so it shares
  // the per-baseUrl namespace clearAuthBlocks sweeps, with "apikey" in the
  // username slot keeping keys out of the fingerprint space ordinary
  // credentials occupy.
  const blockKey = auth.mode === "apikey" ? blockKeyFor(baseUrl, "apikey", auth.key) : null
  if (blockKey) {
    const blocked = authBlocks.get(blockKey)
    if (blocked) throw new Error(blocked)
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers: authHeaders(auth),
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    const errName =
      err !== null && typeof err === "object" && "name" in (err as object)
        ? String((err as { name: unknown }).name)
        : ""
    if (errName === "TimeoutError" || errName === "AbortError") {
      throw new Error(`Request to ${host} timed out after ${ADAPTER_FETCH_TIMEOUT_MS / 1000}s`)
    }
    throw new Error(`Failed to connect to ${host}: ${describeFetchError(err)}`)
  }

  // A rejected key is definitive — unlike a session cookie there is nothing to
  // refresh, so record it and stop asking. Editing the key changes the block
  // key, and Test Connection clears the whole baseUrl, so the user is never
  // stuck. Both 401 and 403 count, because qBittorrent has used each for an
  // unauthenticated WebAPI request across 5.x.
  //
  // An IP ban is the one 403 that must NOT latch, exactly as on the password
  // path: the ban expires on its own, requests made during it are refused
  // before the credential is even looked at, and a ban is reachable without
  // this key being wrong at all — a sibling password client on the same host
  // can trip the counter. Latching it would outlive the ban and turn a
  // self-healing condition into a permanent one.
  if (blockKey && (response.status === 401 || response.status === 403)) {
    if (response.status === 403) {
      const banBody = await response.text().catch(() => null)
      if (banBody === null) {
        // The body is what tells a ban apart from a rejected key, so without
        // it there is nothing to decide on. Latching the wrong way disables a
        // valid key until the user intervenes, while not latching costs one
        // more request — so defer to the next attempt, which will normally
        // have a readable body and will latch then.
        throw new Error(`qBittorrent API error: ${response.status} ${response.statusText}`)
      }
      if (/banned/i.test(banBody)) throw new Error(IP_BANNED)
    }
    authBlocks.set(blockKey, API_KEY_REJECTED)
    throw new Error(API_KEY_REJECTED)
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
export function parseCachedTorrents(raw: unknown): SlimTorrent[] {
  if (!raw) return []
  let arr: unknown[]
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        log.warn({ type: typeof parsed }, "parseCachedTorrents: parsed JSON is not an array")
        return []
      }
      arr = parsed
    } catch (err) {
      log.warn({ err }, "parseCachedTorrents: JSON parse failed")
      return []
    }
  } else if (Array.isArray(raw)) {
    arr = raw
  } else {
    return []
  }
  if (arr.length === 0) return arr as SlimTorrent[]
  if (!isQbtTorrent(arr[0])) {
    log.warn({ sample: arr[0] }, "parseCachedTorrents: first element failed isQbtTorrent check")
    return []
  }
  return arr as SlimTorrent[]
}

export async function getTorrents(
  baseUrl: string,
  auth: QbtAuth,
  tag?: string,
  filter?: string
): Promise<QbtTorrent[]> {
  const parts: string[] = []
  if (tag) parts.push(`tag=${encodeURIComponent(tag)}`)
  if (filter) parts.push(`filter=${encodeURIComponent(filter)}`)
  const qs = parts.join("&")
  const url = `${baseUrl}/api/v2/torrents/info${qs ? `?${qs}` : ""}`
  const host = new URL(baseUrl).hostname
  const response = await qbtFetch(url, host, baseUrl, auth)
  return response.json() as Promise<QbtTorrent[]>
}

export async function getTransferInfo(baseUrl: string, auth: QbtAuth): Promise<QbtTransferInfo> {
  const url = `${baseUrl}/api/v2/transfer/info`
  const host = new URL(baseUrl).hostname
  const response = await qbtFetch(url, host, baseUrl, auth)
  return response.json() as Promise<QbtTransferInfo>
}

export async function syncMaindata(
  baseUrl: string,
  auth: QbtAuth,
  rid: number
): Promise<QbtMaindataResponse> {
  const url = `${baseUrl}/api/v2/sync/maindata?rid=${rid}`
  const host = new URL(baseUrl).hostname
  const response = await qbtFetch(url, host, baseUrl, auth)
  const data: unknown = await response.json()
  if (!isQbtMaindataResponse(data)) {
    throw new Error("Invalid maindata response from qBittorrent")
  }
  return data
}
