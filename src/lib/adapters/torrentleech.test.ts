// src/lib/adapters/torrentleech.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import { parseTlCredentials, parseTlProfile, TorrentleechAdapter } from "./torrentleech"

// The proxy path is what these tests are checking is TAKEN, so proxyFetch is
// mocked rather than exercised. tunnel.ts has its own coverage.
vi.mock("@/lib/tunnel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tunnel")>()),
  proxyFetch: vi.fn(),
}))

// Markup copied from a live TorrentLeech profile page, with the account's own
// figures replaced. The structure is verbatim, and it has to be: the previous
// fixture was written from the same assumption as the parser (a
// `profile-downloaded-details` class that the site does not emit), so the tests
// agreed with the bug instead of catching it.
//
// The pieces that matter, and why each is here:
//   - the "Classic TL" nav link, present on every page, which the old class
//     regex matched before ever reaching the real class
//   - the top bar, the only source of seeding/leeching counts and hit-and-runs,
//     where the count follows the size in parentheses
//   - the asymmetric uploaded/downloaded spans
const NAV_HTML = `
<ul class="nav">
  <li><a href="http://wiki.torrentleech.org">Wiki</a></li>
  <li><a href="http://classic.torrentleech.org">Classic TL</a></li>
  <li><a href="http://v4.torrentleech.org">V4 TL</a></li>
</ul>`

const TOP_BAR_HTML = `
<span class="menu-info">
  <div title="Uploaded (Seeding)" class="div-menu-item">
    <i class="fa fa-arrow-circle-o-up"></i> <span class="link">10.5 GB</span> (12)
  </div>
  <div title="Downloaded (Leeching)" class="div-menu-item">
    <i class="fa fa-arrow-circle-o-down"></i> <span class="link">5.25 GB</span> (3)
  </div>
  <div title="Buffer" class="div-menu-item"><i class="fa fa-refresh"></i> 5.25 GB</div>
  <div title="Ratio" class="div-menu-item"><i class="fa fa-percent"></i> 2.000</div>
  <div title="Hit and Run" class="div-menu-item">
    <span class="link"><i class="fa fa-ban"></i>  2</span>
  </div>
</span>
<span class="menu-info">
  <div class="div-menu-item"><span class="link">TL Points: <span class="total-TL-points">2,750.50</span></span></div>
  <div class="div-menu-item">Slots: <span>&infin;</span></div>
</span>`

// Note the asymmetry, which is the site's and not a typo: the uploaded span
// carries `profile-uploaded-details`, the downloaded span carries no
// counterpart class.
const PROFILE_HTML = `
<div class="profile-details">
  <div class="profile-username profile-details-item">testuser</div>
  <div class="label label-success label-user-class profile-details-item">
    Registered
  </div>
</div>
<div class="profile-info">
  <div class="profile-uploaded">
    <i class="fa fa-arrow-circle-o-up"></i> uploaded:<span class="profile-info-details profile-uploaded-details">10.5 GB</span>
  </div>
  <div class="profile-downloaded">
    <i class="fa fa-arrow-circle-o-down"></i> downloaded: <span class="profile-info-details">5.25 GB</span>
  </div>
  <div class="profile-ratio">
    <i class="fa fa-percent"></i> ratio:<span class="profile-info-details profile-ratio-details">2.000</span>
  </div>
  <div class="profile-slots"><i class="fa fa-braille"></i> slots:<span class="profile-info-details">&infin;</span></div>
</div>
<table>
  <tr><td>Username</td><td>testuser</td></tr>
  <tr><td>Class</td><td>Registered</td></tr>
</table>`

const FULL_PROFILE_PAGE = `<!doctype html><html><head></head><body>${NAV_HTML}${TOP_BAR_HTML}${PROFILE_HTML}</body></html>`

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

  it("reads downloaded bytes from a span with no profile-downloaded-details class", () => {
    // The regression guard. If this ever reads 0 again, ratio becomes Infinity
    // and every torrent on the tracker looks satisfied.
    const stats = parseTlProfile(FULL_PROFILE_PAGE, "testuser")
    expect(stats.downloadedBytes).toBeGreaterThan(0n)
    expect(stats.ratio).not.toBe(Infinity)
  })

  it("still prefers profile-downloaded-details when the markup is symmetric", () => {
    const symmetric = FULL_PROFILE_PAGE.replace(
      '<span class="profile-info-details">5.25 GB</span>',
      '<span class="profile-info-details profile-downloaded-details">1.25 GB</span>'
    )
    expect(parseTlProfile(symmetric, "testuser").downloadedBytes).toBe(1_250_000_000n)
  })

  it("reads the user class from the badge, not the Classic TL nav link", () => {
    const stats = parseTlProfile(FULL_PROFILE_PAGE, "testuser")
    expect(stats.group).toBe("Registered")
  })

  it("falls back to the Class table row when the badge is absent", () => {
    const noBadge = FULL_PROFILE_PAGE.replace("label-user-class", "label-something-else")
    expect(parseTlProfile(noBadge, "testuser").group).toBe("Registered")
  })

  it("defaults the class to User when the page carries neither", () => {
    const noClass = `<!doctype html><html><body>${NAV_HTML}${PROFILE_HTML.replace(
      "label-user-class",
      "x"
    ).replace("<td>Class</td>", "<td>Rank</td>")}</body></html>`
    expect(parseTlProfile(noClass, "testuser").group).toBe("User")
  })

  it("counts torrents from the parenthesised figure, not the size beside it", () => {
    // "10.5 GB (12)": the first number in that cell is 10, which is a byte
    // total masquerading as a torrent count.
    const stats = parseTlProfile(FULL_PROFILE_PAGE, "testuser")
    expect(stats.seedingCount).toBe(12)
    expect(stats.leechingCount).toBe(3)
  })

  it("reports hit and runs from the top bar", () => {
    expect(parseTlProfile(FULL_PROFILE_PAGE, "testuser").hitAndRuns).toBe(2)
  })

  it("reports zero hit and runs as 0, not null", () => {
    const clean = FULL_PROFILE_PAGE.replace('<i class="fa fa-ban"></i>  2', '<i class="fa fa-ban"></i>  0')
    expect(parseTlProfile(clean, "testuser").hitAndRuns).toBe(0)
  })

  it("reports hit and runs as null when the top bar has no such cell", () => {
    const noCell = FULL_PROFILE_PAGE.replace('title="Hit and Run"', 'title="Something Else"')
    expect(parseTlProfile(noCell, "testuser").hitAndRuns).toBeNull()
  })

  it("reads TL Points from the total-TL-points span", () => {
    expect(parseTlProfile(FULL_PROFILE_PAGE, "testuser").seedbonus).toBeCloseTo(2750.5)
  })

  it("falls back to the TL Points label when the span class is absent", () => {
    const noSpan = FULL_PROFILE_PAGE.replace("total-TL-points", "tl-points-renamed")
    expect(parseTlProfile(noSpan, "testuser").seedbonus).toBeCloseTo(2750.5)
  })

  it("reports counts as 0 when the top bar is missing entirely", () => {
    const noTopBar = `<!doctype html><html><body>${PROFILE_HTML}</body></html>`
    const stats = parseTlProfile(noTopBar, "testuser")
    expect(stats.seedingCount).toBe(0)
    expect(stats.leechingCount).toBe(0)
  })

  it("reports an infinite ratio (∞) as Infinity", () => {
    const infPage = `<!doctype html><html><body>
      <div class="profile-uploaded"><span class="profile-info-details profile-uploaded-details">10.5 GB</span></div>
      <div class="profile-downloaded"><span class="profile-info-details">0 B</span></div>
      <div class="profile-ratio"><span class="profile-info-details profile-ratio-details">&infin;</span></div>
    </body></html>`
    const stats = parseTlProfile(infPage, "testuser")
    expect(stats.ratio).toBe(Infinity)
  })

  it("derives Infinity for a zero-download account even with no ratio cell", () => {
    const noRatioCell = `<!doctype html><html><body>
      <div class="profile-uploaded"><span class="profile-info-details profile-uploaded-details">250 GB</span></div>
      <div class="profile-downloaded"><span class="profile-info-details">0 B</span></div>
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

  it("omits alt2FAToken entirely when the account has no 2FA", () => {
    const json = JSON.stringify({ username: "testuser", password: "hunter2" })
    expect(parseTlCredentials(json)).not.toHaveProperty("alt2FAToken")
  })

  it("parses the Alt 2FA Token when present", () => {
    const json = JSON.stringify({
      username: "testuser",
      password: "hunter2",
      alt2FAToken: "  abc123def456  ",
    })
    expect(parseTlCredentials(json).alt2FAToken).toBe("abc123def456")
  })

  it("accepts the all-lowercase alt2fatoken spelling other clients store", () => {
    const json = JSON.stringify({
      username: "testuser",
      password: "hunter2",
      alt2fatoken: "abc123def456",
    })
    expect(parseTlCredentials(json).alt2FAToken).toBe("abc123def456")
  })

  it("treats a blank Alt 2FA Token as absent rather than sending an empty field", () => {
    const json = JSON.stringify({ username: "u", password: "p", alt2FAToken: "   " })
    expect(parseTlCredentials(json)).not.toHaveProperty("alt2FAToken")
  })

  it("throws when the Alt 2FA Token is not a string", () => {
    const json = JSON.stringify({ username: "u", password: "p", alt2FAToken: 123456 })
    expect(() => parseTlCredentials(json)).toThrow("alt2FAToken must be a string")
  })
})

describe("TorrentleechAdapter.fetchStats", () => {
  const adapter = new TorrentleechAdapter()
  const validToken = JSON.stringify({ username: "testuser", password: "hunter2" })

  beforeEach(async () => {
    vi.restoreAllMocks()
    const { proxyFetch } = await import("@/lib/tunnel")
    vi.mocked(proxyFetch).mockReset()
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

  it("posts alt2FAToken as a third login field when the account has 2FA", async () => {
    const tokenCreds = JSON.stringify({
      username: "testuser",
      password: "hunter2",
      alt2FAToken: "abc123def456",
    })
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(setCookieResponse(["tluid=abc123; Path=/"]))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => FULL_PROFILE_PAGE,
      } as Response)

    await adapter.fetchStats("https://www.torrentleech.org", tokenCreds, "")

    const body = fetchSpy.mock.calls[0][1]?.body as string
    const form = new URLSearchParams(body)
    // The field name is TorrentLeech's own spelling, not ours. The login form
    // reads `alt2FAToken` and silently ignores anything else.
    expect(form.get("alt2FAToken")).toBe("abc123def456")
    expect(form.get("username")).toBe("testuser")
    expect(form.get("password")).toBe("hunter2")
  })

  it("does not send an alt2FAToken field at all for accounts without 2FA", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(setCookieResponse(["tluid=abc123; Path=/"]))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => FULL_PROFILE_PAGE,
      } as Response)

    await adapter.fetchStats("https://www.torrentleech.org", validToken, "")

    const body = fetchSpy.mock.calls[0][1]?.body as string
    expect(new URLSearchParams(body).has("alt2FAToken")).toBe(false)
  })

  it("names 2FA as the cause when the login page asks for a One Time Password", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      setCookieResponse([], {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () =>
          `<div class="login-container"><h2>One Time Password</h2></div>`,
      } as Partial<Response>)
    )

    await expect(
      adapter.fetchStats("https://www.torrentleech.org", validToken, "")
    ).rejects.toThrow("Alt 2FA Token")
  })

  it("blames the token too when a 2FA login is refused", async () => {
    const tokenCreds = JSON.stringify({
      username: "testuser",
      password: "hunter2",
      alt2FAToken: "wrong-token",
    })
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      setCookieResponse([], {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => `<p class="text-danger">Invalid login</p>`,
      } as Partial<Response>)
    )

    await expect(
      adapter.fetchStats("https://www.torrentleech.org", tokenCreds, "")
    ).rejects.toThrow("Invalid TorrentLeech credentials or Alt 2FA Token")
  })

  it("rejects a 200 login that still set tluid, as TL does on a REFUSED login", async () => {
    // Measured against the live site: a rejected login answers 200 with the
    // login page and still sets tluid/tlpass/member_id/pass_hash/session_id.
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      setCookieResponse(["tluid=abc123; Path=/", "tlpass=xyz; Path=/"], {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => `<form name="login-form"><a href="/user/account/login">in</a></form>`,
      } as Partial<Response>)
    )

    await expect(
      adapter.fetchStats("https://www.torrentleech.org", validToken, "")
    ).rejects.toThrow("Invalid TorrentLeech credentials")
  })

  it("names 2FA when a cookie-bearing 200 login shows the One Time Password page", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      setCookieResponse(["tluid=abc123; Path=/"], {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => `<div class="login-container"><h2>One Time Password</h2></div>`,
      } as Partial<Response>)
    )

    await expect(
      adapter.fetchStats("https://www.torrentleech.org", validToken, "")
    ).rejects.toThrow("Alt 2FA Token")
  })

  it("still accepts a 200 login that does not look like the login page", async () => {
    // Guards the fallback: the redirect is the signal today, but a 200 with a
    // real page and a session cookie must not start failing.
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        setCookieResponse(["tluid=abc123; Path=/"], {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => `<html><body>Welcome back</body></html>`,
        } as Partial<Response>)
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => FULL_PROFILE_PAGE,
      } as Response)

    const stats = await adapter.fetchStats("https://www.torrentleech.org", validToken, "")
    expect(stats.username).toBe("testuser")
  })

  it("sends the login POST through the proxy when one is configured", async () => {
    const { proxyFetch } = await import("@/lib/tunnel")
    const proxySpy = vi.mocked(proxyFetch)
    proxySpy.mockResolvedValueOnce({
      ok: true,
      status: 302,
      statusText: "Found",
      headers: { "set-cookie": ["tluid=abc123; Path=/"] },
      json: async () => ({}),
      text: async () => "",
      buffer: async () => Buffer.from(""),
    })
    // The profile GET was already proxied before this change; the login POST
    // was the one request that was not.
    proxySpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {},
      json: async () => ({}),
      text: async () => FULL_PROFILE_PAGE,
      buffer: async () => Buffer.from(FULL_PROFILE_PAGE),
    })
    const fetchSpy = vi.spyOn(global, "fetch")

    const agent = {} as never
    const stats = await adapter.fetchStats("https://www.torrentleech.org", validToken, "", {
      proxyAgent: agent,
    })

    expect(stats.username).toBe("testuser")
    // The whole point: the request carrying the password went through the
    // proxy, and nothing went out the direct path at all.
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(proxySpy).toHaveBeenCalledTimes(2)

    const [url, passedAgent, opts] = proxySpy.mock.calls[0]
    expect(url).toBe("https://www.torrentleech.org/user/account/login/")
    expect(passedAgent).toBe(agent)
    expect(opts?.method).toBe("POST")
    expect(new URLSearchParams(opts?.body ?? "").get("username")).toBe("testuser")
    expect(proxySpy.mock.calls[1][0]).toContain("/profile/testuser")
  })

  it("still uses a direct fetch for the login when no proxy is configured", async () => {
    const { proxyFetch } = await import("@/lib/tunnel")
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(setCookieResponse(["tluid=abc123; Path=/"]))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => FULL_PROFILE_PAGE,
      } as Response)

    await adapter.fetchStats("https://www.torrentleech.org", validToken, "")

    expect(vi.mocked(proxyFetch)).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("reads the 2FA hint from the proxied response body too", async () => {
    const { proxyFetch } = await import("@/lib/tunnel")
    vi.mocked(proxyFetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {},
      json: async () => ({}),
      text: async () => `<div class="login-container"><h2>One Time Password</h2></div>`,
      buffer: async () => Buffer.from(""),
    })

    await expect(
      adapter.fetchStats("https://www.torrentleech.org", validToken, "", {
        proxyAgent: {} as never,
      })
    ).rejects.toThrow("Alt 2FA Token")
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

    // 3 calls total: one login + two profile fetches, not two logins.
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    const loginCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/user/account/login/")
    )
    expect(loginCalls).toHaveLength(1)
  })
})
