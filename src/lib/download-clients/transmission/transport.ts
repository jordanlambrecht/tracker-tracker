// src/lib/download-clients/transmission/transport.ts
//
// Available functions:
//   invalidateSessionId - Drop a cached CSRF session id and the client's sync store
//   rpcEndpoint         - The RPC URL for a base URL and URL path
//   authHeaders         - Basic auth header, or none for blank credentials
//   postRpc             - One POST to the RPC endpoint, with the transport's error wording
//   rpcCall             - Issue one read-only RPC method, handling the 409 handshake
//   getTorrents         - torrent-get for the declared field list
//   getSessionStats     - session-stats (global transfer speeds)
//   testSession         - session-get, used to prove reachability and credentials

import { ADAPTER_FETCH_TIMEOUT_MS, TRANSMISSION_RESPONSE_MAX_BYTES } from "@/lib/limits"
import { log } from "@/lib/logger"
import { resetStore } from "../sync-store"
import {
  blockKeyFor,
  describeFetchError,
  fetchSignal,
  getAuthBlock,
  isResponseTooLarge,
  readCappedJson,
  setAuthBlock,
} from "../transport"
import type { ClientCredentials } from "../types"
import {
  isTransmissionTorrent,
  isTransmissionTorrentList,
  TORRENT_FIELDS,
  type TransmissionRpcResponse,
  type TransmissionSessionStats,
  type TransmissionTorrent,
} from "./types"

// ---------------------------------------------------------------------------
// CSRF session id cache.
//
// Transmission answers a request without the current X-Transmission-Session-Id
// with 409 and the id in that same header. The id is a CSRF token, not a
// credential, and it rotates about hourly and on restart, so a request is
// replayed once with the id the 409 handed back.
// ---------------------------------------------------------------------------

const gSession = globalThis as typeof globalThis & {
  __transmissionSessionIds?: Map<string, string>
}
if (!gSession.__transmissionSessionIds) gSession.__transmissionSessionIds = new Map()
const sessionIds = gSession.__transmissionSessionIds

export function invalidateSessionId(baseUrl: string): void {
  sessionIds.delete(baseUrl)
  resetStore(baseUrl)
}

// ---------------------------------------------------------------------------
// Auth-failure breaker.
//
// Transmission's anti-brute-force setting, off by default, counts failed logins
// on one global counter and, at its threshold (100 by default), answers every
// client with 403 until the daemon restarts. A stale password on the 5s
// heartbeat would trip it in about eight minutes, so a 401 is not retried.
//
// The block is keyed by baseUrl and a credential fingerprint, so an edited
// credential is not blocked. It clears when this app restarts, on Test
// Connection and on dispose. A 403 is never latched: it is the IP whitelist or a lockout that has
// already tripped, retrying makes neither worse, and a latch would outlive the
// restart that clears the lockout.
// ---------------------------------------------------------------------------

const CREDENTIALS_REJECTED =
  "Authentication failed. Transmission rejected the username and password"
const BLANK_CREDENTIALS_REJECTED =
  "Authentication failed. Transmission requires a username and password"
const API_KEY_UNSUPPORTED =
  "Transmission has no API-key authentication. Set this client to username and password"
const FORBIDDEN =
  "Transmission refused the request. Either its IP whitelist does not include this app, or " +
  "its anti-brute-force lockout has tripped and only a restart clears it"
const HOSTNAME_REFUSED =
  "Transmission refused the hostname. Add it to rpc-host-whitelist, or turn on password " +
  "authentication"
const SESSION_ID_MISSING = "Transmission returned 409 without an X-Transmission-Session-Id header"
const RPC_REFUSED = "Transmission refused the RPC call"
const UNEXPECTED = "Transmission sent an unexpected response"
const OVERSIZED = "Transmission returned an oversized response"

/**
 * A URL path replaces Transmission's default `/transmission` base, the way
 * Sonarr and Radarr treat it, so it reaches a custom rpc-url and a proxy that
 * renames the path. The base URL keeps the path either way, since it is the
 * sync store key.
 */
function rpcEndpoint(baseUrl: string, urlPath: string): string {
  return urlPath ? `${baseUrl}/rpc` : `${baseUrl}/transmission/rpc`
}

/** Blank credentials send no header, for a daemon with rpc-authentication-required off. */
function authHeaders(username: string, password: string): Record<string, string> {
  if (!username && !password) return {}
  return { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` }
}

async function postRpc(
  url: string,
  host: string,
  headers: Record<string, string>,
  body: string,
  sessionId: string | undefined,
  signal: AbortSignal | undefined
): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: sessionId ? { ...headers, "X-Transmission-Session-Id": sessionId } : headers,
      body,
      // A followed redirect would feed the parser a body from wherever the
      // Location points. Manual mode surfaces the 3xx as non-ok instead.
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
    // The hostname only. The scheduler logs this raw, and the URL path can
    // carry a proxy key.
    throw new Error(`Failed to connect to ${host}: ${describeFetchError(err)}`)
  }
}

type RpcMethod = "session-get" | "session-stats" | "torrent-get"

async function rpcCall<T>(
  baseUrl: string,
  creds: ClientCredentials,
  method: RpcMethod,
  args?: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  if (creds.authMethod === "apikey") throw new Error(API_KEY_UNSUPPORTED)
  const { username, password, urlPath } = creds

  const blockKey = blockKeyFor(baseUrl, username, password)
  const blocked = getAuthBlock(blockKey)
  if (blocked) throw new Error(blocked)

  const url = rpcEndpoint(baseUrl, urlPath)
  const host = new URL(baseUrl).hostname
  const headers = { "Content-Type": "application/json", ...authHeaders(username, password) }
  const body = JSON.stringify(args ? { method, arguments: args } : { method })

  let response = await postRpc(url, host, headers, body, sessionIds.get(baseUrl), signal)
  if (response.status === 409) {
    const fresh = response.headers.get("x-transmission-session-id")
    if (!fresh) throw new Error(SESSION_ID_MISSING)
    // Read nothing from the 409, but release its body before the replay.
    await response.body?.cancel()
    sessionIds.set(baseUrl, fresh)
    response = await postRpc(url, host, headers, body, fresh, signal)
  }

  if (response.status === 401) {
    const rejection = username || password ? CREDENTIALS_REJECTED : BLANK_CREDENTIALS_REJECTED
    setAuthBlock(blockKey, rejection)
    throw new Error(rejection)
  }
  if (response.status === 403) throw new Error(FORBIDDEN)
  if (response.status === 421) throw new Error(HOSTNAME_REFUSED)
  if (!response.ok) {
    throw new Error(`Transmission RPC error: ${response.status} ${response.statusText}`)
  }

  let payload: TransmissionRpcResponse<T> | null
  try {
    payload = await readCappedJson<TransmissionRpcResponse<T> | null>(
      response,
      host,
      TRANSMISSION_RESPONSE_MAX_BYTES
    )
  } catch (err) {
    // A proxy route answering with an HTML page is the usual cause.
    if (err instanceof SyntaxError) throw new Error(`${UNEXPECTED}: the body was not JSON`)
    // Reworded so the card names Transmission, with the host and cap kept for the log.
    if (isResponseTooLarge(err)) throw new Error(`${OVERSIZED} (${err.message})`, { cause: err })
    throw err
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${UNEXPECTED}: no RPC envelope`)
  }
  // Transmission answers a refused method with HTTP 200 and a failure string in
  // `result`. The string is host-sent, so it stays out of the message.
  if (payload.result !== "success") throw new Error(RPC_REFUSED)
  if (payload.arguments === undefined) {
    throw new Error(`${UNEXPECTED}: ${method} returned no arguments`)
  }
  return payload.arguments
}

/**
 * Every torrent with the declared field list, or with `recentlyActive` only
 * those that moved data in the last minute. torrent-get selects by id, hash or
 * recently-active, never by label, so tag filtering stays with the adapter.
 */
export async function getTorrents(
  baseUrl: string,
  creds: ClientCredentials,
  options?: { recentlyActive?: boolean; signal?: AbortSignal }
): Promise<TransmissionTorrent[]> {
  const args = await rpcCall<unknown>(
    baseUrl,
    creds,
    "torrent-get",
    {
      fields: [...TORRENT_FIELDS],
      ...(options?.recentlyActive ? { ids: "recently-active" } : {}),
    },
    options?.signal
  )
  if (!isTransmissionTorrentList(args)) {
    throw new Error(`${UNEXPECTED}: torrent-get returned no torrent list`)
  }
  // Checked per entry, like the sync store's delta path, so one bad entry is
  // dropped instead of failing the poll.
  const valid = args.torrents.filter(isTransmissionTorrent)
  if (valid.length !== args.torrents.length) {
    log.warn(
      { host: new URL(baseUrl).hostname, received: args.torrents.length, kept: valid.length },
      "transmission: dropped torrents that failed the shape check"
    )
  }
  return valid
}

export async function getSessionStats(
  baseUrl: string,
  creds: ClientCredentials
): Promise<TransmissionSessionStats> {
  const stats = await rpcCall<Partial<TransmissionSessionStats>>(baseUrl, creds, "session-stats")
  // Transmission always sends both, so a missing one is refused, never read as 0.
  if (typeof stats.uploadSpeed !== "number" || typeof stats.downloadSpeed !== "number") {
    throw new Error(`${UNEXPECTED}: session-stats had no transfer speeds`)
  }
  return { uploadSpeed: stats.uploadSpeed, downloadSpeed: stats.downloadSpeed }
}

export async function testSession(baseUrl: string, creds: ClientCredentials): Promise<void> {
  await rpcCall<unknown>(baseUrl, creds, "session-get", { fields: ["version"] })
}
