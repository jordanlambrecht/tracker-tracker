// src/lib/tracker-platforms/adapters/funfile.ts
//
// Functions: parseFunfileCredentials, siteBytes, detailsRow, firstSize, labelledSize,
//            parseFunfilePage, sessionKey, isRedirect, send, absorbCookies, cookieHeader, login,
//            withFunfileSession, fetchProfile, FunfileAdapter

import { randomBytes, scrypt } from "node:crypto"
import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { classifyFetchError, classifyProxyFetchError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { proxyFetch } from "@/lib/tunnel"
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

// FunFile has no API. The adapter logs in with the username and password and
// reads the member's own userdetails.php page, whose header and details table
// contain every figure. FunFile bans an IP address after six failed logins in
// a row, so a poll logs in at most once, and a rejected login throws
// CredentialsRejectedError, which pauses the tracker.

const LABEL = "FunFile"
const LOGIN_PAGE = /\/login\.php/i
const REJECTED =
  "FunFile login failed with the stored username and password. Polling was paused to avoid an IP ban: check the username and password, then resume polling"
const SESSION_EXPIRED = "Session expired. The FunFile session is logged out"
const MAX_LOGIN_HOPS = 3

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
  const remoteUserId = Number.parseInt(
    userLink?.getAttribute("href")?.match(/[?&]id=(\d+)/)?.[1] ?? "",
    10
  )
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
  // has not been seen, so other text reads as unknown unless it names counts.
  let seedingCount: number | null = null
  let leechingCount: number | null = null
  if (/Currently idle/i.test(headerText)) {
    seedingCount = 0
    leechingCount = 0
  } else {
    seedingCount = tryParseCount(headerText.match(/(\d+)\s*seed/i)?.[1]) ?? null
    leechingCount = tryParseCount(headerText.match(/(\d+)\s*leech/i)?.[1]) ?? null
  }

  const title = doc.querySelector(".mf_content h1")
  const warned = title?.querySelector('img[alt="Warned" i], img[title="Warned" i]') ? true : null

  const stats: TrackerStats = {
    username,
    group,
    uploadedBytes,
    downloadedBytes,
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount,
    leechingCount,
    seedbonus: tryParseCount(detailsRow(doc, "Credits")?.textContent) ?? null,
    hitAndRuns: null,
    requiredRatio: null,
    warned,
    freeleechTokens: null,
    platformMeta: meta,
  }
  if (Number.isFinite(remoteUserId) && remoteUserId > 0) stats.remoteUserId = remoteUserId
  const joined = datePrefix(normalizeWhitespace(detailsRow(doc, "Join Date")?.textContent ?? ""))
  if (joined) stats.joinedDate = joined
  const lastSeen = datePrefix(normalizeWhitespace(detailsRow(doc, "Last Seen")?.textContent ?? ""))
  if (lastSeen) stats.lastAccessDate = lastSeen
  return stats
}

// The session cookies are cached in memory between polls, keyed by a hash of
// the credentials as for TorrentLeech, so the password is posted only when the
// session has expired.
const gFf = globalThis as typeof globalThis & {
  __funfileSessionCache?: Map<string, string>
  __funfileSessionSalt?: Buffer
}
if (!gFf.__funfileSessionCache) gFf.__funfileSessionCache = new Map()
if (!gFf.__funfileSessionSalt) gFf.__funfileSessionSalt = randomBytes(16)
const sessionCache = gFf.__funfileSessionCache
const sessionSalt = gFf.__funfileSessionSalt

function sessionKey(baseUrl: string, creds: FunfileCredentials): Promise<string> {
  return new Promise((resolve, reject) => {
    scrypt(`${creds.username}\u0000${creds.password}`, sessionSalt, 32, (err, derived) => {
      if (err) reject(err)
      else resolve(`${baseUrl}|${derived.toString("hex")}`)
    })
  })
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

function isRedirect(status: number): boolean {
  return REDIRECT_STATUSES.has(status)
}

interface LoginResponse {
  status: number
  statusText: string
  location: string
  setCookies: string[]
  text: () => Promise<string>
}

/** One request without following redirects, through the proxy when one is set. */
async function send(
  url: string,
  init: { method: "GET" | "POST"; body?: string; cookies: string },
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<LoginResponse> {
  const headers: Record<string, string> = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ...(init.body !== undefined ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    ...(init.cookies ? { Cookie: init.cookies } : {}),
  }
  try {
    if (proxyAgent) {
      const res = await proxyFetch(url, proxyAgent, {
        method: init.method,
        body: init.body,
        headers,
        timeoutMs: ADAPTER_FETCH_TIMEOUT_MS,
      })
      const rawCookies = res.headers["set-cookie"]
      const rawLocation = res.headers.location
      return {
        status: res.status,
        statusText: res.statusText,
        location: Array.isArray(rawLocation) ? (rawLocation[0] ?? "") : (rawLocation ?? ""),
        setCookies: Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [],
        text: () => res.text(),
      }
    }
    const res = await fetch(url, {
      method: init.method,
      headers,
      body: init.body,
      redirect: "manual",
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    })
    return {
      status: res.status,
      statusText: res.statusText,
      location: res.headers.get("location") ?? "",
      setCookies: res.headers.getSetCookie?.() ?? [],
      text: () => res.text(),
    }
  } catch (err) {
    const hostname = new URL(url).hostname
    throw proxyAgent ? classifyProxyFetchError(err, hostname) : classifyFetchError(err, hostname)
  }
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
 * session. Only definite refusals throw CredentialsRejectedError: a 404 "File
 * not found.", a redirect to the login page, or a page with the login form.
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

  let res = await send(url, { method: "POST", body, cookies: "" }, proxyAgent)
  absorbCookies(jar, res.setCookies)

  for (let hop = 0; isRedirect(res.status); hop++) {
    if (hop === MAX_LOGIN_HOPS) throw new Error(`Too many redirects from ${LABEL}`)
    let next: URL
    try {
      next = new URL(res.location, url)
    } catch {
      throw new Error(`Unexpected response from ${hostname}: redirect to an unreadable Location`)
    }
    if (next.origin !== origin) throw new Error(`${LABEL} redirected off-site`)
    if (LOGIN_PAGE.test(next.pathname)) throw new CredentialsRejectedError(REJECTED)
    url = next.href
    res = await send(url, { method: "GET", cookies: cookieHeader(jar) }, proxyAgent)
    absorbCookies(jar, res.setCookies)
  }

  if (res.status === 407 || res.status === 429 || res.status >= 500) {
    throw new Error(`Tracker API error: ${res.status} ${res.statusText}`)
  }
  const html = await res.text()
  if (res.status === 404 && html.includes("File not found")) {
    throw new CredentialsRejectedError(REJECTED)
  }
  if (res.status < 400 && html.includes("logout.php")) return cookieHeader(jar)
  if (res.status < 400 && /name="password"/i.test(html)) {
    throw new CredentialsRejectedError(REJECTED)
  }
  throw new Error(`Unexpected response from ${hostname}: no FunFile login result`)
}

/**
 * Runs the work with the cached session, or after one login when there is no
 * session or the cached one has expired. A poll never logs in twice.
 */
async function withFunfileSession<T>(
  baseUrl: string,
  creds: FunfileCredentials,
  proxyAgent: FetchOptions["proxyAgent"],
  work: (cookies: string) => Promise<T>
): Promise<T> {
  const key = await sessionKey(baseUrl, creds)
  const cached = sessionCache.get(key)
  if (cached) {
    try {
      return await work(cached)
    } catch (err) {
      if (!(err instanceof SessionExpiredError)) throw err
      sessionCache.delete(key)
    }
  }
  const cookies = await login(baseUrl, creds, proxyAgent)
  sessionCache.set(key, cookies)
  return work(cookies)
}

/** The member's own page; the uid comes from the session's `uid` cookie. */
async function fetchProfile(
  baseUrl: string,
  cookies: string,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<TrackerStats> {
  const uid = cookies.match(/(?:^|;\s*)uid=(\d+)/)?.[1]
  // Without the cookie the index header still links to the member's page.
  const path = uid ? `/userdetails.php?id=${uid}` : "/index.php"
  const html = await fetchTrackerHtml({
    url: `${baseUrl}${path}`,
    cookies,
    proxyAgent,
    label: LABEL,
    sessionExpiredMessage: SESSION_EXPIRED,
    followRedirects: { loginPattern: LOGIN_PAGE },
  })
  if (uid) return parseFunfilePage(html, new URL(baseUrl).hostname)
  const id = parseHtml(html)
    .querySelector('.head_banner a[href*="userdetails.php?id="]')
    ?.getAttribute("href")
    ?.match(/[?&]id=(\d+)/)?.[1]
  if (!id) return parseFunfilePage(html, new URL(baseUrl).hostname)
  return fetchProfile(baseUrl, `${cookies}; uid=${id}`, proxyAgent)
}

export class FunfileAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseFunfileCredentials(apiToken)
    return withFunfileSession(baseUrl, creds, options?.proxyAgent, (cookies) =>
      fetchProfile(baseUrl, cookies, options?.proxyAgent)
    )
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
      const stats = await withFunfileSession(baseUrl, creds, options?.proxyAgent, (cookies) =>
        fetchProfile(baseUrl, cookies, options?.proxyAgent)
      )
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
