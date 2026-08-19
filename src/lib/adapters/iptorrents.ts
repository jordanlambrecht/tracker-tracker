// src/lib/adapters/iptorrents.ts
//
// Functions: parseIptCredentials, tryParseBytes, valueAfterLabel, parseUpStatCards,
//            parseIptProfile, fetchHtml, IptorrentsAdapter

import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { parseBytes } from "@/lib/parser"
import { parseCredentialJson, validateCookieHeader } from "./cookie-credentials"
import { fetchTrackerHtml } from "./html-fetch"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "./types"

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
 * in `.up-stat-label`). The Ratio card is deliberately ignored — ratio is
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

  let uploadedBytes = 0n
  let downloadedBytes = 0n
  let seedingCount = 0
  let leechingCount = 0
  let seedbonus = 0

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
    // Derived from byte totals, not the stats bar's own Ratio text. Whatever
    // that field holds for a zero-download account, the old parse left it at 0
    // either way, so a healthy account read as a critical ratio.
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
// HTML fetcher — direct fetch or proxy
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
    sessionExpiredMessage: "Session expired — browser cookies need to be refreshed",
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
