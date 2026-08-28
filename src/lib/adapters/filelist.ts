// src/lib/adapters/filelist.ts
//
// Functions: parseFilelistCredentials, normalizeWhitespace, datePrefix,
//            tryParseFilelistBytes, parseFilelistProfile, extractUidFromCookies,
//            extractOwnUserId, fetchHtml, FilelistAdapter

import { parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { parseBytes } from "@/lib/parser"
import { parseCredentialJson, validateCookieHeader } from "./cookie-credentials"
import { fetchTrackerHtml } from "./html-fetch"
import type {
  DebugApiCall,
  FetchOptions,
  FileListPlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "./types"

// ---------------------------------------------------------------------------
// Credential handling
//
// FileList has no user API key. The 32-char passkey only authenticates the
// torrent-search api.php (search-torrents / latest-torrents); user stats exist
// only in logged-in HTML. So the adapter authenticates with pasted browser
// cookies plus the exact User-Agent the session was issued to, the same way
// IPTorrents does.
// ---------------------------------------------------------------------------

export interface FilelistCredentials {
  cookies: string
  userAgent: string
}

export function parseFilelistCredentials(apiToken: string): FilelistCredentials {
  const { cookies, userAgent } = parseCredentialJson(apiToken, "FileList", [
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
// Profile page parser
//
// userdetails.php is a TBDev table of <td class="colhead">Label</td><td>value
// rows, plus a header strip (FLCoins, Tokens, Invites, Ratio, byte totals)
// repeated on every authenticated page. Labels contain U+00A0 non-breaking
// spaces ("Join date"), so whitespace is normalized before matching. Labels
// are English here; the site has a language setting, and the parser assumes
// the owner's account uses English (single-user app).
// ---------------------------------------------------------------------------

/**
 * Collapses runs of whitespace to single spaces. JS \s matches U+00A0, so the
 * &nbsp; inside labels ("Join&nbsp;date") normalizes to a plain space here.
 */
function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

/** `2026-08-20 19:05:17 (1 week ago)` → `2026-08-20`. */
function datePrefix(value: string): string | undefined {
  return value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
}

/**
 * parseBytes adapted to FileList's formatting, returning undefined instead of
 * throwing so one odd cell cannot abort the whole profile parse. The site
 * prints "kB" while parseBytes' decimal unit table is case-sensitive
 * (KB/MB/GB/TB), so the unit token is uppercased; grouping commas are
 * stripped from the number. Site figures are 2-decimal approximations, and
 * whether FileList's own math is 1000- or 1024-based is unverifiable on a
 * zero account, so repo precedent (TorrentLeech/IPTorrents feed site strings
 * to parseBytes' decimal units) wins; validate against live figures as the
 * account accrues.
 */
function tryParseFilelistBytes(value: string): bigint | undefined {
  const match = value.trim().match(/^([\d,.]+)\s*([A-Za-z]+)$/)
  if (!match) return undefined
  try {
    return parseBytes(`${match[1].replace(/,/g, "")} ${match[2].toUpperCase()}`)
  } catch {
    return undefined
  }
}

export function parseFilelistProfile(html: string): TrackerStats {
  // Cloudflare first: a challenge body also lacks the logout link, and the
  // specific challenge message must win over the generic session-expired one.
  if (
    html.includes("<title>Just a moment...</title>") ||
    html.includes("cf_chl_opt") ||
    html.includes("challenges.cloudflare.com/turnstile")
  ) {
    throw new Error("Cloudflare challenge detected. Cookies need refreshing")
  }

  // Every authenticated FileList page carries the header Logout link. The site
  // redirects anonymous requests, but this also guards a login page served
  // with a 200.
  if (!html.includes("logout.php")) {
    throw new Error("Session expired. Browser cookies need to be refreshed")
  }

  const doc = parseHtml(html)

  // The page <h1> is the profile owner's name (plus a country-flag <img> that
  // contributes no text).
  const username = doc.querySelector("h1")?.textContent?.trim() ?? ""

  let uploadedBytes: bigint | undefined
  let downloadedBytes: bigint | undefined
  let group = ""
  let seedingCount: number | null = null
  let joinedDate: string | undefined
  let lastAccessDate: string | undefined
  let invites: number | undefined
  let reputation: number | undefined
  let totalSeedSizeBytes: number | undefined

  for (const labelCell of doc.querySelectorAll("td.colhead")) {
    const label = normalizeWhitespace(labelCell.textContent ?? "")
    const valueCell = labelCell.nextElementSibling
    if (!valueCell) continue
    const value = normalizeWhitespace(valueCell.textContent ?? "")

    if (label === "Uploaded") {
      uploadedBytes = tryParseFilelistBytes(value) ?? uploadedBytes
    } else if (label === "Downloaded") {
      downloadedBytes = tryParseFilelistBytes(value) ?? downloadedBytes
    } else if (label === "Class") {
      group = value
    } else if (label === "Join date") {
      joinedDate = datePrefix(value) ?? joinedDate
    } else if (label === "Last seen") {
      lastAccessDate = datePrefix(value) ?? lastAccessDate
    } else if (label === "Invitations") {
      const match = value.match(/Active invites:\s*(\d+)/i)
      if (match) invites = Number.parseInt(match[1], 10)
    } else if (label === "Reputation") {
      // The bar itself has no text; the count lives in its title attribute
      // ("10 Rep. Points").
      const title = valueCell.querySelector("[title]")?.getAttribute("title") ?? ""
      const match = title.match(/^([\d.,]+)/)
      if (match) reputation = Number.parseFloat(match[1].replace(/,/g, ""))
    } else if (label === "Seed bonus") {
      // Despite the label, this row holds the seeding summary, not a bonus
      // figure: "Seeding N torrents with a total seed size of X GB."
      const match = value.match(
        /Seeding\s+([\d,]+)\s+torrents?\b.*?seed size of\s+([\d.,]+\s*[A-Za-z]+)/i
      )
      if (match) {
        seedingCount = Number.parseInt(match[1].replace(/,/g, ""), 10)
        const size = tryParseFilelistBytes(match[2])
        // platformMeta is JSON-serialized; bigint does not survive JSON.
        if (size !== undefined) totalSeedSizeBytes = Number(size)
      }
    }
  }

  // The header strip repeats the byte totals, but it is deliberately NOT a
  // fallback: a page whose profile table is missing is not a profile page.
  if (uploadedBytes === undefined && downloadedBytes === undefined) {
    throw new Error(
      "Could not find profile stats on FileList page. The page may not be authenticated"
    )
  }

  const uploaded = uploadedBytes ?? 0n
  const downloaded = downloadedBytes ?? 0n

  // Header strip: seed bonus is the FLCoins figure (the shop.php link text);
  // the table's "Seed bonus" row does not hold a bonus number. The strip's
  // own Ratio text ("---" on a fresh account) is ignored; ratio is derived
  // from the byte totals below.
  let seedbonus: number | null = null
  const coinsText = normalizeWhitespace(doc.querySelector('a[href*="shop.php"]')?.textContent ?? "")
  const coinsMatch = coinsText.match(/[\d,.]+/)
  if (coinsMatch) seedbonus = Number.parseFloat(coinsMatch[0].replace(/,/g, ""))

  let freeleechTokens: number | null = null
  const tokensText = normalizeWhitespace(
    doc.querySelector('a[href*="action=tokens"]')?.textContent ?? ""
  )
  const tokensMatch = tokensText.match(/Tokens\s*([\d,]+)/i)
  if (tokensMatch) freeleechTokens = Number.parseInt(tokensMatch[1].replace(/,/g, ""), 10)

  // Header "Invites N" as fallback when the table's Invitations row is absent.
  if (invites === undefined) {
    const invitesText = normalizeWhitespace(
      doc.querySelector('a[href*="invite.php"]')?.textContent ?? ""
    )
    const match = invitesText.match(/Invites\s*(\d+)/i)
    if (match) invites = Number.parseInt(match[1], 10)
  }

  const platformMeta: FileListPlatformMeta = {}
  if (invites !== undefined) platformMeta.invites = invites
  if (reputation !== undefined) platformMeta.reputation = reputation
  if (totalSeedSizeBytes !== undefined) platformMeta.totalSeedSizeBytes = totalSeedSizeBytes

  const stats: TrackerStats = {
    username,
    group,
    uploadedBytes: uploaded,
    downloadedBytes: downloaded,
    ratio: computeRatio(uploaded, downloaded),
    bufferBytes: computeBufferBytes(uploaded, downloaded),
    seedingCount,
    // Not shown anywhere on FileList (no leeching count, hit-and-run count,
    // per-account required ratio, or warned flag): null means "site does not
    // report", never 0.
    leechingCount: null,
    seedbonus,
    hitAndRuns: null,
    requiredRatio: null,
    warned: null,
    freeleechTokens,
  }
  if (joinedDate) stats.joinedDate = joinedDate
  if (lastAccessDate) stats.lastAccessDate = lastAccessDate
  if (Object.keys(platformMeta).length > 0) stats.platformMeta = platformMeta
  return stats
}

// ---------------------------------------------------------------------------
// HTML fetcher and user-id resolution
//
// userdetails.php needs the numeric user id. Resolution order: the cached
// remoteUserId from a prior poll, then the uid cookie a TBDev session carries,
// then a one-time bootstrap fetch of the homepage.
// ---------------------------------------------------------------------------

function extractUidFromCookies(cookies: string): number | undefined {
  const m = cookies.match(/(?:^|;\s*)uid=(\d+)\s*(?:;|$)/)
  if (!m) return undefined
  const n = Number.parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * The header's Logout link ("logout.php?id=N") always carries the logged-in
 * user's own id; unlike a userdetails.php?id= match it can never hit another
 * user's profile link.
 */
function extractOwnUserId(html: string): number | undefined {
  const m = html.match(/logout\.php\?id=(\d+)/)
  if (!m) return undefined
  const n = Number.parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function fetchHtml(
  url: string,
  creds: FilelistCredentials,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  // A redirect may be routine or a bounce to login, so the chain is followed
  // and only a Location matching the login pattern reads as an expired
  // session. The pattern is unverified against a live logged-out bounce;
  // amend it during Phase B live verification if FileList bounces elsewhere.
  return fetchTrackerHtml({
    url,
    cookies: creds.cookies,
    userAgent: creds.userAgent,
    proxyAgent,
    label: "FileList",
    sessionExpiredMessage: "Session expired. Browser cookies need to be refreshed",
    followRedirects: { loginPattern: /login\.php|takelogin\.php/i },
  })
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

const BOOTSTRAP_ERROR =
  "Could not find a profile link on the FileList homepage. The page may not be authenticated"

export class FilelistAdapter implements TrackerAdapter {
  // _apiPath is ignored: userdetails.php is intrinsic to the platform, not a
  // property of a user's row, so a stale persisted api_path value self-heals
  // instead of breaking the adapter (the btn.ts:10-21 precedent).
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseFilelistCredentials(apiToken)

    let uid = options?.remoteUserId ?? extractUidFromCookies(creds.cookies)
    if (uid === undefined) {
      const homeHtml = await fetchHtml(`${baseUrl}/`, creds, options?.proxyAgent)
      uid = extractOwnUserId(homeHtml)
      if (uid === undefined) throw new Error(BOOTSTRAP_ERROR)
    }

    const html = await fetchHtml(`${baseUrl}/userdetails.php?id=${uid}`, creds, options?.proxyAgent)
    const stats = parseFilelistProfile(html)
    // Returned so the scheduler persists it and later polls skip discovery.
    return { ...stats, remoteUserId: uid }
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const calls: DebugApiCall[] = []
    // Outside any try: bad credentials are a caller error, not a call entry.
    const creds = parseFilelistCredentials(apiToken)

    let uid = options?.remoteUserId ?? extractUidFromCookies(creds.cookies)
    if (uid === undefined) {
      try {
        const homeHtml = await fetchHtml(`${baseUrl}/`, creds, options?.proxyAgent)
        uid = extractOwnUserId(homeHtml)
        if (uid === undefined) throw new Error(BOOTSTRAP_ERROR)
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
        return calls
      }
    }

    const endpoint = `/userdetails.php?id=${uid}`
    try {
      const html = await fetchHtml(`${baseUrl}${endpoint}`, creds, options?.proxyAgent)
      const stats = parseFilelistProfile(html)
      calls.push({ label: "User Details Page", endpoint, data: stats, error: null })
    } catch (err) {
      calls.push({
        label: "User Details Page",
        endpoint,
        data: null,
        error: err instanceof Error ? err.message : "Request failed",
      })
    }
    return calls
  }
}
