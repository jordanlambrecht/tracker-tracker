// src/lib/tracker-platforms/adapters/luminance.ts
//
// Functions: parseLuminanceCredentials, parseLuminanceLoginToken, isLoginForm,
//            parseLuminanceUserId, statText, statTime, requiredBytes, parseLuminanceProfile,
//            mergeCookies, cookieHeader, flashMessages, refuseNoVerdict, loginRefusal, login,
//            fetchHtml, withSession, readProfile, LuminanceAdapter

import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { isRedirect } from "@/lib/network"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "../contract"
import { presentClass } from "../helpers/class-name"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { SessionExpiredError } from "../helpers/errors"
import { fetchTrackerHtml } from "../helpers/html-fetch"
import {
  isCloudflareInterstitial,
  normalizeWhitespace,
  tryParseCount,
  tryParseSiteBytes,
} from "../helpers/html-parse"
import { type LoginResponse, loginRequest, withLoginSession } from "../helpers/login-session"

// ---------------------------------------------------------------------------
// Credential handling
//
// Luminance has no stats API, so the adapter logs in with the password. An
// account with two-factor login cannot pass that POST, so it stores the
// session cookie of a browser login instead, with that browser's User-Agent.
// ---------------------------------------------------------------------------

export type LuminanceCredentials =
  | { username: string; password: string }
  | { username: string; cookies: string; userAgent: string }

export function parseLuminanceCredentials(apiToken: string): LuminanceCredentials {
  const { username, password, cookies, userAgent } = parseCredentialJson(
    apiToken,
    "Luminance",
    ["username"] as const,
    ["password", "cookies", "userAgent"] as const
  )

  if (cookies?.trim()) {
    if (!userAgent?.trim()) throw new Error("Luminance credentials: userAgent cannot be empty")
    return {
      username: username.trim(),
      cookies: validateCookieHeader(cookies, {
        extraCookieNames: ["sid"],
        requiredCookieNames: ["sid"],
        example: "sid=abc123",
      }),
      userAgent,
    }
  }
  if (!password?.trim()) {
    throw new Error("Luminance credentials must contain password (string), or cookies and userAgent")
  }
  // Never trimmed: leading or trailing spaces are part of the secret.
  return { username: username.trim(), password }
}

// ---------------------------------------------------------------------------
// Page parsers
// ---------------------------------------------------------------------------

const SESSION_EXPIRED =
  "Session expired. Check the stored Luminance username and password if this persists"

export function parseLuminanceLoginToken(html: string): string | null {
  return parseHtml(html).querySelector('input[name="token"]')?.getAttribute("value") || null
}

/** Luminance serves its login form in place of a page when the session is not accepted. */
function isLoginForm(doc: ParsedElement): boolean {
  return doc.querySelector("form#login_form") !== null
}

export function parseLuminanceUserId(html: string, hostname: string): number {
  const doc = parseHtml(html)
  if (isLoginForm(doc)) throw new SessionExpiredError(SESSION_EXPIRED)
  const href = doc.querySelector("a.username")?.getAttribute("href") ?? ""
  const id = href.match(/[?&]id=(\d+)/)?.[1]
  if (!id) throw new Error(`Unexpected response from ${hostname}: no user id on the home page`)
  return Number(id)
}

function statText(doc: ParsedElement, label: string): string | null {
  for (const li of doc.querySelectorAll("ul.stats > li")) {
    const text = normalizeWhitespace(li.textContent)
    if (text.startsWith(label)) return text.slice(label.length).trim()
  }
  return null
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** The time a stats line's span.time title gives, such as "Jan 01 2025, 00:00", as YYYY-MM-DD HH:MM. */
function statTime(doc: ParsedElement, label: string): string | undefined {
  for (const li of doc.querySelectorAll("ul.stats > li")) {
    if (!normalizeWhitespace(li.textContent).startsWith(label)) continue
    const title = li.querySelector("span.time")?.getAttribute("title") ?? ""
    const match = title.match(/^([A-Z][a-z]{2}) (\d{1,2}) (\d{4}), (\d{2}):(\d{2})$/)
    const month = match ? MONTHS.indexOf(match[1]) + 1 : 0
    if (!match || month === 0) return undefined
    const [, , day, year, hours, minutes] = match
    return `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")} ${hours}:${minutes}`
  }
  return undefined
}

function requiredBytes(doc: ParsedElement, label: string, hostname: string): bigint {
  const bytes = tryParseSiteBytes(statText(doc, label) ?? "")
  if (bytes === undefined) {
    throw new Error(
      `Unexpected response from ${hostname}: unreadable ${label.replace(/:$/, "")} on the Luminance profile`
    )
  }
  return bytes
}

export function parseLuminanceProfile(
  html: string,
  hostname: string,
  remoteUserId?: number
): TrackerStats {
  const doc = parseHtml(html)
  if (isLoginForm(doc)) throw new SessionExpiredError(SESSION_EXPIRED)
  const username = normalizeWhitespace(doc.querySelector("a.username")?.textContent ?? "")
  if (!username || !doc.querySelector("ul.stats")) {
    throw new Error(`Unexpected response from ${hostname}: no profile stats on the Luminance page`)
  }

  const uploadedBytes = requiredBytes(doc, "Uploaded:", hostname)
  const downloadedBytes = requiredBytes(doc, "Downloaded:", hostname)
  const group =
    presentClass(doc.querySelector("span.rank")?.textContent.trim()) ??
    presentClass(statText(doc, "Class:"))
  const credits =
    doc.querySelector("#bonusdiv > h4")?.textContent ??
    doc.querySelectorAll("h4").find((h) => h.textContent.includes("Credits:"))?.textContent
  const seeding =
    tryParseCount(doc.querySelector("#nav_seeding_r")?.textContent) ??
    tryParseCount(statText(doc, "Seeding:")?.split("(")[0])

  return {
    username,
    group,
    remoteUserId,
    uploadedBytes,
    downloadedBytes,
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount: seeding ?? null,
    leechingCount: null,
    seedbonus: tryParseCount(credits?.split(":")[1]) ?? null,
    hitAndRuns: null,
    requiredRatio: tryParseCount(statText(doc, "Required ratio:")) ?? null,
    warned: null,
    freeleechTokens: tryParseCount(statText(doc, "Tokens:")) ?? null,
    joinedDate: statTime(doc, "Joined:"),
    lastAccessDate: statTime(doc, "Last Seen:"),
  }
}

// ---------------------------------------------------------------------------
// Login
//
// Outcomes follow Luminance's Auth service: a refused login redirects to the
// page for its reason, and sid is set only once the password checks out. No
// tracker text reaches an error; each outcome is a fixed string.
// ---------------------------------------------------------------------------

const ACCEPT_HTML = "text/html,application/xhtml+xml"

function mergeCookies(jar: Map<string, string>, setCookies: string[]): void {
  for (const raw of setCookies) {
    const pair = raw.split(";")[0]?.trim() ?? ""
    const eq = pair.indexOf("=")
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1))
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
}

/** The flashes cookie is rawurlencoded JSON, an array of `{ message, severity }`. */
export function flashMessages(encoded: string | undefined): string[] {
  if (!encoded) return []
  let flashes: unknown
  try {
    flashes = JSON.parse(decodeURIComponent(encoded))
  } catch {
    return []
  }
  if (!Array.isArray(flashes)) return []
  return flashes
    .map((f) => (f as { message?: unknown } | null)?.message)
    .filter((m): m is string => typeof m === "string")
}

/**
 * A challenge, a proxy refusal, a 429 or a 5xx is no verdict on the
 * credentials, so it is reported before anything is read from the answer. The
 * challenge comes first because one can arrive with a 503. The status error is
 * worded as adapterFetch words it, which the sanitizer matches on.
 */
function refuseNoVerdict(res: LoginResponse, body: string): void {
  if (isCloudflareInterstitial(body)) {
    throw new Error("Cloudflare challenge detected on the Luminance login page")
  }
  if (res.status === 407 || res.status === 429 || res.status >= 500) {
    throw new Error(`Tracker API error: ${res.status} ${res.statusText}`)
  }
}

/** The refusal a login redirect names, or null when it names none. */
function loginRefusal(
  location: string,
  flashes: string | undefined,
  baseUrl: string,
  hostname: string
): Error | null {
  let path: string
  try {
    path = new URL(location, baseUrl).pathname
  } catch {
    // An unreadable Location names no refusal; the sid check decides.
    return null
  }
  switch (path) {
    case "/twofactor/login":
      return new Error("Luminance login refused: the account uses two-factor login")
    case "/disabled":
    case "/reactivate":
      return new Error("Luminance login refused: the account is disabled")
    case "/pwned":
      return new Error("Luminance login refused: the password is in a known breach")
    case "/login":
      // A wrong password and a refused cinfo both land here, told apart only
      // by the flash.
      return flashMessages(flashes).includes("Unsupported platform")
        ? new Error(`Unexpected response from ${hostname}: the login refused the client details`)
        : new Error("Invalid Luminance credentials")
    default:
      return null
  }
}

async function login(
  baseUrl: string,
  creds: { username: string; password: string },
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  const hostname = new URL(baseUrl).hostname
  const loginUrl = `${baseUrl}/login`
  const jar = new Map<string, string>()

  const form = await loginRequest(
    loginUrl,
    { method: "GET", headers: { Accept: ACCEPT_HTML } },
    proxyAgent
  )
  const formHtml = await form.text()
  refuseNoVerdict(form, formHtml)
  mergeCookies(jar, form.setCookies)
  const token = parseLuminanceLoginToken(formHtml)
  if (!token) throw new Error(`Unexpected response from ${hostname}: no login form`)

  // Luminance refuses logins without the width|height|pixelRatio|colorDepth|tzOffset its page submits
  const body = new URLSearchParams({
    token,
    username: creds.username,
    password: creds.password,
    cinfo: "1920|1080|1|24|0",
    keeploggedin: "1",
  }).toString()
  const res = await loginRequest(
    loginUrl,
    {
      method: "POST",
      headers: {
        Accept: ACCEPT_HTML,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader(jar),
      },
      body,
    },
    proxyAgent
  )
  refuseNoVerdict(res, isRedirect(res.status) ? "" : await res.text())
  mergeCookies(jar, res.setCookies)

  const refusal = loginRefusal(res.location(), jar.get("flashes"), baseUrl, hostname)
  if (refusal) throw refusal
  if (!jar.has("sid")) {
    throw new Error(`Unexpected response from ${hostname}: the login answered without a session`)
  }
  return cookieHeader(jar)
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

const COOKIE_EXPIRED =
  "Session expired. Paste a fresh session cookie from a browser login into this tracker's credentials"

/**
 * Where Luminance sends a request whose session it no longer accepts. A dead
 * sid gets `back()`, which is the site root when the request carries no
 * Referer, and a request with no sid gets the login page. Both pages read here
 * answer a live session directly, so a redirect to the root is never routine.
 */
const SESSION_BOUNCE = /^(?:https?:\/\/[^/?#]+)?\/(?:$|[?#]|login|twofactor)/i

/** userAgent is the stored browser's for a pasted session, and absent for our own login. */
function fetchHtml(
  url: string,
  cookies: string,
  userAgent: string | undefined,
  options?: FetchOptions
): Promise<string> {
  return fetchTrackerHtml({
    url,
    cookies,
    userAgent,
    proxyAgent: options?.proxyAgent,
    label: "Luminance",
    sessionExpiredMessage: SESSION_EXPIRED,
    followRedirects: { loginPattern: SESSION_BOUNCE },
  })
}

/**
 * Runs the work with a page fetcher bound to a session. A password session is
 * cached and renewed once when it expires; a pasted one cannot be renewed
 * here, so its expiry asks the user for a fresh cookie.
 */
async function withSession<T>(
  baseUrl: string,
  creds: LuminanceCredentials,
  options: FetchOptions | undefined,
  work: (page: (url: string) => Promise<string>) => Promise<T>
): Promise<T> {
  if ("cookies" in creds) {
    try {
      return await work((url) => fetchHtml(url, creds.cookies, creds.userAgent, options))
    } catch (err) {
      if (err instanceof SessionExpiredError) throw new SessionExpiredError(COOKIE_EXPIRED)
      throw err
    }
  }
  return withLoginSession(
    baseUrl,
    [creds.username, creds.password],
    () => login(baseUrl, creds, options?.proxyAgent),
    (cookies) => work((url) => fetchHtml(url, cookies, undefined, options))
  )
}

const profileEndpoint = (apiPath: string, userId: number) => `${apiPath}?id=${userId}`

/**
 * Reads the home page for the user id when none is cached, then the profile.
 * `progress` holds the id once known, so fetchRaw can tell which call failed.
 */
async function readProfile(
  page: (url: string) => Promise<string>,
  baseUrl: string,
  apiPath: string,
  remoteUserId: number | undefined,
  progress: { userId?: number }
): Promise<{ stats: TrackerStats; endpoint: string }> {
  const hostname = new URL(baseUrl).hostname
  const userId = remoteUserId ?? parseLuminanceUserId(await page(`${baseUrl}/`), hostname)
  progress.userId = userId
  const endpoint = profileEndpoint(apiPath, userId)
  const stats = parseLuminanceProfile(await page(`${baseUrl}${endpoint}`), hostname, userId)
  return { stats, endpoint }
}

export class LuminanceAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseLuminanceCredentials(apiToken)
    const { stats } = await withSession(baseUrl, creds, options, (page) =>
      readProfile(page, baseUrl, apiPath, options?.remoteUserId, {})
    )
    return stats
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const creds = parseLuminanceCredentials(apiToken)
    const remoteUserId = options?.remoteUserId
    const progress: { userId?: number } = {}
    const homePage = (error: string | null): DebugApiCall => ({
      label: "Home Page",
      endpoint: "/",
      data: error === null ? { userId: progress.userId } : null,
      error,
    })
    // Called once the poll has run, so the entry carries the id it read.
    const lookedUp = () => (remoteUserId === undefined ? [homePage(null)] : [])

    try {
      const { stats, endpoint } = await withSession(baseUrl, creds, options, (page) =>
        readProfile(page, baseUrl, apiPath, remoteUserId, progress)
      )
      return [...lookedUp(), { label: "Profile", endpoint, data: stats, error: null }]
    } catch (err) {
      const error = err instanceof Error ? err.message : "Request failed"
      const userId = remoteUserId ?? progress.userId
      if (userId === undefined) {
        return [
          homePage(error),
          {
            label: "Profile",
            endpoint: apiPath,
            data: null,
            error: "Skipped: Home Page failed and no user id is cached",
          },
        ]
      }
      return [
        ...lookedUp(),
        { label: "Profile", endpoint: profileEndpoint(apiPath, userId), data: null, error },
      ]
    }
  }
}
