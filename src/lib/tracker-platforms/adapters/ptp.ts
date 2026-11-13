// src/lib/tracker-platforms/adapters/ptp.ts
//
// Functions: parsePtpCredentials, signedSiteBytes, parsePtpIndex, fetchIndex, PtpAdapter

import { parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateHeaderToken } from "@/lib/tracker-credentials/header-token"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "../contract"
import { adapterRequest } from "../helpers/adapter-fetch"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { isCloudflareChallengeResponse } from "../helpers/html-fetch"
import { normalizeWhitespace, tryParseCount, tryParseSiteBytes } from "../helpers/html-parse"

// ---------------------------------------------------------------------------
// PassThePopcorn has no ajax.php. Its API is the ApiUser and ApiKey request
// headers on ordinary pages, and with those headers set a page answers JSON
// unless json=0 is passed. The site header on index.php carries the user stats
// bar, so one request reads everything this adapter reports.
// ---------------------------------------------------------------------------

export interface PtpCredentials {
  apiUser: string
  apiKey: string
}

/**
 * The credential form stores ApiUser under `username` and ApiKey under
 * `token`, the token-username shape.
 * @internal
 */
export function parsePtpCredentials(apiToken: string): PtpCredentials {
  const { token, username } = parseCredentialJson(apiToken, "PassThePopcorn", [
    "token",
    "username",
  ] as const)
  return { apiUser: validateHeaderToken(username), apiKey: validateHeaderToken(token) }
}

/** The leading sign tryParseSiteBytes does not read. */
function signedSiteBytes(value: string): bigint | undefined {
  const trimmed = value.trim()
  const negative = trimmed.startsWith("-")
  const bytes = tryParseSiteBytes(negative ? trimmed.slice(1) : trimmed)
  if (bytes === undefined) return undefined
  return negative ? -bytes : bytes
}

/** @internal Used by tests. */
export function parsePtpIndex(html: string, hostname: string): TrackerStats {
  const doc = parseHtml(html)

  // The title attribute holds the four-decimal total; the visible text rounds
  // to three.
  const bytesFrom = (id: string) =>
    tryParseSiteBytes(doc.querySelector(`#${id} a`)?.getAttribute("title") ?? "")
  const uploadedBytes = bytesFrom("stats_seeding")
  const downloadedBytes = bytesFrom("stats_leeching")

  if (uploadedBytes === undefined && downloadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: no user stats bar on index.php`)
  }
  if (uploadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: unreadable uploaded byte total`)
  }
  if (downloadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: unreadable downloaded byte total`)
  }

  const userLink = doc.querySelector("#nav_userinfo a")
  const idMatch = userLink?.getAttribute("href")?.match(/user\.php\?id=(\d+)/)

  // PTP's buffer is not upload minus download, so the figure it prints wins.
  const ratioTitle = doc.querySelector("#stats_ratio a")?.getAttribute("title") ?? ""
  const bufferText = ratioTitle.match(/Buffer:\s*(-?[\d.,]+\s*[A-Za-z]+)/)?.[1]
  const bufferBytes =
    (bufferText ? signedSiteBytes(bufferText) : undefined) ??
    computeBufferBytes(uploadedBytes, downloadedBytes)

  const bonusText = normalizeWhitespace(doc.querySelector("#nav_bonus a")?.textContent ?? "")
  const bonusMatch = bonusText.match(/^Bonus \(([\d,.]+)\)$/)

  // Two items share the stats_hnrs id; the second is the Unregistered Torrents
  // count, so the item is picked by its link text.
  const hnrItem = doc
    .querySelectorAll("li#stats_hnrs")
    .find((li) => normalizeWhitespace(li.querySelector("a")?.textContent ?? "") === "HnRs")
  const hnrText = hnrItem?.querySelector(".user-info-bar__text")?.textContent

  const stats: TrackerStats = {
    username: normalizeWhitespace(userLink?.textContent ?? ""),
    // The class is only on user.php, which PTP blocks for API access.
    group: null,
    uploadedBytes,
    downloadedBytes,
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes,
    seedingCount: null,
    leechingCount: null,
    seedbonus: bonusMatch ? (tryParseCount(bonusMatch[1]) ?? null) : null,
    hitAndRuns: tryParseCount(hnrText) ?? null,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
  }
  if (idMatch) stats.remoteUserId = Number.parseInt(idMatch[1], 10)
  return stats
}

/** Bad ApiUser or ApiKey. On the sanitizer's credential list. */
const INVALID_CREDENTIALS = "Invalid PTP API credentials"

async function fetchIndex(
  url: string,
  hostname: string,
  creds: PtpCredentials,
  options?: FetchOptions
): Promise<string> {
  const response = await adapterRequest(url, hostname, options, {
    ApiUser: creds.apiUser,
    ApiKey: creds.apiKey,
    Accept: "text/html",
  })
  if (response.ok) return response.text()
  // PTP answers a bad ApiUser or ApiKey with 400 "Malformed Api Credentials".
  if (response.status === 400) throw new Error(INVALID_CREDENTIALS)
  if (await isCloudflareChallengeResponse(response)) {
    throw new Error(`Cloudflare challenge detected on ${hostname}`)
  }
  throw new Error(`Tracker API error: ${response.status} ${response.statusText}`)
}

export class PtpAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parsePtpCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    const endpoint = `${apiPath}?json=0`
    const html = await fetchIndex(new URL(endpoint, baseUrl).toString(), hostname, creds, options)
    return parsePtpIndex(html, hostname)
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const creds = parsePtpCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    const endpoint = `${apiPath}?json=0`

    try {
      const html = await fetchIndex(new URL(endpoint, baseUrl).toString(), hostname, creds, options)
      return [
        { label: "Index Page", endpoint, data: parsePtpIndex(html, hostname), error: null },
      ]
    } catch (err) {
      return [
        {
          label: "Index Page",
          endpoint,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
