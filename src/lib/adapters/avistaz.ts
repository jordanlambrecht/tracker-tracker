// src/lib/adapters/avistaz.ts
//
// Functions: parseAvistazCredentials, strictParseBytes, textAfterLabel, textFromDatagrid,
//            extractRatioBarValue, parseAvistazProfile, fetchHtml, AvistazAdapter

import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { localDateStr } from "@/lib/formatters"
import { parseBytes } from "@/lib/parser"
import { parseCredentialJson, validateCookieHeader } from "./cookie-credentials"
import { fetchTrackerHtml } from "./html-fetch"
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
  const { cookies, userAgent, username } = parseCredentialJson(apiToken, "AvistaZ", [
    "cookies",
    "userAgent",
    "username",
  ] as const)

  return {
    cookies: validateCookieHeader(cookies, {
      extraCookieNames: ["love"],
      example: "cf_clearance=abc123; session=xyz",
    }),
    userAgent,
    username,
  }
}

// ---------------------------------------------------------------------------
// Byte parsing — reuses existing parseBytes from @/lib/parser which handles
// both binary (GiB) and decimal (GB) units with exact bigint arithmetic.
// AvistaZ uses decimal units (GB, KB).
// ---------------------------------------------------------------------------

function strictParseBytes(text: string, field: string): bigint {
  const trimmed = text.trim()
  if (!trimmed) throw new Error(`AvistaZ: empty ${field} byte string`)
  return parseBytes(trimmed)
}

// ---------------------------------------------------------------------------
// HTML parsing helpers
// ---------------------------------------------------------------------------

function textAfterLabel(rows: ParsedElement[], label: string): string {
  for (const row of rows) {
    const cells = row.querySelectorAll("td")
    if (cells.length >= 2 && cells[0].textContent?.includes(label)) {
      return cells[1].textContent?.trim() ?? ""
    }
  }
  return ""
}

// BS5 (AnimeZ) uses datagrid divs instead of tables
function textFromDatagrid(doc: ParsedElement, label: string): string {
  const items = doc.querySelectorAll(".datagrid-item")
  for (const item of items) {
    const title = item.querySelector(".datagrid-title")?.textContent?.trim()
    if (title === label) {
      return item.querySelector(".datagrid-content")?.textContent?.trim() ?? ""
    }
  }
  return ""
}

/**
 * Extracts the numeric value after a labeled entry in ratio bar items.
 * Uses regex-only matching to handle whitespace variations in the DOM
 * (i.e. "Hit & Run:" may have line breaks between words).
 */
function extractRatioBarValue(items: ParsedElement[], labelRegex: RegExp): string {
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
  // Detect login redirect. AvistaZ uses /auth/login, AnimeZ and others use /login.
  if (html.includes("/auth/login") || html.includes('action="/login"')) {
    throw new Error("Session expired — browser cookies need to be refreshed")
  }

  // Detect Cloudflare challenge (classic JS challenge or Turnstile widget)
  if (
    html.includes("<title>Just a moment...</title>") ||
    html.includes("cf_chl_opt") ||
    html.includes("challenges.cloudflare.com/turnstile")
  ) {
    throw new Error("Cloudflare challenge detected — cf_clearance cookie needs refreshing")
  }

  const doc = parseHtml(html)

  // ── Ratio bar ──────────────────────────────────────────────────────────────
  const ratioBar = doc.querySelector("div.ratio-bar")
  if (!ratioBar) {
    throw new Error("Could not find ratio bar in profile page — the page may not be authenticated")
  }

  const items = Array.from(ratioBar.querySelectorAll("ul.list-inline > li"))

  // Username: BS3 uses span.badge-user in the ratio bar, BS5 omits it.
  // Fall back to the username passed from credentials.
  const parsedUsername = ratioBar.querySelector("span.badge-user")?.textContent?.trim() ?? username

  // Group: BS3 has two badge-user spans (username, group) in the ratio bar.
  // BS5 puts the group in a separate badge element elsewhere on the page.
  const groupSpans = ratioBar.querySelectorAll("span.badge-user")
  let group = "Unknown"
  if (groupSpans.length >= 2) {
    group = groupSpans[1].textContent?.trim() ?? "Unknown"
  } else {
    const badgeEl = doc.querySelector(".badge.bg-secondary-lt, .badge-extra.badge-sm")
    if (badgeEl) group = badgeEl.textContent?.trim() ?? "Unknown"
  }

  // Upload / download / seeding / leeching / bonus from tooltip-titled items
  let uploadedBytes = 0n
  let downloadedBytes = 0n
  let seedingCount = 0
  let leechingCount = 0
  let seedbonus = 0

  for (const li of items) {
    // AvistaZ (BS3): data-toggle="tooltip" title="Upload"
    // AnimeZ (BS5): data-bs-toggle="tooltip" title="Uploaded"
    const isTooltip =
      li.getAttribute("data-toggle") === "tooltip" ||
      li.getAttribute("data-bs-toggle") === "tooltip"
    const title = isTooltip ? (li.getAttribute("title")?.trim() ?? null) : null
    // Strip everything except digits, decimal point, and unit letters/spaces
    const text = li.textContent?.replace(/[^\d.a-zA-Z\s]/g, "").trim() ?? ""

    if (title === "Upload" || title === "Uploaded") {
      uploadedBytes = strictParseBytes(text, "upload")
    } else if (title === "Download" || title === "Downloaded") {
      downloadedBytes = strictParseBytes(text, "download")
    } else if (title === "Active Seeds") {
      seedingCount = parseInt(text.replace(/,/g, ""), 10) || 0
    } else if (title === "Active Leeches") {
      leechingCount = parseInt(text.replace(/,/g, ""), 10) || 0
    } else if (title === "Bonus Points") {
      const numMatch = text.match(/([\d,.]+)/)
      seedbonus = numMatch ? parseFloat(numMatch[1].replace(/,/g, "")) : 0
    }
  }

  if (uploadedBytes === 0n && downloadedBytes === 0n) {
    throw new Error(
      "Could not extract upload/download bytes from AvistaZ ratio bar. The page structure may have changed."
    )
  }

  // BS3 (AvistaZ) uses text labels like "Seeding: 2". BS5 (AnimeZ) uses tooltip
  // titles handled above. Fall back to text-based extraction for BS3.
  if (!seedingCount)
    seedingCount = parseInt(extractRatioBarValue(items, /Seeding:\s*([\d,]+)/), 10) || 0
  if (!leechingCount)
    leechingCount = parseInt(extractRatioBarValue(items, /Leeching:\s*([\d,]+)/), 10) || 0
  if (!seedbonus) seedbonus = parseFloat(extractRatioBarValue(items, /Bonus:\s*([\d,.]+)/)) || 0
  const hitAndRuns = parseInt(extractRatioBarValue(items, /Hit\s*&\s*Run:\s*([\d,]+)/), 10) || 0
  const reseedRequests = parseInt(extractRatioBarValue(items, /Reseed:\s*([\d,]+)/), 10) || 0

  // ── Profile table rows ─────────────────────────────────────────────────────
  const allRows = Array.from(
    doc.querySelectorAll("table.table-striped tr, table.table-bordered tr")
  )

  // BS3 uses table rows, BS5 uses datagrid divs. Try both, preferring table.
  const field = (label: string, ...altLabels: string[]) => {
    const fromTable = textAfterLabel(allRows, label)
    if (fromTable) return fromTable
    for (const alt of altLabels) {
      const fromGrid = textFromDatagrid(doc, alt)
      if (fromGrid) return fromGrid
    }
    return textFromDatagrid(doc, label)
  }

  const userIdText = field("User ID")
  const userIdMatch = userIdText.match(/(\d+)/)
  const remoteUserId = userIdMatch ? parseInt(userIdMatch[1], 10) : undefined

  const joinedRaw = field("Joined", "Member Since")
    .replace(/\s*\(.*\)/, "")
    .trim()
  const joinedDate = joinedRaw ? localDateStr(new Date(joinedRaw)) : undefined

  const lastAccessRaw = field("Last Access", "Last Seen")
    .replace(/\s*\(.*\)/, "")
    .trim()
  const lastAccessDate = lastAccessRaw ? localDateStr(new Date(lastAccessRaw)) : undefined

  // ── Private account-detail rows ────────────────────────────────────────────
  const donorText = field("Donor")
  const vipExpiryText = field("VIP Expiry")
  const invitesText = field("Invites")
  const canDownloadText = field("Can Download")
  const canUploadText = field("Can Upload")
  const twoFaText = field("2FA")

  // ── Avatar ─────────────────────────────────────────────────────────────────
  // On your own profile, the avatar <img> is JS-rendered by the Fine Uploader
  // widget (static HTML parsing misses it). The URL
  // does appear in the raw HTML though, so we scan for the /images/avatar/ pattern.
  let avatarUrl: string | undefined

  const avatarSelectors = ["#avatar-uploader img", ".avatar-cell img", "img.avatar-original"]
  for (const sel of avatarSelectors) {
    const img = doc.querySelector(sel)
    const src = img?.getAttribute("src")?.trim()
    if (src) {
      avatarUrl = src.replace(/&amp;/g, "&")
      break
    }
  }

  if (!avatarUrl) {
    // Fallback: scan raw HTML for avatar image URLs (catches JS-rendered content)
    const htmlAvatarMatch = html.match(
      /https?:\/\/[^"'\s<>]+\/images\/avatar\/[^"'\s<>]+\.(?:jpg|png|gif|webp)/i
    )
    if (htmlAvatarMatch) {
      avatarUrl = htmlAvatarMatch[0].replace(/&amp;/g, "&")
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
    // Derived from byte totals, not the ratio bar's own figure — AvistaZ caps
    // that display at 999999.99 for a near-zero-download account, so parsing it
    // reports a made-up number instead of the infinity it stands for.
    ratio: computeRatio(uploadedBytes, downloadedBytes),
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

function fetchHtml(
  url: string,
  cookies: string,
  userAgent: string,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  // A 302 here means the session expired and the server bounced us to login.
  return fetchTrackerHtml({
    url,
    cookies,
    userAgent,
    proxyAgent,
    label: "AvistaZ",
    sessionExpiredMessage: "Session expired — browser cookies need to be refreshed",
  })
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
      const html = await fetchHtml(profileUrl, creds.cookies, creds.userAgent, options?.proxyAgent)
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
