// src/lib/adapters/html-fetch.ts
//
// Functions: buildHtmlHeaders, fetchViaProxy, followRedirectChain, fetchTrackerHtml

import { classifyFetchError, sanitizeNetworkError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import type { FetchOptions } from "./types"

// ---------------------------------------------------------------------------
// Shared HTML fetcher for the scraping adapters.
//
// adapterFetch handles JSON APIs; trackers without an API are read by fetching
// an authenticated page and parsing the DOM. Those adapters previously carried
// a near-identical fetchHtml each, so a change to the header set or the error
// shape had to be made in three places.
// ---------------------------------------------------------------------------

/**
 * Headers a browser sends on a top-level navigation. Only coherent alongside a
 * real browser User-Agent, so adapters authenticating with cookies copied from
 * DevTools send them while adapters using a server-issued session do not.
 */
const NAVIGATION_HEADERS: Record<string, string> = {
  DNT: "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  Connection: "keep-alive",
}

const ACCEPT_HTML = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"

export interface TrackerHtmlRequest {
  url: string
  cookies: string
  /** Tracker display name, used in sanitized error messages. */
  label: string
  /** Thrown when an authenticated request is bounced to a login page. */
  sessionExpiredMessage: string
  /** Copied browser User-Agent. When set, navigation headers are sent too. */
  userAgent?: string
  proxyAgent?: FetchOptions["proxyAgent"]
  /**
   * When set, 301/302 responses are followed rather than treated as an expired
   * session — unless the Location matches loginPattern.
   */
  followRedirects?: { loginPattern: RegExp; maxHops?: number }
}

function buildHtmlHeaders(cookies: string, userAgent?: string): Record<string, string> {
  return {
    Cookie: cookies,
    Accept: ACCEPT_HTML,
    "Accept-Language": "en-US,en;q=0.9",
    ...(userAgent ? { "User-Agent": userAgent, ...NAVIGATION_HEADERS } : {}),
  }
}

function fetchFailure(label: string, status: number, statusText: string): Error {
  return new Error(
    sanitizeNetworkError(`${status} ${statusText}`, `${label} page fetch failed: ${status}`)
  )
}

async function fetchViaProxy(
  url: string,
  headers: Record<string, string>,
  proxyAgent: NonNullable<FetchOptions["proxyAgent"]>,
  label: string
): Promise<string> {
  const { proxyFetch } = await import("@/lib/tunnel")
  const result = await proxyFetch(url, proxyAgent, { headers })
  if (!result.ok) throw fetchFailure(label, result.status, result.statusText)
  return (await result.buffer()).toString("utf8")
}

function getHtml(url: string, headers: Record<string, string>): Promise<Response> {
  return fetch(url, {
    headers,
    signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    redirect: "manual",
  }).catch((err) => {
    throw classifyFetchError(err, new URL(url).hostname)
  })
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302
}

/**
 * Walks a redirect chain by hand (redirect: "manual") so a bounce to the login
 * page can be distinguished from an ordinary relocation such as / -> /t.
 */
async function followRedirectChain(
  response: Response,
  fromUrl: string,
  headers: Record<string, string>,
  { loginPattern, maxHops = 3 }: NonNullable<TrackerHtmlRequest["followRedirects"]>,
  sessionExpiredMessage: string,
  label: string
): Promise<Response> {
  let current = response
  let currentUrl = fromUrl

  for (let hop = 0; hop <= maxHops; hop++) {
    if (!isRedirect(current.status)) return current

    const location = current.headers.get("location") ?? ""
    if (loginPattern.test(location)) throw new Error(sessionExpiredMessage)
    // A redirect with no Location is malformed and cannot be followed.
    if (!location || hop === maxHops) break

    currentUrl = new URL(location, currentUrl).href
    current = await getHtml(currentUrl, headers)
  }

  throw new Error(`Too many redirects from ${label}`)
}

/**
 * Fetches an authenticated HTML page, honoring the user's proxy when one is
 * configured. Errors are sanitized so a URL carrying a token never reaches a
 * log or an API response.
 */
export async function fetchTrackerHtml(request: TrackerHtmlRequest): Promise<string> {
  const { url, cookies, label, sessionExpiredMessage, userAgent, proxyAgent, followRedirects } =
    request
  const headers = buildHtmlHeaders(cookies, userAgent)

  if (proxyAgent) return fetchViaProxy(url, headers, proxyAgent, label)

  let response = await getHtml(url, headers)

  if (followRedirects) {
    response = await followRedirectChain(
      response,
      url,
      headers,
      followRedirects,
      sessionExpiredMessage,
      label
    )
  } else if (response.status === 302) {
    throw new Error(sessionExpiredMessage)
  }

  if (!response.ok) throw fetchFailure(label, response.status, response.statusText)

  return response.text()
}
