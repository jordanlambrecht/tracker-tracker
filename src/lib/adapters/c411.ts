// src/lib/adapters/c411.ts
//
// Functions: parseC411Credentials, parseCsrfToken, login, getC411Session,
//            invalidateC411Session, fetchC411User, C411Adapter

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { classifyFetchError, sanitizeNetworkError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { parseCredentialJson } from "./cookie-credentials"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "./types"

export interface C411Credentials {
  username: string
  password: string
}

export function parseC411Credentials(apiToken: string): C411Credentials {
  const { username, password } = parseCredentialJson(apiToken, "C411", [
    "username",
    "password",
  ] as const)
  return { username: username.trim(), password }
}

// C411's login is CSRF-protected. The page sets an HttpOnly __csrf cookie AND
// embeds a signed token in a <meta> tag; the cookie alone is rejected as
// "CSRF Token invalid", so both must travel with the login POST.
const CSRF_META_RE = /<meta[^>]*name="csrf-token"[^>]*content="([^"]+)"/i

export function parseCsrfToken(html: string): string {
  const match = html.match(CSRF_META_RE)
  if (!match?.[1]) throw new Error("C411 login page did not include a CSRF token")
  return match[1]
}

function collectCookies(response: Response, jar: Map<string, string>): void {
  for (const raw of response.headers.getSetCookie()) {
    const pair = raw.split(";", 1)[0]?.trim()
    if (!pair) continue
    const eq = pair.indexOf("=")
    if (eq === -1) continue
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
}

function jarToString(jar: Map<string, string>): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ")
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  hostname: string
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS) })
  } catch (err) {
    throw classifyFetchError(err, hostname)
  }
}

export async function login(
  baseUrl: string,
  username: string,
  password: string
): Promise<string> {
  const hostname = new URL(baseUrl).hostname
  const jar = new Map<string, string>()

  const page = await fetchWithTimeout(
    `${baseUrl}/login`,
    {
      headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      redirect: "manual",
    },
    hostname
  )
  collectCookies(page, jar)
  const csrf = parseCsrfToken(await page.text())

  const response = await fetchWithTimeout(
    `${baseUrl}/api/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: jarToString(jar),
        "csrf-token": csrf,
        Origin: new URL(baseUrl).origin,
        Referer: `${baseUrl}/login`,
      },
      body: JSON.stringify({ username, password }),
      redirect: "manual",
    },
    hostname
  )
  collectCookies(response, jar)

  if (response.status === 401) {
    throw new Error("Invalid C411 username or password")
  }
  if (!response.ok) {
    throw new Error(
      sanitizeNetworkError(
        `${response.status} ${response.statusText}`,
        `C411 login failed: ${response.status}`
      )
    )
  }

  return jarToString(jar)
}

const gC411 = globalThis as typeof globalThis & {
  __c411SessionCache?: Map<string, string>
}
if (!gC411.__c411SessionCache) gC411.__c411SessionCache = new Map()
const sessionCache = gC411.__c411SessionCache

function sessionKey(baseUrl: string, username: string): string {
  return `${baseUrl}|${username}`
}

async function getC411Session(
  baseUrl: string,
  username: string,
  password: string
): Promise<string> {
  const key = sessionKey(baseUrl, username)
  const cached = sessionCache.get(key)
  if (cached) return cached
  const cookies = await login(baseUrl, username, password)
  sessionCache.set(key, cookies)
  return cookies
}

function invalidateC411Session(baseUrl: string, username: string): void {
  sessionCache.delete(sessionKey(baseUrl, username))
}

interface C411User {
  id: number
  username: string
  badge?: { label?: string } | null
  uploaded: number
  downloaded: number
  minRatioForDownload?: number
  warnings?: number
  isWarned?: boolean
  createdAt?: string
}

interface C411MeResponse {
  authenticated: boolean
  user: C411User | null
}

async function fetchC411User(
  baseUrl: string,
  cookies: string,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<C411User> {
  const url = `${baseUrl}/api/auth/me`
  const headers: Record<string, string> = { Cookie: cookies, Accept: "application/json" }

  let status: number
  let statusText: string
  let text: string

  if (proxyAgent) {
    const { proxyFetch } = await import("@/lib/tunnel")
    const result = await proxyFetch(url, proxyAgent, { headers })
    status = result.status
    statusText = result.statusText
    text = (await result.buffer()).toString("utf8")
  } else {
    const response = await fetchWithTimeout(
      url,
      { headers, redirect: "manual" },
      new URL(baseUrl).hostname
    )
    status = response.status
    statusText = response.statusText
    text = await response.text()
  }

  if (status === 401 || status === 403) {
    throw new Error("C411 session not established — check the username and password")
  }
  if (status < 200 || status >= 300) {
    throw new Error(sanitizeNetworkError(`${status} ${statusText}`, `C411 API error: ${status}`))
  }

  let data: C411MeResponse
  try {
    data = JSON.parse(text) as C411MeResponse
  } catch {
    throw new Error("C411 returned invalid JSON from /api/auth/me")
  }

  if (!data.authenticated || !data.user) {
    throw new Error("C411 session not established — check the username and password")
  }
  return data.user
}

export class C411Adapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseC411Credentials(apiToken)

    let cookies = await getC411Session(baseUrl, creds.username, creds.password)
    let user: C411User
    try {
      user = await fetchC411User(baseUrl, cookies, options?.proxyAgent)
    } catch (err) {
      if (!(err instanceof Error) || !err.message.startsWith("C411 session")) throw err
      invalidateC411Session(baseUrl, creds.username)
      cookies = await getC411Session(baseUrl, creds.username, creds.password)
      user = await fetchC411User(baseUrl, cookies, options?.proxyAgent)
    }

    const uploadedBytes = BigInt(Math.trunc(user.uploaded))
    const downloadedBytes = BigInt(Math.trunc(user.downloaded))

    return {
      username: user.username,
      group: user.badge?.label ?? "User",
      uploadedBytes,
      downloadedBytes,
      ratio: computeRatio(uploadedBytes, downloadedBytes),
      bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
      seedingCount: null,
      leechingCount: null,
      seedbonus: null,
      hitAndRuns: null,
      requiredRatio: typeof user.minRatioForDownload === "number" ? user.minRatioForDownload : null,
      warned: typeof user.isWarned === "boolean" ? user.isWarned : null,
      freeleechTokens: null,
      remoteUserId: user.id,
      joinedDate: user.createdAt,
    }
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const creds = parseC411Credentials(apiToken)
    const endpoint = "/api/auth/me"

    try {
      const cookies = await getC411Session(baseUrl, creds.username, creds.password)
      const user = await fetchC411User(baseUrl, cookies, options?.proxyAgent)
      return [{ label: "User Stats", endpoint, data: user, error: null }]
    } catch (err) {
      return [
        {
          label: "User Stats",
          endpoint,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
