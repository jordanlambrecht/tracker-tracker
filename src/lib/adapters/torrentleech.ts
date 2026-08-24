// src/lib/adapters/torrentleech.ts
//
// Functions: parseTlCredentials, sessionKey, getTlSession, invalidateTlSession, login,
//            textAfterNode, parseTlProfile, fetchHtml, TorrentleechAdapter

import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { classifyFetchError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { parseBytes } from "@/lib/parser"
import { parseCredentialJson } from "./cookie-credentials"
import { fetchTrackerHtml } from "./html-fetch"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "./types"

// ---------------------------------------------------------------------------
// Credential handling
// ---------------------------------------------------------------------------

export interface TlCredentials {
  username: string
  password: string
}

export function parseTlCredentials(apiToken: string): TlCredentials {
  const { username, password } = parseCredentialJson(apiToken, "TorrentLeech", [
    "username",
    "password",
  ] as const)

  return { username: username.trim(), password }
}

// ---------------------------------------------------------------------------
// Login flow
// ---------------------------------------------------------------------------

/**
 * Logs in and returns the Cookie header string built from Set-Cookie response headers.
 * tunnel.ts's proxyFetch is GET-only with no body support, so login always goes
 * through a direct fetch, only the subsequent profile page fetch honors proxyAgent.
 */
// ---------------------------------------------------------------------------
// Session cache
//
// TorrentLeech has no API, so every poll would otherwise POST the user's
// password to /user/account/login/. Trackers watch login frequency, so reuse
// the session cookie across polls and only re-authenticate when it expires,
// the same approach the qBittorrent transport takes with its SID cache.
// Stored on globalThis so an HMR reload in dev doesn't orphan the cache.
// ---------------------------------------------------------------------------

const gTl = globalThis as typeof globalThis & {
  __tlSessionCache?: Map<string, string>
}
if (!gTl.__tlSessionCache) gTl.__tlSessionCache = new Map()
const tlSessionCache = gTl.__tlSessionCache

/** Cache key is scoped per site+account so multiple logins don't collide. */
function sessionKey(baseUrl: string, username: string): string {
  return `${baseUrl}|${username}`
}

async function getTlSession(baseUrl: string, username: string, password: string): Promise<string> {
  const key = sessionKey(baseUrl, username)
  const cached = tlSessionCache.get(key)
  if (cached) return cached

  const cookies = await login(baseUrl, username, password)
  tlSessionCache.set(key, cookies)
  return cookies
}

function invalidateTlSession(baseUrl: string, username: string): void {
  tlSessionCache.delete(sessionKey(baseUrl, username))
}

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const loginUrl = `${baseUrl}/user/account/login/`
  const body = new URLSearchParams({ username, password }).toString()
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  }

  let response: Response
  try {
    response = await fetch(loginUrl, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    throw classifyFetchError(err, new URL(baseUrl).hostname)
  }
  const setCookieHeaders = response.headers.getSetCookie?.() ?? []

  const cookiePairs = setCookieHeaders
    .map((raw) => raw.split(";")[0]?.trim())
    .filter((pair): pair is string => Boolean(pair))

  const cookieString = cookiePairs.join("; ")
  if (!cookieString.includes("tluid=")) {
    throw new Error("Invalid TorrentLeech credentials")
  }

  return cookieString
}

// ---------------------------------------------------------------------------
// Profile page parser
// ---------------------------------------------------------------------------

function textAfterNode(root: ParsedElement, selector: string): string {
  return root.querySelector(selector)?.textContent?.trim() ?? ""
}

export function parseTlProfile(html: string, username: string): TrackerStats {
  if (html.includes("/user/account/login")) {
    throw new Error("Session expired. TorrentLeech cookies need to be refreshed")
  }

  if (
    html.includes("<title>Just a moment...</title>") ||
    html.includes("cf_chl_opt") ||
    html.includes("challenges.cloudflare.com/turnstile")
  ) {
    throw new Error("Cloudflare challenge detected. The TorrentLeech session needs refreshing")
  }

  const doc = parseHtml(html)

  const uploadedText = textAfterNode(doc, ".profile-uploaded-details")
  const downloadedText = textAfterNode(doc, ".profile-downloaded-details")

  if (!uploadedText && !downloadedText) {
    throw new Error(
      "Could not find profile stats on TorrentLeech page. The page may not be authenticated"
    )
  }

  const uploadedBytes = uploadedText ? parseBytes(uploadedText) : 0n
  const downloadedBytes = downloadedText ? parseBytes(downloadedText) : 0n

  // Active seeding/leeching counts appear as header menu items with tooltip
  // titles ("Uploaded (Seeding)" / "Downloaded (Leeching)").
  let seedingCount = 0
  let leechingCount = 0
  for (const item of doc.querySelectorAll(".div-menu-item")) {
    const title = item.getAttribute("title") ?? ""
    const numMatch = item.textContent?.match(/[\d,]+/)
    const count = numMatch ? parseInt(numMatch[0].replace(/,/g, ""), 10) : 0
    if (/seeding/i.test(title)) seedingCount = count
    else if (/leeching/i.test(title)) leechingCount = count
  }

  // TL Points, often shown near a "TL Points:" label.
  let seedbonus = 0
  const bodyText = doc.textContent ?? ""
  const pointsMatch = bodyText.match(/TL Points:\s*([\d,.]+)/i)
  if (pointsMatch) seedbonus = parseFloat(pointsMatch[1].replace(/,/g, ""))

  // Class badge, if present in a profile field/label pair.
  let group = "User"
  const classMatch = bodyText.match(/Class:?\s*\n?\s*([A-Za-z][A-Za-z ]*)/)
  if (classMatch) group = classMatch[1].trim()

  return {
    username,
    group,
    uploadedBytes,
    downloadedBytes,
    // Derived from byte totals, not the page's ratio cell. TorrentLeech
    // renders "∞" there for a zero-download account and parseFloat turns that
    // into 0.
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount,
    leechingCount,
    seedbonus,
    hitAndRuns: null,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
  }
}

// ---------------------------------------------------------------------------
// HTML fetcher, direct fetch or proxy
// ---------------------------------------------------------------------------

/**
 * No User-Agent is sent: the session cookie comes from our own login POST, not
 * from a browser, so claiming a browser UA would be inconsistent with it.
 */
function fetchHtml(
  url: string,
  cookies: string,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  return fetchTrackerHtml({
    url,
    cookies,
    proxyAgent,
    label: "TorrentLeech",
    sessionExpiredMessage: "Session expired. TorrentLeech cookies need to be refreshed",
  })
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

export class TorrentleechAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseTlCredentials(apiToken)
    const profileUrl = `${baseUrl}/profile/${encodeURIComponent(creds.username)}`

    let cookies = await getTlSession(baseUrl, creds.username, creds.password)
    let html: string
    try {
      html = await fetchHtml(profileUrl, cookies, options?.proxyAgent)
    } catch (err) {
      // A cached session that has expired server-side surfaces as a redirect to
      // the login page. Drop it and authenticate once more before giving up.
      if (!(err instanceof Error) || !err.message.startsWith("Session expired")) throw err
      invalidateTlSession(baseUrl, creds.username)
      cookies = await getTlSession(baseUrl, creds.username, creds.password)
      html = await fetchHtml(profileUrl, cookies, options?.proxyAgent)
    }
    return parseTlProfile(html, creds.username)
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const calls: DebugApiCall[] = []
    const creds = parseTlCredentials(apiToken)
    const endpoint = `/profile/${creds.username}`

    try {
      const cookies = await getTlSession(baseUrl, creds.username, creds.password)
      const profileUrl = `${baseUrl}${endpoint}`
      const html = await fetchHtml(profileUrl, cookies, options?.proxyAgent)
      const stats = parseTlProfile(html, creds.username)
      calls.push({ label: "Profile Page", endpoint, data: stats, error: null })
    } catch (err) {
      calls.push({
        label: "Profile Page",
        endpoint,
        data: null,
        error: err instanceof Error ? err.message : "Request failed",
      })
    }

    return calls
  }
}
