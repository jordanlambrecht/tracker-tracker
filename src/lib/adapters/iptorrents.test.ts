// src/lib/adapters/iptorrents.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import { IptorrentsAdapter, parseIptCredentials, parseIptProfile } from "./iptorrents"

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

describe("parseIptProfile", () => {
  it("extracts stats from the header stats bar", () => {
    const stats = parseIptProfile(FULL_PAGE)
    expect(stats.username).toBe("testuser")
    expect(stats.ratio).toBeCloseTo(0.74)
    expect(stats.uploadedBytes).toBe(14_500_000_000n)
    expect(stats.downloadedBytes).toBe(19_600_000_000n)
    expect(stats.seedingCount).toBe(10)
    expect(stats.leechingCount).toBe(2)
    expect(stats.seedbonus).toBeCloseTo(55.4)
  })

  it("computes bufferBytes as upload minus download", () => {
    const stats = parseIptProfile(FULL_PAGE)
    // This fixture is a deficit account (14.5 GB up, 19.6 GB down) — the
    // shortfall is the point of the chart, so it is not clamped to 0n.
    expect(stats.bufferBytes).toBe(-5_100_000_000n)
  })

  it("defaults group to 'User' with no VIP badge", () => {
    const stats = parseIptProfile(FULL_PAGE)
    expect(stats.group).toBe("User")
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
    const stats = parseIptProfile(vipPage)
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
    const stats = parseIptProfile(upStatPage)
    expect(stats.uploadedBytes).toBe(2_000_000_000n)
    expect(stats.downloadedBytes).toBe(1_000_000_000n)
    // The Ratio card deliberately contradicts the byte totals: 2 GB over 1 GB
    // is 2, so reading 0.5 here would mean the site's own field won.
    expect(stats.ratio).toBe(2)
    expect(stats.seedbonus).toBe(10.5)
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
    const stats = parseIptProfile(noDownloadsPage)
    expect(stats.uploadedBytes).toBe(5_000_000_000n)
    expect(stats.downloadedBytes).toBe(0n)
    expect(stats.ratio).toBe(Infinity)
  })

  it("throws when the stats bar is missing (unauthenticated page)", () => {
    const noStats = `<!doctype html><html><head></head><body><p>No stats here.</p></body></html>`
    expect(() => parseIptProfile(noStats)).toThrow("stats bar")
  })

  it("detects a session-expired login redirect and throws", () => {
    const loginRedirect = `<!doctype html><html><head><meta http-equiv="refresh" content="0;url='/auth/login'" /></head></html>`
    expect(() => parseIptProfile(loginRedirect)).toThrow("Session expired")
  })

  it("detects a Cloudflare challenge and throws", () => {
    const cfChallenge = `<!doctype html><html><head><title>Just a moment...</title></head><body></body></html>`
    expect(() => parseIptProfile(cfChallenge)).toThrow("Cloudflare")
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

describe("IptorrentsAdapter.fetchStats — network error classification", () => {
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

  it("fetches the homepage with cookie and user-agent headers", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => FULL_PAGE,
    } as Response)

    await adapter.fetchStats("https://iptorrents.com", validToken, "")

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [calledUrl, init] = fetchSpy.mock.calls[0]
    expect(calledUrl).toBe("https://iptorrents.com/")
    const headers = init?.headers as Record<string, string>
    expect(headers.Cookie).toBe("uid=123; pass=abc123")
    expect(headers["User-Agent"]).toBe("Mozilla/5.0")
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
      const reqUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url

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

      return new Response(null, { status: 404 })
    })

    const adapter = new IptorrentsAdapter()
    const stats = await adapter.fetchStats("https://iptorrents.com", creds, "/")
    expect(stats.username).toBe("testuser")
    expect(callCount).toBe(2)
  })
})
