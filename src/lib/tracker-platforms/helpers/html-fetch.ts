// src/lib/tracker-platforms/helpers/html-fetch.ts
//
// Functions: buildHtmlHeaders, fetchFailure, getHtmlViaProxy, getHtml, isRedirect,
//            followRedirectChain, fetchTrackerHtml

import { classifyFetchError, sanitizeNetworkError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import type { FetchOptions } from "../contract"
import { SessionExpiredError } from "./errors"

// ---------------------------------------------------------------------------
// Shared HTML fetcher for the scraping adapters.
//
// adapterFetch handles JSON APIs; trackers without an API are read by fetching
// an authenticated page and parsing the DOM.
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
   * When set, redirects are followed rather than treated as an expired session.
   * Does not follow if the Location matches loginPattern.
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

/**
 * The proxied and direct transports narrowed to one shape, so the redirect
 * handling below runs on both.
 */
interface HtmlResponse {
  ok: boolean
  status: number
  statusText: string
  /** Lazy: only the redirect chain needs it, and only a 3xx carries one. */
  location: () => string
  text: () => Promise<string>
}

type HtmlFetcher = (url: string) => Promise<HtmlResponse>

async function getHtmlViaProxy(
  url: string,
  headers: Record<string, string>,
  proxyAgent: NonNullable<FetchOptions["proxyAgent"]>
): Promise<HtmlResponse> {
  const { proxyFetch } = await import("@/lib/tunnel")
  // Passed rather than inherited. tunnel.ts defaults to 15000, which happens to
  // equal ADAPTER_FETCH_TIMEOUT_MS today, so the direct and proxied paths would
  // drift apart silently the moment either number changed.
  const hostname = new URL(url).hostname
  let result: Awaited<ReturnType<typeof proxyFetch>>
  try {
    result = await proxyFetch(url, proxyAgent, {
      headers,
      timeoutMs: ADAPTER_FETCH_TIMEOUT_MS,
    })
  } catch (err) {
    // Worded exactly as adapter-fetch words it, so one sanitizer rule covers
    // both transports instead of the HTML one falling through to "Poll failed".
    if (err instanceof Error && err.message.includes("timed out")) {
      throw new Error(`Request to ${hostname} timed out (via proxy)`)
    }
    const detail = err instanceof Error ? err.message : "Unknown"
    throw new Error(`Failed to connect to ${hostname} via proxy: ${detail}`)
  }
  return {
    ok: result.ok,
    status: result.status,
    statusText: result.statusText,
    location: () => {
      // Node lowercases incoming header names, and a repeated header arrives
      // as an array.
      const raw = result.headers.location
      return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "")
    },
    text: async () => (await result.buffer()).toString("utf8"),
  }
}

async function getHtml(url: string, headers: Record<string, string>): Promise<HtmlResponse> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    redirect: "manual",
  }).catch((err) => {
    throw classifyFetchError(err, new URL(url).hostname)
  })
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    location: () => response.headers.get("location") ?? "",
    text: () => response.text(),
  }
}

/**
 * Every status that carries a Location, not just the two most common. A status
 * missing from this set is returned to the caller as though it were the final
 * response, which means it never reaches the same-origin check below, so
 * narrowing this set silently narrows that guard too.
 */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

function isRedirect(status: number): boolean {
  return REDIRECT_STATUSES.has(status)
}

/**
 * Walks a redirect chain by hand (redirect: "manual") so a bounce to the login
 * page can be distinguished from an ordinary relocation such as / -> /t.
 */
async function followRedirectChain(
  response: HtmlResponse,
  fromUrl: string,
  fetcher: HtmlFetcher,
  { loginPattern, maxHops = 3 }: NonNullable<TrackerHtmlRequest["followRedirects"]>,
  sessionExpiredMessage: string,
  label: string
): Promise<HtmlResponse> {
  let current = response
  let currentUrl = fromUrl
  const origin = new URL(fromUrl).origin

  for (let hop = 0; hop <= maxHops; hop++) {
    if (!isRedirect(current.status)) return current

    const location = current.location()
    if (loginPattern.test(location)) throw new SessionExpiredError(sessionExpiredMessage)
    // A redirect with no Location is malformed and cannot be followed.
    if (!location || hop === maxHops) break

    const nextUrl = new URL(location, currentUrl)
    // `headers` carries the user's tracker session cookie. Location is chosen by
    // the remote host, so following it blindly would replay that cookie wherever
    // the response points. A hostile or compromised tracker could harvest the
    // session with a single 302. Refuse to leave the origin rather than stripping
    // credentials and continuing: these adapters read an authenticated page from a
    // known host, so an off-origin hop is never legitimate, and an anonymous
    // request would return an unparseable page anyway. This also blocks a redirect
    // to a private address, which is likewise a different origin.
    if (nextUrl.origin !== origin) {
      throw new Error(`${label} redirected off-site; refusing to send credentials`)
    }

    currentUrl = nextUrl.href
    current = await fetcher(currentUrl)
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

  const fetcher: HtmlFetcher = proxyAgent
    ? (target) => getHtmlViaProxy(target, headers, proxyAgent)
    : (target) => getHtml(target, headers)

  let response = await fetcher(url)

  if (followRedirects) {
    response = await followRedirectChain(
      response,
      url,
      fetcher,
      followRedirects,
      sessionExpiredMessage,
      label
    )
  } else if (isRedirect(response.status)) {
    throw new SessionExpiredError(sessionExpiredMessage)
  }

  if (!response.ok) throw fetchFailure(label, response.status, response.statusText)

  return response.text()
}
