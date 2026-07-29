// src/lib/adapters/torrentleech.ts
//
// Functions: parseTlCredentials, login, parseTlProfile, fetchHtml, TorrentleechAdapter

import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { computeBufferBytes } from "@/lib/data-transforms"
import { classifyFetchError, sanitizeNetworkError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { parseBytes } from "@/lib/parser"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "./types"

// ---------------------------------------------------------------------------
// Credential handling
// ---------------------------------------------------------------------------

export interface TlCredentials {
  username: string
  password: string
}

export function parseTlCredentials(apiToken: string): TlCredentials {
  let parsed: unknown
  try {
    parsed = JSON.parse(apiToken)
  } catch {
    throw new Error("TorrentLeech credentials must be a JSON object with username and password")
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).username !== "string" ||
    typeof (parsed as Record<string, unknown>).password !== "string"
  ) {
    throw new Error(
      "TorrentLeech credentials must contain username (string) and password (string)"
    )
  }

  const { username, password } = parsed as Record<string, string>
  if (!username.trim()) throw new Error("TorrentLeech credentials: username cannot be empty")
  if (!password.trim()) throw new Error("TorrentLeech credentials: password cannot be empty")

  return { username: username.trim(), password }
}

// ---------------------------------------------------------------------------
// Login flow
// ---------------------------------------------------------------------------

/**
 * Logs in and returns the Cookie header string built from Set-Cookie response headers.
 * tunnel.ts's proxyFetch is GET-only with no body support, so login always goes
 * through a direct fetch — only the subsequent profile page fetch honors proxyAgent.
 */
async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const loginUrl = `${baseUrl}/user/account/login/`
  const body = new URLSearchParams({ username, password }).toString()
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  }

  let response: Response
  try {
    response = await fetch(loginUrl, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    throw classifyFetchError(err, new URL(baseUrl).hostname)
  }
  const setCookieHeaders = response.headers.getSetCookie?.() ?? []

  const cookiePairs = setCookieHeaders
    .map((raw) => raw.split(";")[0]?.trim())
    .filter((pair): pair is string => Boolean(pair))

  const cookieString = cookiePairs.join("; ")
  if (!cookieString.includes("tluid=")) {
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

export function parseTlProfile(html: string, username: string): TrackerStats {
  if (html.includes("/user/account/login")) {
    throw new Error("Session expired — TorrentLeech cookies need to be refreshed")
  }

  if (
    html.includes("<title>Just a moment...</title>") ||
    html.includes("cf_chl_opt") ||
    html.includes("challenges.cloudflare.com/turnstile")
  ) {
    throw new Error("Cloudflare challenge detected — TorrentLeech session needs refreshing")
  }

  const doc = parseHtml(html)

  const uploadedText = textAfterNode(doc, ".profile-uploaded-details")
  const downloadedText = textAfterNode(doc, ".profile-downloaded-details")
  const ratioText = textAfterNode(doc, ".profile-ratio-details")

  if (!uploadedText && !downloadedText) {
    throw new Error(
      "Could not find profile stats on TorrentLeech page — the page may not be authenticated"
    )
  }

  const uploadedBytes = uploadedText ? parseBytes(uploadedText) : 0n
  const downloadedBytes = downloadedText ? parseBytes(downloadedText) : 0n

  let ratio = 0
  if (ratioText && !ratioText.includes("∞") && !/infin/i.test(ratioText)) {
    ratio = parseFloat(ratioText) || 0
  }

  // Active seeding/leeching counts appear as header menu items with tooltip
  // titles ("Uploaded (Seeding)" / "Downloaded (Leeching)").
  let seedingCount = 0
  let leechingCount = 0
  for (const item of doc.querySelectorAll(".div-menu-item")) {
    const title = item.getAttribute("title") ?? ""
    const numMatch = item.textContent?.match(/[\d,]+/)
    const count = numMatch ? parseInt(numMatch[0].replace(/,/g, ""), 10) : 0
    if (/seeding/i.test(title)) seedingCount = count
    else if (/leeching/i.test(title)) leechingCount = count
  }

  // TL Points, often shown near a "TL Points:" label.
  let seedbonus = 0
  const bodyText = doc.textContent ?? ""
  const pointsMatch = bodyText.match(/TL Points:\s*([\d,.]+)/i)
  if (pointsMatch) seedbonus = parseFloat(pointsMatch[1].replace(/,/g, ""))

  // Class badge, if present in a profile field/label pair.
  let group = "User"
  const classMatch = bodyText.match(/Class:?\s*\n?\s*([A-Za-z][A-Za-z ]*)/)
  if (classMatch) group = classMatch[1].trim()

  return {
    username,
    group,
    uploadedBytes,
    downloadedBytes,
    ratio,
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount,
    leechingCount,
    seedbonus,
    hitAndRuns: null,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
  }
}

// ---------------------------------------------------------------------------
// HTML fetcher — direct fetch or proxy
// ---------------------------------------------------------------------------

async function fetchHtml(
  url: string,
  cookies: string,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  const headers: Record<string, string> = {
    Cookie: cookies,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  }

  if (proxyAgent) {
    const { proxyFetch } = await import("@/lib/tunnel")
    const result = await proxyFetch(url, proxyAgent, { headers })
    if (!result.ok) {
      throw new Error(
        sanitizeNetworkError(
          `${result.status} ${result.statusText}`,
          `TorrentLeech page fetch failed: ${result.status}`
        )
      )
    }
    return (await result.buffer()).toString("utf8")
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
      redirect: "manual",
    })
  } catch (err) {
    throw classifyFetchError(err, new URL(url).hostname)
  }

  if (response.status === 302) {
    throw new Error("Session expired — TorrentLeech cookies need to be refreshed")
  }

  if (!response.ok) {
    throw new Error(
      sanitizeNetworkError(
        `${response.status} ${response.statusText}`,
        `TorrentLeech page fetch failed: ${response.status}`
      )
    )
  }

  return response.text()
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

export class TorrentleechAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseTlCredentials(apiToken)
    const cookies = await login(baseUrl, creds.username, creds.password)
    const profileUrl = `${baseUrl}/profile/${encodeURIComponent(creds.username)}`
    const html = await fetchHtml(profileUrl, cookies, options?.proxyAgent)
    return parseTlProfile(html, creds.username)
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const calls: DebugApiCall[] = []
    const creds = parseTlCredentials(apiToken)
    const endpoint = `/profile/${creds.username}`

    try {
      const cookies = await login(baseUrl, creds.username, creds.password)
      const profileUrl = `${baseUrl}${endpoint}`
      const html = await fetchHtml(profileUrl, cookies, options?.proxyAgent)
      const stats = parseTlProfile(html, creds.username)
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
