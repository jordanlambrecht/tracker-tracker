// src/lib/tracker-platforms/helpers/html-fetch.ts
//
// Functions: buildHtmlHeaders, isCloudflareChallenge, fetchFailure, getHtmlViaProxy, getHtml,
//            followRedirectChain, fetchViaSolver, fetchTrackerHtml

import { classifyFetchError, classifyProxyFetchError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { isRedirect } from "@/lib/network"
import type { FetchOptions, FlareSolverrConfig } from "../contract"
import { SessionExpiredError } from "./errors"
import { cookieHeaderToSolverCookies, solverGet, solverPostForm } from "./flaresolverr"

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
  /** Tracker display name, used in the redirect error messages. */
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
  /** A form POST instead of a GET. Redirects after it are followed with GETs. */
  form?: Record<string, string>
  /**
   * Read the page through FlareSolverr instead. Its browser sends its own
   * User-Agent, so `userAgent` and `proxyAgent` are not used.
   */
  flaresolverr?: { config: FlareSolverrConfig; session?: string }
}

/** What a request sends beyond its headers. */
interface RequestBody {
  method: "GET" | "POST"
  body?: string
}

const GET: RequestBody = { method: "GET" }

function buildHtmlHeaders(cookies: string, userAgent?: string): Record<string, string> {
  return {
    Cookie: cookies,
    Accept: ACCEPT_HTML,
    "Accept-Language": "en-US,en;q=0.9",
    ...(userAgent ? { "User-Agent": userAgent, ...NAVIGATION_HEADERS } : {}),
  }
}

/** Cloudflare's interstitial, served in place of the page while a challenge is pending. */
export function isCloudflareChallenge(html: string): boolean {
  return html.includes("<title>Just a moment...</title>") || html.includes("cf_chl_opt")
}

/**
 * Same wording adapterFetch throws, which sanitizeNetworkError matches on. The
 * scheduler and the connection test sanitize it once, and sanitizing it here as
 * well would turn "Authentication failed" and "API returned N" into "Poll
 * failed".
 */
function fetchFailure(status: number, statusText: string): Error {
  return new Error(`Tracker API error: ${status} ${statusText}`.trimEnd())
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
  proxyAgent: NonNullable<FetchOptions["proxyAgent"]>,
  request: RequestBody
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
      ...request,
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

async function getHtml(
  url: string,
  headers: Record<string, string>,
  request: RequestBody
): Promise<HtmlResponse> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    redirect: "manual",
    ...request,
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
 * The request through FlareSolverr. The browser follows redirects itself, so a
 * redirect is visible only in the final URL.
 */
async function fetchViaSolver(
  request: TrackerHtmlRequest,
  solver: NonNullable<TrackerHtmlRequest["flaresolverr"]>
): Promise<string> {
  const { url, cookies, label, sessionExpiredMessage, followRedirects, form } = request
  const { config, session } = solver
  const result = form
    ? await solverPostForm(config, url, form, { session })
    : await solverGet(config, url, { session, cookies: cookieHeaderToSolverCookies(cookies) })

  const requested = new URL(url)
  let landed: URL
  try {
    landed = new URL(result.url)
  } catch {
    landed = requested
  }
  if (landed.origin !== requested.origin) throw new Error(`${label} redirected off-site`)
  const target = landed.pathname + landed.search
  if (target !== requested.pathname + requested.search) {
    if (!followRedirects || followRedirects.loginPattern.test(target)) {
      throw new SessionExpiredError(sessionExpiredMessage)
    }
  }
  if (isCloudflareChallenge(result.html)) {
    throw new Error(
      `Cloudflare challenge detected. It was not solved through FlareSolverr for ${label}`
    )
  }
  if (result.status >= 400) throw fetchFailure(result.status, "")
  return result.html
}

/**
 * Fetches an authenticated HTML page, honoring the user's proxy or FlareSolverr
 * when one is configured. No error it throws names the URL, so a token carried in one never
 * reaches a log or an API response.
 */
export async function fetchTrackerHtml(request: TrackerHtmlRequest): Promise<string> {
  const {
    url,
    cookies,
    label,
    sessionExpiredMessage,
    userAgent,
    proxyAgent,
    followRedirects,
    form,
    flaresolverr,
  } = request
  if (flaresolverr) return fetchViaSolver(request, flaresolverr)

  const headers = buildHtmlHeaders(cookies, userAgent)
  const first: RequestBody = form
    ? { method: "POST", body: new URLSearchParams(form).toString() }
    : GET
  const firstHeaders = form
    ? { ...headers, "Content-Type": "application/x-www-form-urlencoded" }
    : headers

  const send = (target: string, body: RequestBody, sent: Record<string, string>) =>
    proxyAgent ? getHtmlViaProxy(target, sent, proxyAgent, body) : getHtml(target, sent, body)
  const fetcher: HtmlFetcher = (target) => send(target, GET, headers)

  let response = await send(url, first, firstHeaders)

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
    // Cloudflare returns 403 or 503 with its challenge page. Reported as a plain
    // 403, it would be shown as rejected credentials.
    if (response.status === 403 || response.status === 503) {
      let body = ""
      try {
        body = await response.text()
      } catch {
        // An unreadable body is reported by its status alone.
      }
      if (isCloudflareChallenge(body)) {
        throw new Error(`Cloudflare challenge detected. ${label} cookies need refreshing`)
      }
    }
    throw fetchFailure(response.status, response.statusText)
  }

  return response.text()
}
