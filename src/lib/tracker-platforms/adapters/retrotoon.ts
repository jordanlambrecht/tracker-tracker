// src/lib/tracker-platforms/adapters/retrotoon.ts
//
// Functions: parseRetrotoonCredentials, assertAuthenticated,
//            extractOwnUserId, extractUsername, parseRetrotoonProfile,
//            parseRetrotoonBonus, parseRetrotoonHitAndRuns,
//            parseRetrotoonHnrTokens, fetchHtml, bootstrapError,
//            RetrotoonAdapter

import { parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { log } from "@/lib/logger"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"
import type {
  DebugApiCall,
  FetchOptions,
  RetrotoonPlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { SessionExpiredError } from "../helpers/errors"
import { fetchTrackerHtml } from "../helpers/html-fetch"
import {
  datePrefix,
  isCloudflareChallenge,
  normalizeWhitespace,
  tryParseCount,
  tryParseSiteBytes,
} from "../helpers/html-parse"

// ---------------------------------------------------------------------------
// Credential handling
//
// The `rt_` API key only uploads and the passkey only signs Torznab search, so
// stats exist nowhere but the logged-in HTML. Cookies plus the User-Agent the
// session was issued to, as with FileList and IPTorrents.
// ---------------------------------------------------------------------------

export interface RetrotoonCredentials {
  cookies: string
  userAgent: string
}

export function parseRetrotoonCredentials(apiToken: string): RetrotoonCredentials {
  const { cookies, userAgent } = parseCredentialJson(apiToken, "RetroToon World", [
    "cookies",
    "userAgent",
  ] as const)

  return {
    cookies: validateCookieHeader(cookies, {
      extraCookieNames: ["PHPSESSID", "uid", "pass"],
      example: "PHPSESSID=abc123def456",
    }),
    userAgent,
  }
}

// ---------------------------------------------------------------------------
// Page-shape notes
//
// TBDev: userdetails.php is a table of <td class="rowhead">Label</td><td>value
// pairs, with U+00A0 inside the labels, so normalize whitespace before matching.
// ---------------------------------------------------------------------------

/**
 * Authenticated pages carry the header's [Logout] link. Anonymous requests 302
 * to /login.php, so this is really for a login page served with a 200.
 */
function assertAuthenticated(html: string, page: string): void {
  // Before the logout check: a challenge body also lacks the link, and its
  // message is the more useful error.
  if (isCloudflareChallenge(html)) {
    throw new Error("Cloudflare challenge detected. Cookies need refreshing")
  }

  if (!html.includes("logout.php")) {
    throw new SessionExpiredError(`Session expired. Browser cookies need to be refreshed (${page})`)
  }
}

/**
 * `Hello: <b><a href="userdetails.php?id=N">name</a></b> (Class)`. The "Hello:"
 * anchor matters: matching the first userdetails.php link instead would pick up
 * another member on pages like staff.php.
 */
const HEADER_GREETING =
  /Hello:[\s\S]{0,600}?userdetails\.php\?id=(\d+)[^>]*>\s*(?:<[^>]+>\s*)*([^<]+)/i

export function extractOwnUserId(html: string): number | undefined {
  const match = html.match(HEADER_GREETING)
  if (!match) return undefined
  const id = Number.parseInt(match[1], 10)
  return Number.isFinite(id) && id > 0 ? id : undefined
}

/** Header greeting, falling back to the profile card heading (always our own id). */
function extractUsername(html: string, doc: ReturnType<typeof parseHtml>): string {
  const fromHeader = normalizeWhitespace(html.match(HEADER_GREETING)?.[2] ?? "")
  if (fromHeader) return fromHeader
  return normalizeWhitespace(doc.querySelector("div.rt-form-card h2")?.textContent ?? "")
}

// ---------------------------------------------------------------------------
// Profile page parser (userdetails.php?id=N)
//
// Only the owner's own profile carries the full table, which is why the id
// always comes from the header greeting.
// ---------------------------------------------------------------------------

export function parseRetrotoonProfile(html: string, hostname: string): TrackerStats {
  assertAuthenticated(html, "profile")

  const doc = parseHtml(html)

  let uploadedBytes: bigint | undefined
  let downloadedBytes: bigint | undefined
  let group: string | null = null
  let joinedDate: string | undefined
  let lastAccessDate: string | undefined
  let seedbonus: number | null = null
  let freeleechTokens: number | null = null
  const meta: RetrotoonPlatformMeta = {}

  for (const labelCell of doc.querySelectorAll("td.rowhead")) {
    const label = normalizeWhitespace(labelCell.textContent ?? "")
    const valueCell = labelCell.nextElementSibling
    const value = normalizeWhitespace(valueCell?.textContent ?? "")

    // The count is in the label, so these run before the valueless-row skip.
    // "Uploaded (0)" is a torrent count and "Uploaded" is bytes, hence exact
    // matches throughout: a loose /uploaded/i would confuse the two.
    const snatchMatch = label.match(/^Snatchlist \(([\d,]+)\)$/)
    if (snatchMatch) {
      meta.snatched = tryParseCount(snatchMatch[1])
      continue
    }
    const uploadsMatch = label.match(/^Uploaded \(([\d,]+)\)$/)
    if (uploadsMatch) {
      meta.uploadedTorrents = tryParseCount(uploadsMatch[1])
      continue
    }

    if (!valueCell) continue

    if (label === "Uploaded") {
      uploadedBytes = tryParseSiteBytes(value) ?? uploadedBytes
    } else if (label === "Downloaded") {
      downloadedBytes = tryParseSiteBytes(value) ?? downloadedBytes
    } else if (label === "Class") {
      group = value || null
    } else if (label === "Join date") {
      joinedDate = datePrefix(value) ?? joinedDate
    } else if (label === "Last seen") {
      lastAccessDate = datePrefix(value) ?? lastAccessDate
    } else if (label === "Bonus points") {
      seedbonus = tryParseCount(value) ?? seedbonus
    } else if (label === "Freeleech slots") {
      // The site's own name for a freeleech token.
      freeleechTokens = tryParseCount(value) ?? freeleechTokens
    } else if (label === "Torrent comments") {
      meta.torrentComments = tryParseCount(value)
    } else if (label === "Forum posts") {
      meta.forumPosts = tryParseCount(value)
    }
  }

  // The header strip repeats these totals but is deliberately not a fallback: a
  // page without the profile table is not the owner's profile at all.
  if (uploadedBytes === undefined && downloadedBytes === undefined) {
    throw new Error(
      `Unexpected response from ${hostname}: Could not find profile stats on the RetroToon page. The page may not be authenticated`
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

  const stats: TrackerStats = {
    username: extractUsername(html, doc),
    group,
    uploadedBytes,
    downloadedBytes,
    // From the byte totals: the header's own "Ratio:" reads "∞" and parses to 0.
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    // Filled in from bonus.php below; null keeps a failed call distinct from 0.
    seedingCount: null,
    // Not reported on any page, so null means "unknown", not 0.
    leechingCount: null,
    seedbonus,
    hitAndRuns: null,
    // faq.php: no enforced account ratio.
    requiredRatio: null,
    // Not surfaced on any member-visible page.
    warned: null,
    freeleechTokens,
  }
  if (joinedDate) stats.joinedDate = joinedDate
  if (lastAccessDate) stats.lastAccessDate = lastAccessDate
  // Returned even when empty, so a figure the site stops reporting clears
  // instead of leaving the previous poll's JSON in the row for good.
  stats.platformMeta = meta
  return stats
}

// ---------------------------------------------------------------------------
// Bonus shop parser (bonus.php)
//
// The profile's seeding count only arrives via ajax_peers.php, which ships the
// whole seeding table for one number. bonus.php has it in a card instead.
// ---------------------------------------------------------------------------

export interface RetrotoonBonusSummary {
  seedingCount: number | null
  bonusPerHour?: number
}

export function parseRetrotoonBonus(html: string): RetrotoonBonusSummary {
  assertAuthenticated(html, "bonus shop")

  const doc = parseHtml(html)
  const summary: RetrotoonBonusSummary = { seedingCount: null }

  for (const card of doc.querySelectorAll(".bp-stat-card")) {
    const label = normalizeWhitespace(card.querySelector(".bp-stat-label")?.textContent ?? "")
    const value = normalizeWhitespace(card.querySelector(".bp-stat-value")?.textContent ?? "")
    if (!label || !value) continue

    if (/^active seeds$/i.test(label)) {
      const count = tryParseCount(value)
      if (count !== undefined) summary.seedingCount = Math.trunc(count)
    } else if (/^earning rate$/i.test(label)) {
      summary.bonusPerHour = tryParseCount(value)
    }
  }

  return summary
}

// ---------------------------------------------------------------------------
// Hit and run parser (myhr.php)
//
// Only the empty "Pending Hit & Runs" card is recognised; anything else
// returns null, meaning unknown.
// ---------------------------------------------------------------------------

export function parseRetrotoonHitAndRuns(html: string): number | null {
  assertAuthenticated(html, "hit and run")

  const doc = parseHtml(html)

  for (const card of doc.querySelectorAll("div.rt-form-card")) {
    const heading = normalizeWhitespace(card.querySelector(".rt-section-head")?.textContent ?? "")
    if (!/^Pending Hit ?& ?Runs$/i.test(heading)) continue
    const text = normalizeWhitespace(card.textContent ?? "")
    if (/no pending Hit ?& ?Runs?/i.test(text)) return 0
    return null
  }

  return null
}

/** H&R cleanup tokens, read from the same page ("0 tokens available."). */
export function parseRetrotoonHnrTokens(html: string): number | undefined {
  const doc = parseHtml(html)
  const match = normalizeWhitespace(doc.textContent ?? "").match(/([\d,]+)\s+tokens?\s+available/i)
  return match ? tryParseCount(match[1]) : undefined
}

// ---------------------------------------------------------------------------
// HTML fetcher
// ---------------------------------------------------------------------------

function fetchHtml(
  url: string,
  creds: RetrotoonCredentials,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  // Anonymous GETs answer 302 to /login.php. Redirects are still followed so an
  // ordinary relocation keeps working.
  return fetchTrackerHtml({
    url,
    cookies: creds.cookies,
    userAgent: creds.userAgent,
    proxyAgent,
    label: "RetroToon World",
    sessionExpiredMessage: "Session expired. Browser cookies need to be refreshed",
    followRedirects: { loginPattern: /login\.php|takelogin\.php/i },
  })
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

/** The sanitizer keys on the prefix; without it the card reads "Poll failed". */
function bootstrapError(hostname: string): string {
  return `Unexpected response from ${hostname}: Could not find the account greeting on the RetroToon page. The page may not be authenticated`
}

const BONUS_PATH = "/bonus.php"
const HNR_PATH = "/myhr.php"

export class RetrotoonAdapter implements TrackerAdapter {
  // _apiPath is ignored: userdetails.php is intrinsic to the platform, so a
  // stale persisted value self-heals (btn.ts and filelist.ts do the same).
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseRetrotoonCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname

    // bonus.php needs no id and carries the greeting, so it doubles as the
    // first-poll id lookup and costs no extra request.
    const bonusHtml = await fetchHtml(`${baseUrl}${BONUS_PATH}`, creds, options?.proxyAgent)
    // Parsed before the id is read off it: a login page served with 200 carries
    // no greeting either, and that is a session problem, not a missing id.
    const bonus = parseRetrotoonBonus(bonusHtml)
    const uid = options?.remoteUserId ?? extractOwnUserId(bonusHtml)
    if (uid === undefined) throw new Error(bootstrapError(hostname))

    const profileHtml = await fetchHtml(
      `${baseUrl}/userdetails.php?id=${uid}`,
      creds,
      options?.proxyAgent
    )
    const stats = parseRetrotoonProfile(profileHtml, hostname)

    stats.seedingCount = bonus.seedingCount
    const meta: RetrotoonPlatformMeta = {
      ...((stats.platformMeta as RetrotoonPlatformMeta | undefined) ?? {}),
    }
    if (bonus.bonusPerHour !== undefined) meta.bonusPerHour = bonus.bonusPerHour

    // Non-fatal apart from the session check below: the profile above has every
    // core figure, so hitAndRuns stays null, meaning unknown.
    try {
      const hnrHtml = await fetchHtml(`${baseUrl}${HNR_PATH}`, creds, options?.proxyAgent)
      stats.hitAndRuns = parseRetrotoonHitAndRuns(hnrHtml)
      const tokens = parseRetrotoonHnrTokens(hnrHtml)
      if (tokens !== undefined) meta.hnrCleanupTokens = tokens
    } catch (err) {
      // A session that died mid-poll is not a hit-and-run failure: standard 2.4
      // aborts the poll on one, so swallowing it would report healthy stats.
      if (err instanceof SessionExpiredError) throw err
      log.warn({ err }, "retrotoon: hit-and-run lookup failed, core stats kept")
    }

    stats.platformMeta = meta
    // Persisted by the scheduler so later polls skip discovery.
    stats.remoteUserId = uid
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
    const creds = parseRetrotoonCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname

    let uid = options?.remoteUserId
    let bonus: RetrotoonBonusSummary | null = null

    try {
      const bonusHtml = await fetchHtml(`${baseUrl}${BONUS_PATH}`, creds, options?.proxyAgent)
      uid ??= extractOwnUserId(bonusHtml)
      bonus = parseRetrotoonBonus(bonusHtml)
      calls.push({
        label: "Bonus Shop (seeding count, user id lookup)",
        endpoint: BONUS_PATH,
        data: { ...bonus, userId: uid ?? null },
        error: null,
      })
    } catch (err) {
      calls.push({
        label: "Bonus Shop (seeding count, user id lookup)",
        endpoint: BONUS_PATH,
        data: null,
        error: err instanceof Error ? err.message : "Request failed",
      })
    }

    if (uid === undefined) {
      calls.push({
        label: "User Details Page",
        endpoint: "/userdetails.php",
        data: null,
        error: bootstrapError(hostname),
      })
    } else {
      const endpoint = `/userdetails.php?id=${uid}`
      try {
        const html = await fetchHtml(`${baseUrl}${endpoint}`, creds, options?.proxyAgent)
        const stats = parseRetrotoonProfile(html, hostname)
        stats.seedingCount = bonus?.seedingCount ?? null
        calls.push({ label: "User Details Page", endpoint, data: stats, error: null })
      } catch (err) {
        calls.push({
          label: "User Details Page",
          endpoint,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        })
      }
    }

    try {
      const hnrHtml = await fetchHtml(`${baseUrl}${HNR_PATH}`, creds, options?.proxyAgent)
      calls.push({
        label: "Hit and Run Status",
        endpoint: HNR_PATH,
        data: {
          hitAndRuns: parseRetrotoonHitAndRuns(hnrHtml),
          hnrCleanupTokens: parseRetrotoonHnrTokens(hnrHtml) ?? null,
        },
        error: null,
      })
    } catch (err) {
      calls.push({
        label: "Hit and Run Status",
        endpoint: HNR_PATH,
        data: null,
        error: err instanceof Error ? err.message : "Request failed",
      })
    }

    return calls
  }
}
