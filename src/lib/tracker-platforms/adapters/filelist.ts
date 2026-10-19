// src/lib/tracker-platforms/adapters/filelist.ts
//
// Functions: parseFilelistCredentials, assertAuthenticated, parseFilelistProfile,
//            extractUidFromCookies, extractOwnUserId, fetchHtml, bootstrapError,
//            FilelistAdapter

import { parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"
import type {
  DebugApiCall,
  FetchOptions,
  FileListPlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { SessionExpiredError } from "../helpers/errors"
import { fetchTrackerHtml } from "../helpers/html-fetch"
import {
  datePrefix,
  normalizeWhitespace,
  tryParseCount,
  tryParseSiteBytes,
} from "../helpers/html-parse"

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
 * Every authenticated FileList page carries the header Logout link. The site
 * redirects anonymous requests, so this guards a login page served with a 200.
 */
function assertAuthenticated(html: string): void {
  // Cloudflare first: a challenge body also lacks the logout link, and the
  // specific challenge message must win over the generic session-expired one.
  if (
    html.includes("<title>Just a moment...</title>") ||
    html.includes("cf_chl_opt") ||
    html.includes("challenges.cloudflare.com/turnstile")
  ) {
    throw new Error("Cloudflare challenge detected. Cookies need refreshing")
  }

  if (!html.includes("logout.php")) {
    throw new SessionExpiredError("Session expired. Browser cookies need to be refreshed")
  }
}

export function parseFilelistProfile(html: string, hostname: string): TrackerStats {
  assertAuthenticated(html)

  const doc = parseHtml(html)

  // The page <h1> is the profile owner's name (plus a country-flag <img> that
  // contributes no text).
  const username = doc.querySelector("h1")?.textContent?.trim() ?? ""

  let uploadedBytes: bigint | undefined
  let downloadedBytes: bigint | undefined
  let group: string | null = null
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
      uploadedBytes = tryParseSiteBytes(value) ?? uploadedBytes
    } else if (label === "Downloaded") {
      downloadedBytes = tryParseSiteBytes(value) ?? downloadedBytes
    } else if (label === "Class") {
      group = value || null
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
        const size = tryParseSiteBytes(match[2])
        // platformMeta is JSON-serialized; bigint does not survive JSON.
        if (size !== undefined) totalSeedSizeBytes = Number(size)
      }
    }
  }

  // The header strip repeats the byte totals, but it is deliberately not a
  // fallback: a page whose profile table is missing is not a profile page.
  if (uploadedBytes === undefined && downloadedBytes === undefined) {
    throw new Error(
      `Unexpected response from ${hostname}: Could not find profile stats on FileList page. The page may not be authenticated`
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

  // Header strip: seed bonus is the FLCoins figure (the shop.php link text);
  // the table's "Seed bonus" row does not hold a bonus number. The strip's
  // own Ratio text ("---" on a fresh account) is ignored; ratio is derived
  // from the byte totals below.
  const coinsText = normalizeWhitespace(doc.querySelector('a[href*="shop.php"]')?.textContent ?? "")
  const seedbonus = tryParseCount(coinsText) ?? null

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
    uploadedBytes,
    downloadedBytes,
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
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
  // Returned even when empty. The scheduler writes meta only when the key is
  // present, so withholding it here leaves the previous poll's JSON in the row
  // and a figure the site stopped reporting would never clear.
  stats.platformMeta = platformMeta
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
  // session. The pattern is unverified against a live logged-out bounce.
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

/** The sanitizer keys on the prefix; without it the card reads "Poll failed". */
function bootstrapError(hostname: string): string {
  return `Unexpected response from ${hostname}: Could not find a profile link on the FileList homepage. The page may not be authenticated`
}

export class FilelistAdapter implements TrackerAdapter {
  // _apiPath is ignored: userdetails.php is intrinsic to the platform, not a
  // property of a user's row, so a stale persisted api_path value self-heals
  // instead of breaking the adapter (the btn.ts precedent).
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseFilelistCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname

    let uid = options?.remoteUserId ?? extractUidFromCookies(creds.cookies)
    if (uid === undefined) {
      const homeHtml = await fetchHtml(`${baseUrl}/`, creds, options?.proxyAgent)
      // Checked before the id is read off it: a login page served with 200
      // carries no logout link either, and that is a session problem, not a
      // missing id.
      assertAuthenticated(homeHtml)
      uid = extractOwnUserId(homeHtml)
      if (uid === undefined) throw new Error(bootstrapError(hostname))
    }

    const html = await fetchHtml(`${baseUrl}/userdetails.php?id=${uid}`, creds, options?.proxyAgent)
    const stats = parseFilelistProfile(html, hostname)
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
    const hostname = new URL(baseUrl).hostname

    let uid = options?.remoteUserId ?? extractUidFromCookies(creds.cookies)
    if (uid === undefined) {
      try {
        const homeHtml = await fetchHtml(`${baseUrl}/`, creds, options?.proxyAgent)
        assertAuthenticated(homeHtml)
        uid = extractOwnUserId(homeHtml)
        if (uid === undefined) throw new Error(bootstrapError(hostname))
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
      const stats = parseFilelistProfile(html, hostname)
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
