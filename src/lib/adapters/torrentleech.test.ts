// src/lib/adapters/torrentleech.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import { parseTlCredentials, parseTlProfile, TorrentleechAdapter } from "./torrentleech"

const PROFILE_HTML = `
<div class="profile-uploaded">
  <i class="fa fa-arrow-circle-o-up"></i> uploaded:
  <span class="profile-info-details profile-uploaded-details">10.5 GB</span>
</div>
<div class="profile-downloaded">
  <i class="fa fa-arrow-circle-o-down"></i> downloaded:
  <span class="profile-info-details profile-downloaded-details">5.25 GB</span>
</div>
<div class="profile-ratio">
  <i class="fa fa-percent"></i> ratio:
  <span class="profile-info-details profile-ratio-details">2.000</span>
</div>`

const FULL_PROFILE_PAGE = `<!doctype html><html><head></head><body>${PROFILE_HTML}</body></html>`

function setCookieResponse(cookies: string[], overrides: Partial<Response> = {}): Response {
  return {
    ok: true,
    status: 302,
    statusText: "Found",
    headers: { getSetCookie: () => cookies } as unknown as Headers,
    ...overrides,
  } as Response
}

describe("parseTlProfile", () => {
  it("extracts uploaded/downloaded/ratio from the profile page", () => {
    const stats = parseTlProfile(FULL_PROFILE_PAGE, "testuser")
    expect(stats.username).toBe("testuser")
    expect(stats.uploadedBytes).toBe(10_500_000_000n)
    expect(stats.downloadedBytes).toBe(5_250_000_000n)
    expect(stats.ratio).toBeCloseTo(2.0)
    expect(stats.bufferBytes).toBe(10_500_000_000n - 5_250_000_000n)
  })

  it("reports an infinite ratio (∞) as Infinity", () => {
    const infPage = `<!doctype html><html><body>
      <div class="profile-uploaded"><span class="profile-info-details profile-uploaded-details">10.5 GB</span></div>
      <div class="profile-downloaded"><span class="profile-info-details profile-downloaded-details">0 B</span></div>
      <div class="profile-ratio"><span class="profile-info-details profile-ratio-details">&infin;</span></div>
    </body></html>`
    const stats = parseTlProfile(infPage, "testuser")
    expect(stats.ratio).toBe(Infinity)
  })

  it("derives Infinity for a zero-download account even with no ratio cell", () => {
    const noRatioCell = `<!doctype html><html><body>
      <div class="profile-uploaded"><span class="profile-info-details profile-uploaded-details">250 GB</span></div>
      <div class="profile-downloaded"><span class="profile-info-details profile-downloaded-details">0 B</span></div>
    </body></html>`
    const stats = parseTlProfile(noRatioCell, "testuser")
    expect(stats.uploadedBytes).toBe(250_000_000_000n)
    expect(stats.downloadedBytes).toBe(0n)
    expect(stats.ratio).toBe(Infinity)
  })

  it("detects session expiry from a login page redirect", () => {
    const loginPage = `<!doctype html><html><body><form action="/user/account/login/">login</form></body></html>`
    expect(() => parseTlProfile(loginPage, "testuser")).toThrow("Session expired")
  })

  it("detects Cloudflare challenge and throws", () => {
    const cfChallenge = `<!doctype html><html><head><title>Just a moment...</title></head><body></body></html>`
    expect(() => parseTlProfile(cfChallenge, "testuser")).toThrow("Cloudflare")
  })

  it("throws when profile stats are missing (unauthenticated page)", () => {
    const noStats = `<!doctype html><html><body><p>Nothing here</p></body></html>`
    expect(() => parseTlProfile(noStats, "testuser")).toThrow("profile stats")
  })
})

describe("parseTlCredentials", () => {
  it("parses a valid JSON credential blob", () => {
    const json = JSON.stringify({ username: "testuser", password: "hunter2" })
    const creds = parseTlCredentials(json)
    expect(creds.username).toBe("testuser")
    expect(creds.password).toBe("hunter2")
  })

  it("throws on missing username field", () => {
    const json = JSON.stringify({ password: "hunter2" })
    expect(() => parseTlCredentials(json)).toThrow()
  })

  it("throws on missing password field", () => {
    const json = JSON.stringify({ username: "testuser" })
    expect(() => parseTlCredentials(json)).toThrow()
  })

  it("throws on non-JSON string", () => {
    expect(() => parseTlCredentials("not-json")).toThrow()
  })
})

describe("TorrentleechAdapter.fetchStats", () => {
  const adapter = new TorrentleechAdapter()
  const validToken = JSON.stringify({ username: "testuser", password: "hunter2" })

  beforeEach(() => {
    vi.restoreAllMocks()
    // The adapter caches login sessions on globalThis so it doesn't
    // re-authenticate every poll. Clear it so each test starts cold.
    ;(globalThis as { __tlSessionCache?: Map<string, string> }).__tlSessionCache?.clear()
  })

  it("logs in, fetches the profile, and returns parsed stats", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(setCookieResponse(["tluid=abc123; Path=/", "tlpass=xyz; Path=/"]))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => FULL_PROFILE_PAGE,
      } as Response)

    const stats = await adapter.fetchStats("https://www.torrentleech.org", validToken, "")

    expect(stats.username).toBe("testuser")
    expect(stats.uploadedBytes).toBe(10_500_000_000n)
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    const loginCall = fetchSpy.mock.calls[0]
    expect(loginCall[0]).toBe("https://www.torrentleech.org/user/account/login/")
    expect(loginCall[1]?.method).toBe("POST")

    const profileCall = fetchSpy.mock.calls[1]
    expect(profileCall[0]).toBe("https://www.torrentleech.org/profile/testuser")
    const profileHeaders = profileCall[1]?.headers as Record<string, string>
    expect(profileHeaders.Cookie).toContain("tluid=abc123")
  })

  it("throws 'Invalid TorrentLeech credentials' when login response has no tluid cookie", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      setCookieResponse([], { ok: true, status: 200, statusText: "OK" })
    )

    await expect(
      adapter.fetchStats("https://www.torrentleech.org", validToken, "")
    ).rejects.toThrow("Invalid TorrentLeech credentials")
  })

  it("detects a Cloudflare challenge on the profile page", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(setCookieResponse(["tluid=abc123; Path=/"]))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          `<!doctype html><html><head><title>Just a moment...</title></head><body></body></html>`,
      } as Response)

    await expect(
      adapter.fetchStats("https://www.torrentleech.org", validToken, "")
    ).rejects.toThrow("Cloudflare")
  })

  it("throws a sanitized error on network failure during login", async () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(
      adapter.fetchStats("https://www.torrentleech.org", validToken, "")
    ).rejects.toThrow("Failed to connect to www.torrentleech.org: ECONNREFUSED")
  })

  it("reuses the cached session instead of logging in on every poll", async () => {
    const loginResponse = {
      ok: true,
      status: 200,
      headers: { getSetCookie: () => ["tluid=123; Path=/", "tlpass=abc; Path=/"] },
      text: async () => "",
    } as unknown as Response
    const profileResponse = {
      ok: true,
      status: 200,
      headers: { getSetCookie: () => [] },
      text: async () => PROFILE_HTML,
    } as unknown as Response

    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(loginResponse)
      .mockResolvedValueOnce(profileResponse)
      .mockResolvedValueOnce(profileResponse)

    const token = JSON.stringify({ username: "tluser", password: "pw" })
    await adapter.fetchStats("https://www.torrentleech.org", token, "")
    await adapter.fetchStats("https://www.torrentleech.org", token, "")

    // 3 calls total: one login + two profile fetches — not two logins.
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    const loginCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/user/account/login/")
    )
    expect(loginCalls).toHaveLength(1)
  })

})
