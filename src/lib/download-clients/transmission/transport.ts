// src/lib/download-clients/transmission/transport.ts
//
// Available functions:
//   rpcPath                    - Compose the RPC endpoint URL from a base URL
//   invalidateSessionId        - Drop a cached CSRF session id (i.e. on 409)
//   clearAllTransmissionSessions - Drop every cached session id (called on logout)
//   rpcCall                    - Issue one RPC method, handling the 409 handshake
//   getTorrents                - torrent-get for the declared field list
//   getSessionStats            - session-stats (global transfer speeds)
//   testSession                - session-get, used purely to prove reachability

import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { resetStore } from "../sync-store"
import type { ClientCredentials } from "../types"
import {
  isTransmissionTorrentList,
  TORRENT_FIELDS,
  type TransmissionRpcResponse,
  type TransmissionSessionStats,
  type TransmissionTorrent,
} from "./types"

/**
 * Transmission serves its whole RPC surface from one path. `/transmission/rpc`
 * is the default and the only value the WebUI ships with; a user who has
 * changed `rpc-url` in settings.json will need that reflected here, which is
 * why it is a named constant rather than inlined.
 */
const RPC_PATH = "/transmission/rpc"

export function rpcPath(baseUrl: string): string {
  return `${baseUrl}${RPC_PATH}`
}

// ---------------------------------------------------------------------------
// CSRF session id cache.
//
// Transmission answers any RPC request lacking a valid X-Transmission-Session-Id
// with 409 and the correct id in that same response header. The id is a CSRF
// token, not an authenticator: it is handed out freely, rotates when the daemon
// restarts, and carries no credential. Caching it per baseUrl turns the
// handshake into a once-per-process cost instead of doubling every poll.
//
// Deliberately NOT paired with an auth-failure circuit breaker like the
// qBittorrent transport's. That breaker exists because qBittorrent bans the
// calling IP after MaxAuthenticationFailCount failed logins, so retrying bad
// credentials locks the user out for an hour. Transmission has no such counter
// — a wrong password is answered with a plain 401 every time, indefinitely and
// harmlessly — so a breaker here would add a global cache and a stale-state
// failure mode to defend against a ban that cannot happen.
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

export function clearAllTransmissionSessions(): void {
  sessionIds.clear()
}

const CREDENTIALS_REJECTED =
  "Authentication failed — Transmission rejected the username and password"
const API_KEY_UNSUPPORTED =
  "Transmission has no API-key authentication. Set this client to username and password " +
  "(leave both blank if rpc-authentication-required is false)"

/**
 * Basic auth header, or nothing at all.
 *
 * Transmission with `rpc-authentication-required: false` accepts unauthenticated
 * requests, which is the common setup behind a reverse proxy or on a private
 * network. Sending `Authorization: Basic OjA=` in that case is harmless but
 * noisy in the daemon log, so blank credentials send no header.
 */
function authHeaders(creds: ClientCredentials): Record<string, string> {
  if (creds.authMethod === "apikey") {
    // Unreachable via the UI, which offers password auth only for this client
    // type — but the credential union permits it, so it fails loudly rather
    // than silently authenticating as nobody.
    throw new Error(API_KEY_UNSUPPORTED)
  }
  const { username, password } = creds
  if (!username && !password) return {}
  const encoded = Buffer.from(`${username}:${password}`).toString("base64")
  return { Authorization: `Basic ${encoded}` }
}

// Extract a useful detail string from a fetch rejection. Node's fetch wraps
// every network fault in a TypeError and puts the real cause underneath.
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

async function postRpc(
  url: string,
  host: string,
  creds: ClientCredentials,
  body: string,
  sessionId: string | undefined
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeaders(creds),
  }
  if (sessionId) headers["X-Transmission-Session-Id"] = sessionId

  try {
    return await fetch(url, {
      method: "POST",
      headers,
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
    throw new Error(`Failed to connect to ${url}: ${describeFetchError(err)}`)
  }
}

/**
 * Issue one RPC method and return its `arguments` payload.
 *
 * The 409 handshake is handled here and nowhere else: a request that comes back
 * 409 carries the correct session id in its response header, so it is cached and
 * the request replayed exactly once. A second 409 is a real failure rather than
 * a rotation, so it propagates.
 */
export async function rpcCall<T>(
  baseUrl: string,
  creds: ClientCredentials,
  method: string,
  args?: Record<string, unknown>
): Promise<T> {
  const url = rpcPath(baseUrl)
  const host = new URL(baseUrl).hostname
  const body = JSON.stringify(args ? { method, arguments: args } : { method })

  let response = await postRpc(url, host, creds, body, sessionIds.get(baseUrl))

  if (response.status === 409) {
    const fresh = response.headers.get("x-transmission-session-id")
    if (!fresh) {
      throw new Error("Transmission returned 409 without an X-Transmission-Session-Id header")
    }
    sessionIds.set(baseUrl, fresh)
    response = await postRpc(url, host, creds, body, fresh)
  }

  if (response.status === 401) {
    throw new Error(CREDENTIALS_REJECTED)
  }
  if (!response.ok) {
    throw new Error(`Transmission RPC error: ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as TransmissionRpcResponse<T>
  // Transmission answers a malformed or refused method with HTTP 200 and a
  // failure string in `result`, so the status code alone proves nothing.
  if (payload.result !== "success") {
    throw new Error(`Transmission RPC error: ${payload.result || "unknown error"}`)
  }
  if (payload.arguments === undefined) {
    throw new Error(`Transmission RPC error: ${method} returned no arguments`)
  }
  return payload.arguments
}

/**
 * Every torrent, with the declared field list.
 *
 * Deliberately unfiltered: Transmission's `ids` argument selects by id or hash,
 * not by label or activity, so tag and activity filtering happens in the adapter
 * against the mapped records. One `torrent-get` for several hundred torrents measures well
 * under the fetch timeout, and asking once is cheaper than the per-tag fan-out
 * the qBittorrent path needs.
 */
export async function getTorrents(
  baseUrl: string,
  creds: ClientCredentials
): Promise<TransmissionTorrent[]> {
  const args = await rpcCall<unknown>(baseUrl, creds, "torrent-get", {
    fields: [...TORRENT_FIELDS],
  })
  if (!isTransmissionTorrentList(args)) {
    throw new Error("Invalid torrent-get response from Transmission")
  }
  return args.torrents as TransmissionTorrent[]
}

export async function getSessionStats(
  baseUrl: string,
  creds: ClientCredentials
): Promise<TransmissionSessionStats> {
  const stats = await rpcCall<Partial<TransmissionSessionStats>>(
    baseUrl,
    creds,
    "session-stats"
  )
  return {
    uploadSpeed: stats.uploadSpeed ?? 0,
    downloadSpeed: stats.downloadSpeed ?? 0,
  }
}

/** Prove the daemon is reachable and the credentials are accepted. */
export async function testSession(baseUrl: string, creds: ClientCredentials): Promise<void> {
  await rpcCall<unknown>(baseUrl, creds, "session-get", { fields: ["version", "rpc-version"] })
}
