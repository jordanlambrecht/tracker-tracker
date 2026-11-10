// src/lib/tracker-platforms/adapters/funfile.ts
//
// Functions: parseFunfileCredentials, siteBytes, detailsRow, firstSize, labelledSize,
//            parseFunfilePage, absorbCookies, cookieHeader, login, positiveId, uidFromCookies,
//            ownUserId, fetchHtml, fetchProfile, readProfile, FunfileAdapter

import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { isRedirect } from "@/lib/network"
import type {
  DebugApiCall,
  FetchOptions,
  FunFilePlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { CredentialsRejectedError, SessionExpiredError } from "../helpers/errors"
import { fetchTrackerHtml } from "../helpers/html-fetch"
import {
  datePrefix,
  normalizeWhitespace,
  tryParseCount,
  tryParseSiteBytes,
} from "../helpers/html-parse"
import { loginRequest, withLoginSession } from "../helpers/login-session"

// FunFile has no API. The adapter logs in with the username and password and
// reads the member's own userdetails.php page, whose header and details table
// contain every figure. FunFile bans an IP address after six failed logins in
// a row, so a refused login throws CredentialsRejectedError.

const LABEL = "FunFile"
const LOGIN_PAGE = /\/login\.php/i
const REJECTED = "FunFile refused the username and password"
const SESSION_EXPIRED = "Session expired. The FunFile session is logged out"
const MAX_LOGIN_HOPS = 3
const ACCEPT_HTML = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"

export interface FunfileCredentials {
  username: string
  password: string
}

export function parseFunfileCredentials(apiToken: string): FunfileCredentials {
  const { username, password } = parseCredentialJson(apiToken, LABEL, [
    "username",
    "password",
  ] as const)
  // Never trimmed: leading or trailing spaces are part of the secret.
  return { username: username.trim(), password }
}

/**
 * A size as the site prints it ("42.512 GB") in bytes. The units are binary
 * whatever the site calls them: classes.php prints 1250 GB as 1.221 TB.
 */
function siteBytes(text: string | undefined): bigint | undefined {
  if (!text) return undefined
  return tryParseSiteBytes(normalizeWhitespace(text).replace(/([KMGTP])B$/i, "$1iB"))
}

/** The value cell beside a `td.rowhead` label in the details table. */
function detailsRow(doc: ParsedElement, label: string): ParsedElement | undefined {
  for (const head of doc.querySelectorAll("td.rowhead")) {
    if (normalizeWhitespace(head.textContent) === label) {
      return head.nextElementSibling ?? undefined
    }
  }
  return undefined
}

/** "42.512 GB | Daily: 12.34 MB" → the first figure. */
function firstSize(cell: ParsedElement | undefined): bigint | undefined {
  return siteBytes(normalizeWhitespace(cell?.textContent ?? "").split("|")[0])
}

/** "... | FreeLeech: 1.018 TB | ..." → the figure after the label. */
function labelledSize(cell: ParsedElement | undefined, label: string): bigint | undefined {
  for (const part of normalizeWhitespace(cell?.textContent ?? "").split("|")) {
    const [name, value] = part.split(":").map((s) => s.trim())
    if (name === label) return siteBytes(value)
  }
  return undefined
}

/** The member's own userdetails.php page: the header and the details table. */
export function parseFunfilePage(html: string, hostname: string): TrackerStats {
  const doc = parseHtml(html)
  if (!doc.querySelector('a[href*="logout.php"]')) {
    throw new SessionExpiredError(SESSION_EXPIRED)
  }

  const header = doc.querySelector(".head_banner")
  const userLink = header?.querySelector('a[href*="userdetails.php?id="]')
  const username = normalizeWhitespace(userLink?.textContent ?? "")
  if (!username || !header) {
    throw new Error(`Unexpected response from ${hostname}: no FunFile page header`)
  }
  const headerText = normalizeWhitespace(header.textContent)

  const uploadedBytes = firstSize(detailsRow(doc, "Uploaded"))
  const downloadedCell = detailsRow(doc, "Downloaded")
  // The ratio counts only the first figure; freeleech download is listed apart.
  const downloadedBytes = firstSize(downloadedCell)
  if (uploadedBytes === undefined || downloadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: unreadable FunFile byte totals`)
  }

  const group =
    normalizeWhitespace(detailsRow(doc, "Class")?.textContent ?? "") ||
    normalizeWhitespace(header.querySelector("b")?.textContent ?? "") ||
    null

  const meta: FunFilePlatformMeta = {}
  const freeleech = labelledSize(downloadedCell, "FreeLeech")
  if (freeleech !== undefined) meta.freeleechDownloadedBytes = Number(freeleech)
  const total = labelledSize(downloadedCell, "Total")
  if (total !== undefined) meta.totalDownloadedBytes = Number(total)
  const invites = headerText.match(/(\d+|no) invites?/i)?.[1]
  if (invites) meta.invites = invites.toLowerCase() === "no" ? 0 : Number(invites)
  const slots = headerText.match(/Max (\d+) DL Slots/i)?.[1]
  if (slots) meta.downloadSlots = Number(slots)
  const nextClass = html.match(/upload<\/b>\s*another\s*<b>([^<]+)<\/b>\s*to reach the next class/i)
  const nextClassBytes = siteBytes(nextClass?.[1])
  if (nextClassBytes !== undefined) meta.nextClassUploadBytes = Number(nextClassBytes)
  const posts = tryParseCount(detailsRow(doc, "Posts")?.textContent)
  if (posts !== undefined) meta.posts = posts
  const comments = tryParseCount(detailsRow(doc, "Comments")?.textContent)
  if (comments !== undefined) meta.comments = comments

  // "Currently idle" means nothing is active. The wording with active torrents
  // has not been seen, so any other text reads as unknown.
  const idle = /Currently idle/i.test(headerText)

  const title = doc.querySelector(".mf_content h1")
  const warned = title?.querySelector('img[alt="Warned" i], img[title="Warned" i]') ? true : null

  const stats: TrackerStats = {
    username,
    group,
    uploadedBytes,
    downloadedBytes,
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount: idle ? 0 : null,
    leechingCount: idle ? 0 : null,
    seedbonus: tryParseCount(detailsRow(doc, "Credits")?.textContent) ?? null,
    hitAndRuns: null,
    requiredRatio: null,
    warned,
    freeleechTokens: null,
    platformMeta: meta,
  }
  const joined = datePrefix(normalizeWhitespace(detailsRow(doc, "Join Date")?.textContent ?? ""))
  if (joined) stats.joinedDate = joined
  const lastSeen = datePrefix(normalizeWhitespace(detailsRow(doc, "Last Seen")?.textContent ?? ""))
  if (lastSeen) stats.lastAccessDate = lastSeen
  return stats
}

/** Adds each Set-Cookie's name=value to the jar; a later value replaces an earlier one. */
function absorbCookies(jar: Map<string, string>, setCookies: string[]): void {
  for (const raw of setCookies) {
    const pair = raw.split(";")[0]?.trim() ?? ""
    const at = pair.indexOf("=")
    if (at > 0) jar.set(pair.slice(0, at), pair.slice(at + 1))
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
}

/**
 * Posts the login form and follows its same-origin redirects, collecting the
 * cookies set on each response. Returns the Cookie header of the signed-in
 * session. Only a redirect to login.php or the login form coming back reads as
 * a refused login.
 */
async function login(
  baseUrl: string,
  creds: FunfileCredentials,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  const hostname = new URL(baseUrl).hostname
  const origin = new URL(baseUrl).origin
  const jar = new Map<string, string>()
  let url = `${baseUrl}/takelogin.php`
  const body = new URLSearchParams({
    username: creds.username,
    password: creds.password,
    returnto: "",
    login: "Login",
  }).toString()

  let res = await loginRequest(
    url,
    {
      method: "POST",
      headers: { Accept: ACCEPT_HTML, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    proxyAgent
  )
  absorbCookies(jar, res.setCookies)

  for (let hop = 0; isRedirect(res.status); hop++) {
    if (hop === MAX_LOGIN_HOPS) throw new Error(`Too many redirects from ${LABEL}`)
    let next: URL
    try {
      next = new URL(res.location(), url)
    } catch {
      throw new Error(`Unexpected response from ${hostname}: redirect to an unreadable Location`)
    }
    if (next.origin !== origin) throw new Error(`${LABEL} redirected off-site`)
    if (LOGIN_PAGE.test(next.pathname)) throw new CredentialsRejectedError(REJECTED)
    url = next.href
    res = await loginRequest(
      url,
      { method: "GET", headers: { Accept: ACCEPT_HTML, Cookie: cookieHeader(jar) } },
      proxyAgent
    )
    absorbCookies(jar, res.setCookies)
  }

  if (res.status >= 400) throw new Error(`Tracker API error: ${res.status} ${res.statusText}`)
  const html = await res.text()
  if (html.includes("logout.php")) return cookieHeader(jar)
  if (/name="password"/i.test(html)) throw new CredentialsRejectedError(REJECTED)
  throw new Error(`Unexpected response from ${hostname}: no FunFile login result`)
}

function positiveId(digits: string | undefined): number | undefined {
  const n = Number.parseInt(digits ?? "", 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** The uid cookie a TBDev session carries. */
function uidFromCookies(cookies: string): number | undefined {
  return positiveId(cookies.match(/(?:^|;\s*)uid=(\d+)\s*(?:;|$)/)?.[1])
}

/**
 * The logout link's id is always the member's own, unlike the first
 * userdetails.php?id= link, which can be another member's.
 */
function ownUserId(html: string): number | undefined {
  return positiveId(html.match(/logout\.php\?id=(\d+)/)?.[1])
}

function fetchHtml(
  url: string,
  cookies: string,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  return fetchTrackerHtml({
    url,
    cookies,
    proxyAgent,
    label: LABEL,
    sessionExpiredMessage: SESSION_EXPIRED,
    followRedirects: { loginPattern: LOGIN_PAGE },
  })
}

/**
 * The member's own page. The user id is the one saved from an earlier poll,
 * then the session's uid cookie, then the index page's logout link.
 */
async function fetchProfile(
  baseUrl: string,
  cookies: string,
  options?: FetchOptions
): Promise<TrackerStats> {
  const hostname = new URL(baseUrl).hostname
  let uid = options?.remoteUserId ?? uidFromCookies(cookies)
  if (uid === undefined) {
    const home = await fetchHtml(`${baseUrl}/index.php`, cookies, options?.proxyAgent)
    // A signed-out page has no logout link either, and that is an expired session.
    if (!home.includes("logout.php")) throw new SessionExpiredError(SESSION_EXPIRED)
    uid = ownUserId(home)
    if (uid === undefined) {
      throw new Error(`Unexpected response from ${hostname}: no logout.php?id= link on FunFile`)
    }
  }
  const html = await fetchHtml(`${baseUrl}/userdetails.php?id=${uid}`, cookies, options?.proxyAgent)
  return { ...parseFunfilePage(html, hostname), remoteUserId: uid }
}

/** Reads the profile with the cached session, logging in when there is none. */
function readProfile(
  baseUrl: string,
  creds: FunfileCredentials,
  options?: FetchOptions
): Promise<TrackerStats> {
  return withLoginSession(
    baseUrl,
    [creds.username, creds.password],
    () => login(baseUrl, creds, options?.proxyAgent),
    (cookies) => fetchProfile(baseUrl, cookies, options)
  )
}

export class FunfileAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    return readProfile(baseUrl, parseFunfileCredentials(apiToken), options)
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const creds = parseFunfileCredentials(apiToken)
    const endpoint = "/userdetails.php"
    try {
      const stats = await readProfile(baseUrl, creds, options)
      return [{ label: "Profile Page", endpoint, data: stats, error: null }]
    } catch (err) {
      return [
        {
          label: "Profile Page",
          endpoint,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
