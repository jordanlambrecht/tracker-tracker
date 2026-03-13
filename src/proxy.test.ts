// src/proxy.test.ts

import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { proxy } from "./proxy"

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