// src/lib/tracker-platforms/__tests__/login-session.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { proxyFetch } from "@/lib/tunnel"
import { DEFAULT_USER_AGENT } from "@/lib/user-agent"
import { SessionExpiredError } from "../helpers/errors"
import { loginRequest, withLoginSession } from "../helpers/login-session"

vi.mock("@/lib/tunnel", () => ({ proxyFetch: vi.fn() }))

const LOGIN_URL = "https://tracker.example/login"
const agent = {} as never

function proxied(status: number, headers: Record<string, string | string[]> = {}, body = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers,
    json: async () => ({}),
    text: async () => body,
    buffer: async () => Buffer.from(body),
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.mocked(proxyFetch).mockReset()
  ;(globalThis as { __trackerLoginSessions?: Map<string, string> }).__trackerLoginSessions?.clear()
})

describe("loginRequest, direct", () => {
  it("reads Set-Cookie and Location off a redirect it does not follow", async () => {
    const headers = new Headers({ location: "/" })
    headers.append("set-cookie", "sid=abc; path=/; httponly")
    headers.append("set-cookie", "cid=def; path=/")
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 303, headers }))

    const res = await loginRequest(LOGIN_URL, { method: "POST", headers: {}, body: "a=1" })

    expect(res.status).toBe(303)
    expect(res.location()).toBe("/")
    expect(res.setCookies).toEqual(["sid=abc; path=/; httponly", "cid=def; path=/"])
    const init = fetchSpy.mock.calls[0][1]
    expect(init?.redirect).toBe("manual")
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    const sent = init?.headers as Record<string, string> | undefined
    expect(sent?.["User-Agent"]).toBe(DEFAULT_USER_AGENT)
  })

  it("names the host when the connection fails", async () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(loginRequest(LOGIN_URL, { method: "GET", headers: {} })).rejects.toThrow(
      "Failed to connect to tracker.example: ECONNREFUSED"
    )
  })
})

describe("loginRequest, through a proxy", () => {
  it("sends the request through the proxy with the app User-Agent and the shared timeout", async () => {
    vi.mocked(proxyFetch).mockResolvedValueOnce(proxied(200))
    const fetchSpy = vi.spyOn(global, "fetch")

    await loginRequest(LOGIN_URL, { method: "POST", headers: { Accept: "text/html" }, body: "a=1" }, agent)

    expect(fetchSpy).not.toHaveBeenCalled()
    const [url, passedAgent, opts] = vi.mocked(proxyFetch).mock.calls[0]
    expect(url).toBe(LOGIN_URL)
    expect(passedAgent).toBe(agent)
    expect(opts).toMatchObject({ method: "POST", body: "a=1", timeoutMs: ADAPTER_FETCH_TIMEOUT_MS })
    expect(opts?.headers?.["User-Agent"]).toBe(DEFAULT_USER_AGENT)
  })

  it("reads Set-Cookie and Location off the proxied answer", async () => {
    vi.mocked(proxyFetch).mockResolvedValueOnce(
      proxied(303, { location: "/", "set-cookie": ["sid=abc; path=/", "cid=def; path=/"] })
    )

    const res = await loginRequest(LOGIN_URL, { method: "POST", headers: {} }, agent)

    expect(res.status).toBe(303)
    expect(res.location()).toBe("/")
    expect(res.setCookies).toEqual(["sid=abc; path=/", "cid=def; path=/"])
  })

  // classifyFetchError keeps only an error's name or code, which for a proxy
  // timeout is "Error", and the card would then read "Poll failed".
  it("words a proxied timeout the way the other proxied requests do", async () => {
    vi.mocked(proxyFetch).mockRejectedValueOnce(new Error("Request timed out after 15000ms"))

    const err = await loginRequest(LOGIN_URL, { method: "GET", headers: {} }, agent)
      .then(() => null)
      .catch((e: unknown) => (e instanceof Error ? e : null))

    expect(err?.message).toBe("Request to tracker.example timed out (via proxy)")
    expect(sanitizeNetworkError(err?.message ?? "", "Poll failed")).toBe("Request timed out")
  })
})

describe("withLoginSession", () => {
  const BASE = "https://tracker.example"

  it("logs in once and reuses the session across polls", async () => {
    const login = vi.fn(async () => "sid=one")
    const work = vi.fn(async (cookies: string) => cookies)

    await withLoginSession(BASE, ["user", "pw"], login, work)
    const second = await withLoginSession(BASE, ["user", "pw"], login, work)

    expect(second).toBe("sid=one")
    expect(login).toHaveBeenCalledTimes(1)
  })

  // The connection test runs through this cache, so a session opened by the
  // right password must not vouch for a wrong one.
  it("logs in again when any part of the credential set changes", async () => {
    const login = vi.fn(async () => "sid")
    const work = async () => "ok"

    await withLoginSession(BASE, ["user", "right"], login, work)
    await withLoginSession(BASE, ["user", "wrong"], login, work)
    await withLoginSession(BASE, ["user", "wrong", "token"], login, work)

    expect(login).toHaveBeenCalledTimes(3)
  })

  it("logs in again once when the session has expired", async () => {
    const login = vi.fn().mockResolvedValueOnce("sid=old").mockResolvedValueOnce("sid=new")
    const work = vi.fn(async (cookies: string) => {
      if (cookies === "sid=old") throw new SessionExpiredError("reworded freely")
      return cookies
    })

    expect(await withLoginSession(BASE, ["user", "pw"], login, work)).toBe("sid=new")
    expect(login).toHaveBeenCalledTimes(2)
  })

  // A page the adapter cannot read is not an expiry, and treating one as such
  // posts the password on every poll.
  it("does not log in again for an error that only says Session expired", async () => {
    const login = vi.fn(async () => "sid")
    const work = vi.fn(async () => {
      throw new Error("Session expired. Could not find the profile stats")
    })

    await expect(withLoginSession(BASE, ["user", "pw"], login, work)).rejects.toThrow()
    expect(login).toHaveBeenCalledTimes(1)
    expect(work).toHaveBeenCalledTimes(1)
  })

  it("gives up after one fresh session rather than looping", async () => {
    const login = vi.fn(async () => "sid")
    const work = vi.fn(async () => {
      throw new SessionExpiredError("still expired")
    })

    await expect(withLoginSession(BASE, ["user", "pw"], login, work)).rejects.toBeInstanceOf(
      SessionExpiredError
    )
    expect(login).toHaveBeenCalledTimes(2)
    expect(work).toHaveBeenCalledTimes(2)
  })
})
