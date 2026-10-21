// src/lib/tracker-platforms/adapters/portugas.ts
//
// Functions: parsePortugasCredentials, assertAuthenticated, readText,
//            parseCount, readKeyValues, findKey, findTime,
//            parsePortugasHomepage, parsePortugasProfile, PortugasAdapter

import { parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"
import type {
  DebugApiCall,
  FetchOptions,
  PortugasPlatformMeta,
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

// PortuGas runs a custom UNIT3D build with no /api/user route: its API key
// only drives the torrent search API. User stats live in the logged-in HTML,
// so this adapter authenticates with pasted browser cookies, like FileList.
const LABEL = "Portugas"
const SESSION_EXPIRED = "Session expired. Browser cookies need to be refreshed"
const COOKIE_NAMES = ["laravel_session", "portugas_session", "XSRF-TOKEN"] as const

type HtmlDocument = ReturnType<typeof parseHtml>

export interface PortugasCredentials {
  cookies: string
  userAgent: string
}

export function parsePortugasCredentials(apiToken: string): PortugasCredentials {
  const { cookies, userAgent } = parseCredentialJson(apiToken, LABEL, [
    "cookies",
    "userAgent",
  ] as const)

  return {
    cookies: validateCookieHeader(cookies, {
      extraCookieNames: COOKIE_NAMES,
      example: "laravel_session=...; XSRF-TOKEN=...",
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
  if (!html.includes("/logout") || !html.includes("top-nav__stats")) {
    throw new SessionExpiredError(SESSION_EXPIRED)
  }
}

function readText(doc: HtmlDocument, selector: string): string | undefined {
  const element = doc.querySelector(selector)
  if (!element) return undefined
  const value = normalizeWhitespace(element.textContent)
  return value === "" ? undefined : value
}

/** BON points print as "19 910", so the thousands space is stripped first. */
function parseCount(value: string | undefined): number | undefined {
  if (!value) return undefined
  return tryParseCount(value.replace(/\s/g, ""))
}

function readKeyValues(doc: HtmlDocument): Map<string, string> {
  const values = new Map<string, string>()
  for (const group of doc.querySelectorAll(".key-value__group")) {
    const key = group.querySelector("dt")?.textContent
    const value = group.querySelector("dd")?.textContent
    if (!key || !value) continue
    const normalizedKey = normalizeWhitespace(key)
    if (!values.has(normalizedKey)) values.set(normalizedKey, normalizeWhitespace(value))
  }
  return values
}

function findKey(values: Map<string, string>, needle: string): string | undefined {
  for (const [key, value] of values) {
    if (key.toLowerCase().includes(needle.toLowerCase())) return value
  }
  return undefined
}

function findTime(doc: HtmlDocument, label: string): string | undefined {
  for (const group of doc.querySelectorAll(".key-value__group")) {
    const key = group.querySelector("dt")?.textContent
    if (!key || !normalizeWhitespace(key).toLowerCase().includes(label.toLowerCase())) continue
    const time = group.querySelector("time")?.getAttribute("datetime")
    if (time) return datePrefix(normalizeWhitespace(time))
  }
  return undefined
}

interface PortugasHomeReadout {
  stats: TrackerStats
  username?: string
}

/**
 * The ratio bar repeats on every authenticated page, so the homepage alone
 * carries the totals, counts, ratio, BON points and the current class.
 */
export function parsePortugasHomepage(html: string, hostname: string): PortugasHomeReadout {
  assertAuthenticated(html)
  const doc = parseHtml(html)

  const userLink = doc.querySelector(".top-nav__username .user-tag__link")
  const username = userLink?.getAttribute("href")?.match(/\/users\/([^/?#]+)/)?.[1]
  const group = userLink?.getAttribute("title")?.trim() || null

  const uploadedBytes = tryParseSiteBytes(readText(doc, ".ratio-bar__uploaded a") ?? "")
  const downloadedBytes = tryParseSiteBytes(readText(doc, ".ratio-bar__downloaded a") ?? "")
  if (uploadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: missing uploaded total`)
  }
  if (downloadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: missing downloaded total`)
  }

  const reportedRatio = parseCount(readText(doc, ".ratio-bar__ratio a"))
  const reportedBuffer = tryParseSiteBytes(readText(doc, ".ratio-bar__buffer a") ?? "")

  const meta: PortugasPlatformMeta = {}
  const invites = parseCount(readText(doc, ".ratio-bar__invites a"))
  if (invites !== undefined) meta.invites = invites

  return {
    username,
    stats: {
      username: username ?? "",
      group,
      uploadedBytes,
      downloadedBytes,
      ratio:
        downloadedBytes === 0n
          ? computeRatio(uploadedBytes, downloadedBytes)
          : (reportedRatio ?? computeRatio(uploadedBytes, downloadedBytes)),
      bufferBytes: reportedBuffer ?? computeBufferBytes(uploadedBytes, downloadedBytes),
      seedingCount: parseCount(readText(doc, ".ratio-bar__seeding a")) ?? null,
      leechingCount: parseCount(readText(doc, ".ratio-bar__leeching a")) ?? null,
      seedbonus: parseCount(readText(doc, ".ratio-bar__points a")) ?? null,
      hitAndRuns: null,
      requiredRatio: null,
      warned: null,
      freeleechTokens: parseCount(readText(doc, ".ratio-bar__tokens a")) ?? null,
      remoteUserId: undefined,
      joinedDate: undefined,
      lastAccessDate: undefined,
      platformMeta: Object.keys(meta).length > 0 ? meta : undefined,
    },
  }
}

/** Profile-page figures the ratio bar does not carry. */
export function parsePortugasProfile(html: string): Partial<TrackerStats> {
  assertAuthenticated(html)
  const doc = parseHtml(html)
  const values = readKeyValues(doc)

  const registration = doc.querySelector(".profile__registration")?.getAttribute("datetime")
  const joinedDate = registration ? datePrefix(normalizeWhitespace(registration)) : undefined
  const lastAccessDate = findTime(doc, "Última Ação") ?? findTime(doc, "Último Login")

  const userId = parseCount(findKey(values, "ID do Utilizador"))
  const hnrCount = parseCount(findKey(values, "Contagem de HnR"))
  const warnings = parseCount(findKey(values, "Avisos Ativos"))
  const seedSizeBytes = tryParseSiteBytes(findKey(values, "Tamanho das Sementes") ?? "")
  const realRatio = parseCount(findKey(values, "Real Rácio"))

  const meta: PortugasPlatformMeta = {}
  if (hnrCount !== undefined) meta.hnrCount = hnrCount
  if (seedSizeBytes !== undefined && seedSizeBytes <= BigInt(Number.MAX_SAFE_INTEGER)) {
    meta.seedSizeBytes = Number(seedSizeBytes)
  }
  if (realRatio !== undefined) meta.realRatio = realRatio

  return {
    remoteUserId: Number.isSafeInteger(userId) && (userId ?? 0) > 0 ? userId : undefined,
    joinedDate,
    lastAccessDate,
    hitAndRuns: hnrCount ?? null,
    warned: warnings === undefined ? null : warnings > 0,
    platformMeta: Object.keys(meta).length > 0 ? meta : undefined,
  }
}

function mergeMeta(
  first: TrackerStats["platformMeta"],
  second: TrackerStats["platformMeta"]
): PortugasPlatformMeta | undefined {
  const merged = {
    ...(first as PortugasPlatformMeta | undefined),
    ...(second as PortugasPlatformMeta | undefined),
  }
  return Object.keys(merged).length > 0 ? merged : undefined
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed"
}

export class PortugasAdapter implements TrackerAdapter {
  // _apiPath is ignored: the homepage is intrinsic to the platform, not a
  // property of a user's row, so a stale persisted api_path value self-heals
  // instead of breaking the adapter (the filelist.ts precedent).
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parsePortugasCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname

    const homeHtml = await fetchTrackerHtml({
      url: `${baseUrl}/`,
      cookies: creds.cookies,
      userAgent: creds.userAgent,
      label: LABEL,
      sessionExpiredMessage: SESSION_EXPIRED,
      proxyAgent: options?.proxyAgent,
    })
    const home = parsePortugasHomepage(homeHtml, hostname)
    const stats = home.stats

    // Profile figures (join date, ID, H&R, seed size) are enrichment; a
    // failure leaves them unknown instead of discarding the homepage totals.
    if (home.username) {
      try {
        const profileHtml = await fetchTrackerHtml({
          url: `${baseUrl}/users/${encodeURIComponent(home.username)}`,
          cookies: creds.cookies,
          userAgent: creds.userAgent,
          label: LABEL,
          sessionExpiredMessage: SESSION_EXPIRED,
          proxyAgent: options?.proxyAgent,
        })
        const profile = parsePortugasProfile(profileHtml)
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
    const creds = parsePortugasCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    const calls: DebugApiCall[] = []

    let username: string | undefined
    try {
      const html = await fetchTrackerHtml({
        url: `${baseUrl}/`,
        cookies: creds.cookies,
        userAgent: creds.userAgent,
        label: LABEL,
        sessionExpiredMessage: SESSION_EXPIRED,
        proxyAgent: options?.proxyAgent,
      })
      const home = parsePortugasHomepage(html, hostname)
      username = home.username
      calls.push({ label: "Home Page", endpoint: "/", data: home.stats, error: null })
    } catch (err) {
      calls.push({ label: "Home Page", endpoint: "/", data: null, error: errorMessage(err) })
      return calls
    }

    if (username) {
      const endpoint = `/users/${username}`
      try {
        const html = await fetchTrackerHtml({
          url: `${baseUrl}/users/${encodeURIComponent(username)}`,
          cookies: creds.cookies,
          userAgent: creds.userAgent,
          label: LABEL,
          sessionExpiredMessage: SESSION_EXPIRED,
          proxyAgent: options?.proxyAgent,
        })
        calls.push({
          label: "Profile",
          endpoint,
          data: parsePortugasProfile(html),
          error: null,
        })
      } catch (err) {
        calls.push({ label: "Profile", endpoint, data: null, error: errorMessage(err) })
      }
    }

    return calls
  }
}
