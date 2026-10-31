// src/lib/tracker-platforms/helpers/html-fetch.ts
//
// Functions: buildHtmlHeaders, fetchFailure, failureBody, getHtmlViaProxy, getHtml,
//            followRedirectChain, fetchTrackerHtml

import { classifyFetchError, classifyProxyFetchError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { isRedirect } from "@/lib/network"
import { withDefaultUserAgent } from "@/lib/user-agent"
import type { FetchOptions } from "../contract"
import { SessionExpiredError } from "./errors"
import { isCloudflareChallenge } from "./html-parse"

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
  /** Tracker display name, used in error messages. */
  label: string
  /** Thrown when an authenticated request is bounced to a login page. */
  sessionExpiredMessage: string
  /**
   * The browser User-Agent a copied session was issued to, sent with the
   * navigation headers. Omitted for a session the app logged in for itself,
   * which sends the app User-Agent and no navigation headers.
   */
  userAgent?: string
  proxyAgent?: FetchOptions["proxyAgent"]
  /**
   * When set, redirects are followed rather than treated as an expired session.
   * Does not follow if the Location matches loginPattern.
   */
  followRedirects?: { loginPattern: RegExp; maxHops?: number }
}

function buildHtmlHeaders(cookies: string, userAgent?: string): Record<string, string> {
  const headers = { Cookie: cookies, Accept: ACCEPT_HTML, "Accept-Language": "en-US,en;q=0.9" }
  return userAgent
    ? { ...headers, "User-Agent": userAgent, ...NAVIGATION_HEADERS }
    : withDefaultUserAgent(headers)
}

/**
 * Same wording adapterFetch throws, which sanitizeNetworkError matches on. The
 * scheduler and the connection test sanitize it once, and sanitizing it here as
 * well would turn "Authentication failed" and "API returned N" into "Poll
 * failed".
 */
function fetchFailure(status: number, statusText: string): Error {
  return new Error(`Tracker API error: ${status} ${statusText}`)
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

/**
 * A failed response's body, or "" when it cannot be read, so the error falls
 * back to the status.
 */
async function failureBody(response: HtmlResponse): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ""
  }
}

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
    throw classifyProxyFetchError(err, hostname)
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
    // A redirect with no Location is malformed and cannot be followed. It is not
    // a loop, so it must not read as one on the card.
    if (!location) {
      throw new Error(
        `Unexpected response from ${new URL(fromUrl).hostname}: redirect with no Location`
      )
    }
    if (hop === maxHops) break

    // new URL's own error says "Invalid URL", which the sanitizer would read as
    // bad credentials.
    let nextUrl: URL
    try {
      nextUrl = new URL(location, currentUrl)
    } catch {
      throw new Error(
        `Unexpected response from ${new URL(fromUrl).hostname}: redirect to an unreadable Location`
      )
    }
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
 * configured. No error it throws names the URL, so a token carried in one never
 * reaches a log or an API response.
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

  if (!response.ok) {
    // Cloudflare serves its challenge with a 403 or a 503. Read by its status
    // alone, the 403 would show as rejected credentials.
    if (
      (response.status === 403 || response.status === 503) &&
      isCloudflareChallenge(await failureBody(response))
    ) {
      throw new Error(`Cloudflare challenge detected on ${label}`)
    }
    throw fetchFailure(response.status, response.statusText)
  }

  return response.text()
}
