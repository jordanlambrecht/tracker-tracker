// src/lib/tracker-platforms/adapters/iptorrents.ts
//
// Functions: parseIptCredentials, tryParseBytes, valueAfterLabel, parseUpStatCards,
//            profileDate, parseIptProfile, missingProfileLink, profileMismatch,
//            fetchHtml, IptorrentsAdapter

import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { log } from "@/lib/logger"
import { parseBytes } from "@/lib/parser"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "../contract"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { SessionExpiredError } from "../helpers/errors"
import { fetchTrackerHtml } from "../helpers/html-fetch"
import {
  datePrefix,
  isCloudflareChallenge,
  normalizeWhitespace,
  tryParseCount,
} from "../helpers/html-parse"

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
 * Fallback for the profile page's `.up-stat` cards (value in `.up-stat-value`,
 * label in `.up-stat-label`), which describe the profile's owner. The Ratio
 * card is deliberately ignored, ratio is derived from the byte totals below.
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

/** A profile field's date, such as "2024-05-06 07:08:09 (2 years ago)", as "2024-05-06". */
function profileDate(doc: ParsedElement, label: string): string | undefined {
  for (const field of doc.querySelectorAll(".up-field")) {
    if (normalizeWhitespace(field.querySelector(".up-field-label")?.textContent ?? "") !== label) {
      continue
    }
    return datePrefix(
      normalizeWhitespace(field.querySelector(".up-field-value")?.textContent ?? "")
    )
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Profile page parser
// ---------------------------------------------------------------------------

/**
 * Reads the stats bar, which every signed-in page carries. The badge, dates and
 * stat cards are read only when the page is `profileId`'s profile and that is
 * the signed-in member, since another member's profile shows their own.
 */
export function parseIptProfile(html: string, hostname: string, profileId?: number): TrackerStats {
  if (html.includes("/auth/login")) {
    throw new SessionExpiredError("Session expired. Browser cookies need to be refreshed")
  }

  if (isCloudflareChallenge(html)) {
    throw new Error("Cloudflare challenge detected. Cookies need refreshing")
  }

  const doc = parseHtml(html)

  const statsDiv = doc.querySelector(".stats")
  if (!statsDiv) {
    throw new Error(
      `Unexpected response from ${hostname}: Could not find stats bar on IPTorrents page. The page may not be authenticated`
    )
  }

  // The anchor carries a tooltip child (<div class="tTip">Profile</div>), so its
  // text reads "ProfileNAME"; strip the tooltip as the stat items do. Read from
  // the stats bar, where it is always the signed-in member.
  const unameEl = statsDiv.querySelector(".uname")
  const username = unameEl
    ? valueAfterLabel(unameEl, unameEl.querySelector(".tTip")?.textContent?.trim() ?? "")
    : ""
  const idMatch = unameEl?.getAttribute("href")?.match(/^\/u\/(\d+)$/)
  const ownId = idMatch ? Number.parseInt(idMatch[1], 10) : undefined
  // The badge, dates and stat cards describe the profile's owner, so they
  // count only on the signed-in member's own page.
  const ownProfile = ownId !== undefined && ownId === profileId

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

  if (uploadedBytes === undefined && downloadedBytes === undefined && ownProfile) {
    const fallback = parseUpStatCards(doc)
    if (fallback.uploadedBytes !== undefined) uploadedBytes = fallback.uploadedBytes
    if (fallback.downloadedBytes !== undefined) downloadedBytes = fallback.downloadedBytes
    if (fallback.seedbonus !== undefined) seedbonus = fallback.seedbonus
  }

  // Neither layout yielded a byte total, so this is a page shape the parser
  // does not know.
  if (uploadedBytes === undefined && downloadedBytes === undefined) {
    throw new Error(
      `Unexpected response from ${hostname}: Could not extract upload/download bytes from the IPTorrents stats bar. The page structure may have changed.`
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

  const badge = ownProfile
    ? normalizeWhitespace(doc.querySelector("span.up-class-badge")?.textContent ?? "")
    : ""
  // The header's VIP flag stands in when there is no badge to read.
  const vipEl = doc.querySelector(".hdr-vip")
  const vip = !!vipEl && /VIP/i.test(vipEl.getAttribute("title") ?? "")

  return {
    username,
    group: badge || (vip ? "VIP" : null),
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
    joinedDate: ownProfile ? profileDate(doc, "Join Date") : undefined,
    lastAccessDate: ownProfile ? profileDate(doc, "Last Seen") : undefined,
    // Returned so the scheduler persists it and later polls skip the homepage.
    remoteUserId: ownId,
  }
}

/** The sanitizer keys on the prefix; without it the card reads "Poll failed". */
function missingProfileLink(hostname: string): string {
  return `Unexpected response from ${hostname}: Could not find the profile link in the IPTorrents stats bar`
}

/** Why a profile page's badge and dates were skipped, or null when they were read. */
function profileMismatch(stats: TrackerStats, profileId: number, hostname: string): string | null {
  if (stats.remoteUserId === profileId) return null
  return stats.remoteUserId === undefined
    ? `${missingProfileLink(hostname)}, so the badge and dates were skipped`
    : `Unexpected response from ${hostname}: the profile page did not match the signed-in member, so its badge and dates were skipped`
}

// ---------------------------------------------------------------------------
// HTML fetcher, direct fetch or proxy
// ---------------------------------------------------------------------------

function fetchHtml(
  url: string,
  creds: IptCredentials,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  // A redirect here may be routine (/ → /t, /u/N → /user.php?u=N) or a bounce
  // to login, so the chain is followed rather than treated as an expired
  // session outright.
  return fetchTrackerHtml({
    url,
    cookies: creds.cookies,
    userAgent: creds.userAgent,
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
  // The profile page carries the stats bar as well as the class and dates, so
  // one request covers a poll; the homepage is fetched only to learn the id.
  // _apiPath is ignored: /u/{id} is intrinsic to IPT, so a stale persisted
  // path self-heals.
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseIptCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname

    let uid = options?.remoteUserId
    if (uid === undefined) {
      const homeHtml = await fetchHtml(`${baseUrl}/`, creds, options?.proxyAgent)
      uid = parseIptProfile(homeHtml, hostname).remoteUserId
      if (uid === undefined) throw new Error(missingProfileLink(hostname))
    }

    const html = await fetchHtml(`${baseUrl}/u/${uid}`, creds, options?.proxyAgent)
    const stats = parseIptProfile(html, hostname, uid)
    // A cached id from other cookies heals on the next poll, since the stats
    // bar's own id is returned.
    const mismatch = profileMismatch(stats, uid, hostname)
    if (mismatch) log.warn({ hostname, reason: mismatch }, "iptorrents: profile page skipped")
    return stats
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const calls: DebugApiCall[] = []
    // Outside any try: bad credentials are a caller error, not a call entry.
    const creds = parseIptCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname

    let uid = options?.remoteUserId
    if (uid === undefined) {
      try {
        const homeHtml = await fetchHtml(`${baseUrl}/`, creds, options?.proxyAgent)
        uid = parseIptProfile(homeHtml, hostname).remoteUserId
        if (uid === undefined) throw new Error(missingProfileLink(hostname))
        calls.push({
          label: "Home Page (user id lookup)",
          endpoint: "/",
          data: { userId: uid },
          error: null,
        })
      } catch (err) {
        calls.push({
          label: "Home Page (user id lookup)",
          endpoint: "/",
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        })
        calls.push({
          label: "Profile Page",
          endpoint: "/u/{id}",
          data: null,
          error: "Skipped: Home Page failed and no user id is cached",
        })
        return calls
      }
    }

    const endpoint = `/u/${uid}`
    try {
      const html = await fetchHtml(`${baseUrl}${endpoint}`, creds, options?.proxyAgent)
      const stats = parseIptProfile(html, hostname, uid)
      calls.push({
        label: "Profile Page",
        endpoint,
        data: stats,
        error: profileMismatch(stats, uid, hostname),
      })
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
