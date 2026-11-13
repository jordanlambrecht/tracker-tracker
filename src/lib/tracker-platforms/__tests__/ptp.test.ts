// src/lib/tracker-platforms/__tests__/ptp.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { PtpAdapter, parsePtpCredentials, parsePtpIndex } from "../adapters/ptp"
import { tryParseSiteBytes } from "../helpers/html-parse"

// The user-info bar from the passthepopcorn.me site header, captured from a
// logged-in browser on 2026-11-13, the same markup an ApiUser/ApiKey request
// to index.php?json=0 returns. Username, id and figures are invented and
// link query strings are removed.
const INDEX_HTML = `<html><body>
<ul class="user-info-bar__list">
  <li id="nav_userinfo" class="user-info-bar__item"><a class="user-info-bar__link" href="user.php?id=12345">alice</a></li>
  <li id="nav_bonus" class="user-info-bar__item user-info-bar__link--important"><a class="user-info-bar__link" href="bonus.php" title="Bp/h: 0">Bonus (1,234,567)</a></li>
</ul>
<ul id="userinfo_stats" class="user-info-bar__list">
  <li id="stats_seeding" class="user-info-bar__item"><a class="user-info-bar__link" href="torrents.php" title="10.5000 TiB">Up</a>: <span class="user-info-bar__text">10.500 TiB</span></li>
  <li id="stats_leeching" class="user-info-bar__item"><a class="user-info-bar__link" href="torrents.php" title="4.2500 TiB">Down</a>: <span class="user-info-bar__text">4.250 TiB</span></li>
  <li id="stats_ratio" class="user-info-bar__item"><a class="user-info-bar__link" href="rules.php" title="Ratio: 2.4706 Buffer: 12.1000 TiB">Ratio</a>: <span class="user-info-bar__text"><span class="ratio-10">2.47</span></span></li>
  <li id="stats_hnrs" class="user-info-bar__item"><a class="user-info-bar__link" href="snatchlist.php">HnRs</a>: <span class="user-info-bar__text ">3</span></li>
  <li id="stats_hnrs" class="user-info-bar__item"><a title="Unregistered Torrents" class="user-info-bar__link" href="userhistory.php">UR</a>: <span class="user-info-bar__text ">7</span></li>
</ul>
</body></html>`

const HOST = "passthepopcorn.me"
const BASE = `https://${HOST}`
const PATH = "/index.php"
const creds = (token = "key123", username = "user123") => JSON.stringify({ token, username })
const htmlResponse = (body: string, status = 200) => new Response(body, { status })

describe("parsePtpIndex", () => {
  it("reads the user-info bar", () => {
    const stats = parsePtpIndex(INDEX_HTML, HOST)
    expect(stats.username).toBe("alice")
    expect(stats.remoteUserId).toBe(12345)
    expect(stats.uploadedBytes).toBe(tryParseSiteBytes("10.5000 TiB"))
    expect(stats.downloadedBytes).toBe(tryParseSiteBytes("4.2500 TiB"))
    expect(stats.ratio).toBeCloseTo(2.4706, 3)
    expect(stats.bufferBytes).toBe(tryParseSiteBytes("12.1000 TiB"))
    expect(stats.seedbonus).toBe(1234567)
    expect(stats.hitAndRuns).toBe(3)
  })

  it("leaves what the bar does not show as null", () => {
    const stats = parsePtpIndex(INDEX_HTML, HOST)
    expect(stats.group).toBeNull()
    expect(stats.seedingCount).toBeNull()
    expect(stats.leechingCount).toBeNull()
    expect(stats.requiredRatio).toBeNull()
    expect(stats.warned).toBeNull()
    expect(stats.freeleechTokens).toBeNull()
  })

  it("reads a negative buffer", () => {
    const html = INDEX_HTML.replace("Buffer: 12.1000 TiB", "Buffer: -1.5000 TiB")
    expect(parsePtpIndex(html, HOST).bufferBytes).toBe(-(tryParseSiteBytes("1.5000 TiB") ?? 0n))
  })

  it("falls back to upload minus download when the buffer is absent", () => {
    const html = INDEX_HTML.replace(" Buffer: 12.1000 TiB", "")
    const stats = parsePtpIndex(html, HOST)
    expect(stats.bufferBytes).toBe(stats.uploadedBytes - stats.downloadedBytes)
  })

  it("leaves bonus and HnRs null when their items are missing", () => {
    const html = INDEX_HTML.replace(/<li id="nav_bonus"[\s\S]*?<\/li>/, "").replace(
      /<li id="stats_hnrs"[^\n]*HnRs[^\n]*<\/li>/,
      ""
    )
    const stats = parsePtpIndex(html, HOST)
    expect(stats.seedbonus).toBeNull()
    expect(stats.hitAndRuns).toBeNull()
  })

  it("fails a page with no stats bar", () => {
    expect(() => parsePtpIndex("<html><body>{}</body></html>", HOST)).toThrow(
      `Unexpected response from ${HOST}: no user stats bar`
    )
  })

  it("fails a page with one unreadable byte total", () => {
    const html = INDEX_HTML.replace('title="4.2500 TiB"', 'title="?"')
    expect(() => parsePtpIndex(html, HOST)).toThrow("unreadable downloaded byte total")
  })
})

describe("parsePtpCredentials", () => {
  it("maps username to ApiUser and token to ApiKey", () => {
    expect(parsePtpCredentials(creds(" key ", " user "))).toEqual({
      apiUser: "user",
      apiKey: "key",
    })
  })

  it("rejects a header-breaking ApiUser", () => {
    expect(() => parsePtpCredentials(creds("key", "user\r\nX: 1"))).toThrow()
  })
})

describe("PtpAdapter.fetchStats", () => {
  const adapter = new PtpAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("sends ApiUser and ApiKey and asks for HTML with json=0", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(htmlResponse(INDEX_HTML))
    const stats = await adapter.fetchStats(BASE, creds(), PATH)
    expect(stats.username).toBe("alice")
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe(`${BASE}/index.php?json=0`)
    const headers = init?.headers as Record<string, string>
    expect(headers.ApiUser).toBe("user123")
    expect(headers.ApiKey).toBe("key123")
    expect(headers.Accept).toBe("text/html")
  })

  it("reads a 400 as bad credentials", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      htmlResponse("Malformed Api Credentials", 400)
    )
    const err = await adapter.fetchStats(BASE, creds(), PATH).catch((e: Error) => e)
    expect(err).toBeInstanceOf(Error)
    expect(sanitizeNetworkError((err as Error).message)).toBe("Invalid credentials")
  })

  it("reads a 401 as an authentication failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      htmlResponse("Your API privileges are disabled", 401)
    )
    await expect(adapter.fetchStats(BASE, creds(), PATH)).rejects.toThrow("Tracker API error: 401")
  })

  it("names the host on a timeout", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      new DOMException("signal timed out", "TimeoutError")
    )
    await expect(adapter.fetchStats(BASE, creds(), PATH)).rejects.toThrow(
      `Request to ${HOST} timed out`
    )
  })
})

describe("PtpAdapter.fetchRaw", () => {
  const adapter = new PtpAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the parsed index page", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(htmlResponse(INDEX_HTML))
    const [call] = await adapter.fetchRaw(BASE, creds(), PATH)
    expect(call.endpoint).toBe("/index.php?json=0")
    expect(call.error).toBeNull()
    expect((call.data as { username: string }).username).toBe("alice")
  })

  it("reports a page fetchStats would fail", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(htmlResponse("<html></html>"))
    const [call] = await adapter.fetchRaw(BASE, creds(), PATH)
    expect(call.data).toBeNull()
    expect(call.error).toContain("no user stats bar")
  })

  it("throws a malformed credential to the caller", async () => {
    await expect(adapter.fetchRaw(BASE, "not json", PATH)).rejects.toThrow()
  })
})
