// src/lib/adapters/hdspace.ts
//
// HD-Space (hd-space.org) runs an xbtit codebase with no API, behind a Cloudflare
// managed challenge that blocks every non-browser client (a plain login POST never
// reaches the site). So, like the AvistaZ and IPTorrents adapters, this one
// replays the user's browser session: the pasted Cookie header (which must
// include Cloudflare's `cf_clearance`, valid for a year on this site) plus the
// browser's User-Agent, which `cf_clearance` is bound to. Stats come from the
// header block xbtit renders on every authenticated page plus the "Joined on"
// row of the user control panel.
//
// Functions: parseHdspaceCredentials, parseHdspaceProfile, fetchHtml, HdspaceAdapter

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { parseBytes } from "@/lib/parser"
import { parseCredentialJson } from "./cookie-credentials"
import { fetchTrackerHtml } from "./html-fetch"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "./types"

// ---------------------------------------------------------------------------
// Credential handling
// ---------------------------------------------------------------------------

export interface HdspaceCredentials {
  cookies: string
  userAgent: string
}

export function parseHdspaceCredentials(apiToken: string): HdspaceCredentials {
  const { cookies, userAgent } = parseCredentialJson(apiToken, "HD-Space", [
    "cookies",
    "userAgent",
  ] as const)
  return { cookies: cookies.trim().replace(/^Cookie:\s*/i, ""), userAgent: userAgent.trim() }
}

// ---------------------------------------------------------------------------
// Profile page parser
// ---------------------------------------------------------------------------

/** Strip tags and collapse whitespace so the header cells can be matched as text. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
}

/**
 * "UP: 22.01 GB" / "DL: 10.90 MB" as xbtit prints them. The labels say GB/MB but
 * the numbers are binary (1024-based): the site's own ratio, 2,067.83 for those
 * two figures, equals 22.01 / 10.90 × 1024 — so the labels are mapped to their
 * binary units before parsing, and the totals match the site to the byte-ish.
 */
const XBTIT_UNITS: Record<string, string> = { B: "B", KB: "KiB", MB: "MiB", GB: "GiB", TB: "TiB" }

function bytesFrom(text: string, label: "UP" | "DL"): bigint {
  const match = text.match(new RegExp(`${label}:\\s*([\\d.,]+)\\s*([KMGT]?B)`, "i"))
  if (!match) throw new Error(`Could not find ${label} on HD-Space page — the page may not be authenticated`)
  const unit = XBTIT_UNITS[match[2].toUpperCase()] ?? match[2]
  return parseBytes(`${match[1].replace(/,/g, "")} ${unit}`)
}

export function parseHdspaceProfile(html: string): TrackerStats {
  if (
    html.includes("<title>Just a moment...</title>") ||
    html.includes("cf_chl_opt") ||
    html.includes("challenges.cloudflare.com")
  ) {
    throw new Error("Cloudflare challenge detected — HD-Space cf_clearance cookie needs refreshing")
  }
  if (!/href=["']logout\.php["']/i.test(html)) {
    throw new Error("Session expired — HD-Space browser cookies need to be refreshed")
  }

  const text = visibleText(html)

  // "Welcome back deusx (Logout)" in the header; the panel repeats it as "User: deusx".
  const welcomeMatch = text.match(/Welcome back\s+(\S+)\s+\(Logout\)/)
  const userRowMatch = text.match(/User:\s+(\S+)\s+Rank:/)
  const username = (welcomeMatch?.[1] ?? userRowMatch?.[1] ?? "").trim()
  if (!username) {
    throw new Error("Could not find the username on HD-Space page — the page may not be authenticated")
  }

  const uploadedBytes = bytesFrom(text, "UP")
  const downloadedBytes = bytesFrom(text, "DL")

  // "Rank: Members" in the header; the control panel repeats it as a row.
  let group = "Members"
  const rankMatch = text.match(/Rank:\s*([A-Za-z][A-Za-z. ]*?)\s+(?:UP:|Joined|Last)/)
  if (rankMatch) group = rankMatch[1].trim()

  let seedbonus: number | null = null
  const bonusMatch = text.match(/Bonus:\s*([\d,]+(?:\.\d+)?)/)
  if (bonusMatch) seedbonus = parseFloat(bonusMatch[1].replace(/,/g, ""))

  // "Active Torrents : <img seed> 16 <img leech> 0" — the icons are gone after
  // tag stripping, leaving two integers.
  let seedingCount: number | null = null
  let leechingCount: number | null = null
  const activeMatch = text.match(/Active Torrents\s*:\s*(\d+)\s+(\d+)/)
  if (activeMatch) {
    seedingCount = parseInt(activeMatch[1], 10)
    leechingCount = parseInt(activeMatch[2], 10)
  }

  // Control panel only: "Joined on: September 03, 2026, 17:10:02"
  let joinedDate: string | undefined
  const joinedMatch = text.match(/Joined on:\s*([A-Z][a-z]+ \d{1,2}, \d{4})(?:,\s*(\d{2}:\d{2}:\d{2}))?/)
  if (joinedMatch) {
    const parsed = new Date(`${joinedMatch[1]} ${joinedMatch[2] ?? "00:00:00"} UTC`)
    if (!Number.isNaN(parsed.getTime())) joinedDate = parsed.toISOString()
  }

  // The "My Panel" link carries the numeric user id.
  let remoteUserId: number | undefined
  const uidMatch = html.match(/page=usercp&(?:amp;)?uid=(\d+)/)
  if (uidMatch) remoteUserId = parseInt(uidMatch[1], 10)

  return {
    username,
    group,
    uploadedBytes,
    downloadedBytes,
    // Derived from bytes: the header prints "∞" or a comma-grouped number.
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount,
    leechingCount,
    seedbonus,
    // xbtit has no hit-and-run system, warnings, required ratio or tokens.
    hitAndRuns: null,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
    ...(remoteUserId !== undefined ? { remoteUserId } : {}),
    ...(joinedDate ? { joinedDate } : {}),
  }
}

// ---------------------------------------------------------------------------
// HTML fetcher — browser UA + navigation headers, so the request matches the
// session that minted the cookies (Cloudflare ties cf_clearance to the UA).
// ---------------------------------------------------------------------------

function fetchHtml(
  url: string,
  cookies: string,
  userAgent: string,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  return fetchTrackerHtml({
    url,
    cookies,
    userAgent,
    proxyAgent,
    label: "HD-Space",
    sessionExpiredMessage: "Session expired — HD-Space browser cookies need to be refreshed",
    // xbtit may answer index.php with a redirect to itself; only a bounce to the
    // login page means the session is gone.
    followRedirects: { loginPattern: /page=login/i },
  })
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

export class HdspaceAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseHdspaceCredentials(apiToken)
    const panelUrl = `${baseUrl}${apiPath || "/index.php?page=usercp"}`
    const html = await fetchHtml(panelUrl, creds.cookies, creds.userAgent, options?.proxyAgent)
    return parseHdspaceProfile(html)
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const calls: DebugApiCall[] = []
    const creds = parseHdspaceCredentials(apiToken)
    const endpoint = apiPath || "/index.php?page=usercp"
    try {
      const html = await fetchHtml(`${baseUrl}${endpoint}`, creds.cookies, creds.userAgent, options?.proxyAgent)
      const stats = parseHdspaceProfile(html)
      calls.push({ label: "User Control Panel", endpoint, data: stats, error: null })
    } catch (err) {
      calls.push({
        label: "User Control Panel",
        endpoint,
        data: null,
        error: err instanceof Error ? err.message : "Request failed",
      })
    }
    return calls
  }
}
