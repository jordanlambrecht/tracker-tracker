// src/lib/tracker-platforms/adapters/yggreborn.ts
//
// Functions: parseYggrebornCredentials, assertAuthenticated, statCardValue,
//            accountRowValue, userStatus, frenchDate, frenchCount,
//            parseYggrebornAccount, fetchHtml, YggrebornAdapter

import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"
import type {
  DebugApiCall,
  FetchOptions,
  TrackerAdapter,
  TrackerStats,
  YggrebornPlatformMeta,
} from "../contract"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { SessionExpiredError } from "../helpers/errors"
import { fetchTrackerHtml } from "../helpers/html-fetch"
import {
  isCloudflareChallenge,
  normalizeWhitespace,
  tryParseCount,
  tryParseSiteBytes,
} from "../helpers/html-parse"

// ---------------------------------------------------------------------------
// Credential handling
//
// The passkey only signs the Torznab search API (/api), which returns torrents
// and no account figures, so stats exist nowhere but the logged-in HTML.
// Cookies plus the User-Agent the session was issued to, as with IPTorrents
// and RetroToon.
// ---------------------------------------------------------------------------

/** The page every figure is read from. Intrinsic to the site, so the adapter owns it. */
const ACCOUNT_PATH = "/account/"

export interface YggrebornCredentials {
  cookies: string
  userAgent: string
}

/** @internal Used by tests. */
export function parseYggrebornCredentials(apiToken: string): YggrebornCredentials {
  const { cookies, userAgent } = parseCredentialJson(apiToken, "YggReborn", [
    "cookies",
    "userAgent",
  ] as const)

  return {
    cookies: validateCookieHeader(cookies, {
      extraCookieNames: ["session", "remember_token"],
      example: "session=abc123def456",
    }),
    userAgent,
  }
}

// ---------------------------------------------------------------------------
// Page-shape notes
//
// /account/ is a Tailwind page with no stable ids or semantic classes, so every
// lookup keys on the French label text the page prints. A stat card is a value
// <div> followed by its label <div>; an account row is a label <span> followed
// by its value element.
// ---------------------------------------------------------------------------

/**
 * Signed-in pages carry the logout form. An anonymous request is redirected,
 * which fetchTrackerHtml already reads as an expired session, so this is for a
 * login page served with a 200.
 */
function assertAuthenticated(html: string): void {
  // Before the logout check: a challenge body also lacks the form, and its
  // message is the more useful error.
  if (isCloudflareChallenge(html)) {
    throw new Error("Cloudflare challenge detected. Cookies need refreshing")
  }

  if (!/<form[^>]+action=["']\/logout["']/i.test(html)) {
    throw new SessionExpiredError("Session expired. Browser cookies need to be refreshed")
  }
}

/** Text of the value <div> sitting directly before the stat card's label <div>. */
function statCardValue(doc: ParsedElement, label: string): string | undefined {
  for (const el of doc.querySelectorAll("div")) {
    // A label is a leaf. Skipping containers keeps a wrapper whose whole text
    // happens to equal the label from matching.
    if (el.childElementCount > 0) continue
    if (normalizeWhitespace(el.textContent ?? "") !== label) continue
    const value = el.previousElementSibling
    if (value) return normalizeWhitespace(value.textContent ?? "")
  }
  return undefined
}

/** Text of the element following an "Informations du compte" label <span>. */
function accountRowValue(doc: ParsedElement, label: string): string | undefined {
  for (const el of doc.querySelectorAll("span")) {
    if (normalizeWhitespace(el.textContent ?? "") !== label) continue
    const value = el.nextElementSibling
    if (value) return normalizeWhitespace(value.textContent ?? "")
  }
  return undefined
}

/** The rank named in the "Statut Utilisateur" card, or null when the card is absent or blank. */
function userStatus(doc: ParsedElement): string | null {
  for (const heading of doc.querySelectorAll("h3")) {
    if (normalizeWhitespace(heading.textContent ?? "") !== "Statut Utilisateur") continue
    // The rank is the card's first <span>. The heading sits one or two wrappers
    // below the card, so climb until a <span> is in reach.
    let card: ParsedElement | null = heading.parentNode
    for (let depth = 0; card && depth < 3; depth++) {
      const rank = normalizeWhitespace(card.querySelector("span")?.textContent ?? "")
      if (rank) return rank
      card = card.parentNode
    }
  }
  return null
}

/** `05/05/2026` or `14/11/2026 15:04` (day first) as `2026-05-05`. */
function frenchDate(value: string | undefined): string | undefined {
  const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})\b/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined
}

/**
 * A count that may carry the French thousands space ("1 280"). tryParseCount
 * reads the first number only, so without this it would return 1.
 */
function frenchCount(value: string | undefined): number | undefined {
  return tryParseCount(value?.replace(/(\d)\s+(?=\d)/g, "$1"))
}

// ---------------------------------------------------------------------------
// Account page parser (/account/)
// ---------------------------------------------------------------------------

/** @internal Used by tests. */
export function parseYggrebornAccount(html: string, hostname: string): TrackerStats {
  assertAuthenticated(html)

  const doc = parseHtml(html)

  const uploadedText = statCardValue(doc, "Upload")
  const downloadedText = statCardValue(doc, "Download")

  // Neither card is on the page, so this is a signed-in page that is not the
  // account page.
  if (uploadedText === undefined && downloadedText === undefined) {
    throw new Error(
      `Unexpected response from ${hostname}: Could not find the tracker statistics on the YggReborn account page. The page structure may have changed.`
    )
  }

  // One side readable and the other not is a page-shape change, not an account
  // with nothing on that side, and both fields are non-nullable bigint, so a 0n
  // here would be stored as a measured zero (standard 2.1).
  const uploadedBytes = tryParseSiteBytes(uploadedText ?? "")
  if (uploadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: unreadable uploaded byte total`)
  }
  const downloadedBytes = tryParseSiteBytes(downloadedText ?? "")
  if (downloadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: unreadable downloaded byte total`)
  }

  const meta: YggrebornPlatformMeta = {}
  const freeleechBytes = tryParseSiteBytes(statCardValue(doc, "Freeleech DL") ?? "")
  // A number, not a bigint: platformMeta is JSON-serialized.
  if (freeleechBytes !== undefined) meta.freeleechDownloadedBytes = Number(freeleechBytes)
  // The Score card prints a dash until the member has uploaded, which
  // frenchCount reads as undefined, so the key stays absent.
  const uploaderScore = frenchCount(statCardValue(doc, "Score"))
  if (uploaderScore !== undefined) meta.uploaderScore = uploaderScore
  const uploadedTorrents = frenchCount(statCardValue(doc, "Uploads"))
  if (uploadedTorrents !== undefined) meta.uploadedTorrents = uploadedTorrents
  const verifiedUploads = frenchCount(statCardValue(doc, "Vérifiés"))
  if (verifiedUploads !== undefined) meta.verifiedUploads = verifiedUploads

  return {
    username: accountRowValue(doc, "Nom d'utilisateur") ?? "",
    group: userStatus(doc),
    uploadedBytes,
    downloadedBytes,
    // Derived from byte totals, not the page's own two-decimal Ratio card.
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    // The account page prints none of these. Active torrents are listed on
    // /account/torrents-actifs, which this adapter does not read.
    seedingCount: null,
    leechingCount: null,
    seedbonus: null,
    hitAndRuns: null,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
    // Bare YYYY-MM-DD, converted from the page's day-first dates.
    joinedDate: frenchDate(accountRowValue(doc, "Membre depuis")),
    lastAccessDate: frenchDate(accountRowValue(doc, "Dernière connexion")),
    // Returned on every successful poll so a figure that leaves the page clears.
    platformMeta: meta,
  }
}

// ---------------------------------------------------------------------------
// HTML fetcher, direct fetch or proxy
// ---------------------------------------------------------------------------

function fetchHtml(
  url: string,
  creds: YggrebornCredentials,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  // No followRedirects: /account/ answers a signed-in member directly, so any
  // redirect is the bounce to the login page.
  return fetchTrackerHtml({
    url,
    cookies: creds.cookies,
    userAgent: creds.userAgent,
    proxyAgent,
    label: "YggReborn",
    sessionExpiredMessage: "Session expired. Browser cookies need to be refreshed",
  })
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

export class YggrebornAdapter implements TrackerAdapter {
  // _apiPath is ignored: /account/ is intrinsic to YggReborn, so the adapter
  // owns it. One request covers a poll.
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseYggrebornCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname

    const html = await fetchHtml(`${baseUrl}${ACCOUNT_PATH}`, creds, options?.proxyAgent)
    return parseYggrebornAccount(html, hostname)
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    // Outside any try: bad credentials are a caller error, not a call entry.
    const creds = parseYggrebornCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname

    try {
      const html = await fetchHtml(`${baseUrl}${ACCOUNT_PATH}`, creds, options?.proxyAgent)
      // The parsed figures stand in for the raw artifact, which is a whole
      // HTML page carrying the member's email and announce URL.
      return [
        {
          label: "Account Page",
          endpoint: ACCOUNT_PATH,
          data: parseYggrebornAccount(html, hostname),
          error: null,
        },
      ]
    } catch (err) {
      return [
        {
          label: "Account Page",
          endpoint: ACCOUNT_PATH,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
