// src/lib/adapters/avistaz.ts
//
// Functions: parseAvistazCredentials, safeParseBytes, textAfterLabel,
//            extractRatioBarValue, parseAvistazProfile, fetchHtml, AvistazAdapter

import { JSDOM } from "jsdom"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { localDateStr } from "@/lib/formatters"
import { computeBufferBytes } from "@/lib/helpers"
import { parseBytes } from "@/lib/parser"
import type {
  AvistazPlatformMeta,
  DebugApiCall,
  FetchOptions,
  TrackerAdapter,
  TrackerStats,
} from "./types"

// ---------------------------------------------------------------------------
// Credential handling
// ---------------------------------------------------------------------------

export interface AvistazCredentials {
  cookies: string
  userAgent: string
  username: string
}

export function parseAvistazCredentials(apiToken: string): AvistazCredentials {
  let parsed: unknown
  try {
    parsed = JSON.parse(apiToken)
  } catch {
    throw new Error("AvistaZ credentials must be a JSON object with cookies, userAgent, and username")
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).cookies !== "string" ||
    typeof (parsed as Record<string, unknown>).userAgent !== "string" ||
    typeof (parsed as Record<string, unknown>).username !== "string"
  ) {
    throw new Error(
      "AvistaZ credentials must contain cookies (string), userAgent (string), and username (string)"
    )
  }

  const { cookies, userAgent, username } = parsed as Record<string, string>
  if (!cookies.trim()) throw new Error("AvistaZ credentials: cookies cannot be empty")
  if (!userAgent.trim()) throw new Error("AvistaZ credentials: userAgent cannot be empty")
  if (!username.trim()) throw new Error("AvistaZ credentials: username cannot be empty")

  // Detect common copy-paste mistakes — user copied the cookie name instead of the value
  const trimmedCookies = cookies.trim()
  const cookieNameOnly = /^(cf_clearance|[a-z]+x_session|remember_web_\w+|XSRF-TOKEN|love)$/i
  if (cookieNameOnly.test(trimmedCookies)) {
    throw new Error(
      `It looks like you pasted a cookie name ("${trimmedCookies}") instead of the full Cookie header value. Copy the entire value after "Cookie:" in DevTools.`
    )
  }

  // Should contain at least one key=value pair
  if (!trimmedCookies.includes("=")) {
    throw new Error(
      "Cookie string doesn't look right — it should contain key=value pairs (i.e. cf_clearance=abc123; session=xyz)"
    )
  }

  return { cookies: trimmedCookies, userAgent, username }
}

// ---------------------------------------------------------------------------
// Byte parsing — reuses existing parseBytes from @/lib/parser which handles
// both binary (GiB) and decimal (GB) units with exact bigint arithmetic.
// AvistaZ uses decimal units (GB, KB).
// ---------------------------------------------------------------------------

function safeParseBytes(text: string): bigint {
  try {
    return parseBytes(text.trim())
  } catch {
    return 0n
  }
}

// ---------------------------------------------------------------------------
// HTML parsing helpers
// ---------------------------------------------------------------------------

function textAfterLabel(rows: Element[], label: string): string {
  for (const row of rows) {
    const cells = row.querySelectorAll("td")
    if (cells.length >= 2 && cells[0].textContent?.includes(label)) {
      return cells[1].textContent?.trim() ?? ""
    }
  }
  return ""
}

/**
 * Extracts the numeric value after a labeled entry in ratio bar items.
 * Uses regex-only matching to handle whitespace variations in the DOM
 * (i.e. "Hit & Run:" may have line breaks between words).
 */
function extractRatioBarValue(items: Element[], labelRegex: RegExp): string {
  for (const li of items) {
    const text = li.textContent?.replace(/\s+/g, " ").trim() ?? ""
    const match = text.match(labelRegex)
    if (match?.[1]) return match[1].replace(/,/g, "")
  }
  return ""
}

// ---------------------------------------------------------------------------
// Profile page parser
// ---------------------------------------------------------------------------

export function parseAvistazProfile(html: string, username: string): TrackerStats {
  // Detect login redirect — meta refresh to /auth/login
  if (html.includes("/auth/login")) {
    throw new Error("Session expired — browser cookies need to be refreshed")
  }

  // Detect Cloudflare JS challenge
  if (html.includes("<title>Just a moment...</title>") || html.includes("cf_chl_opt")) {
    throw new Error("Cloudflare challenge detected — cf_clearance cookie needs refreshing")
  }

  const dom = new JSDOM(html)
  const doc = dom.window.document

  // ── Ratio bar ──────────────────────────────────────────────────────────────
  const ratioBar = doc.querySelector("div.ratio-bar")
  if (!ratioBar) {
    throw new Error(
      "Could not find ratio bar in profile page — the page may not be authenticated"
    )
  }

  const items = Array.from(ratioBar.querySelectorAll("ul.list-inline > li"))

  // Username from first badge-user span; group from second
  const parsedUsername =
    ratioBar.querySelector("span.badge-user")?.textContent?.trim() ?? username
  const groupSpans = ratioBar.querySelectorAll("span.badge-user")
  const group =
    groupSpans.length >= 2 ? groupSpans[1].textContent?.trim() ?? "Unknown" : "Unknown"

  // Upload / download / ratio from tooltip-titled items
  let uploadedBytes = 0n
  let downloadedBytes = 0n
  let ratio = 0

  for (const li of items) {
    const title =
      li.getAttribute("data-toggle") === "tooltip" ? li.getAttribute("title") : null
    // Strip everything except digits, decimal point, and unit letters/spaces
    const text = li.textContent?.replace(/[^\d.a-zA-Z\s]/g, "").trim() ?? ""

    if (title === "Upload") {
      uploadedBytes = safeParseBytes(text)
    } else if (title === "Download") {
      downloadedBytes = safeParseBytes(text)
    } else if (title === "Ratio") {
      const ratioMatch = text.match(/([\d.]+)/)
      ratio = ratioMatch ? parseFloat(ratioMatch[1]) : 0
    }
  }

  const seedingCount =
    parseInt(extractRatioBarValue(items, /Seeding:\s*([\d,]+)/), 10) || 0
  const leechingCount =
    parseInt(extractRatioBarValue(items, /Leeching:\s*([\d,]+)/), 10) || 0
  const seedbonus =
    parseFloat(extractRatioBarValue(items, /Bonus:\s*([\d,.]+)/)) || 0
  const hitAndRuns =
    parseInt(extractRatioBarValue(items, /Hit\s*&\s*Run:\s*([\d,]+)/), 10) || 0
  const reseedRequests =
    parseInt(extractRatioBarValue(items, /Reseed:\s*([\d,]+)/), 10) || 0

  // ── Profile table rows ─────────────────────────────────────────────────────
  const allRows = Array.from(
    doc.querySelectorAll("table.table-striped tr, table.table-bordered tr")
  )

  const userIdText = textAfterLabel(allRows, "User ID")
  const userIdMatch = userIdText.match(/(\d+)/)
  const remoteUserId = userIdMatch ? parseInt(userIdMatch[1], 10) : undefined

  const joinedRaw = textAfterLabel(allRows, "Joined")
    .replace(/\s*\(.*\)/, "")
    .trim()
  const joinedDate = joinedRaw ? localDateStr(new Date(joinedRaw)) : undefined

  const lastAccessRaw = textAfterLabel(allRows, "Last Access")
    .replace(/\s*\(.*\)/, "")
    .trim()
  const lastAccessDate = lastAccessRaw ? localDateStr(new Date(lastAccessRaw)) : undefined

  // ── Private account-detail rows ────────────────────────────────────────────
  const donorText = textAfterLabel(allRows, "Donor")
  const vipExpiryText = textAfterLabel(allRows, "VIP Expiry")
  const invitesText = textAfterLabel(allRows, "Invites")
  const canDownloadText = textAfterLabel(allRows, "Can Download")
  const canUploadText = textAfterLabel(allRows, "Can Upload")
  const twoFaText = textAfterLabel(allRows, "2FA")

  // ── Avatar ─────────────────────────────────────────────────────────────────
  // Custom upload lives in #avatar-uploader img; fallback is a Gravatar in a script template
  const avatarImg = doc.querySelector("#avatar-uploader img") as HTMLImageElement | null
  let avatarUrl: string | undefined
  if (avatarImg?.src) {
    avatarUrl = avatarImg.src
  } else {
    const templateEl = doc.querySelector("#avatar-template")
    const gravatarMatch = templateEl?.textContent?.match(
      /https:\/\/www\.gravatar\.com\/avatar\/[^"'\s]+/
    )
    if (gravatarMatch) {
      // Replace d=mm (mystery-person silhouette, returns 200) with d=404
      // so the avatar route gets a 404 and the UI falls back to <UserIcon>
      avatarUrl = gravatarMatch[0].replace(/&amp;/g, "&").replace(/d=mm/, "d=404")
    }
  }

  // ── Activity summary (.well-sm block) ──────────────────────────────────────
  const wellItems = Array.from(doc.querySelectorAll(".well-sm li"))
  let totalUploads = 0
  let totalDownloads = 0

  for (const li of wellItems) {
    const text = li.textContent?.trim() ?? ""
    const strong = li.querySelector("strong")?.textContent?.trim() ?? "0"
    if (text.includes("Total Uploads")) {
      totalUploads = parseInt(strong, 10) || 0
    } else if (text.includes("Downloads")) {
      totalDownloads = parseInt(strong, 10) || 0
    }
  }

  const platformMeta: AvistazPlatformMeta = {
    donor: donorText.toLowerCase().includes("yes") || donorText.toLowerCase().includes("true"),
    vipExpiry: vipExpiryText === "-" ? null : vipExpiryText || null,
    invites: parseInt(invitesText, 10) || 0,
    canDownload: canDownloadText.toLowerCase() !== "no",
    canUpload: canUploadText.toLowerCase() !== "no",
    totalUploads,
    totalDownloads,
    reseedRequests,
    twoFactorEnabled: !twoFaText.includes("Not Enabled"),
  }

  return {
    username: parsedUsername,
    group,
    uploadedBytes,
    downloadedBytes,
    ratio,
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount,
    leechingCount,
    seedbonus,
    hitAndRuns,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
    remoteUserId,
    joinedDate,
    lastAccessDate,
    avatarUrl,
    platformMeta,
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
    const { proxyFetch } = await import("@/lib/proxy")
    const result = await proxyFetch(url, proxyAgent, { headers })
    if (!result.ok) {
      throw new Error(
        sanitizeNetworkError(
          `${result.status} ${result.statusText}`,
          `AvistaZ page fetch failed: ${result.status}`
        )
      )
    }
    return (await result.buffer()).toString("utf8")
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15000),
      redirect: "manual",
    })
  } catch (err) {
    const name =
      err !== null && typeof err === "object" && "name" in (err as object)
        ? String((err as { name: unknown }).name)
        : ""
    if (name === "TimeoutError" || name === "AbortError") {
      const hostname = new URL(url).hostname
      throw new Error(`Request to ${hostname} timed out`)
    }
    const code =
      err instanceof Error && "code" in err
        ? (err as NodeJS.ErrnoException).code
        : undefined
    const detail = code ?? (name || "Unknown")
    const hostname = new URL(url).hostname
    throw new Error(`Failed to connect to ${hostname}: ${detail}`)
  }

  // 302 redirect typically means the session expired and the server redirected to login
  if (response.status === 302) {
    throw new Error("Session expired — browser cookies need to be refreshed")
  }

  if (!response.ok) {
    throw new Error(
      sanitizeNetworkError(
        `${response.status} ${response.statusText}`,
        `AvistaZ page fetch failed: ${response.status}`
      )
    )
  }

  return response.text()
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

export class AvistazAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseAvistazCredentials(apiToken)
    const profileUrl = `${baseUrl}/profile/${encodeURIComponent(creds.username)}`
    const html = await fetchHtml(profileUrl, creds.cookies, creds.userAgent, options?.proxyAgent)
    return parseAvistazProfile(html, creds.username)
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const calls: DebugApiCall[] = []
    const creds = parseAvistazCredentials(apiToken)
    const profileUrl = `${baseUrl}/profile/${encodeURIComponent(creds.username)}`
    const endpoint = `/profile/${creds.username}`

    try {
      const html = await fetchHtml(
        profileUrl,
        creds.cookies,
        creds.userAgent,
        options?.proxyAgent
      )
      const stats = parseAvistazProfile(html, creds.username)
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
