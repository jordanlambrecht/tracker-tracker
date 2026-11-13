// src/lib/download-clients/rtorrent/transport.ts
//
// Available functions:
//   clearClient      - Drop the client's sync store
//   testClient       - system.client_version, used to prove reachability and credentials
//   getTransferStats - Global upload and download rates in one system.multicall
//   getTorrents      - Every private torrent with its trackers, in two calls

import { RTORRENT_RESPONSE_MAX_BYTES, RTORRENT_RPC_TIMEOUT_MS } from "@/lib/limits"
import { log } from "@/lib/logger"
import { assertOutboundAllowed } from "@/lib/network"
import { resetStore } from "../sync-store"
import {
  blockKeyFor,
  describeFetchError,
  fetchSignal,
  getAuthBlock,
  isResponseTooLarge,
  readCappedText,
  setAuthBlock,
} from "../transport"
import type { ClientCredentials, TransferStats } from "../types"
import {
  RTORRENT_FIELDS,
  type RtorrentTorrent,
  type RtorrentTracker,
  rowToTorrent,
  rowToTracker,
  TRACKER_FIELDS,
} from "./types"
import { decodeMethodResponse, encodeMethodCall, XmlRpcFault, type XmlRpcValue } from "./xmlrpc"

// ---------------------------------------------------------------------------
// Auth-failure breaker.
//
// rTorrent has no auth of its own: the web server in front of its XML-RPC
// does, and on a seedbox that is often the account's login, where repeated
// failures can lock the account. A 401 is latched like Transmission's, keyed
// by baseUrl and the saved credential, and cleared on Test Connection and
// dispose. A 403 is the server's access rules, so it is never latched.
// ---------------------------------------------------------------------------

const CREDENTIALS_REJECTED = "Authentication failed. rTorrent rejected the username and password"
const BLANK_CREDENTIALS_REJECTED =
  "Authentication failed. rTorrent requires a username and password"
const API_KEY_UNSUPPORTED =
  "rTorrent has no API-key authentication. Set this client to username and password"
const FORBIDDEN = "rTorrent refused the request"
const UNEXPECTED = "rTorrent sent an unexpected response"
const OVERSIZED = "rTorrent returned an oversized response"
const FAULT = "rTorrent refused the XML-RPC call"

/**
 * ruTorrent and rflood serve XML-RPC at /RPC2. A URL path replaces it, for
 * a seedbox's /xmlrpc or any other mount, and is already part of the base URL.
 */
function rpcEndpoint(baseUrl: string, urlPath: string): string {
  return urlPath ? baseUrl : `${baseUrl}/RPC2`
}

/** Blank credentials send no header, for an endpoint with no auth in front of it. */
function authHeaders(username: string, password: string): Record<string, string> {
  if (!username && !password) return {}
  return { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` }
}

export function clearClient(baseUrl: string): void {
  resetStore(baseUrl)
}

async function post(
  url: string,
  host: string,
  headers: Record<string, string>,
  body: string,
  signal: AbortSignal | undefined
): Promise<Response> {
  assertOutboundAllowed()
  try {
    return await fetch(url, {
      method: "POST",
      headers,
      body,
      // A followed redirect would feed the parser a body from wherever the
      // Location points. Manual mode surfaces the 3xx as non-ok instead.
      redirect: "manual",
      signal: fetchSignal(signal, RTORRENT_RPC_TIMEOUT_MS),
    })
  } catch (err) {
    const errName =
      err !== null && typeof err === "object" && "name" in (err as object)
        ? String((err as { name: unknown }).name)
        : ""
    if (errName === "TimeoutError" || errName === "AbortError") {
      throw new Error(`Request to ${host} timed out after ${RTORRENT_RPC_TIMEOUT_MS / 1000}s`)
    }
    // The hostname only. The scheduler logs this raw, and the URL path can
    // carry a proxy key.
    throw new Error(`Failed to connect to ${host}: ${describeFetchError(err)}`)
  }
}

async function call(
  baseUrl: string,
  creds: ClientCredentials,
  method: string,
  params: XmlRpcValue[],
  signal?: AbortSignal
): Promise<XmlRpcValue> {
  if (creds.authMethod === "apikey") throw new Error(API_KEY_UNSUPPORTED)
  const { username, password, urlPath } = creds

  const blockKey = blockKeyFor(baseUrl, creds.credentialKey)
  const blocked = getAuthBlock(blockKey)
  if (blocked) throw new Error(blocked)

  const host = new URL(baseUrl).hostname
  const headers = { "Content-Type": "text/xml", ...authHeaders(username, password) }
  const response = await post(
    rpcEndpoint(baseUrl, urlPath),
    host,
    headers,
    encodeMethodCall(method, params),
    signal
  )

  if (response.status === 401) {
    const rejection = username || password ? CREDENTIALS_REJECTED : BLANK_CREDENTIALS_REJECTED
    setAuthBlock(blockKey, rejection)
    throw new Error(rejection)
  }
  if (response.status === 403) throw new Error(FORBIDDEN)
  if (!response.ok) {
    throw new Error(`rTorrent XML-RPC error: ${response.status} ${response.statusText}`)
  }

  let text: string
  try {
    text = await readCappedText(response, host, RTORRENT_RESPONSE_MAX_BYTES)
  } catch (err) {
    // Reworded so the card names rTorrent, with the host and cap kept for the log.
    if (isResponseTooLarge(err)) throw new Error(`${OVERSIZED} (${err.message})`, { cause: err })
    throw err
  }

  try {
    return decodeMethodResponse(text)
  } catch (err) {
    if (err instanceof XmlRpcFault) throw new Error(`${FAULT} (code ${err.faultCode})`)
    // A proxy's login or error page is the usual cause.
    if (err instanceof SyntaxError) throw new Error(`${UNEXPECTED}: the body was not XML-RPC`)
    throw err
  }
}

/**
 * The value of one system.multicall entry, or undefined when that entry
 * faulted. A success arrives wrapped in a one-element array.
 */
function multicallResult(entry: XmlRpcValue | undefined): XmlRpcValue | undefined {
  return Array.isArray(entry) && entry.length === 1 ? entry[0] : undefined
}

export async function testClient(baseUrl: string, creds: ClientCredentials): Promise<void> {
  const version = await call(baseUrl, creds, "system.client_version", [])
  if (typeof version !== "string") {
    throw new Error(`${UNEXPECTED}: system.client_version returned no version`)
  }
}

export async function getTransferStats(
  baseUrl: string,
  creds: ClientCredentials
): Promise<TransferStats> {
  const result = await call(baseUrl, creds, "system.multicall", [
    [
      { methodName: "throttle.global_up.rate", params: [""] },
      { methodName: "throttle.global_down.rate", params: [""] },
    ],
  ])
  const entries = Array.isArray(result) ? result : []
  const up = multicallResult(entries[0])
  const down = multicallResult(entries[1])
  if (typeof up !== "number" || typeof down !== "number") {
    throw new Error(`${UNEXPECTED}: the throttle rates were not numbers`)
  }
  return { uploadSpeed: up, downloadSpeed: down }
}

/**
 * Every private torrent in the main view, with its trackers. d.multicall2
 * cannot select by flag, so the private check runs here, and the trackers of
 * only the private ones are read in one system.multicall. A sub-call that
 * faulted, such as for a torrent removed between the two calls, leaves that
 * torrent with no trackers instead of failing the poll.
 *
 * Public torrents never reach the store, as with Transmission.
 */
export async function getTorrents(
  baseUrl: string,
  creds: ClientCredentials,
  options?: { signal?: AbortSignal }
): Promise<RtorrentTorrent[]> {
  const rows = await call(
    baseUrl,
    creds,
    "d.multicall2",
    ["", "main", ...RTORRENT_FIELDS],
    options?.signal
  )
  if (!Array.isArray(rows)) throw new Error(`${UNEXPECTED}: d.multicall2 returned no list`)

  const parsed = rows.map(rowToTorrent)
  const valid = parsed.filter((t): t is RtorrentTorrent => t !== null)
  if (valid.length !== rows.length) {
    log.warn(
      { host: new URL(baseUrl).hostname, received: rows.length, kept: valid.length },
      "rtorrent: dropped torrents that failed the shape check"
    )
  }
  const torrents = valid.filter((t) => t.isPrivate)
  if (torrents.length === 0) return []

  const result = await call(
    baseUrl,
    creds,
    "system.multicall",
    [
      torrents.map((t) => ({
        methodName: "t.multicall",
        params: [t.hash, "", ...TRACKER_FIELDS],
      })),
    ],
    options?.signal
  )
  const entries = Array.isArray(result) ? result : []
  for (const [i, torrent] of torrents.entries()) {
    const trackerRows = multicallResult(entries[i])
    torrent.trackers = Array.isArray(trackerRows)
      ? trackerRows.map(rowToTracker).filter((t): t is RtorrentTracker => t !== null)
      : []
  }
  return torrents
}
