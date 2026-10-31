// src/lib/tracker-platforms/__tests__/iptorrents.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { IptorrentsAdapter, parseIptCredentials, parseIptProfile } from "../adapters/iptorrents"

const STATS_HTML = `
<div class="stats">
  <a class="uname" href="/u/12345">testuser</a>
  <span class="tTipWrap"><div class="tTip">Ratio</div><i class="fa fa-battery-three-quarters"></i>0.740</span>
  <span class="tTipWrap"><div class="tTip">Uploaded</div><i class="fa fa-upload"></i>14.5 GB</span>
  <span class="tTipWrap"><div class="tTip">Downloaded</div><i class="fa fa-download"></i>19.6 GB</span>
  <span class="tTipWrap"><div class="tTip">Active Torrents</div><i class="fa fa-angle-double-up"></i>10&nbsp;<i class="fa fa-angle-double-down"></i>2</span>
  <span class="tTipWrap"><div class="tTip">Bonus Points</div><i class="fa fa-gift"></i>55.4</span>
</div>`

const FULL_PAGE = `<!doctype html><html><head></head><body>${STATS_HTML}</body></html>`

// The signed-in member's own profile: the stats bar every page carries, then the
// class badge and dates. Shapes from the live page on 2026-10-24, values invented.
const PROFILE_PAGE = `<!doctype html><html><body>${STATS_HTML}
  <div class="up-header-info">
    <h1 class="up-username">testuser</h1>
    <div class="up-class-line"><span class="up-class-badge"><svg viewBox="0 0 16 16"></svg>Power User</span></div>
  </div>
  <div class="up-section">
    <div class="up-field">
      <span class="up-field-label">Join Date</span>
      <span class="up-field-value">2024-05-06 07:08:09 (<span class="elapsedDate" title="Monday, May 6, 2024 at 7:08am">2 years ago</span>)</span>
    </div>
    <div class="up-field">
      <span class="up-field-label">Last Seen</span>
      <span class="up-field-value">2026-01-02 03:04:05 (<span class="elapsedDate" title="Friday, January 2, 2026 at 3:04am">3 minutes ago</span>)</span>
    </div>
  </div>
</body></html>`

const HOSTNAME = "iptorrents.com"

const page = (html: string) => ({ ok: true, status: 200, text: async () => html }) as Response

describe("parseIptProfile", () => {
  it("extracts stats from the header stats bar", () => {
    const stats = parseIptProfile(FULL_PAGE, HOSTNAME)
    expect(stats.username).toBe("testuser")
    expect(stats.ratio).toBeCloseTo(0.74)
    expect(stats.uploadedBytes).toBe(14_500_000_000n)
    expect(stats.downloadedBytes).toBe(19_600_000_000n)
    expect(stats.seedingCount).toBe(10)
    expect(stats.leechingCount).toBe(2)
    expect(stats.seedbonus).toBeCloseTo(55.4)
  })

  it("throws on a page it cannot read rather than reporting a set of zeros", () => {
    // Every accumulator starts at zero and the byte parser swallows failures,
    // so without the guard a third DOM variant is stored as a real snapshot of
    // nothing and the connection test goes green beside it.
    const unknownShape = `<!doctype html><html><body><div class="stats"><span class="uname">testuser</span><div class="tTipWrap">nothing recognisable here</div></div></body></html>`

    expect(() => parseIptProfile(unknownShape, HOSTNAME)).toThrow(/upload\/download bytes/i)
  })

  it("reads a brand new account as zeros rather than an unreadable page", () => {
    // Both rows are present and both say 0 B. A new account must read as zeros,
    // not as a stats bar that failed to parse.
    const newAccount = `<!doctype html><html><body><div class="stats">
      <span class="uname">newuser</span>
      <div class="tTipWrap"><span class="tTip">Uploaded</span> 0 B</div>
      <div class="tTipWrap"><span class="tTip">Downloaded</span> 0 B</div>
    </div></body></html>`

    const stats = parseIptProfile(newAccount, HOSTNAME)
    expect(stats.uploadedBytes).toBe(0n)
    expect(stats.downloadedBytes).toBe(0n)
    expect(stats.ratio).toBe(0)
  })

  it("rejects a page whose Uploaded row is unreadable while Downloaded parses", () => {
    // The Downloaded row still parses, so the both-missing guard never fires and
    // an upload total the account never had would reach the snapshot as 0n.
    const uploadUnreadable = FULL_PAGE.replace("14.5 GB", "n/a")

    expect(() => parseIptProfile(uploadUnreadable, HOSTNAME)).toThrow(
      "Unexpected response from iptorrents.com: unreadable uploaded byte total"
    )
  })

  it("rejects a page whose Downloaded row is unreadable while Uploaded parses", () => {
    const downloadUnreadable = FULL_PAGE.replace("19.6 GB", "n/a")

    expect(() => parseIptProfile(downloadUnreadable, HOSTNAME)).toThrow(
      "Unexpected response from iptorrents.com: unreadable downloaded byte total"
    )
  })

  it("reports counts the stats bar does not carry as unknown", () => {
    // A zero here is a claim the account seeds nothing, which is what the
    // no-seeds badge and the zero-seeding alert both key on.
    const bytesOnly = `<!doctype html><html><body><div class="stats">
      <span class="uname">testuser</span>
      <div class="tTipWrap"><span class="tTip">Uploaded</span> 1.00 GB</div>
      <div class="tTipWrap"><span class="tTip">Downloaded</span> 500 MB</div>
    </div></body></html>`

    const stats = parseIptProfile(bytesOnly, HOSTNAME)
    expect(stats.seedingCount).toBeNull()
    expect(stats.leechingCount).toBeNull()
    expect(stats.seedbonus).toBeNull()
  })

  it("computes bufferBytes as upload minus download", () => {
    const stats = parseIptProfile(FULL_PAGE, HOSTNAME)
    // This fixture is a deficit account (14.5 GB up, 19.6 GB down), the
    // shortfall is the point of the chart, so it is not clamped to 0n.
    expect(stats.bufferBytes).toBe(-5_100_000_000n)
  })

  it("reads a page with no class as unknown rather than User", () => {
    // A guessed "User" would land in rank history as the member's class.
    expect(parseIptProfile(FULL_PAGE, HOSTNAME).group).toBeNull()
  })

  it("detects VIP group from the hdr-vip badge title", () => {
    const vipPage = `<!doctype html><html><head></head><body>
      <div class="stats">
        <a class="uname" href="/u/1">vipuser</a>
        <span class="hdr-vip" title="VIP active - expires in 30 days"></span>
        <span class="tTipWrap"><div class="tTip">Ratio</div>1.500</span>
        <span class="tTipWrap"><div class="tTip">Uploaded</div>1.0 GB</span>
        <span class="tTipWrap"><div class="tTip">Downloaded</div>500.0 MB</span>
      </div>
    </body></html>`
    const stats = parseIptProfile(vipPage, HOSTNAME)
    expect(stats.group).toBe("VIP")
  })

  it("falls back to .up-stat cards when the stats bar has no tTipWrap items", () => {
    const upStatPage = `<!doctype html><html><head></head><body>
      <div class="stats">
        <a class="uname" href="/u/1">carduser</a>
        <div class="up-stat"><div class="up-stat-label">Uploaded</div><div class="up-stat-value">2.0 GB</div></div>
        <div class="up-stat"><div class="up-stat-label">Downloaded</div><div class="up-stat-value">1.0 GB</div></div>
        <div class="up-stat"><div class="up-stat-label">Ratio</div><div class="up-stat-value">0.500</div></div>
        <div class="up-stat"><div class="up-stat-label">Balance</div><div class="up-stat-value">10.5</div></div>
      </div>
    </body></html>`
    const stats = parseIptProfile(upStatPage, HOSTNAME, 1)
    expect(stats.uploadedBytes).toBe(2_000_000_000n)
    expect(stats.downloadedBytes).toBe(1_000_000_000n)
    // The Ratio card deliberately contradicts the byte totals: 2 GB over 1 GB
    // is 2, so reading 0.5 here would mean the site's own field won.
    expect(stats.ratio).toBe(2)
    expect(stats.seedbonus).toBe(10.5)

    // The cards are the profile owner's, so another member's page must not
    // stand in for the signed-in member's totals.
    expect(() => parseIptProfile(upStatPage, HOSTNAME, 2)).toThrow(/upload\/download bytes/)
  })

  it("reports an unreadable bonus figure as unknown rather than NaN", () => {
    // A placeholder bonus must not parse as NaN, which is neither a figure nor
    // null and slips past every guard into the snapshot.
    const tTipPage = `<!doctype html><html><body><div class="stats">
      <span class="uname">testuser</span>
      <div class="tTipWrap"><span class="tTip">Uploaded</span> 1.00 GB</div>
      <div class="tTipWrap"><span class="tTip">Downloaded</span> 500 MB</div>
      <div class="tTipWrap"><span class="tTip">Bonus Points</span> ...</div>
    </div></body></html>`
    expect(parseIptProfile(tTipPage, HOSTNAME).seedbonus).toBeNull()

    // The .up-stat fallback carries its own copy of the same parse.
    const upStatPage = `<!doctype html><html><head></head><body>
      <div class="stats">
        <a class="uname" href="/u/1">carduser</a>
        <div class="up-stat"><div class="up-stat-label">Uploaded</div><div class="up-stat-value">2.0 GB</div></div>
        <div class="up-stat"><div class="up-stat-label">Downloaded</div><div class="up-stat-value">1.0 GB</div></div>
        <div class="up-stat"><div class="up-stat-label">Balance</div><div class="up-stat-value">...</div></div>
      </div>
    </body></html>`
    expect(parseIptProfile(upStatPage, HOSTNAME, 1).seedbonus).toBeNull()
  })

  it("returns Infinity for ratio when downloaded is zero and uploaded is positive", () => {
    const noDownloadsPage = `<!doctype html><html><head></head><body>
      <div class="stats">
        <a class="uname" href="/u/1">seeder</a>
        <span class="tTipWrap"><div class="tTip">Ratio</div>0.000</span>
        <span class="tTipWrap"><div class="tTip">Uploaded</div>5.0 GB</span>
        <span class="tTipWrap"><div class="tTip">Downloaded</div>0.0 GB</span>
      </div>
    </body></html>`
    const stats = parseIptProfile(noDownloadsPage, HOSTNAME)
    expect(stats.uploadedBytes).toBe(5_000_000_000n)
    expect(stats.downloadedBytes).toBe(0n)
    expect(stats.ratio).toBe(Infinity)
  })

  it("throws when the stats bar is missing (unauthenticated page)", () => {
    const noStats = `<!doctype html><html><head></head><body><p>No stats here.</p></body></html>`
    expect(() => parseIptProfile(noStats, HOSTNAME)).toThrow("stats bar")
  })

  it("detects a session-expired login redirect and throws", () => {
    const loginRedirect = `<!doctype html><html><head><meta http-equiv="refresh" content="0;url='/auth/login'" /></head></html>`
    expect(() => parseIptProfile(loginRedirect, HOSTNAME)).toThrow("Session expired")
  })

  it("detects a Cloudflare challenge and throws, and the card names it", () => {
    const cfChallenge = `<!doctype html><html><head><title>Just a moment...</title></head><body></body></html>`
    let message = ""
    try {
      parseIptProfile(cfChallenge, HOSTNAME)
    } catch (err) {
      message = err instanceof Error ? err.message : ""
    }
    expect(message).toBe("Cloudflare challenge detected. Cookies need refreshing")
    expect(sanitizeNetworkError(message, "Poll failed")).toBe(
      "Cloudflare challenge blocked the request"
    )
  })
})

describe("parseIptProfile on a profile page", () => {
  it("reads the class and dates on the signed-in member's own profile", () => {
    const stats = parseIptProfile(PROFILE_PAGE, HOSTNAME, 12345)
    expect(stats.group).toBe("Power User")
    expect(stats.joinedDate).toBe("2024-05-06")
    expect(stats.lastAccessDate).toBe("2026-01-02")
    expect(stats.remoteUserId).toBe(12345)
  })

  it("skips the class and dates on another member's profile but keeps the stats bar", () => {
    // The stats bar is always the signed-in member's; the badge and dates belong
    // to whoever the profile is for.
    const stats = parseIptProfile(PROFILE_PAGE, HOSTNAME, 999)
    expect(stats.group).toBeNull()
    expect(stats.joinedDate).toBeUndefined()
    expect(stats.lastAccessDate).toBeUndefined()
    expect(stats.uploadedBytes).toBe(14_500_000_000n)
    expect(stats.remoteUserId).toBe(12345)
  })

  it("takes the member's id from the stats bar, not a member link elsewhere on the page", () => {
    const linkFirst = PROFILE_PAGE.replace(
      "<body>",
      '<body><a class="uname" href="/u/777">inviter</a>'
    )
    expect(parseIptProfile(linkFirst, HOSTNAME).remoteUserId).toBe(12345)
    expect(parseIptProfile(linkFirst, HOSTNAME, 777).group).toBeNull()
  })

  it("ignores a username link that is not a profile path", () => {
    const offsite = FULL_PAGE.replace('href="/u/12345"', 'href="https://elsewhere.example/u/1"')
    expect(parseIptProfile(offsite, HOSTNAME).remoteUserId).toBeUndefined()
  })

  it("prefers the badge, then the header's VIP flag, then unknown", () => {
    const vipFlag = '<span class="hdr-vip" title="VIP active - expires in 30 days"></span>'
    const withFlag = PROFILE_PAGE.replace('<div class="stats">', `<div class="stats">${vipFlag}`)
    const noBadge = (page: string) => page.replace(/<span class="up-class-badge">.*?<\/span>/, "")

    expect(parseIptProfile(withFlag, HOSTNAME, 12345).group).toBe("Power User")
    expect(parseIptProfile(noBadge(withFlag), HOSTNAME, 12345).group).toBe("VIP")
    expect(parseIptProfile(noBadge(PROFILE_PAGE), HOSTNAME, 12345).group).toBeNull()
  })
})

describe("parseIptProfile pages it cannot read", () => {
  // The tracker answered, so the card must not read "Poll failed", which is
  // also what a host that never answered gets.
  it.each([
    [
      "no stats bar",
      "<html><body><p>Down for maintenance</p></body></html>",
      "Could not find stats bar on IPTorrents page. The page may not be authenticated",
    ],
    [
      "a stats bar with no byte totals",
      '<html><body><div class="stats"></div></body></html>',
      "Could not extract upload/download bytes from the IPTorrents stats bar. The page structure may have changed.",
    ],
  ])("reads %s as an unexpected response", (_case, page, detail) => {
    let message = ""
    try {
      parseIptProfile(page, HOSTNAME)
    } catch (err) {
      message = err instanceof Error ? err.message : ""
    }
    expect(message).toBe(`Unexpected response from ${HOSTNAME}: ${detail}`)
    expect(sanitizeNetworkError(message, "Poll failed")).toBe(
      "Tracker returned an unexpected response"
    )
  })
})

// The other fixtures write the username anchor bare, which is why this went
// unnoticed. The live anchor is a tTipWrap like the stat items and carries a
// tooltip child, so these use that shape with invented values.
describe("parseIptProfile username", () => {
  const withTooltip = (name: string) =>
    `<div class="stats"><div><div><a href="/u/1234" class="tTipWrap uname"><div class="tTip ttop">Profile</div>${name}</a></div></div>` +
    `<span class="tTipWrap"><div class="tTip">Uploaded</div>10 GB</span>` +
    `<span class="tTipWrap"><div class="tTip">Downloaded</div>5 GB</span>` +
    `<span class="tTipWrap"><div class="tTip">Active Torrents</div>3 1</span>` +
    `<span class="tTipWrap"><div class="tTip">Bonus Points</div>100</span></div>`

  it("strips the Profile tooltip rather than prefixing it to the name", () => {
    expect(parseIptProfile(withTooltip("testuser"), HOSTNAME).username).toBe("testuser")
  })

  it("keeps a name that itself starts with the tooltip text", () => {
    expect(parseIptProfile(withTooltip("ProfileHunter"), HOSTNAME).username).toBe("ProfileHunter")
  })
})

describe("parseIptCredentials", () => {
  it("parses a valid JSON credential blob", () => {
    const json = JSON.stringify({ cookies: "uid=123; pass=abc123", userAgent: "Mozilla/5.0" })
    const creds = parseIptCredentials(json)
    expect(creds.cookies).toBe("uid=123; pass=abc123")
    expect(creds.userAgent).toBe("Mozilla/5.0")
  })

  it("throws on missing cookies field", () => {
    const json = JSON.stringify({ userAgent: "Mozilla/5.0" })
    expect(() => parseIptCredentials(json)).toThrow("cookies")
  })

  it("throws on missing userAgent field", () => {
    const json = JSON.stringify({ cookies: "uid=123; pass=abc123" })
    expect(() => parseIptCredentials(json)).toThrow()
  })

  it("throws on non-JSON string", () => {
    expect(() => parseIptCredentials("not-json")).toThrow()
  })

  it("throws on empty cookies", () => {
    const json = JSON.stringify({ cookies: "   ", userAgent: "Mozilla/5.0" })
    expect(() => parseIptCredentials(json)).toThrow("cookies")
  })

  it("throws when cookie string has no key=value pairs", () => {
    const json = JSON.stringify({ cookies: "some-random-text", userAgent: "Mozilla/5.0" })
    expect(() => parseIptCredentials(json)).toThrow("key=value")
  })

  it("throws when a non-ASCII character is present", () => {
    const json = JSON.stringify({ cookies: "uid=123; pass=abc…", userAgent: "Mozilla/5.0" })
    expect(() => parseIptCredentials(json)).toThrow("non-ASCII")
  })
})

describe("IptorrentsAdapter.fetchStats - network error classification", () => {
  const adapter = new IptorrentsAdapter()
  const validToken = JSON.stringify({ cookies: "uid=123; pass=abc123", userAgent: "Mozilla/5.0" })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("unwraps TypeError wrapping ECONNREFUSED", async () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED 192.0.2.1:443"), {
      code: "ECONNREFUSED",
    })
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(adapter.fetchStats("https://iptorrents.com", validToken, "")).rejects.toThrow(
      "Failed to connect to iptorrents.com: ECONNREFUSED"
    )
  })

  it("propagates session-expired error when server returns a 302 redirect to login", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 302,
      statusText: "Found",
      headers: new Headers({ location: "/auth/login" }),
    } as Response)

    await expect(adapter.fetchStats("https://iptorrents.com", validToken, "")).rejects.toThrow(
      "Session expired"
    )
  })

  it("looks the id up on the homepage, then reads the profile page, with cookie and user-agent headers", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(page(FULL_PAGE))
      .mockResolvedValueOnce(page(PROFILE_PAGE))

    const stats = await adapter.fetchStats("https://iptorrents.com", validToken, "")

    expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
      "https://iptorrents.com/",
      "https://iptorrents.com/u/12345",
    ])
    for (const [, init] of fetchSpy.mock.calls) {
      const headers = init?.headers as Record<string, string>
      expect(headers.Cookie).toBe("uid=123; pass=abc123")
      expect(headers["User-Agent"]).toBe("Mozilla/5.0")
    }
    expect(stats.group).toBe("Power User")
    expect(stats.remoteUserId).toBe(12345)
  })

  it("reads everything from the profile page alone once the id is cached", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(page(PROFILE_PAGE))

    const stats = await adapter.fetchStats("https://iptorrents.com", validToken, "", {
      remoteUserId: 12345,
    })

    expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual(["https://iptorrents.com/u/12345"])
    expect(stats.uploadedBytes).toBe(14_500_000_000n)
    expect(stats.group).toBe("Power User")
    expect(stats.joinedDate).toBe("2024-05-06")
    expect(stats.lastAccessDate).toBe("2026-01-02")
  })

  it("fails the poll on a challenge page served in place of the profile", async () => {
    const cfChallenge = `<!doctype html><html><head><title>Just a moment...</title></head><body></body></html>`
    vi.spyOn(global, "fetch").mockResolvedValueOnce(page(cfChallenge))

    await expect(
      adapter.fetchStats("https://iptorrents.com", validToken, "", { remoteUserId: 12345 })
    ).rejects.toThrow("Cloudflare challenge detected")
  })

  it("reads a stale cached id's page as no class and returns the signed-in member's id", async () => {
    // Cookies swapped to another account keep the old id until this poll
    // returns the new one.
    vi.spyOn(global, "fetch").mockResolvedValueOnce(page(PROFILE_PAGE))

    const stats = await adapter.fetchStats("https://iptorrents.com", validToken, "", {
      remoteUserId: 999,
    })

    expect(stats.group).toBeNull()
    expect(stats.joinedDate).toBeUndefined()
    expect(stats.uploadedBytes).toBe(14_500_000_000n)
    expect(stats.remoteUserId).toBe(12345)
  })

  it("names the missing profile link when the homepage has none", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(page(FULL_PAGE.replace(' href="/u/12345"', "")))

    await expect(adapter.fetchStats("https://iptorrents.com", validToken, "")).rejects.toThrow(
      "Unexpected response from iptorrents.com: Could not find the profile link in the IPTorrents stats bar"
    )
  })
})

describe("IptorrentsAdapter - redirect handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("follows 302 to /t instead of throwing session expired", async () => {
    const creds = JSON.stringify({
      cookies: "uid=123; pass=abc",
      userAgent: "Mozilla/5.0",
    })
    const statsHtml = `<div class="stats"><a class="uname" href="/u/123">testuser</a><span class="tTipWrap"><div class="tTip">Ratio</div>1.50</span><span class="tTipWrap"><div class="tTip">Uploaded</div>10 GB</span><span class="tTipWrap"><div class="tTip">Downloaded</div>5 GB</span><span class="tTipWrap"><div class="tTip">Active Torrents</div>3 1</span><span class="tTipWrap"><div class="tTip">Bonus Points</div>100</span></div>`

    let callCount = 0
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: "/t" },
        })
      }
      return new Response(statsHtml, { status: 200 })
    })

    const adapter = new IptorrentsAdapter()
    const stats = await adapter.fetchStats("https://iptorrents.com", creds, "/")
    expect(stats.username).toBe("testuser")
    expect(stats.uploadedBytes).toBe(10_000_000_000n)
  })

  it("throws session expired when 302 points to /auth/login", async () => {
    const creds = JSON.stringify({
      cookies: "uid=123; pass=expired",
      userAgent: "Mozilla/5.0",
    })

    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(null, {
        status: 302,
        headers: { location: "/auth/login" },
      })
    })

    const adapter = new IptorrentsAdapter()
    await expect(adapter.fetchStats("https://iptorrents.com", creds, "/")).rejects.toThrow(
      "Session expired"
    )
  })

  it('follows path-relative redirects (e.g. location: "t")', async () => {
    const creds = JSON.stringify({
      cookies: "uid=123; pass=abc",
      userAgent: "Mozilla/5.0",
    })
    const statsHtml = `<div class="stats"><a class="uname" href="/u/123">testuser</a><span class="tTipWrap"><div class="tTip">Ratio</div>1.50</span><span class="tTipWrap"><div class="tTip">Uploaded</div>10 GB</span><span class="tTipWrap"><div class="tTip">Downloaded</div>5 GB</span><span class="tTipWrap"><div class="tTip">Active Torrents</div>3 1</span><span class="tTipWrap"><div class="tTip">Bonus Points</div>100</span></div>`

    let callCount = 0
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      callCount++
      const reqUrl =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url

      if (callCount === 1) {
        expect(reqUrl).toBe("https://iptorrents.com/")
        return new Response(null, {
          status: 302,
          headers: { location: "t" }, // Relative path without leading slash
        })
      }

      if (callCount === 2) {
        expect(reqUrl).toBe("https://iptorrents.com/t")
        return new Response(statsHtml, { status: 200 })
      }

      if (callCount === 3) {
        expect(reqUrl).toBe("https://iptorrents.com/u/123")
        return new Response(statsHtml, { status: 200 })
      }

      return new Response(null, { status: 404 })
    })

    const adapter = new IptorrentsAdapter()
    const stats = await adapter.fetchStats("https://iptorrents.com", creds, "/")
    expect(stats.username).toBe("testuser")
    // The redirect, the page it lands on, and the profile page
    expect(callCount).toBe(3)
  })

  it("follows the profile link's redirect to user.php", async () => {
    const urls: string[] = []
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const reqUrl =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      urls.push(reqUrl)
      if (urls.length === 1) {
        return new Response(null, { status: 302, headers: { location: "/user.php?u=12345" } })
      }
      return new Response(PROFILE_PAGE, { status: 200 })
    })

    const stats = await new IptorrentsAdapter().fetchStats(
      "https://iptorrents.com",
      JSON.stringify({ cookies: "uid=123; pass=abc", userAgent: "Mozilla/5.0" }),
      "/",
      { remoteUserId: 12345 }
    )

    expect(urls).toEqual([
      "https://iptorrents.com/u/12345",
      "https://iptorrents.com/user.php?u=12345",
    ])
    expect(stats.group).toBe("Power User")
  })

  it("throws session expired when the profile link bounces to login", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "/auth/login" } })
    )

    await expect(
      new IptorrentsAdapter().fetchStats(
        "https://iptorrents.com",
        JSON.stringify({ cookies: "uid=123; pass=expired", userAgent: "Mozilla/5.0" }),
        "/",
        { remoteUserId: 12345 }
      )
    ).rejects.toThrow("Session expired")
  })
})

describe("IptorrentsAdapter.fetchRaw", () => {
  const adapter = new IptorrentsAdapter()
  const validToken = JSON.stringify({ cookies: "uid=123; pass=abc123", userAgent: "Mozilla/5.0" })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the id lookup and the parsed profile page as successful calls", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(page(FULL_PAGE))
      .mockResolvedValueOnce(page(PROFILE_PAGE))

    const calls = await adapter.fetchRaw("https://iptorrents.com", validToken, "")

    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      label: "Home Page (user id lookup)",
      data: { userId: 12345 },
      error: null,
    })
    expect(calls[1]).toMatchObject({
      label: "Profile Page",
      endpoint: "/u/12345",
      data: { group: "Power User" },
      error: null,
    })
  })

  it("records a failed profile page next to the id lookup", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(page(FULL_PAGE))
      .mockRejectedValueOnce(new Error("network down"))

    const calls = await adapter.fetchRaw("https://iptorrents.com", validToken, "")

    expect(calls[0].error).toBeNull()
    expect(calls[1].data).toBeNull()
    expect(calls[1].error).toBe("Failed to connect to iptorrents.com: Error")
  })

  it("records an unreadable homepage and the profile call it skipped", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      page("<html><body>nothing recognisable</body></html>")
    )

    const calls = await adapter.fetchRaw("https://iptorrents.com", validToken, "")

    expect(calls).toHaveLength(2)
    expect(calls[0].data).toBeNull()
    expect(calls[0].error).toBe(
      "Unexpected response from iptorrents.com: Could not find stats bar on IPTorrents page. The page may not be authenticated"
    )
    expect(calls[1]).toEqual({
      label: "Profile Page",
      endpoint: "/u/{id}",
      data: null,
      error: "Skipped: Home Page failed and no user id is cached",
    })
  })

  it("shows a stale cached id's skipped class as the profile call's error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(page(PROFILE_PAGE))

    const calls = await adapter.fetchRaw("https://iptorrents.com", validToken, "", {
      remoteUserId: 999,
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].data).toMatchObject({ group: null, remoteUserId: 12345 })
    expect(calls[0].error).toMatch(/did not match the signed-in member/)
  })

  it("names a missing profile link as the reason the badge was skipped", async () => {
    // With a cached id the poll still succeeds on the stats bar, so this entry
    // is where a link that changed shape shows up.
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      page(PROFILE_PAGE.replace(' href="/u/12345"', ""))
    )

    const calls = await adapter.fetchRaw("https://iptorrents.com", validToken, "", {
      remoteUserId: 12345,
    })

    expect(calls[0].data).toMatchObject({ group: null })
    expect(calls[0].error).toBe(
      "Unexpected response from iptorrents.com: Could not find the profile link in the IPTorrents stats bar, so the badge and dates were skipped"
    )
  })
})
