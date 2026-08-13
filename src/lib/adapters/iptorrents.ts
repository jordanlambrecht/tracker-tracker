// src/lib/adapters/iptorrents.ts
//
// Functions: parseIptCredentials, tryParseBytes, parseIptProfile, fetchHtml, IptorrentsAdapter

import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { computeBufferBytes } from "@/lib/data-transforms"
import { classifyFetchError, sanitizeNetworkError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { parseBytes } from "@/lib/parser"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "./types"

// ---------------------------------------------------------------------------
// Credential handling
// ---------------------------------------------------------------------------

export interface IptCredentials {
  cookies: string
  userAgent: string
}

export function parseIptCredentials(apiToken: string): IptCredentials {
  let parsed: unknown
  try {
    parsed = JSON.parse(apiToken)
  } catch {
    throw new Error("IPTorrents credentials must be a JSON object with cookies and userAgent")
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).cookies !== "string" ||
    typeof (parsed as Record<string, unknown>).userAgent !== "string"
  ) {
    throw new Error(
      "IPTorrents credentials must contain cookies (string) and userAgent (string)"
    )
  }

  const { cookies, userAgent } = parsed as Record<string, string>
  if (!cookies.trim()) throw new Error("IPTorrents credentials: cookies cannot be empty")
  if (!userAgent.trim()) throw new Error("IPTorrents credentials: userAgent cannot be empty")

  // Strip "Cookie: " prefix if user copied from raw headers view
  const trimmedCookies = cookies.trim().replace(/^Cookie:\s*/i, "")
  const cookieNameOnly = /^(cf_clearance|uid|pass|[a-z]+x_session|remember_web_\w+|XSRF-TOKEN)$/i
  if (cookieNameOnly.test(trimmedCookies)) {
    throw new Error(
      `It looks like you pasted a cookie name ("${trimmedCookies}") instead of the full Cookie header value. Copy the entire value after "Cookie:" in DevTools.`
    )
  }

  if (!trimmedCookies.includes("=")) {
    throw new Error(
      "Cookie string doesn't look right — it should contain key=value pairs (i.e. uid=123; pass=abc123)"
    )
  }

  // HTTP headers only allow byte-safe characters (0-255). Non-ASCII chars like
  // ellipsis (U+2026) appear when DevTools truncates long values during copy.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional byte-range check
  const nonAscii = trimmedCookies.match(/[^\x00-\xFF]/)
  if (nonAscii) {
    const char = nonAscii[0]
    const code = char.codePointAt(0)
    const idx = nonAscii.index
    throw new Error(
      `Cookie string contains a non-ASCII character ("${char}", U+${code?.toString(16).toUpperCase().padStart(4, "0")}) at position ${idx}. ` +
        "This usually means the browser truncated a long value when copying. Re-copy the full cookie string from DevTools."
    )
  }

  return { cookies: trimmedCookies, userAgent }
}

// ---------------------------------------------------------------------------
// HTML parsing helpers
// ---------------------------------------------------------------------------

/**
 * parseBytes for optional/best-effort fields: returns undefined rather than
 * throwing when a DOM variant yields something unparseable, so a single odd
 * value can't abort the whole profile parse.
 */
function tryParseBytes(value: string): bigint | undefined {
  try {
    return parseBytes(value)
  } catch {
    return undefined
  }
}

/** Extracts the value text of a tTipWrap item once its `.tTip` label text is stripped. */
function valueAfterLabel(wrap: ParsedElement, label: string): string {
  const fullText = wrap.textContent ?? ""
  return fullText.replace(label, "").replace(/\s+/g, " ").trim()
}

/** Fallback for the newer `.up-stat` card UI (value in `.up-stat-value`, label in `.up-stat-label`). */
function parseUpStatCards(doc: ParsedElement): {
  uploadedBytes?: bigint
  downloadedBytes?: bigint
  ratio?: number
  seedbonus?: number
} {
  const result: {
    uploadedBytes?: bigint
    downloadedBytes?: bigint
    ratio?: number
    seedbonus?: number
  } = {}

  for (const card of doc.querySelectorAll(".up-stat")) {
    const label = card.querySelector(".up-stat-label")?.textContent?.trim() ?? ""
    const value = card.querySelector(".up-stat-value")?.textContent?.trim() ?? ""
    if (!label || !value) continue

    if (/uploaded/i.test(label)) {
      result.uploadedBytes = tryParseBytes(value) ?? result.uploadedBytes
    } else if (/downloaded/i.test(label)) {
      result.downloadedBytes = tryParseBytes(value) ?? result.downloadedBytes
    } else if (/ratio/i.test(label)) {
      const match = value.match(/[\d.]+/)
      if (match) result.ratio = parseFloat(match[0])
    } else if (/balance/i.test(label)) {
      const match = value.match(/[\d,.]+/)
      if (match) result.seedbonus = parseFloat(match[0].replace(/,/g, ""))
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Profile page parser
// ---------------------------------------------------------------------------

export function parseIptProfile(html: string): TrackerStats {
  if (html.includes("/auth/login")) {
    throw new Error("Session expired — browser cookies need to be refreshed")
  }

  if (
    html.includes("<title>Just a moment...</title>") ||
    html.includes("cf_chl_opt") ||
    html.includes("challenges.cloudflare.com/turnstile")
  ) {
    throw new Error("Cloudflare challenge detected — cookies need refreshing")
  }

  const doc = parseHtml(html)

  const statsDiv = doc.querySelector(".stats")
  if (!statsDiv) {
    throw new Error(
      "Could not find stats bar on IPTorrents page — the page may not be authenticated"
    )
  }

  const username = doc.querySelector(".uname")?.textContent?.trim() ?? ""

  let ratio = 0
  let uploadedBytes = 0n
  let downloadedBytes = 0n
  let seedingCount = 0
  let leechingCount = 0
  let seedbonus = 0

  for (const wrap of statsDiv.querySelectorAll(".tTipWrap")) {
    const label = wrap.querySelector(".tTip")?.textContent?.trim() ?? ""
    if (!label) continue
    const value = valueAfterLabel(wrap, label)

    if (label === "Ratio") {
      const match = value.match(/[\d.]+/)
      if (match) ratio = parseFloat(match[0])
    } else if (label === "Uploaded") {
      uploadedBytes = tryParseBytes(value) ?? uploadedBytes
    } else if (label === "Downloaded") {
      downloadedBytes = tryParseBytes(value) ?? downloadedBytes
    } else if (label === "Active Torrents") {
      const nums = value.match(/\d+/g)
      if (nums && nums.length >= 2) {
        seedingCount = parseInt(nums[0], 10) || 0
        leechingCount = parseInt(nums[1], 10) || 0
      }
    } else if (label === "Bonus Points") {
      const match = value.match(/[\d,.]+/)
      if (match) seedbonus = parseFloat(match[0].replace(/,/g, ""))
    }
  }

  if (uploadedBytes === 0n && downloadedBytes === 0n) {
    const fallback = parseUpStatCards(doc)
    if (fallback.uploadedBytes !== undefined) uploadedBytes = fallback.uploadedBytes
    if (fallback.downloadedBytes !== undefined) downloadedBytes = fallback.downloadedBytes
    if (fallback.ratio !== undefined) ratio = fallback.ratio
    if (fallback.seedbonus !== undefined) seedbonus = fallback.seedbonus
  }

  let group = "User"
  const vipEl = doc.querySelector(".hdr-vip")
  if (vipEl && /VIP/i.test(vipEl.getAttribute("title") ?? "")) {
    group = "VIP"
  }

  return {
    username,
    group,
    uploadedBytes,
    downloadedBytes,
    ratio,
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
// HTML fetcher — direct fetch or proxy
// ---------------------------------------------------------------------------

async function fetchHtml(
  url: string,
  cookies: string,
  userAgent: string,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  const headers: Record<string, string> = {
    Cookie: cookies,
    "User-Agent": userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    DNT: "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    Connection: "keep-alive",
  }

  if (proxyAgent) {
    const { proxyFetch } = await import("@/lib/tunnel")
    const result = await proxyFetch(url, proxyAgent, { headers })
    if (!result.ok) {
      throw new Error(
        sanitizeNetworkError(
          `${result.status} ${result.statusText}`,
          `IPTorrents page fetch failed: ${result.status}`
        )
      )
    }
    return (await result.buffer()).toString("utf8")
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
      redirect: "manual",
    })
  } catch (err) {
    throw classifyFetchError(err, new URL(url).hostname)
  }

  // 302 redirect: could be normal (e.g. / → /t) or session expiry (→ /auth/login)
  if (response.status === 302 || response.status === 301) {
    const location = response.headers.get("location") ?? ""
    // If redirected to a login page, the session has expired
    if (/\/auth\/login|\/login/i.test(location)) {
      throw new Error("Session expired — browser cookies need to be refreshed")
    }
    // Otherwise follow the redirect (bounded to 3 hops max)
    let currentUrl = new URL(location, url).href
    for (let hop = 0; hop < 3; hop++) {
      try {
        response = await fetch(currentUrl, {
          headers,
          signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
          redirect: "manual",
        })
      } catch (err) {
        throw classifyFetchError(err, new URL(currentUrl).hostname)
      }
      if (response.status === 302 || response.status === 301) {
        const nextLocation = response.headers.get("location") ?? ""
        if (/\/auth\/login|\/login/i.test(nextLocation)) {
          throw new Error("Session expired — browser cookies need to be refreshed")
        }
        if (!nextLocation) break
        currentUrl = new URL(nextLocation, currentUrl).href
      } else {
        break
      }
    }
    if (response.status === 302 || response.status === 301) {
      throw new Error("Too many redirects from IPTorrents")
    }
  }

  if (!response.ok) {
    throw new Error(
      sanitizeNetworkError(
        `${response.status} ${response.statusText}`,
        `IPTorrents page fetch failed: ${response.status}`
      )
    )
  }

  return response.text()
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

export class IptorrentsAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseIptCredentials(apiToken)
    // The stats bar is present on every authenticated page, so the homepage
    // is used rather than a specific profile URL (which requires the numeric
    // uid to build).
    const homeUrl = `${baseUrl}/`
    const html = await fetchHtml(homeUrl, creds.cookies, creds.userAgent, options?.proxyAgent)
    return parseIptProfile(html)
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const calls: DebugApiCall[] = []
    const creds = parseIptCredentials(apiToken)
    const homeUrl = `${baseUrl}/`

    try {
      const html = await fetchHtml(homeUrl, creds.cookies, creds.userAgent, options?.proxyAgent)
      const stats = parseIptProfile(html)
      calls.push({ label: "Home Page", endpoint: "/", data: stats, error: null })
    } catch (err) {
      calls.push({
        label: "Home Page",
        endpoint: "/",
        data: null,
        error: err instanceof Error ? err.message : "Request failed",
      })
    }

    return calls
  }
}
