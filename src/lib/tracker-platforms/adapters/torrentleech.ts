// src/lib/tracker-platforms/adapters/torrentleech.ts
//
// Functions: parseTlCredentials, sessionKey, getTlSession, withTlSession, login,
//            isRedirect, textAfterNode, firstText, topBarCell, parenCount,
//            trailingCount, parseTlProfile, fetchHtml, TorrentleechAdapter

import { randomBytes, scrypt } from "node:crypto"
import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { classifyFetchError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { log } from "@/lib/logger"
import { parseBytes } from "@/lib/parser"
import { proxyFetch } from "@/lib/tunnel"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "../contract"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { SessionExpiredError } from "../helpers/errors"
import { fetchTrackerHtml } from "../helpers/html-fetch"

// ---------------------------------------------------------------------------
// Credential handling
// ---------------------------------------------------------------------------

export interface TlCredentials {
  username: string
  password: string
  /**
   * TorrentLeech's "Alt 2FA Token" (Site Profile => Alt 2FA Token), required
   * only when the account has 2FA enabled.
   *
   * It is not a TOTP secret and nothing here computes a one-time code. The site
   * issues a static token for exactly this case, and its login form takes it as
   * a third input alongside username and password.
   */
  alt2FAToken?: string
}

export function parseTlCredentials(apiToken: string): TlCredentials {
  const optional = parseCredentialJson(
    apiToken,
    "TorrentLeech",
    ["username", "password"] as const,
    ["alt2FAToken", "alt2fatoken"] as const
  )
  const { username, password } = optional

  // `alt2FAToken` is the site's own spelling; `alt2fatoken` is the key Prowlarr
  // and Jackett store it under.
  const token = optional.alt2FAToken ?? optional.alt2fatoken
  const alt2FAToken = token?.trim() ?? ""

  return {
    username: username.trim(),
    password,
    ...(alt2FAToken ? { alt2FAToken } : {}),
  }
}

// ---------------------------------------------------------------------------
// Login flow
// ---------------------------------------------------------------------------

/** Every status that carries a Location, matching html-fetch's own set. */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

function isRedirect(status: number): boolean {
  return REDIRECT_STATUSES.has(status)
}

// ---------------------------------------------------------------------------
// Session cache
//
// TorrentLeech has no API, so every poll would otherwise POST the user's
// password to /user/account/login/. Trackers watch login frequency, so reuse
// the session cookie across polls and only re-authenticate when it expires,
// the same approach the qBittorrent transport takes with its SID cache.
// Stored on globalThis so an HMR reload in dev doesn't orphan the cache or
// the salt its keys depend on.
// ---------------------------------------------------------------------------

const gTl = globalThis as typeof globalThis & {
  __tlSessionCache?: Map<string, string>
  __tlSessionSalt?: Buffer
}
if (!gTl.__tlSessionCache) gTl.__tlSessionCache = new Map()
if (!gTl.__tlSessionSalt) gTl.__tlSessionSalt = randomBytes(16)
const tlSessionCache = gTl.__tlSessionCache
const tlSessionSalt = gTl.__tlSessionSalt

/**
 * Scoped per site and per credential set. The password and 2FA token are in
 * the key because the connection test authenticates through this cache.
 * Hashed so the long-lived global map never holds a password. The hash is
 * scrypt because CodeQL flags a password reaching a fast one, and async
 * because scryptSync would block the event loop.
 */
function sessionKey(baseUrl: string, creds: TlCredentials): Promise<string> {
  const input = `${creds.username}\u0000${creds.password}\u0000${creds.alt2FAToken ?? ""}`
  return new Promise((resolve, reject) => {
    scrypt(input, tlSessionSalt, 32, (err, derived) => {
      if (err) reject(err)
      else resolve(`${baseUrl}|${derived.toString("hex")}`)
    })
  })
}

async function getTlSession(
  key: string,
  baseUrl: string,
  creds: TlCredentials,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  const cached = tlSessionCache.get(key)
  if (cached) return cached

  const cookies = await login(baseUrl, creds, proxyAgent)
  tlSessionCache.set(key, cookies)
  return cookies
}

/**
 * Logs in and returns the Cookie header built from the Set-Cookie headers.
 * Honors the configured proxy, since this is the one request that carries the
 * password.
 */
async function login(
  baseUrl: string,
  creds: TlCredentials,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  const loginUrl = `${baseUrl}/user/account/login/`
  const form: Record<string, string> = {
    username: creds.username,
    password: creds.password,
  }
  // Sent only when the account has 2FA.
  if (creds.alt2FAToken) form.alt2FAToken = creds.alt2FAToken
  const body = new URLSearchParams(form).toString()
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  }

  let setCookieHeaders: string[]
  let loginStatus: number
  let readBody: () => Promise<string>
  try {
    if (proxyAgent) {
      // https.request does not follow redirects, which is what `redirect:
      // "manual"` buys on the direct path. TL answers a good login with a 302
      // that carries the session cookie.
      const res = await proxyFetch(loginUrl, proxyAgent, {
        method: "POST",
        body,
        headers,
        timeoutMs: ADAPTER_FETCH_TIMEOUT_MS,
      })
      const raw = res.headers["set-cookie"]
      setCookieHeaders = Array.isArray(raw) ? raw : raw ? [raw] : []
      loginStatus = res.status
      readBody = () => res.text()
    } else {
      const response = await fetch(loginUrl, {
        method: "POST",
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
      })
      setCookieHeaders = response.headers.getSetCookie?.() ?? []
      loginStatus = response.status
      readBody = () => response.text()
    }
  } catch (err) {
    throw classifyFetchError(err, new URL(baseUrl).hostname)
  }

  const cookiePairs = setCookieHeaders
    .map((raw) => raw.split(";")[0]?.trim())
    .filter((pair): pair is string => Boolean(pair))

  const cookieString = cookiePairs.join("; ")

  // A tluid cookie is not proof of authentication. TorrentLeech answers a
  // rejected login with 200 and the login page, and still sets tluid, tlpass,
  // member_id, pass_hash and session_id. Trusting the cookie means caching a
  // session that was never signed in, and every later page fetch then comes
  // back as the login page, reported as "Session expired", which sends people
  // off to refresh a session that never existed. A real login answers 302.
  //
  // The body is only inspected when the response was not a redirect: a 302
  // carries no body, and a 200 that does not look like the login page is still
  // accepted, so a future flow that returns 200 on success would not regress.
  const authenticated = cookieString.includes("tluid=") && isRedirect(loginStatus)
  if (!authenticated) {
    let html = ""
    if (!isRedirect(loginStatus)) {
      try {
        html = await readBody()
      } catch (readErr) {
        // Fall through to the generic message rather than masking the login
        // failure with a body read error, but leave a trace of it.
        log.warn({ err: readErr }, "torrentleech: could not read login response body")
      }
    }

    const looksLikeLoginPage =
      /One Time Password/i.test(html) ||
      /name="login-form"/i.test(html) ||
      html.includes("/user/account/login")

    // Reject only on positive evidence of a refusal. A 200 whose body could not
    // be read, or that does not look like the login page, still trusts the
    // cookie.
    if (cookieString.includes("tluid=") && !looksLikeLoginPage) return cookieString

    if (/One Time Password/i.test(html)) {
      throw new Error(
        "TorrentLeech requires 2FA. Add your Alt 2FA Token (Site Profile => Alt 2FA Token) to this tracker's credentials"
      )
    }
    if (creds.alt2FAToken) {
      throw new Error("Invalid TorrentLeech credentials or Alt 2FA Token")
    }
    throw new Error("Invalid TorrentLeech credentials")
  }

  return cookieString
}

// ---------------------------------------------------------------------------
// Profile page parser
// ---------------------------------------------------------------------------

function textAfterNode(root: ParsedElement, selector: string): string {
  return root.querySelector(selector)?.textContent?.trim() ?? ""
}

/** First selector in the list that yields non-empty text. */
function firstText(root: ParsedElement, selectors: string[]): string {
  for (const selector of selectors) {
    const text = textAfterNode(root, selector)
    if (text) return text
  }
  return ""
}

/**
 * Reads the top-bar widget TorrentLeech renders on every page. Its cells are
 * identified only by a `title` attribute ("Uploaded (Seeding)", "Hit and Run"),
 * which is the sole place some numbers appear at all.
 */
function topBarCell(doc: ParsedElement, title: RegExp): string {
  for (const item of doc.querySelectorAll(".div-menu-item")) {
    if (title.test(item.getAttribute("title") ?? "")) return item.textContent?.trim() ?? ""
  }
  return ""
}

/**
 * The active-torrent count in a top-bar cell, which reads "10.5 GB (12)": a
 * size followed by the count in parentheses.
 *
 * Taking the first number instead reads the size's leading digits: "10.5 GB
 * (12)" yields 10, a plausible-looking torrent count that is really a byte
 * total. Anchor on the parentheses, and report nothing rather than a guess when
 * they are absent.
 */
function parenCount(text: string): number | null {
  const match = text.match(/\((\d[\d,]*)\)/)
  return match ? parseInt(match[1].replace(/,/g, ""), 10) : null
}

/** The last standalone integer in a cell, for cells that carry only a count. */
function trailingCount(text: string): number | null {
  const matches = text.match(/\d[\d,]*/g)
  if (!matches) return null
  return parseInt(matches[matches.length - 1].replace(/,/g, ""), 10)
}

export function parseTlProfile(html: string, username: string, hostname: string): TrackerStats {
  if (html.includes("/user/account/login")) {
    throw new SessionExpiredError("Session expired. TorrentLeech cookies need to be refreshed")
  }

  if (
    html.includes("<title>Just a moment...</title>") ||
    html.includes("cf_chl_opt") ||
    html.includes("challenges.cloudflare.com/turnstile")
  ) {
    throw new Error("Cloudflare challenge detected. The TorrentLeech session needs refreshing")
  }

  const doc = parseHtml(html)

  // Only the uploaded figure carries a `profile-uploaded-details` class; the
  // downloaded one is a bare `profile-info-details` span inside
  // `.profile-downloaded`, with no counterpart class anywhere on the page. So
  // each side is read through its parent container, the details class kept
  // first in case TorrentLeech ever makes the markup symmetric.
  const uploadedText = firstText(doc, [
    ".profile-uploaded-details",
    ".profile-uploaded .profile-info-details",
  ])
  const downloadedText = firstText(doc, [
    ".profile-downloaded-details",
    ".profile-downloaded .profile-info-details",
  ])

  if (!uploadedText && !downloadedText) {
    throw new Error(
      "Could not find profile stats on TorrentLeech page. The page may not be authenticated"
    )
  }
  // One side readable and the other not is a page-shape change, not an account
  // with nothing on that side, and both fields are non-nullable bigint, so a 0n
  // here would be stored as a measured zero (standard 2.1).
  if (!uploadedText) {
    throw new Error(`Unexpected response from ${hostname}: unreadable uploaded byte total`)
  }
  if (!downloadedText) {
    throw new Error(`Unexpected response from ${hostname}: unreadable downloaded byte total`)
  }

  const uploadedBytes = parseBytes(uploadedText)
  const downloadedBytes = parseBytes(downloadedText)

  // Active seeding/leeching counts appear only in the top bar, alongside the
  // size totals they are parenthesised after.
  const seedingCount = parenCount(topBarCell(doc, /seeding/i))
  const leechingCount = parenCount(topBarCell(doc, /leeching/i))

  // Hit and runs have their own top-bar cell.
  const hitAndRuns = trailingCount(topBarCell(doc, /hit and run/i))

  // TL Points, from the span that holds the figure or else the "TL Points:"
  // label. Neither present, or an unparseable figure, leaves it null.
  let seedbonus: number | null = null
  const pointsText =
    textAfterNode(doc, ".total-TL-points") ||
    ((doc.textContent ?? "").match(/TL Points:\s*([\d,.]+)/i)?.[1] ?? "")
  if (pointsText) {
    const parsed = Number.parseFloat(pointsText.replace(/,/g, ""))
    if (Number.isFinite(parsed)) seedbonus = parsed
  }

  // User class, from the badge beside the avatar, falling back to the "Class"
  // row of the profile table. A whole-page text match on "Class" would hit the
  // "Classic TL" nav link first.
  let group = textAfterNode(doc, ".label-user-class")
  if (!group) {
    for (const cell of doc.querySelectorAll("td")) {
      if (cell.textContent?.trim() === "Class") {
        group = cell.nextElementSibling?.textContent?.trim() ?? ""
        break
      }
    }
  }
  if (!group) group = "User"

  return {
    username,
    group,
    uploadedBytes,
    downloadedBytes,
    // Derived from byte totals, not the page's ratio cell. TorrentLeech
    // renders "∞" there for a zero-download account and parseFloat turns that
    // into 0.
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount,
    leechingCount,
    seedbonus,
    hitAndRuns,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
  }
}

// ---------------------------------------------------------------------------
// HTML fetcher, direct fetch or proxy
// ---------------------------------------------------------------------------

/**
 * No User-Agent is sent: the session cookie comes from our own login POST, not
 * from a browser, so claiming a browser UA would be inconsistent with it.
 */
function fetchHtml(
  url: string,
  cookies: string,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  return fetchTrackerHtml({
    url,
    cookies,
    proxyAgent,
    label: "TorrentLeech",
    // Wording is free to change: withTlSession keys its retry on the error
    // type.
    sessionExpiredMessage:
      "Session expired. Check the stored TorrentLeech username, password and 2FA token if this persists",
  })
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

/**
 * Runs the work with a session cookie, and once more with a fresh one when the
 * cached session turns out to be dead. The parse runs inside because
 * parseTlProfile raises its own session-expired error for a login page that
 * the fetch reports as a success.
 */
async function withTlSession<T>(
  baseUrl: string,
  creds: ReturnType<typeof parseTlCredentials>,
  proxyAgent: FetchOptions["proxyAgent"],
  work: (cookies: string) => Promise<T>
): Promise<T> {
  const key = await sessionKey(baseUrl, creds)
  try {
    return await work(await getTlSession(key, baseUrl, creds, proxyAgent))
  } catch (err) {
    if (!(err instanceof SessionExpiredError)) throw err
    tlSessionCache.delete(key)
    return work(await getTlSession(key, baseUrl, creds, proxyAgent))
  }
}

export class TorrentleechAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseTlCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    const profileUrl = `${baseUrl}/profile/${encodeURIComponent(creds.username)}`

    return withTlSession(baseUrl, creds, options?.proxyAgent, async (cookies) =>
      parseTlProfile(
        await fetchHtml(profileUrl, cookies, options?.proxyAgent),
        creds.username,
        hostname
      )
    )
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const calls: DebugApiCall[] = []
    const creds = parseTlCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    // Encoded the same way fetchStats builds it, so the debug view shows the
    // URL the poll uses.
    const endpoint = `/profile/${encodeURIComponent(creds.username)}`

    try {
      const profileUrl = `${baseUrl}${endpoint}`
      const stats = await withTlSession(baseUrl, creds, options?.proxyAgent, async (cookies) =>
        parseTlProfile(
          await fetchHtml(profileUrl, cookies, options?.proxyAgent),
          creds.username,
          hostname
        )
      )
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
