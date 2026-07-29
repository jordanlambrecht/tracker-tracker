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

// Header menu, copied from a real logged-in TL profile page (values altered).
// Note the shape difference that the count parsing depends on: seeding and
// leeching lead with a transfer SIZE and carry the torrent count in trailing
// parens, whereas Hit and Run is a bare number.
const MENU_HTML = `
<span class="menu-info">
  <div title="Uploaded (Seeding)" class="div-menu-item">
    <i class="fa fa-arrow-circle-o-up"></i> <span class="link">2.39 TB</span> (30)
  </div>
  <div title="Downloaded (Leeching)" class="div-menu-item">
    <i class="fa fa-arrow-circle-o-down"></i> <span class="link">244.44 GB</span> (9)
  </div>
  <div title="Buffer" class="div-menu-item"><i class="fa fa-refresh"></i> 2.15 TB</div>
  <div title="Ratio" class="div-menu-item"><i class="fa fa-percent"></i> 9.995</div>
  <div title="Hit and Run" class="div-menu-item">
    <span class="link"><i class="fa fa-ban"></i>  4</span>
  </div>
</span>`

const FULL_PROFILE_PAGE = `<!doctype html><html><head></head><body>${PROFILE_HTML}</body></html>`
const PAGE_WITH_MENU = `<!doctype html><html><body>${PROFILE_HTML}${MENU_HTML}</body></html>`

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

  it("reads the parenthesised torrent count, not the transfer size", () => {
    const stats = parseTlProfile(PAGE_WITH_MENU, "testuser")
    // Regression guard: taking the first number in the element would give
    // 2 (from "2.39 TB") and 244 (from "244.44 GB").
    expect(stats.seedingCount).toBe(30)
    expect(stats.leechingCount).toBe(9)
  })

  it("extracts the hit-and-run count from the header menu", () => {
    expect(parseTlProfile(PAGE_WITH_MENU, "testuser").hitAndRuns).toBe(4)
  })

  it("reports zero hit and runs as 0, not null", () => {
    const clean = PAGE_WITH_MENU.replace(
      '<i class="fa fa-ban"></i>  4',
      '<i class="fa fa-ban"></i>  0'
    )
    expect(parseTlProfile(clean, "testuser").hitAndRuns).toBe(0)
  })

  it("leaves hitAndRuns null when the counter is absent", () => {
    // A missing counter must not read as "no hit and runs" — that would hide
    // the condition the field exists to surface.
    expect(parseTlProfile(FULL_PROFILE_PAGE, "testuser").hitAndRuns).toBeNull()
  })

  it("treats an infinite ratio (∞) as 0", () => {
    const infPage = `<!doctype html><html><body>
      <div class="profile-uploaded"><span class="profile-info-details profile-uploaded-details">0 B</span></div>
      <div class="profile-downloaded"><span class="profile-info-details profile-downloaded-details">0 B</span></div>
      <div class="profile-ratio"><span class="profile-info-details profile-ratio-details">&infin;</span></div>
    </body></html>`
    const stats = parseTlProfile(infPage, "testuser")
    expect(stats.ratio).toBe(0)
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
})
