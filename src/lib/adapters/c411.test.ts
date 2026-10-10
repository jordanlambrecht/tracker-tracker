// src/lib/adapters/c411.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { C411Adapter, parseC411Credentials, parseCsrfToken } from "./c411"

const LOGIN_HTML = '<html><head><meta name="csrf-token" content="tok123"></head></html>'
const CREDS = JSON.stringify({ username: "TheSnak", password: "pw" })

function loginPage(): Response {
  return new Response(LOGIN_HTML, { status: 200, headers: { "set-cookie": "__csrf=abc" } })
}

function loginOk(cookie = "c411_session=xyz"): Response {
  return new Response("{}", { status: 200, headers: { "set-cookie": cookie } })
}

function meResponse(user: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ authenticated: true, user }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  ;(globalThis as { __c411SessionCache?: Map<string, string> }).__c411SessionCache?.clear()
})

describe("parseC411Credentials", () => {
  it("parses username and password", () => {
    expect(parseC411Credentials(CREDS)).toEqual({ username: "TheSnak", password: "pw" })
  })

  it("rejects a non-JSON blob", () => {
    expect(() => parseC411Credentials("not-json")).toThrow(/JSON object/)
  })
})

describe("parseCsrfToken", () => {
  it("extracts the meta token", () => {
    expect(parseCsrfToken(LOGIN_HTML)).toBe("tok123")
  })

  it("throws when the token is absent", () => {
    expect(() => parseCsrfToken("<html></html>")).toThrow(/CSRF token/)
  })
})

describe("C411Adapter", () => {
  it("logs in, sends the csrf token and cookie, and maps the payload", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(loginPage())
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(
        meResponse({
          id: 361964,
          username: "TheSnak",
          badge: { label: "Membre" },
          uploaded: 8958322226363,
          downloaded: 1727509064118,
          minRatioForDownload: 0.8,
          isWarned: false,
          createdAt: "2026-08-02T14:35:37.000Z",
        })
      )

    const stats = await new C411Adapter().fetchStats("https://c411.test", CREDS, "/api/auth/me")

    expect(stats.username).toBe("TheSnak")
    expect(stats.group).toBe("Membre")
    expect(stats.uploadedBytes).toBe(8958322226363n)
    expect(stats.downloadedBytes).toBe(1727509064118n)
    expect(stats.requiredRatio).toBe(0.8)
    expect(stats.warned).toBe(false)
    expect(stats.remoteUserId).toBe(361964)
    expect(stats.joinedDate).toBe("2026-08-02T14:35:37.000Z")

    const loginHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>
    expect(loginHeaders["csrf-token"]).toBe("tok123")
    expect(loginHeaders.Cookie).toContain("__csrf=abc")
  })

  it("throws on a rejected login", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(loginPage())
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))

    await expect(
      new C411Adapter().fetchStats("https://c411.test", CREDS, "/api/auth/me")
    ).rejects.toThrow(/Invalid C411 username or password/)
  })

  it("re-authenticates once when the cached session is stale", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(loginPage())
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false, user: null })))
      .mockResolvedValueOnce(loginPage())
      .mockResolvedValueOnce(loginOk("c411_session=xyz2"))
      .mockResolvedValueOnce(meResponse({ id: 1, username: "TheSnak", uploaded: 10, downloaded: 5 }))

    const stats = await new C411Adapter().fetchStats("https://c411.test", CREDS, "/api/auth/me")

    expect(stats.username).toBe("TheSnak")
    expect(stats.uploadedBytes).toBe(10n)
  })

  it("returns an error DebugApiCall when the request fails", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"))

    const calls = await new C411Adapter().fetchRaw("https://c411.test", CREDS, "/api/auth/me")

    expect(calls[0]?.data).toBeNull()
    expect(calls[0]?.error).toBeTruthy()
  })
})
