// src/lib/tracker-platforms/adapters/luminance.ts
//
// Functions: parseLuminanceCredentials, parseLuminanceLoginToken, parseLuminanceUserId,
//            statText, statTime, requiredBytes, numberOrNull, parseLuminanceProfile, request,
//            mergeCookies, flashMessages, cookieHeader, login, getSession, fetchPage,
//            fetchProfileWith, fetchProfile, LuminanceAdapter

import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { classifyFetchError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { parseBytes } from "@/lib/parser"
import { proxyFetch } from "@/lib/tunnel"
import { DEFAULT_USER_AGENT, withDefaultUserAgent } from "@/lib/user-agent"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "../contract"
import { presentClass } from "../helpers/class-name"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { fetchTrackerHtml } from "../helpers/html-fetch"

export interface LuminanceCredentials {
  username: string
  password: string
}

export function parseLuminanceCredentials(apiToken: string): LuminanceCredentials {
  const { username, password } = parseCredentialJson(apiToken, "Luminance", [
    "username",
    "password",
  ] as const)
  return { username: username.trim(), password }
}

export function parseLuminanceLoginToken(html: string): string | null {
  return parseHtml(html).querySelector('input[name="token"]')?.getAttribute("value") || null
}

export function parseLuminanceUserId(html: string): number | null {
  const href = parseHtml(html).querySelector("a.username")?.getAttribute("href") ?? ""
  const id = href.match(/[?&]id=(\d+)/)?.[1]
  return id ? Number(id) : null
}

function statText(doc: ParsedElement, label: string): string | null {
  for (const li of doc.querySelectorAll("ul.stats > li")) {
    const text = li.textContent.replace(/\s+/g, " ").trim()
    if (text.startsWith(label)) return text.slice(label.length).trim()
  }
  return null
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** The time a stats line's span.time title gives, such as "Jan 01 2025, 00:00", as YYYY-MM-DD HH:MM. */
function statTime(doc: ParsedElement, label: string): string | undefined {
  for (const li of doc.querySelectorAll("ul.stats > li")) {
    if (!li.textContent.trim().startsWith(label)) continue
    const title = li.querySelector("span.time")?.getAttribute("title") ?? ""
    const match = title.match(/^([A-Z][a-z]{2}) (\d{1,2}) (\d{4}), (\d{2}):(\d{2})$/)
    const month = match ? MONTHS.indexOf(match[1]) + 1 : 0
    if (!match || month === 0) return undefined
    const [, , day, year, hours, minutes] = match
    return `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")} ${hours}:${minutes}`
  }
  return undefined
}

function requiredBytes(doc: ParsedElement, label: string): bigint {
  const value = statText(doc, label)
  try {
    if (value) return parseBytes(value.replace(/,/g, ""))
  } catch {}
  throw new Error(
    `Unexpected response: unreadable ${label.replace(/:$/, "")} on the Luminance profile`
  )
}

function numberOrNull(value: string | null | undefined): number | null {
  const match = value?.replace(/,/g, "").match(/\d+(\.\d+)?/)
  return match ? Number(match[0]) : null
}

export function parseLuminanceProfile(html: string, remoteUserId?: number): TrackerStats {
  const doc = parseHtml(html)
  const username = doc.querySelector("a.username")?.textContent.trim() ?? ""
  if (!username || !doc.querySelector("ul.stats")) {
    throw new Error("Session expired. Could not find the profile stats")
  }

  const uploadedBytes = requiredBytes(doc, "Uploaded:")
  const downloadedBytes = requiredBytes(doc, "Downloaded:")
  const group =
    presentClass(doc.querySelector("span.rank")?.textContent.trim()) ??
    presentClass(statText(doc, "Class:"))
  const credits =
    doc.querySelector("#bonusdiv > h4")?.textContent ??
    doc.querySelectorAll("h4").find((h) => h.textContent.includes("Credits:"))?.textContent
  const seeding =
    numberOrNull(doc.querySelector("#nav_seeding_r")?.textContent) ??
    numberOrNull(statText(doc, "Seeding:")?.split("(")[0])

  return {
    username,
    group,
    remoteUserId,
    uploadedBytes,
    downloadedBytes,
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount: seeding,
    leechingCount: null,
    seedbonus: numberOrNull(credits?.split(":")[1]),
    hitAndRuns: null,
    requiredRatio: numberOrNull(statText(doc, "Required ratio:")),
    warned: null,
    freeleechTokens: numberOrNull(statText(doc, "Tokens:")),
    joinedDate: statTime(doc, "Joined:"),
    lastAccessDate: statTime(doc, "Last Seen:"),
  }
}

interface RawResponse {
  location: string
  setCookies: string[]
  text: () => Promise<string>
}

async function request(
  url: string,
  init: { method: "GET" | "POST"; headers: Record<string, string>; body?: string },
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<RawResponse> {
  try {
    if (proxyAgent) {
      const res = await proxyFetch(url, proxyAgent, {
        ...init,
        headers: withDefaultUserAgent(init.headers),
        timeoutMs: ADAPTER_FETCH_TIMEOUT_MS,
      })
      const raw = res.headers["set-cookie"]
      return {
        location: res.headers.location ?? "",
        setCookies: Array.isArray(raw) ? raw : raw ? [raw] : [],
        text: () => res.text(),
      }
    }
    const res = await fetch(url, {
      ...init,
      headers: withDefaultUserAgent(init.headers),
      redirect: "manual",
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    })
    return {
      location: res.headers.get("location") ?? "",
      setCookies: res.headers.getSetCookie?.() ?? [],
      text: () => res.text(),
    }
  } catch (err) {
    throw classifyFetchError(err, new URL(url).hostname)
  }
}

function mergeCookies(jar: Map<string, string>, setCookies: string[]): void {
  for (const raw of setCookies) {
    const pair = raw.split(";")[0]?.trim() ?? ""
    const eq = pair.indexOf("=")
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1))
  }
}

export function flashMessages(encoded: string | undefined): string[] {
  if (!encoded) return []
  const candidates = [encoded]
  try {
    candidates.push(decodeURIComponent(encoded.replace(/\+/g, " ")), decodeURIComponent(encoded))
  } catch {}
  for (const candidate of candidates) {
    try {
      const flashes: unknown = JSON.parse(candidate)
      if (!Array.isArray(flashes)) continue
      return flashes
        .map((f) => (typeof f === "string" ? f : (f as { message?: unknown })?.message))
        .filter((m): m is string => typeof m === "string" && m.trim() !== "")
    } catch {}
  }
  return []
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
}

async function login(
  baseUrl: string,
  creds: LuminanceCredentials,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  const jar = new Map<string, string>()
  const accept = { Accept: "text/html,application/xhtml+xml" }

  const form = await request(`${baseUrl}/login`, { method: "GET", headers: accept }, proxyAgent)
  mergeCookies(jar, form.setCookies)
  const token = parseLuminanceLoginToken(await form.text())
  if (!token) throw new Error("Luminance login form not found")

  // Luminance refuses logins without the width|height|pixelRatio|colorDepth|tzOffset its page submits
  const body = new URLSearchParams({
    token,
    username: creds.username,
    password: creds.password,
    cinfo: "1920|1080|1|24|0",
    keeploggedin: "1",
  }).toString()
  const res = await request(
    `${baseUrl}/login`,
    {
      method: "POST",
      headers: {
        ...accept,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader(jar),
      },
      body,
    },
    proxyAgent
  )
  mergeCookies(jar, res.setCookies)
  const returned = res.setCookies.map((c) => c.split("=")[0]?.trim()).filter(Boolean)

  if (/twofactor/i.test(res.location)) {
    throw new Error("Luminance 2FA is not supported. Disable 2FA for this account")
  }
  if (!jar.has("sid")) {
    const reason =
      flashMessages(jar.get("flashes")).join("; ") ||
      `redirected to ${res.location || "?"} (cookies: ${returned.join(", ") || "none"})`
    throw new Error(`Luminance login failed: ${reason}`)
  }
  return cookieHeader(jar)
}

const gLum = globalThis as typeof globalThis & { __luminanceSessions?: Map<string, string> }
if (!gLum.__luminanceSessions) gLum.__luminanceSessions = new Map()
const sessions = gLum.__luminanceSessions

async function getSession(
  baseUrl: string,
  creds: LuminanceCredentials,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  const key = `${baseUrl}|${creds.username}`
  const cached = sessions.get(key)
  if (cached) return cached
  const cookies = await login(baseUrl, creds, proxyAgent)
  sessions.set(key, cookies)
  return cookies
}

function fetchPage(url: string, cookies: string, options?: FetchOptions): Promise<string> {
  return fetchTrackerHtml({
    url,
    cookies,
    userAgent: DEFAULT_USER_AGENT,
    proxyAgent: options?.proxyAgent,
    label: "Luminance",
    sessionExpiredMessage: "Session expired. Logging in again on the next poll",
    followRedirects: { loginPattern: /\/login|\/twofactor/i },
  })
}

async function fetchProfileWith(
  baseUrl: string,
  cookies: string,
  apiPath: string,
  options?: FetchOptions
): Promise<TrackerStats> {
  const userId =
    options?.remoteUserId ?? parseLuminanceUserId(await fetchPage(`${baseUrl}/`, cookies, options))
  if (!userId) throw new Error("Session expired. Could not find the user ID")
  const url = new URL(apiPath, baseUrl)
  url.searchParams.set("id", String(userId))
  return parseLuminanceProfile(await fetchPage(url.toString(), cookies, options), userId)
}

async function fetchProfile(
  baseUrl: string,
  apiToken: string,
  apiPath: string,
  options?: FetchOptions
): Promise<TrackerStats> {
  const creds = parseLuminanceCredentials(apiToken)
  const cookies = await getSession(baseUrl, creds, options?.proxyAgent)
  try {
    return await fetchProfileWith(baseUrl, cookies, apiPath, options)
  } catch (err) {
    if (!(err instanceof Error) || !err.message.startsWith("Session expired")) throw err
    sessions.delete(`${baseUrl}|${creds.username}`)
    const fresh = await getSession(baseUrl, creds, options?.proxyAgent)
    return fetchProfileWith(baseUrl, fresh, apiPath, options)
  }
}

export class LuminanceAdapter implements TrackerAdapter {
  fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    return fetchProfile(baseUrl, apiToken, apiPath, options)
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    parseLuminanceCredentials(apiToken)
    try {
      const stats = await fetchProfile(baseUrl, apiToken, apiPath, options)
      return [{ label: "Profile", endpoint: apiPath, data: stats, error: null }]
    } catch (err) {
      return [
        {
          label: "Profile",
          endpoint: apiPath,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
