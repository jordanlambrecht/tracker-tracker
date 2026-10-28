// src/lib/tracker-platforms/adapters/rutracker.ts
//
// Functions: parseRutrackerCredentials, encodeSiteForm, assertSignedIn, extractFormToken,
//            parseRutrackerIndex, siteBytes, detailsRow, parseReleases, parseRutrackerProfile,
//            englishRank, englishTenure, bytesField, parseTrafStats, parseSeedingCount,
//            parseRutrackerCaptcha, mergeCookies, cookieHeader, jarOf, sitePage, sessionKey,
//            dropCaptcha, holdCaptcha, liveCaptcha, isLoginPage, login, pause, RutrackerAdapter

import { randomBytes, scrypt } from "node:crypto"
import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { log } from "@/lib/logger"
import type {
  DebugApiCall,
  FetchOptions,
  PendingCaptcha,
  RuTrackerPlatformMeta,
  TrackerAdapter,
  TrackerOverview,
} from "../contract"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { SessionExpiredError } from "../helpers/errors"
import {
  isCloudflareChallenge,
  normalizeWhitespace,
  tryParseCount,
  tryParseSiteBytes,
} from "../helpers/html-parse"
import { loginRequest } from "../helpers/login-session"

// RuTracker has no API and shows no download figure, so a poll is an account
// overview: the signed-in header contains the account, the profile contains the
// role and other details, and the profile's AJAX call and seeding list provide
// the upload figures when upload statistics are switched on. The adapter logs in
// with the username and password and reads the pages itself, through the proxy
// when one is set. A Cloudflare challenge fails the poll.

const LABEL = "RuTracker"
/** The site's charset: its pages are decoded from it and submitted forms encoded in it. */
const SITE_CHARSET = "windows-1251"
const SESSION_EXPIRED = "Session expired. The RuTracker session is logged out"
const CHALLENGE = "Cloudflare challenge detected on RuTracker"
const CAPTCHA_NEEDED = "Enter the RuTracker captcha on the tracker page"
const CAPTCHA_WRONG = "Wrong captcha, try the new one"
const NO_CAPTCHA = "No RuTracker captcha is pending"
/** How long an unanswered captcha, and the cookies it was shown with, is kept. */
const CAPTCHA_TTL_MS = 10 * 60 * 1000
/** Besides the tracker's own host, where the site serves captcha images from. */
const CAPTCHA_IMAGE_HOSTS = ["static.rutracker.cc"]
const LOGIN_PATTERN = /login\.php/i
/** Spacing between the requests of one poll, as Gazelle's enrichment does. */
const REQUEST_GAP_MS = 1500
/** The profile's seeding list stops at this many rows. */
const SEEDING_LIST_CAP = 100
/** A light page that contains the signed-in header, used for the first request. */
const LANDING_PATH = "/forum/privmsg.php?folder=inbox"
const ACCEPT_HTML = "text/html,application/xhtml+xml"
const siteDecoder = new TextDecoder(SITE_CHARSET)

// The windows-1251 byte of each character the charset has above ASCII.
const SITE_BYTES: ReadonlyMap<string, number> = (() => {
  const bytes = new Map<string, number>()
  for (let byte = 0x80; byte <= 0xff; byte++) {
    const char = siteDecoder.decode(Uint8Array.of(byte))
    if (char !== "\ufffd") bytes.set(char, byte)
  }
  return bytes
})()

/**
 * A form body as a browser sends it from a windows-1251 page: Cyrillic in the
 * site's charset, and a character it lacks as a numeric reference, `&#NNNN;`.
 */
export function encodeSiteForm(fields: Record<string, string>): string {
  const encode = (text: string) => {
    const bytes: number[] = []
    for (const char of text) {
      const code = char.codePointAt(0) as number
      const site = SITE_BYTES.get(char)
      if (code < 0x80) bytes.push(code)
      else if (site !== undefined) bytes.push(site)
      else for (const c of `&#${code};`) bytes.push(c.charCodeAt(0))
    }
    return bytes
      .map((b) =>
        /[A-Za-z0-9*\-._]/.test(String.fromCharCode(b))
          ? String.fromCharCode(b)
          : b === 0x20
            ? "+"
            : `%${b.toString(16).toUpperCase().padStart(2, "0")}`
      )
      .join("")
  }
  return Object.entries(fields)
    .map(([name, value]) => `${encode(name)}=${encode(value)}`)
    .join("&")
}

/** English names for the site's roles and titles; a name missing here is shown as printed. */
const RANK_NAMES: Record<string, string> = {
  пользователь: "User",
  "участник групп": "Group Member",
  модератор: "Moderator",
  "старший модератор": "Senior Moderator",
  "модератор-стажёр": "Trainee Moderator",
  "модератор-стажер": "Trainee Moderator",
  "помощник модератора": "Moderator Assistant",
  администратор: "Administrator",
  "техническая помощь": "Technical Support",
  хранитель: "Keeper",
  хранители: "Keepers",
  старожил: "Oldie",
  старожилы: "Oldie",
}
/** Qualifiers the site appends in parentheses, as in "VIP (Адм)". */
const RANK_QUALIFIERS: Record<string, string> = { адм: "Adm", неактивен: "inactive" }
/** Tenure units by the start of the Russian word, which changes its ending with the number. */
const TENURE_UNITS: [prefix: string, unit: string][] = [
  ["лет", "year"],
  ["год", "year"],
  ["мес", "month"],
  ["нед", "week"],
  ["д", "day"],
  ["час", "hour"],
  ["мин", "minute"],
]

export interface RutrackerCredentials {
  username: string
  password: string
}

export function parseRutrackerCredentials(apiToken: string): RutrackerCredentials {
  const { username, password } = parseCredentialJson(apiToken, LABEL, [
    "username",
    "password",
  ] as const)
  // Never trimmed: leading or trailing spaces are part of the secret.
  return { username: username.trim(), password }
}

/** A challenge or a guest page served with a 200 is not the member's page. */
function assertSignedIn(html: string, doc: ParsedElement): void {
  if (isCloudflareChallenge(html)) throw new Error(CHALLENGE)
  if (!doc.querySelector("#logged-in-username")) {
    throw new SessionExpiredError(SESSION_EXPIRED)
  }
}

/** `form_token: '<hex>'` in the page's inline `window.BB` settings. */
function extractFormToken(html: string): string | undefined {
  return html.match(/form_token\s*:\s*'([0-9a-f]{16,64})'/i)?.[1]
}

export interface RutrackerIndex {
  username: string
  userId: number
  formToken?: string
}

export function parseRutrackerIndex(html: string, hostname: string): RutrackerIndex {
  const doc = parseHtml(html)
  assertSignedIn(html, doc)

  const link = doc.querySelector("#logged-in-username")
  const username = normalizeWhitespace(link?.textContent ?? "")
  const userId = Number.parseInt(link?.getAttribute("href")?.match(/[?&]u=(\d+)/)?.[1] ?? "", 10)
  if (!username || !Number.isFinite(userId) || userId <= 0) {
    throw new Error(`Unexpected response from ${hostname}: no username in the RuTracker header`)
  }
  return { username, userId, formToken: extractFormToken(html) }
}

/**
 * A size as the site prints it ("2.86&nbsp;GB", "&middot; 976.96 GB") in bytes.
 * The site's units are binary whatever it calls them: 5511890221000 bytes is
 * printed as 5.013 TB.
 */
function siteBytes(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined
  const text = normalizeWhitespace(value.replace(/&nbsp;/g, " "))
    .replace(/^·\s*/, "")
    .replace(/([KMGTP])B$/i, "$1iB")
  const size = tryParseSiteBytes(text)
  return size === undefined ? undefined : Number(size)
}

/** The value cell beside a `th` label in the profile's details table. */
function detailsRow(doc: ParsedElement, label: string): ParsedElement | undefined {
  for (const row of doc.querySelectorAll("table.user_details tr")) {
    const th = row.querySelector("th")
    if (th && normalizeWhitespace(th.textContent).startsWith(label)) {
      return row.querySelector("td") ?? undefined
    }
  }
  return undefined
}

/** "Раздачи:": all releases, then the verified ones after the approved mark. */
function parseReleases(cell: ParsedElement | undefined): Partial<RuTrackerPlatformMeta> {
  if (!cell) return {}
  const meta: Partial<RuTrackerPlatformMeta> = {}
  const all = cell.querySelector('a[href*="tracker.php?rid="]')
  if (all) {
    const bolds = all.querySelectorAll("b")
    meta.releases = tryParseCount(bolds[0]?.textContent)
    meta.releasesBytes = siteBytes(bolds[1]?.textContent)
  }
  const verified = cell.querySelector(".tor-approved")?.parentNode
  if (verified) {
    const text = normalizeWhitespace(verified.textContent).replace(/^√\s*/, "")
    meta.verifiedReleases = tryParseCount(text)
    meta.verifiedReleasesBytes = siteBytes(verified.querySelector(".seedmed")?.textContent)
  }
  // Undefined members are left out rather than set, so JSON stores no key for them.
  return Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined)
  ) as Partial<RuTrackerPlatformMeta>
}

export interface RutrackerProfile {
  group: string | null
  joinedDate?: string
  avatarUrl?: string
  formToken?: string
  /** The profile contains the seeding list heading, present only when statistics are on. */
  hasSeedingList: boolean
  meta: RuTrackerPlatformMeta
}

function englishRank(name: string): string {
  const match = name.match(/^(.*?)\s*(?:\(([^)]*)\))?$/)
  const base = (match?.[1] ?? name).trim()
  const qualifier = match?.[2]?.trim()
  const english = RANK_NAMES[base.toLowerCase()] ?? base
  if (!qualifier) return english
  return `${english} (${RANK_QUALIFIERS[qualifier.toLowerCase()] ?? qualifier})`
}

/** "18 лет 6 месяцев" as "18 years 6 months"; text with an unknown unit is returned unchanged. */
function englishTenure(text: string): string {
  const parts = [...text.matchAll(/(\d+)\s*([а-яё]+)\.?/gi)]
  if (parts.length === 0 || parts.map((p) => p[0]).join(" ") !== text.replace(/\s+/g, " ").trim()) {
    return text
  }
  const english: string[] = []
  for (const [, count, word] of parts) {
    const unit = TENURE_UNITS.find(([prefix]) => word.toLowerCase().startsWith(prefix))?.[1]
    if (!unit) return text
    english.push(`${count} ${unit}${count === "1" ? "" : "s"}`)
  }
  return english.join(" ")
}

export function parseRutrackerProfile(
  html: string,
  hostname: string,
  baseUrl: string
): RutrackerProfile {
  const doc = parseHtml(html)
  assertSignedIn(html, doc)

  const roleCell = doc.querySelector("#role")
  if (!doc.querySelector("table.user_details") || !roleCell) {
    throw new Error(`Unexpected response from ${hostname}: no RuTracker profile table`)
  }

  const meta: RuTrackerPlatformMeta = {}

  const role = normalizeWhitespace(roleCell.querySelector("b:not(#ban-msg)")?.textContent ?? "")
  if (role) meta.role = englishRank(role)

  // "Звание: <b>VIP (Адм)</b>", or "нет" for none. For a rank shown only as an
  // image, the name is in the image title.
  let title: string | undefined
  for (const div of doc.querySelectorAll(".user_profile .med.mrg_4")) {
    const text = normalizeWhitespace(div.textContent)
    if (!text.startsWith("Звание:")) continue
    const value = text.slice("Звание:".length).trim()
    if (value && value.toLowerCase() !== "нет") title = value
  }
  if (!title) {
    const imageTitle = doc.querySelector("#rank-img img")?.getAttribute("title")?.trim()
    if (imageTitle) title = imageTitle
  }
  if (title) meta.title = englishRank(title)

  const banNote = normalizeWhitespace(doc.querySelector("#ban-msg")?.textContent ?? "")
  meta.restricted = banNote.length > 0
  if (banNote) meta.restrictionNote = banNote

  const tenure = normalizeWhitespace(detailsRow(doc, "Стаж:")?.textContent ?? "")
  if (tenure) meta.tenure = englishTenure(tenure)

  const joined = normalizeWhitespace(detailsRow(doc, "Зарегистрирован:")?.textContent ?? "")
  const joinedDate = joined.match(/\d{4}-\d{2}-\d{2}/)?.[0]

  // The profile prints zero posts as "Нет".
  const posts = doc.querySelector("#posts")
  if (posts) {
    const text = normalizeWhitespace(posts.textContent)
    const count = /^нет$/i.test(text) ? 0 : tryParseCount(posts.querySelector("b")?.textContent)
    if (count !== undefined) meta.posts = count
  }

  Object.assign(meta, parseReleases(detailsRow(doc, "Раздачи:")))

  if (detailsRow(doc, "Статистика отключена:")) meta.statsEnabled = false
  else if (doc.querySelector("#traf-stats-tbl")) meta.statsEnabled = true

  const hasSeedingList = doc
    .querySelectorAll("h1.pagetitle")
    .some((h) => h.textContent.includes("Сидируемые раздачи"))

  const avatarSrc = doc.querySelector("#avatar-img img")?.getAttribute("src")
  let avatarUrl: string | undefined
  if (avatarSrc) {
    try {
      avatarUrl = new URL(avatarSrc, baseUrl).href
    } catch {
      avatarUrl = undefined
    }
  }

  return {
    group: meta.title ?? meta.role ?? null,
    joinedDate,
    avatarUrl,
    formToken: extractFormToken(html),
    hasSeedingList,
    meta,
  }
}

/** An exact byte string ("193027526010024") as a number, or undefined. */
function bytesField(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

/** The profile's `get_traf_stats` AJAX reply. */
export function parseTrafStats(body: string, hostname: string): Partial<RuTrackerPlatformMeta> {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(body) as Record<string, unknown>
  } catch {
    throw new Error(`Unexpected response from ${hostname}: upload statistics were not JSON`)
  }
  if (typeof data !== "object" || data === null) {
    throw new Error(`Unexpected response from ${hostname}: upload statistics were not an object`)
  }
  const uploadedBytes = bytesField(data.uploaded_total_byte)
  if (uploadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: no upload total in the statistics`)
  }
  // Undefined members are left out rather than set, so JSON stores no key for them.
  const figures: Partial<Record<keyof RuTrackerPlatformMeta, number | undefined>> = {
    uploadedBytes,
    uploadedTodayBytes: siteBytes(data.uploaded_day),
    uploadedYesterdayBytes: siteBytes(data.up_yesterday),
    rareUploadedBytes: bytesField(data.up_rare_total_byte),
    rareUploadedTodayBytes: siteBytes(data.up_rare_day),
    rareUploadedYesterdayBytes: siteBytes(data.up_rare_yesterday),
  }
  return Object.fromEntries(
    Object.entries(figures).filter(([, value]) => value !== undefined)
  ) as Partial<RuTrackerPlatformMeta>
}

/** "Сидируемые раздачи: <b>N</b>", or "нет" for none. */
export function parseSeedingCount(html: string): number | undefined {
  const doc = parseHtml(html)
  const heading = doc
    .querySelectorAll("h1.pagetitle")
    .find((h) => h.textContent.includes("Сидируемые раздачи"))
  if (!heading) return undefined
  const count = heading.querySelector("b")
  if (count) return tryParseCount(count.textContent)
  return /нет/i.test(heading.textContent) ? 0 : undefined
}

export interface RutrackerCaptcha {
  imageUrl: string
  capSid: string
  /** The answer's field name, `cap_code_<hash>`, which changes with each captcha */
  codeField: string
}

/**
 * The captcha in a login form, or null when there is none. The image must be
 * an https URL on the tracker or its static host, since the server fetches it.
 */
export function parseRutrackerCaptcha(html: string, baseUrl: string): RutrackerCaptcha | null {
  const doc = parseHtml(html)
  const capSid = doc.querySelector('input[name="cap_sid"]')?.getAttribute("value")
  const codeField = doc
    .querySelectorAll("input")
    .map((input) => input.getAttribute("name") ?? "")
    .find((name) => /^cap_code_[0-9a-z]+$/i.test(name))
  const src = doc.querySelector('img[src*="/captcha/"]')?.getAttribute("src")
  if (!capSid || !codeField || !src) return null
  let image: URL
  try {
    image = new URL(src, baseUrl)
  } catch {
    return null
  }
  const allowedHost =
    CAPTCHA_IMAGE_HOSTS.includes(image.hostname) || image.hostname === new URL(baseUrl).hostname
  if (image.protocol !== "https:" || !allowedHost) return null
  return { imageUrl: image.href, capSid, codeField }
}

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

function jarOf(header: string | undefined): Map<string, string> {
  const jar = new Map<string, string>()
  if (header) mergeCookies(jar, header.split("; "))
  return jar
}

interface SitePage {
  status: number
  location: string
  html: string
}

/**
 * One request to the site with the jar's cookies, a POST when there is a form.
 * Cookies the answer sets are added to the jar. Redirects are not followed.
 */
async function sitePage(
  url: string,
  jar: Map<string, string>,
  proxyAgent: FetchOptions["proxyAgent"],
  form?: Record<string, string>
): Promise<SitePage> {
  const headers: Record<string, string> = { Accept: ACCEPT_HTML }
  if (jar.size > 0) headers.Cookie = cookieHeader(jar)
  if (form) headers["Content-Type"] = "application/x-www-form-urlencoded"
  const res = await loginRequest(
    url,
    { method: form ? "POST" : "GET", headers, body: form ? encodeSiteForm(form) : undefined },
    proxyAgent
  )
  mergeCookies(jar, res.setCookies)
  const html = siteDecoder.decode(await res.bytes())
  if (isCloudflareChallenge(html)) throw new Error(CHALLENGE)
  return { status: res.status, location: res.location(), html }
}

const isRedirect = (status: number) => status >= 300 && status < 400

// Logging in on every poll would post the password hourly, and RuTracker shows a
// captcha after repeated logins. The session cookies are cached across polls,
// keyed by a hash of the credentials as for TorrentLeech. The cache is in memory
// only.

const gRt = globalThis as typeof globalThis & {
  __rutrackerSessionCache?: Map<string, string>
  __rutrackerSessionSalt?: Buffer
}
if (!gRt.__rutrackerSessionCache) gRt.__rutrackerSessionCache = new Map()
if (!gRt.__rutrackerSessionSalt) gRt.__rutrackerSessionSalt = randomBytes(16)
const sessionCache = gRt.__rutrackerSessionCache
const sessionSalt = gRt.__rutrackerSessionSalt

// A captcha waiting for the user's answer, stored with the cookies it was shown
// with, since the answer is checked against that session. Keyed like the
// session cache.
interface HeldCaptcha extends RutrackerCaptcha {
  cookies: string
  expiresAt: number
  timer: ReturnType<typeof setTimeout>
}

const gRtCaptcha = globalThis as typeof globalThis & {
  __rutrackerCaptchas?: Map<string, HeldCaptcha>
}
if (!gRtCaptcha.__rutrackerCaptchas) gRtCaptcha.__rutrackerCaptchas = new Map()
const captchas = gRtCaptcha.__rutrackerCaptchas
// Taken at load so a test's fake clock cannot fire the expiry early; whether a
// captcha has expired is read from Date.now() whenever it is looked up.
const expiryTimer = { set: setTimeout, clear: clearTimeout }

function dropCaptcha(key: string): void {
  const held = captchas.get(key)
  if (!held) return
  expiryTimer.clear(held.timer)
  captchas.delete(key)
}

function holdCaptcha(key: string, jar: Map<string, string>, captcha: RutrackerCaptcha): void {
  dropCaptcha(key)
  const timer = expiryTimer.set(() => dropCaptcha(key), CAPTCHA_TTL_MS)
  timer.unref?.()
  captchas.set(key, {
    ...captcha,
    cookies: cookieHeader(jar),
    expiresAt: Date.now() + CAPTCHA_TTL_MS,
    timer,
  })
}

function liveCaptcha(key: string): HeldCaptcha | undefined {
  const held = captchas.get(key)
  if (held && held.expiresAt <= Date.now()) {
    dropCaptcha(key)
    return undefined
  }
  return held
}

function sessionKey(baseUrl: string, creds: RutrackerCredentials): Promise<string> {
  return new Promise((resolve, reject) => {
    scrypt(`${creds.username}\u0000${creds.password}`, sessionSalt, 32, (err, derived) => {
      if (err) reject(err)
      else resolve(`${baseUrl}|${derived.toString("hex")}`)
    })
  })
}

/** The login form, on the login page or the guest index. */
function isLoginPage(html: string): boolean {
  return /name="login_username"/.test(html)
}

type LoginOutcome = { kind: "signed-in" } | { kind: "captcha"; captcha: RutrackerCaptcha }

/**
 * Submits the login form with the jar's cookies, with the answer to a captcha
 * when there is one. The password goes only into the submitted form. A login
 * that goes through answers with a redirect that sets bb_session.
 */
async function login(
  baseUrl: string,
  creds: RutrackerCredentials,
  jar: Map<string, string>,
  proxyAgent: FetchOptions["proxyAgent"],
  captcha?: { capSid: string; codeField: string; answer: string }
): Promise<LoginOutcome> {
  const page = await sitePage(`${baseUrl}/forum/login.php`, jar, proxyAgent, {
    redirect: LANDING_PATH.replace("/forum/", ""),
    login_username: creds.username,
    login_password: creds.password,
    login: "Вход",
    ...(captcha ? { cap_sid: captcha.capSid, [captcha.codeField]: captcha.answer } : {}),
  })
  if (isRedirect(page.status) && jar.has("bb_session")) return { kind: "signed-in" }
  const shown = parseRutrackerCaptcha(page.html, baseUrl)
  if (shown) return { kind: "captcha", captcha: shown }
  if (isLoginPage(page.html)) {
    throw new Error("Invalid RuTracker credentials")
  }
  throw new Error(
    `Unexpected response from ${new URL(baseUrl).hostname}: no RuTracker login result`
  )
}

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS))
}

interface PollPages {
  index?: RutrackerIndex
  profile?: RutrackerProfile
  trafStats?: Partial<RuTrackerPlatformMeta>
  seedingCount?: number
}

type Step = "header" | "login" | "profile" | "trafStats" | "seeding"

type OnStep = (step: Step, endpoint: string, data: unknown, error: unknown) => void

export class RutrackerAdapter implements TrackerAdapter {
  /**
   * The signed-in header and the profile are required. The statistics and the seeding
   * list are best-effort: a failure there is reported to `onStep` and the poll
   * continues without them.
   */
  private async readPages(
    baseUrl: string,
    creds: RutrackerCredentials,
    proxyAgent: FetchOptions["proxyAgent"],
    onStep: OnStep
  ): Promise<PollPages> {
    const hostname = new URL(baseUrl).hostname
    const key = await sessionKey(baseUrl, creds)
    let jar = jarOf(sessionCache.get(key))
    const pages: PollPages = {}

    // A page that redirects to the login form means the session was dropped.
    const get = async (path: string) => {
      const page = await sitePage(`${baseUrl}${path}`, jar, proxyAgent)
      if (isRedirect(page.status)) {
        if (LOGIN_PATTERN.test(page.location)) throw new SessionExpiredError(SESSION_EXPIRED)
        throw new Error(`Unexpected response from ${hostname}: ${path} redirected`)
      }
      return page.html
    }
    const post = async (path: string, fields: Record<string, string>) => {
      const page = await sitePage(`${baseUrl}${path}`, jar, proxyAgent, fields)
      if (page.status >= 300) {
        throw new Error(`Unexpected response from ${hostname}: ${path} returned ${page.status}`)
      }
      return page.html
    }

    let landingHtml: string
    try {
      landingHtml = await get(LANDING_PATH)
    } catch (err) {
      if (!(err instanceof SessionExpiredError)) {
        onStep("header", LANDING_PATH, null, err)
        throw err
      }
      landingHtml = ""
    }

    if (!landingHtml.includes('id="logged-in-username"')) {
      sessionCache.delete(key)
      try {
        // While a captcha is pending, the password is not posted again.
        if (liveCaptcha(key)) throw new Error(CAPTCHA_NEEDED)
        jar = new Map()
        await pause()
        // The login page can show a captcha before anything is posted.
        const loginPage = await get("/forum/login.php")
        let captcha = parseRutrackerCaptcha(loginPage, baseUrl)
        if (!captcha) {
          await pause()
          const outcome = await login(baseUrl, creds, jar, proxyAgent)
          if (outcome.kind === "captcha") captcha = outcome.captcha
        }
        if (captcha) {
          holdCaptcha(key, jar, captcha)
          throw new Error(CAPTCHA_NEEDED)
        }
        sessionCache.set(key, cookieHeader(jar))
        onStep("login", "/forum/login.php", { loggedIn: true }, null)
      } catch (err) {
        onStep("login", "/forum/login.php", null, err)
        throw err
      }
      await pause()
      try {
        landingHtml = await get(LANDING_PATH)
      } catch (err) {
        onStep("header", LANDING_PATH, null, err)
        throw err
      }
    }

    try {
      pages.index = parseRutrackerIndex(landingHtml, hostname)
      onStep("header", LANDING_PATH, pages.index, null)
    } catch (err) {
      onStep("header", LANDING_PATH, null, err)
      throw err
    }
    const { userId } = pages.index

    await pause()
    const profileEndpoint = `/forum/profile.php?mode=viewprofile&u=${userId}`
    try {
      pages.profile = parseRutrackerProfile(await get(profileEndpoint), hostname, baseUrl)
      onStep("profile", profileEndpoint, pages.profile, null)
    } catch (err) {
      onStep("profile", profileEndpoint, null, err)
      throw err
    }

    const { profile } = pages
    const formToken = profile.formToken ?? pages.index.formToken
    // The AJAX call returns zeros when statistics are off, so it is made only
    // when the profile shows statistics as on.
    if (profile.meta.statsEnabled !== true || !formToken) return pages

    await pause()
    const ajaxEndpoint = "/forum/ajax.php"
    try {
      const body = await post(ajaxEndpoint, {
        action: "get_traf_stats",
        user_id: String(userId),
        form_token: formToken,
      })
      pages.trafStats = parseTrafStats(body, hostname)
      onStep("trafStats", ajaxEndpoint, pages.trafStats, null)
    } catch (err) {
      onStep("trafStats", ajaxEndpoint, null, err)
    }

    if (!profile.hasSeedingList) return pages

    await pause()
    try {
      const html = await post(profileEndpoint, { form_token: formToken, show_seeding: "1" })
      pages.seedingCount = parseSeedingCount(html)
      onStep("seeding", profileEndpoint, { seedingCount: pages.seedingCount ?? null }, null)
    } catch (err) {
      onStep("seeding", profileEndpoint, null, err)
    }

    return pages
  }

  /** Once more after an expired session, with the cached cookies dropped. */
  private async readPagesWithRetry(
    baseUrl: string,
    creds: RutrackerCredentials,
    proxyAgent: FetchOptions["proxyAgent"],
    onStep: OnStep
  ): Promise<PollPages> {
    try {
      return await this.readPages(baseUrl, creds, proxyAgent, onStep)
    } catch (err) {
      if (!(err instanceof SessionExpiredError)) throw err
      sessionCache.delete(await sessionKey(baseUrl, creds))
      return this.readPages(baseUrl, creds, proxyAgent, onStep)
    }
  }

  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerOverview> {
    const creds = parseRutrackerCredentials(apiToken)
    const pages = await this.readPagesWithRetry(
      baseUrl,
      creds,
      options?.proxyAgent,
      (step, _e, _d, err) => {
        if (err && (step === "trafStats" || step === "seeding")) {
          log.warn(
            { error: err instanceof Error ? err.message : String(err) },
            `rutracker: ${step === "trafStats" ? "upload statistics" : "seeding list"} unavailable, overview kept`
          )
        }
      }
    )
    const { index, profile } = pages
    if (!index || !profile) {
      throw new Error(`Unexpected response from ${new URL(baseUrl).hostname}: incomplete poll`)
    }

    const meta: RuTrackerPlatformMeta = { ...profile.meta, ...pages.trafStats }
    if (pages.seedingCount !== undefined) {
      meta.seedingCount = pages.seedingCount
      meta.seedingCapped = pages.seedingCount >= SEEDING_LIST_CAP
    }

    const overview: TrackerOverview = {
      kind: "overview",
      username: index.username,
      group: profile.group,
      remoteUserId: index.userId,
      platformMeta: meta,
    }
    if (profile.joinedDate) overview.joinedDate = profile.joinedDate
    if (profile.avatarUrl) overview.avatarUrl = profile.avatarUrl
    return overview
  }

  async pendingCaptcha(baseUrl: string, apiToken: string): Promise<PendingCaptcha | null> {
    const held = liveCaptcha(await sessionKey(baseUrl, parseRutrackerCredentials(apiToken)))
    return held
      ? { imageUrl: held.imageUrl, expiresAt: new Date(held.expiresAt).toISOString() }
      : null
  }

  async submitCaptcha(
    baseUrl: string,
    apiToken: string,
    answer: string,
    options?: FetchOptions
  ): Promise<void> {
    const creds = parseRutrackerCredentials(apiToken)
    const key = await sessionKey(baseUrl, creds)
    const held = liveCaptcha(key)
    if (!held) throw new Error(NO_CAPTCHA)

    const jar = jarOf(held.cookies)
    let outcome: LoginOutcome
    try {
      outcome = await login(baseUrl, creds, jar, options?.proxyAgent, {
        capSid: held.capSid,
        codeField: held.codeField,
        answer,
      })
    } catch (err) {
      dropCaptcha(key)
      throw err
    }
    // A wrong answer is followed by a new captcha.
    if (outcome.kind === "captcha") {
      holdCaptcha(key, jar, outcome.captcha)
      throw new Error(CAPTCHA_WRONG)
    }
    sessionCache.set(key, cookieHeader(jar))
    dropCaptcha(key)
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    // Parsed outside the try so a malformed credential throws to the route.
    const creds = parseRutrackerCredentials(apiToken)
    const labels: Record<Step, string> = {
      header: "Account Header",
      login: "Login",
      profile: "Profile",
      trafStats: "Upload Statistics",
      seeding: "Seeding List",
    }
    const calls: DebugApiCall[] = []
    try {
      await this.readPagesWithRetry(
        baseUrl,
        creds,
        options?.proxyAgent,
        (step, endpoint, data, err) => {
          calls.push({
            label: labels[step],
            endpoint,
            data: err ? null : data,
            error: err ? (err instanceof Error ? err.message : "Request failed") : null,
          })
        }
      )
    } catch {
      // Already recorded as the failing call.
    }
    return calls
  }
}
