// src/lib/tracker-platforms/adapters/iptorrents.ts
//
// Functions: parseIptCredentials, tryParseBytes, valueAfterLabel, parseUpStatCards,
//            parseIptProfile, fetchHtml, IptorrentsAdapter

import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { parseBytes } from "@/lib/parser"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "../contract"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { SessionExpiredError } from "../helpers/errors"
import { fetchTrackerHtml } from "../helpers/html-fetch"
import { tryParseCount } from "../helpers/html-parse"

// ---------------------------------------------------------------------------
// Credential handling
// ---------------------------------------------------------------------------

export interface IptCredentials {
  cookies: string
  userAgent: string
}

export function parseIptCredentials(apiToken: string): IptCredentials {
  const { cookies, userAgent } = parseCredentialJson(apiToken, "IPTorrents", [
    "cookies",
    "userAgent",
  ] as const)

  return {
    cookies: validateCookieHeader(cookies, {
      extraCookieNames: ["uid", "pass"],
      example: "uid=123; pass=abc123",
    }),
    userAgent,
  }
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

/**
 * Fallback for the newer `.up-stat` card UI (value in `.up-stat-value`, label
 * in `.up-stat-label`). The Ratio card is deliberately ignored, ratio is
 * derived from the byte totals below.
 */
function parseUpStatCards(doc: ParsedElement): {
  uploadedBytes?: bigint
  downloadedBytes?: bigint
  seedbonus?: number
} {
  const result: {
    uploadedBytes?: bigint
    downloadedBytes?: bigint
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
    } else if (/balance/i.test(label)) {
      result.seedbonus = tryParseCount(value) ?? result.seedbonus
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Profile page parser
// ---------------------------------------------------------------------------

export function parseIptProfile(html: string, hostname: string): TrackerStats {
  if (html.includes("/auth/login")) {
    throw new SessionExpiredError("Session expired. Browser cookies need to be refreshed")
  }

  if (
    html.includes("<title>Just a moment...</title>") ||
    html.includes("cf_chl_opt") ||
    html.includes("challenges.cloudflare.com/turnstile")
  ) {
    throw new Error("Cloudflare challenge detected. Cookies need refreshing")
  }

  const doc = parseHtml(html)

  const statsDiv = doc.querySelector(".stats")
  if (!statsDiv) {
    throw new Error(
      "Could not find stats bar on IPTorrents page. The page may not be authenticated"
    )
  }

  // The anchor carries a tooltip child (<div class="tTip">Profile</div>), so its
  // text reads "ProfileNAME"; strip the tooltip as the stat items do.
  const unameEl = doc.querySelector(".uname")
  const username = unameEl
    ? valueAfterLabel(unameEl, unameEl.querySelector(".tTip")?.textContent?.trim() ?? "")
    : ""

  // undefined until a row is actually read, so "the stats bar had no Uploaded
  // row" stays distinct from "it said 0 B". Only the first is a parse failure.
  let uploadedBytes: bigint | undefined
  let downloadedBytes: bigint | undefined
  // null until the stats bar yields the figure, so a bar with no Active
  // Torrents reads as unknown rather than zero.
  let seedingCount: number | null = null
  let leechingCount: number | null = null
  let seedbonus: number | null = null

  for (const wrap of statsDiv.querySelectorAll(".tTipWrap")) {
    const label = wrap.querySelector(".tTip")?.textContent?.trim() ?? ""
    if (!label) continue
    const value = valueAfterLabel(wrap, label)

    if (label === "Uploaded") {
      uploadedBytes = tryParseBytes(value) ?? uploadedBytes
    } else if (label === "Downloaded") {
      downloadedBytes = tryParseBytes(value) ?? downloadedBytes
    } else if (label === "Active Torrents") {
      const nums = value.match(/\d+/g)
      if (nums && nums.length >= 2) {
        seedingCount = parseInt(nums[0], 10)
        leechingCount = parseInt(nums[1], 10)
      }
    } else if (label === "Bonus Points") {
      seedbonus = tryParseCount(value) ?? seedbonus
    }
  }

  if (uploadedBytes === undefined && downloadedBytes === undefined) {
    const fallback = parseUpStatCards(doc)
    if (fallback.uploadedBytes !== undefined) uploadedBytes = fallback.uploadedBytes
    if (fallback.downloadedBytes !== undefined) downloadedBytes = fallback.downloadedBytes
    if (fallback.seedbonus !== undefined) seedbonus = fallback.seedbonus
  }

  // Neither layout yielded a byte total, so this is a page shape the parser
  // does not know.
  if (uploadedBytes === undefined && downloadedBytes === undefined) {
    throw new Error(
      "Could not extract upload/download bytes from the IPTorrents stats bar. The page structure may have changed."
    )
  }

  // One side readable and the other not is a page-shape change, not an account
  // with nothing on that side, and both fields are non-nullable bigint, so a 0n
  // here would be stored as a measured zero (standard 2.1).
  if (uploadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: unreadable uploaded byte total`)
  }
  if (downloadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: unreadable downloaded byte total`)
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
    // Derived from byte totals, not the stats bar's own Ratio text.
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

function fetchHtml(
  url: string,
  cookies: string,
  userAgent: string,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  // A redirect here may be routine (/ → /t) or a bounce to login, so the chain
  // is followed rather than treated as an expired session outright.
  return fetchTrackerHtml({
    url,
    cookies,
    userAgent,
    proxyAgent,
    label: "IPTorrents",
    sessionExpiredMessage: "Session expired. Browser cookies need to be refreshed",
    followRedirects: { loginPattern: /\/auth\/login|\/login/i },
  })
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
    const hostname = new URL(baseUrl).hostname
    // The stats bar is present on every authenticated page, so the homepage
    // is used rather than a specific profile URL (which requires the numeric
    // uid to build).
    const homeUrl = `${baseUrl}/`
    const html = await fetchHtml(homeUrl, creds.cookies, creds.userAgent, options?.proxyAgent)
    return parseIptProfile(html, hostname)
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const calls: DebugApiCall[] = []
    const creds = parseIptCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    const homeUrl = `${baseUrl}/`

    try {
      const html = await fetchHtml(homeUrl, creds.cookies, creds.userAgent, options?.proxyAgent)
      const stats = parseIptProfile(html, hostname)
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
