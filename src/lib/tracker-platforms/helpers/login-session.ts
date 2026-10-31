// src/lib/tracker-platforms/helpers/login-session.ts
//
// Functions: loginRequest, sessionKey, withLoginSession

import { randomBytes, scrypt } from "node:crypto"
import { classifyFetchError, classifyProxyFetchError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { proxyFetch } from "@/lib/tunnel"
import { withDefaultUserAgent } from "@/lib/user-agent"
import type { FetchOptions } from "../contract"
import { SessionExpiredError } from "./errors"

// ---------------------------------------------------------------------------
// Logging in for trackers with no stats API, where the adapter posts the
// user's password and reads the session cookie the answer sets.
// ---------------------------------------------------------------------------

/** The proxied and direct answers narrowed to what a login flow reads. */
export interface LoginResponse {
  status: number
  statusText: string
  /** Lazy, since only a redirect carries one and not every flow reads it. */
  location: () => string
  setCookies: string[]
  text: () => Promise<string>
}

/**
 * One request of a login flow, on the proxy when one is configured, since the
 * POST carries the password. Neither transport follows a redirect, so the
 * caller reads the Set-Cookie and Location of the login answer itself. The
 * session is the app's own, not a browser's, so the app User-Agent goes out
 * unless the caller sets one.
 */
export async function loginRequest(
  url: string,
  init: { method: "GET" | "POST"; headers: Record<string, string>; body?: string },
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<LoginResponse> {
  const headers = withDefaultUserAgent(init.headers)
  const hostname = new URL(url).hostname

  if (proxyAgent) {
    let res: Awaited<ReturnType<typeof proxyFetch>>
    try {
      res = await proxyFetch(url, proxyAgent, {
        method: init.method,
        headers,
        body: init.body,
        timeoutMs: ADAPTER_FETCH_TIMEOUT_MS,
      })
    } catch (err) {
      throw classifyProxyFetchError(err, hostname)
    }
    return {
      status: res.status,
      statusText: res.statusText,
      location: () => res.headers.location ?? "",
      setCookies: res.headers["set-cookie"] ?? [],
      text: () => res.text(),
    }
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: init.method,
      headers,
      body: init.body,
      redirect: "manual",
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    throw classifyFetchError(err, hostname)
  }
  return {
    status: res.status,
    statusText: res.statusText,
    location: () => res.headers.get("location") ?? "",
    setCookies: res.headers.getSetCookie(),
    text: () => res.text(),
  }
}

// ---------------------------------------------------------------------------
// Session cache
//
// Trackers watch login frequency, so a session is reused across polls and the
// password is posted again only when the session dies. Stored on globalThis so
// an HMR reload in dev does not orphan the cache or the salt its keys use.
// ---------------------------------------------------------------------------

const gLogin = globalThis as typeof globalThis & {
  __trackerLoginSessions?: Map<string, string>
  __trackerLoginSessionSalt?: Buffer
}
if (!gLogin.__trackerLoginSessions) gLogin.__trackerLoginSessions = new Map()
if (!gLogin.__trackerLoginSessionSalt) gLogin.__trackerLoginSessionSalt = randomBytes(16)
const sessions = gLogin.__trackerLoginSessions
const sessionSalt = gLogin.__trackerLoginSessionSalt

/**
 * Scoped per site and per whole credential set. The connection test
 * authenticates through this cache, so a key without the password would pass
 * a wrong one on the strength of a session the right one opened. Hashed so the
 * long-lived map never holds a password; scrypt because CodeQL flags a
 * password reaching a fast hash, and async because scryptSync would block the
 * event loop.
 */
function sessionKey(baseUrl: string, credentials: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    scrypt(credentials.join("\u0000"), sessionSalt, 32, (err, derived) => {
      if (err) reject(err)
      else resolve(`${baseUrl}|${derived.toString("hex")}`)
    })
  })
}

/**
 * Runs the work with the cached session, logging in when there is none, and
 * once more with a fresh session when the work throws SessionExpiredError.
 * Any other error reaches the caller without a login, so a page the adapter
 * cannot read costs none. A second expiry reaches it too, and the next poll
 * starts from the fresh session.
 */
export async function withLoginSession<T>(
  baseUrl: string,
  credentials: readonly string[],
  login: () => Promise<string>,
  work: (cookies: string) => Promise<T>
): Promise<T> {
  const key = await sessionKey(baseUrl, credentials)
  const session = async () => {
    const cached = sessions.get(key)
    if (cached) return cached
    const cookies = await login()
    sessions.set(key, cookies)
    return cookies
  }

  try {
    return await work(await session())
  } catch (err) {
    if (!(err instanceof SessionExpiredError)) throw err
    sessions.delete(key)
    return work(await session())
  }
}
