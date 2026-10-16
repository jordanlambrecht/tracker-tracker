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
//   fetchSignal           - The caller's deadline combined with the transport ceiling
//   readCappedBody        - Read a body stream, refusing one past QBT_RESPONSE_MAX_BYTES
//   readCappedText        - readCappedBody for the reads that want text
//   readCappedJson        - readCappedBody parsed as JSON
//   parseCachedTorrents   - Parse cachedTorrents column (string or object)
//   getTorrents           - Fetch torrent info from qBittorrent (optionally filtered by tag)
//   getTransferInfo       - Fetch global transfer stats from qBittorrent
//   syncMaindata          - Fetch delta sync data from qBittorrent (maindata endpoint)

import { createHash } from "node:crypto"
import { sanitizeHost } from "@/lib/data-transforms"
import { ADAPTER_FETCH_TIMEOUT_MS, QBT_RESPONSE_MAX_BYTES } from "@/lib/limits"
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
    // A bare TypeError from fetch is either the useless "fetch failed" or
    // undici's header validation, which quotes the header and so the API key.
    // Neither message is worth logging; the name is.
    if (err instanceof TypeError)
      return err.message === "fetch failed" ? "Unknown network error" : err.name
    if (err.message) return err.message
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

/**
 * Characters that must never reach a Cookie header. `split(";", 1)` and
 * `trim()` leave only an interior control character, and undici rejects CR and
 * LF in a parsed response header, so this is unreachable today. It keeps the
 * guarantee in this file because authHeaders interpolates the value straight
 * into a header.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-char check
const unsafeChars = /[;\r\n\x00-\x1F\x7F]/

/** The session cookie qBittorrent assigns at login, name varies by version/port. */
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
  password: string,
  signal?: AbortSignal
): Promise<{ baseUrl: string; sid: SidCookie }> {
  const baseUrl = buildBaseUrl(host, port, ssl)
  // Keyed by credentials as well as origin, the same way authBlocks is. Keyed
  // by baseUrl alone, a second client row on the same host would ride the first
  // row's session, and a row with a revoked password would still poll green.
  const cacheKey = blockKeyFor(baseUrl, username, password)
  const cached = sidCache.get(cacheKey)
  if (cached) return { baseUrl, sid: cached }

  const sid = await login(host, port, ssl, username, password, signal)
  sidCache.set(cacheKey, sid)
  return { baseUrl, sid }
}

/**
 * Drop every cached SID for a host, whatever credentials minted it. Callers
 * only know the baseUrl, and a 403 from one row says nothing about which
 * credential pair is stale, so the sweep matches clearAuthBlocks.
 */
export function invalidateSession(baseUrl: string): void {
  const prefix = `${baseUrl}\u0000`
  for (const key of sidCache.keys()) {
    if (key === baseUrl || key.startsWith(prefix)) sidCache.delete(key)
  }
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
// qBittorrent bans the calling IP after MaxAuthenticationFailCount (default 5)
// failed logins and keeps rejecting for BanDuration (default 3600s), even once
// the password is fixed. The 5s heartbeat would get there in about 25 seconds,
// so a rejected login is not retried.
//
// The block is keyed by baseUrl and a credential fingerprint, so an edited
// credential is not blocked. It also clears on restart and on Test Connection.
//
// The 403 ban response is not blocked. Retrying during a ban cannot extend it,
// and leaving it unblocked lets a fixed password recover once the ban expires.
// ---------------------------------------------------------------------------

const gBlocks = globalThis as typeof globalThis & {
  __qbtAuthBlocks?: Map<string, string>
}
if (!gBlocks.__qbtAuthBlocks) gBlocks.__qbtAuthBlocks = new Map()
/** Maps `${baseUrl}\u0000${credentialFingerprint}` to the error message to replay. */
const authBlocks = gBlocks.__qbtAuthBlocks

/**
 * Non-reversible identifier for a credential pair. Only ever compared, never
 * logged or persisted, it exists so a credential edit is detectable without
 * holding the plaintext.
 *
 * SHA-256 is deliberate. Do not swap in a slow KDF. The digest keys an
 * in-memory Map in a process that already holds the plaintext, and blockKeyFor
 * runs on the request path, so a slow KDF adds per-request cost and protects
 * nothing. The CodeQL insufficient-effort alert on this was reviewed and
 * dismissed as a false positive.
 */
function credentialFingerprint(username: string, password: string): string {
  return createHash("sha256").update(`${username}\u0000${password}`).digest("hex")
}

function blockKeyFor(baseUrl: string, username: string, password: string): string {
  return `${baseUrl}\u0000${credentialFingerprint(username, password)}`
}

/**
 * Drop every auth block recorded for a baseUrl regardless of credentials.
 * Called when the user explicitly asks to test the connection, an explicit
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
 *
 * `signal` bounds the login this may have to perform; `op` carries the caller's
 * deadline into its own request.
 */
export async function withSessionRetry<T>(
  host: string,
  port: number,
  ssl: boolean,
  username: string,
  password: string,
  op: (baseUrl: string, sid: SidCookie) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const { baseUrl, sid } = await getSession(host, port, ssl, username, password, signal)
  try {
    return await op(baseUrl, sid)
  } catch (err) {
    if (err instanceof Error && err.message === "Session expired") {
      invalidateSession(baseUrl)
      const fresh = await getSession(host, port, ssl, username, password, signal)
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
  "Authentication failed. qBittorrent rejected the blank credentials. Blank credentials only " +
  'work when "Bypass authentication for clients on localhost" is enabled in qBittorrent'
const CREDENTIALS_REJECTED = "Authentication failed. qBittorrent rejected the username and password"
const IP_BANNED = "qBittorrent has temporarily banned this IP after too many failed login attempts"
const API_KEY_REJECTED =
  "Authentication failed. qBittorrent rejected the API key. Check that it has not been " +
  "rotated, and that the server is running qBittorrent 5.2.0 or newer"

/**
 * The caller's deadline and this transport's own ceiling, whichever fires
 * first. Without the caller's signal, a client past its deadline is abandoned
 * rather than cancelled and keeps its socket and response buffer open.
 */
function fetchSignal(signal?: AbortSignal): AbortSignal {
  return signal
    ? AbortSignal.any([signal, AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS)])
    : AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS)
}

export async function login(
  host: string,
  port: number,
  ssl: boolean,
  username: string,
  password: string,
  signal?: AbortSignal
): Promise<SidCookie> {
  const baseUrl = buildBaseUrl(host, port, ssl)
  const hostname = new URL(baseUrl).hostname
  const url = `${baseUrl}/api/v2/auth/login`
  const body = new URLSearchParams({ username, password }).toString()

  // Replay a previous rejection instead of asking again. See the auth-failure
  // circuit breaker above. Editing either credential changes the key, so a user
  // who fixes their password is never held here.
  const blockKey = blockKeyFor(baseUrl, username, password)
  const blocked = authBlocks.get(blockKey)
  if (blocked) throw new Error(blocked)

  const rejection =
    username === "" && password === "" ? BLANK_CREDENTIALS_REJECTED : CREDENTIALS_REJECTED

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      // A 307 or 308 replays the method and the body at the new origin, and
      // undici strips Cookie and Authorization when the origin changes but
      // never the body. Following one hands the plaintext password to
      // whatever host the configured client names. Manual mode surfaces the
      // 3xx as non-ok, which the check below already throws on.
      redirect: "manual",
      signal: fetchSignal(signal),
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
    // tripped MaxAuthenticationFailCount. Not blocked deliberately, the ban
    // expires on its own and re-attempting cannot extend it.
    if (response.status === 403) {
      const banBody = (await readCappedText(response, hostname).catch(rethrowRefusal)) ?? ""
      if (/banned/i.test(banBody)) throw new Error(IP_BANNED)
      throw new Error(`qBittorrent API error: ${response.status} ${response.statusText}`)
    }
    throw new Error(`qBittorrent API error: ${response.status} ${response.statusText}`)
  }

  const text = await readCappedText(response, hostname)
  if (text !== "Ok." && response.status !== 204) {
    // Older qBittorrent answers a bad login with 200 + "Fails." rather than 401.
    authBlocks.set(blockKey, rejection)
    throw new Error(rejection)
  }

  // qBittorrent 5.2+ names its session cookie `QBT_SID_<port>` instead of the
  // legacy `SID`, and rejects the value under any other name. getSetCookie()
  // keeps each Set-Cookie header separate; .get() comma-joins them, and cookie
  // values can contain commas.
  const sid = response.headers
    .getSetCookie()
    .map((cookie): SidCookie | null => {
      const eq = cookie.indexOf("=")
      if (eq === -1) return null
      const name = cookie.slice(0, eq).trim()
      const value = cookie
        .slice(eq + 1)
        .split(";", 1)[0]
        .trim()
      return { name, value }
    })
    .find((cookie): cookie is SidCookie => {
      if (!cookie) return false
      return cookie.name === "SID" || /^QBT_SID_\d+$/.test(cookie.name)
    })

  if (!sid) {
    throw new Error("Authentication failed. SID cookie not found in response")
  }
  // Only the cookie actually selected is checked. An unrelated Set-Cookie on
  // the same response is none of our business and must not fail the login.
  if (unsafeChars.test(sid.value)) {
    throw new Error("Authentication failed. Session cookie contained an unsafe character")
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
  auth: QbtAuth,
  signal?: AbortSignal
): Promise<Response> {
  // API keys never pass through login(), so the circuit breaker that guards
  // password auth has to be applied here instead. Without it a rotated key
  // would be retried by every heartbeat forever, the same runaway the
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
      // Same reason as login(). No credential rides in this body, but a
      // followed redirect would feed the parser a response from an origin the
      // user never configured.
      redirect: "manual",
      signal: fetchSignal(signal),
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

  // A rejected key is definitive, unlike a session cookie there is nothing to
  // refresh, so record it and stop asking. Editing the key changes the block
  // key, and Test Connection clears the whole baseUrl, so the user is never
  // stuck. Both 401 and 403 count, because qBittorrent has used each for an
  // unauthenticated WebAPI request across 5.x.
  //
  // An IP ban is the one 403 that must not latch, exactly as on the password
  // path: the ban expires on its own, requests made during it are refused
  // before the credential is even looked at, and a ban is reachable without
  // this key being wrong at all, a sibling password client on the same host
  // can trip the counter. Latching it would outlive the ban and turn a
  // self-healing condition into a permanent one.
  if (blockKey && (response.status === 401 || response.status === 403)) {
    if (response.status === 403) {
      const banBody = await readCappedText(response, host).catch(rethrowRefusal)
      if (banBody === null) {
        // The body is what tells a ban apart from a rejected key, so without
        // it there is nothing to decide on. Latching the wrong way disables a
        // valid key until the user intervenes, while not latching costs one
        // more request, so defer to the next attempt, which will normally
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

/**
 * A body that ran past the cap, as a type rather than a recognisable string:
 * the ban-body reads swallow a read that merely failed, and must not swallow
 * this one.
 */
class ResponseTooLargeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ResponseTooLargeError"
  }
}

/**
 * Read a qBittorrent response body, refusing one that runs past
 * QBT_RESPONSE_MAX_BYTES. The timeout bounds how long a host may take, not how
 * much it may send, so without the cap a slow endless body is read into memory
 * unbounded.
 *
 * Returns null when the response carries no stream: nothing to read
 * incrementally, nothing to cap, so the caller's own reader handles it.
 */
async function readCappedBody(response: Response, host: string): Promise<string | null> {
  const body = response.body
  if (!body || typeof body.getReader !== "function") return null

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.length
      if (total > QBT_RESPONSE_MAX_BYTES) {
        await reader.cancel()
        throw new ResponseTooLargeError(
          `Response from ${host} exceeded ${QBT_RESPONSE_MAX_BYTES} bytes and was refused`
        )
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  // TextDecoder runs the same UTF-8 decode as response.text() and
  // response.json(), which drops a leading BOM. Buffer.toString("utf8") keeps
  // it and JSON.parse rejects it, so a host that emits one fails every poll.
  return new TextDecoder().decode(Buffer.concat(chunks))
}

/** The cap applied to the reads that want text: a ban notice, the login body. */
async function readCappedText(response: Response, host: string): Promise<string> {
  return (await readCappedBody(response, host)) ?? (await response.text())
}

async function readCappedJson<T>(response: Response, host: string): Promise<T> {
  const text = await readCappedBody(response, host)
  if (text === null) return (await response.json()) as T
  // security-audit-ignore: readCappedBody bounded the body, and a parse failure rejects into the poll's own catch
  return JSON.parse(text) as T
}

/** A read that failed decided nothing; a refused read is the answer itself. */
function rethrowRefusal(err: unknown): null {
  if (err instanceof ResponseTooLargeError) throw err
  return null
}

export async function getTorrents(
  baseUrl: string,
  auth: QbtAuth,
  tag?: string,
  filter?: string,
  signal?: AbortSignal
): Promise<QbtTorrent[]> {
  const parts: string[] = []
  if (tag) parts.push(`tag=${encodeURIComponent(tag)}`)
  if (filter) parts.push(`filter=${encodeURIComponent(filter)}`)
  const qs = parts.join("&")
  const url = `${baseUrl}/api/v2/torrents/info${qs ? `?${qs}` : ""}`
  const host = new URL(baseUrl).hostname
  const response = await qbtFetch(url, host, baseUrl, auth, signal)
  // Shape-checked like syncMaindata's body, so an object or a wrongly shaped
  // entry never reaches mapQbtTorrent.
  const data = await readCappedJson<unknown>(response, host)
  if (!Array.isArray(data)) {
    throw new Error(`Unexpected response from ${host}: torrent list was not an array`)
  }
  const valid = data.filter(isQbtTorrent)
  if (valid.length !== data.length) {
    log.warn(
      { host, received: data.length, kept: valid.length },
      "qbt: dropped torrents that failed the shape check"
    )
  }
  return valid
}

export async function getTransferInfo(baseUrl: string, auth: QbtAuth): Promise<QbtTransferInfo> {
  const url = `${baseUrl}/api/v2/transfer/info`
  const host = new URL(baseUrl).hostname
  const response = await qbtFetch(url, host, baseUrl, auth)
  return readCappedJson<QbtTransferInfo>(response, host)
}

export async function syncMaindata(
  baseUrl: string,
  auth: QbtAuth,
  rid: number
): Promise<QbtMaindataResponse> {
  const url = `${baseUrl}/api/v2/sync/maindata?rid=${rid}`
  const host = new URL(baseUrl).hostname
  const response = await qbtFetch(url, host, baseUrl, auth)
  const data: unknown = await readCappedJson<unknown>(response, host)
  if (!isQbtMaindataResponse(data)) {
    throw new Error("Invalid maindata response from qBittorrent")
  }
  return data
}
