// src/lib/tracker-platforms/adapters/carpt.ts
//
// Functions: parseCarptCredentials, assertAuthenticated, matchText,
//            parseCarptHomepage, parseCarptProfile, CarptAdapter

import { parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"
import type {
  CarptPlatformMeta,
  DebugApiCall,
  FetchOptions,
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

// CarPT runs NexusPHP, which has no user API. Its pages carry the account
// totals in a header block, so this adapter authenticates with pasted browser
// cookies and parses the HTML, like FileList and Portugas.
const LABEL = "CarPT"
const SESSION_EXPIRED = "Session expired. Browser cookies need to be refreshed"
const COOKIE_NAMES = ["c_secure_uid", "c_secure_pass", "c_secure_login", "PHPSESSID"] as const

type HtmlDocument = ReturnType<typeof parseHtml>

export interface CarptCredentials {
  cookies: string
  userAgent: string
}

export function parseCarptCredentials(apiToken: string): CarptCredentials {
  const { cookies, userAgent } = parseCredentialJson(apiToken, LABEL, [
    "cookies",
    "userAgent",
  ] as const)

  return {
    cookies: validateCookieHeader(cookies, {
      extraCookieNames: COOKIE_NAMES,
      example: "c_secure_uid=...; c_secure_pass=...; PHPSESSID=...",
    }),
    userAgent,
  }
}

function assertAuthenticated(html: string): void {
  if (
    html.includes("<title>Just a moment...</title>") ||
    html.includes("cf_chl_opt") ||
    html.includes("challenges.cloudflare.com/turnstile")
  ) {
    throw new Error("Cloudflare challenge detected. Cookies need refreshing")
  }
  if (!html.includes("logout.php") || !html.includes("userdetails.php?id=")) {
    throw new SessionExpiredError(SESSION_EXPIRED)
  }
}

function matchText(html: string, pattern: RegExp): string | undefined {
  const match = html.match(pattern)
  return match?.[1] ? normalizeWhitespace(match[1]) : undefined
}

interface CarptHeader {
  username?: string
  uid?: string
  uploadedBytes?: bigint
  downloadedBytes?: bigint
  ratio?: number
  seedingCount?: number
  leechingCount?: number
  seedbonus?: number
  hnrUnderInvestigation?: number
  hnrCount?: number
  hnrLimit?: number
}

/** Every NexusPHP page repeats the welcome block with the account totals. */
function readHeader(html: string): CarptHeader {
  const hnr = html.match(/H&R:\s*<\/font>\s*\[<a[^>]*>(\d+)\/<font[^>]*>(\d+)<\/font>\/(\d+)/)
  const header: CarptHeader = {
    username: matchText(html, /class='User_Name'><b>([^<]+)<\/b>/),
    uid: matchText(html, /userdetails\.php\?id=(\d+)/),
    uploadedBytes: tryParseSiteBytes(
      matchText(html, /上传量:<\/font>\s*([\d.,]+\s*[A-Za-z]+)/) ?? ""
    ),
    downloadedBytes: tryParseSiteBytes(
      matchText(html, /下载量:<\/font>\s*([\d.,]+\s*[A-Za-z]+)/) ?? ""
    ),
    ratio: tryParseCount(matchText(html, /分享率:<\/font>\s*([\d.,]+)/)),
    seedingCount: tryParseCount(matchText(html, /title="当前做种"[^>]*\/>(\d+)/)),
    leechingCount: tryParseCount(matchText(html, /title="当前下载"[^>]*\/>(\d+)/)),
    seedbonus: tryParseCount(
      matchText(html, /魔力值\s*<\/font>\[<a[^>]*>使用<\/a>\]:\s*([\d,]+(?:\.\d+)?)/)
    ),
  }

  if (hnr) {
    header.hnrUnderInvestigation = Number.parseInt(hnr[1], 10)
    header.hnrCount = Number.parseInt(hnr[2], 10)
    header.hnrLimit = Number.parseInt(hnr[3], 10)
  }

  return header
}

interface CarptHomeReadout {
  stats: TrackerStats
  uid?: string
}

export function parseCarptHomepage(html: string, hostname: string): CarptHomeReadout {
  assertAuthenticated(html)
  const header = readHeader(html)

  if (header.uploadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: missing uploaded total`)
  }
  if (header.downloadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: missing downloaded total`)
  }

  const meta: CarptPlatformMeta = {}
  if (header.hnrUnderInvestigation !== undefined) {
    meta.hnrUnderInvestigation = header.hnrUnderInvestigation
  }
  if (header.hnrLimit !== undefined) meta.hnrLimit = header.hnrLimit

  return {
    uid: header.uid,
    stats: {
      username: header.username ?? "",
      group: null,
      uploadedBytes: header.uploadedBytes,
      downloadedBytes: header.downloadedBytes,
      ratio:
        header.downloadedBytes === 0n
          ? computeRatio(header.uploadedBytes, header.downloadedBytes)
          : (header.ratio ?? computeRatio(header.uploadedBytes, header.downloadedBytes)),
      bufferBytes: computeBufferBytes(header.uploadedBytes, header.downloadedBytes),
      seedingCount: header.seedingCount ?? null,
      leechingCount: header.leechingCount ?? null,
      seedbonus: header.seedbonus ?? null,
      hitAndRuns: header.hnrCount ?? null,
      requiredRatio: null,
      warned: null,
      freeleechTokens: null,
      remoteUserId: header.uid ? Number.parseInt(header.uid, 10) : undefined,
      joinedDate: undefined,
      lastAccessDate: undefined,
      platformMeta: Object.keys(meta).length > 0 ? meta : undefined,
    },
  }
}

interface CarptRow {
  value: string
  row: ReturnType<HtmlDocument["querySelector"]>
}

function readRows(doc: HtmlDocument): Map<string, CarptRow> {
  const rows = new Map<string, CarptRow>()
  for (const row of doc.querySelectorAll("tr")) {
    const head = row.querySelector(".rowhead")
    const follow = row.querySelector(".rowfollow")
    if (!head || !follow) continue
    const key = normalizeWhitespace(head.textContent)
    if (!rows.has(key))
      rows.set(key, { value: normalizeWhitespace(follow.textContent), row: follow })
  }
  return rows
}

/** Profile-page figures the welcome block does not carry. */
export function parseCarptProfile(html: string): Partial<TrackerStats> {
  assertAuthenticated(html)
  const doc = parseHtml(html)
  const rows = readRows(doc)

  const group = rows.get("等级")?.row?.querySelector("img")?.getAttribute("title") ?? null
  const joinedDate = datePrefix(rows.get("加入日期")?.value ?? "")
  const lastAccessDate = datePrefix(rows.get("最近动向")?.value ?? "")
  const uid = tryParseCount(rows.get("用户ID/UID")?.value)
  const seedingPoints = tryParseCount(rows.get("做种积分")?.value)
  const torrentComments = tryParseCount(rows.get("种子评论")?.value)
  const forumPosts = tryParseCount(rows.get("论坛帖子")?.value)

  const meta: CarptPlatformMeta = {}
  if (seedingPoints !== undefined) meta.seedingPoints = seedingPoints
  if (torrentComments !== undefined) meta.torrentComments = torrentComments
  if (forumPosts !== undefined) meta.forumPosts = forumPosts

  return {
    group,
    remoteUserId: Number.isSafeInteger(uid) && (uid ?? 0) > 0 ? uid : undefined,
    joinedDate,
    lastAccessDate,
    platformMeta: Object.keys(meta).length > 0 ? meta : undefined,
  }
}

function mergeMeta(
  first: TrackerStats["platformMeta"],
  second: TrackerStats["platformMeta"]
): CarptPlatformMeta | undefined {
  const merged = {
    ...(first as CarptPlatformMeta | undefined),
    ...(second as CarptPlatformMeta | undefined),
  }
  return Object.keys(merged).length > 0 ? merged : undefined
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed"
}

export class CarptAdapter implements TrackerAdapter {
  // _apiPath is ignored: userdetails.php is intrinsic to NexusPHP, not a
  // property of a user's row, so a stale persisted api_path value self-heals
  // instead of breaking the adapter (the filelist.ts precedent).
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseCarptCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname

    const homeHtml = await fetchTrackerHtml({
      url: `${baseUrl}/`,
      cookies: creds.cookies,
      userAgent: creds.userAgent,
      label: LABEL,
      sessionExpiredMessage: SESSION_EXPIRED,
      proxyAgent: options?.proxyAgent,
    })
    const home = parseCarptHomepage(homeHtml, hostname)
    const stats = home.stats

    // Class, join date and seeding points are enrichment; a failure leaves
    // them unknown instead of discarding the totals that already passed.
    if (home.uid) {
      try {
        const profileHtml = await fetchTrackerHtml({
          url: `${baseUrl}/userdetails.php?id=${home.uid}`,
          cookies: creds.cookies,
          userAgent: creds.userAgent,
          label: LABEL,
          sessionExpiredMessage: SESSION_EXPIRED,
          proxyAgent: options?.proxyAgent,
        })
        const profile = parseCarptProfile(profileHtml)
        Object.assign(stats, {
          ...profile,
          platformMeta: mergeMeta(stats.platformMeta, profile.platformMeta),
        })
      } catch {
        // Keep the homepage stats.
      }
    }

    return stats
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const creds = parseCarptCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    const calls: DebugApiCall[] = []

    let uid: string | undefined
    try {
      const html = await fetchTrackerHtml({
        url: `${baseUrl}/`,
        cookies: creds.cookies,
        userAgent: creds.userAgent,
        label: LABEL,
        sessionExpiredMessage: SESSION_EXPIRED,
        proxyAgent: options?.proxyAgent,
      })
      const home = parseCarptHomepage(html, hostname)
      uid = home.uid
      calls.push({ label: "Home Page", endpoint: "/", data: home.stats, error: null })
    } catch (err) {
      calls.push({ label: "Home Page", endpoint: "/", data: null, error: errorMessage(err) })
      return calls
    }

    if (uid) {
      const endpoint = `/userdetails.php?id=${uid}`
      try {
        const html = await fetchTrackerHtml({
          url: `${baseUrl}/userdetails.php?id=${uid}`,
          cookies: creds.cookies,
          userAgent: creds.userAgent,
          label: LABEL,
          sessionExpiredMessage: SESSION_EXPIRED,
          proxyAgent: options?.proxyAgent,
        })
        calls.push({
          label: "Profile",
          endpoint,
          data: parseCarptProfile(html),
          error: null,
        })
      } catch (err) {
        calls.push({ label: "Profile", endpoint, data: null, error: errorMessage(err) })
      }
    }

    return calls
  }
}
