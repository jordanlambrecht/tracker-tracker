// src/proxy.test.ts

import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { proxy } from "./proxy"

vi.mock("@/lib/cookie-security", () => ({
  shouldSecureCookies: () => false,
}))

describe("auth middleware", () => {
  it("allows public auth routes without a session", () => {
    const response = proxy(new NextRequest("http://localhost/api/auth/status"))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })

  it("returns 401 for protected API routes without a session", async () => {
    const response = proxy(new NextRequest("http://localhost/api/trackers"))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("redirects protected pages to login without a session", () => {
    const response = proxy(new NextRequest("http://localhost/settings"))

    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.headers.get("location")).toBe("http://localhost/login")
  })

  it("refreshes both cookies for authenticated requests with sliding expiration", () => {
    const request = new NextRequest("http://localhost/api/trackers", {
      headers: {
        cookie: "tt_session=session-token; tt_max_age=1800",
      },
    })

    const response = proxy(request)
    const setCookie = response.headers.get("set-cookie") ?? ""

    expect(response.status).toBe(200)
    expect(setCookie).toContain("tt_session=session-token")
    expect(setCookie).toContain("tt_max_age=1800")
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie.toLowerCase()).toContain("samesite=strict")
    expect(setCookie).toContain("Max-Age=1800")
    // shouldSecureCookies() is mocked to return false, verify Secure is absent
    expect(setCookie).not.toContain("Secure")
  })

  it("does not honor oversized tt_max_age cookie values", () => {
    const request = new NextRequest("http://localhost/api/trackers", {
      headers: { cookie: "tt_session=token; tt_max_age=99999999" },
    })
    const response = proxy(request)
    const setCookie = response.headers.get("set-cookie") ?? ""
    expect(setCookie).not.toContain("Max-Age=99999999")
  })

  it("passes through when tt_max_age cookie is absent", () => {
    const request = new NextRequest("http://localhost/api/trackers", {
      headers: { cookie: "tt_session=token" },
    })
    const response = proxy(request)
    // Should pass through without setting refreshed cookies
    expect(response.status).toBe(200)
  })

  it("does not refresh cookies when tt_max_age is zero", () => {
    const request = new NextRequest("http://localhost/api/trackers", {
      headers: { cookie: "tt_session=token; tt_max_age=0" },
    })
    const response = proxy(request)
    const setCookie = response.headers.get("set-cookie") ?? ""
    // maxAge=0 should not trigger refresh (condition: maxAge > 0)
    expect(setCookie).not.toContain("tt_session")
  })

  it("allows health check without authentication", () => {
    const response = proxy(new NextRequest("http://localhost/api/health"))
    expect(response.status).toBe(200)
  })
})

describe("framing headers", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // Every branch of proxy() must carry the headers. A response leaving through a
  // path nobody remembered to cover is unprotected, so each is asserted separately
  // rather than trusting one representative case.
  const paths: Array<[string, string, string | undefined]> = [
    ["a public route", "http://localhost/api/auth/status", undefined],
    ["an unauthenticated API route", "http://localhost/api/trackers", undefined],
    ["a login redirect", "http://localhost/settings", undefined],
    [
      "an authenticated request",
      "http://localhost/api/trackers",
      "tt_session=session-token; tt_max_age=1800",
    ],
  ]

  const call = (url: string, cookie?: string) =>
    proxy(new NextRequest(url, cookie ? { headers: { cookie } } : undefined))

  for (const [label, url, cookie] of paths) {
    it(`denies framing by default on ${label}`, () => {
      const response = call(url, cookie)

      expect(response.headers.get("X-Frame-Options")).toBe("DENY")
      expect(response.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'none'")
    })

    it(`scopes framing to the configured origin on ${label}`, () => {
      vi.stubEnv("ALLOWED_FRAME_ANCESTORS", "https://dash.example.com")
      const response = call(url, cookie)

      expect(response.headers.get("Content-Security-Policy")).toBe(
        "frame-ancestors 'self' https://dash.example.com"
      )
      expect(response.headers.get("X-Frame-Options")).toBeNull()
    })
  }

  it("still redirects and still returns 401 with an allow-list configured", async () => {
    vi.stubEnv("ALLOWED_FRAME_ANCESTORS", "https://dash.example.com")

    expect(call("http://localhost/settings").headers.get("location")).toBe(
      "http://localhost/login"
    )

    const api = call("http://localhost/api/trackers")
    expect(api.status).toBe(401)
    await expect(api.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("falls back to deny when the configured value is junk", () => {
    vi.stubEnv("ALLOWED_FRAME_ANCESTORS", "*")
    const response = call("http://localhost/login")

    expect(response.headers.get("X-Frame-Options")).toBe("DENY")
    expect(response.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'none'")
  })
})
