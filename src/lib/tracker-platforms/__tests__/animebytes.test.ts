// src/lib/tracker-platforms/__tests__/animebytes.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AnimeBytesAdapter, parseAnimeBytesCredentials } from "../adapters/animebytes"
import type { AnimeBytesPlatformMeta } from "../contract"

// Invented fixture in the shape of GET /api/stats/personal. No live response
// has been captured, so the shape is unverified.
const RESPONSE = {
  success: true,
  api: { version: "1", git: "0.0.0" },
  freeleech: 0,
  yen: { per_day: 4800, per_hour: 200, current: 123456 },
  hnrs: { potential: 2, active: 1 },
  upload: { raw: 900_000_000_000, account: 1_000_000_000_000 },
  download: { raw: 450_000_000_000, account: 400_000_000_000 },
  torrents: { uploaded: 3, pruned: 1 },
  tracker: {
    seeding: 51,
    leeching: 0,
    snatched: 120,
    seed_size: 2_500_000_000_000,
    avg_seed_time: 1_209_600,
  },
  class: "Power User",
}

const okResponse = (body: unknown) => ({ ok: true, json: async () => body }) as Response
const BASE = "https://animebytes.tv"
const PATH = "/api/stats/personal"
const creds = (token: string, username = "someone") => JSON.stringify({ token, username })

describe("AnimeBytesAdapter", () => {
  const adapter = new AnimeBytesAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("maps /api/stats/personal into TrackerStats", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(RESPONSE))

    const stats = await adapter.fetchStats(BASE, creds("fake-token"), PATH)

    expect(stats.group).toBe("Power User")
    expect(stats.uploadedBytes).toBe(1_000_000_000_000n)
    expect(stats.downloadedBytes).toBe(400_000_000_000n)
    expect(stats.seedingCount).toBe(51)
    expect(stats.leechingCount).toBe(0)
    expect(stats.seedbonus).toBe(123456)
    expect(stats.hitAndRuns).toBe(1)
  })

  it("uses the account totals, not the raw ones, for ratio and buffer", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(RESPONSE))

    const stats = await adapter.fetchStats(BASE, creds("fake-token"), PATH)

    expect(stats.ratio).toBe(2.5)
    expect(stats.bufferBytes).toBe(600_000_000_000n)
  })

  it("takes the username from the credentials, since the API has none", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(RESPONSE))

    const stats = await adapter.fetchStats(BASE, creds("fake-token", " someone "), PATH)

    expect(stats.username).toBe("someone")
  })

  it("leaves fields AnimeBytes does not report null", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(RESPONSE))

    const stats = await adapter.fetchStats(BASE, creds("fake-token"), PATH)

    expect(stats.requiredRatio).toBeNull()
    expect(stats.warned).toBeNull()
    expect(stats.freeleechTokens).toBeNull()
  })

  it("keeps the AnimeBytes-specific fields in platformMeta", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(RESPONSE))

    const stats = await adapter.fetchStats(BASE, creds("fake-token"), PATH)
    const meta = stats.platformMeta as AnimeBytesPlatformMeta

    expect(meta.potentialHnrs).toBe(2)
    expect(meta.yenPerHour).toBe(200)
    expect(meta.yenPerDay).toBe(4800)
    expect(meta.rawUploadedBytes).toBe(900_000_000_000)
    expect(meta.rawDownloadedBytes).toBe(450_000_000_000)
    expect(meta.snatched).toBe(120)
    expect(meta.seedSizeBytes).toBe(2_500_000_000_000)
    expect(meta.avgSeedTime).toBe(1_209_600)
    expect(meta.torrentsUploaded).toBe(3)
    expect(meta.torrentsPruned).toBe(1)
    expect(meta.freeleechUntil).toBeUndefined()
  })

  it("records when personal freeleech ends", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({ ...RESPONSE, freeleech: 1_790_000_000 })
    )

    const stats = await adapter.fetchStats(BASE, creds("fake-token"), PATH)

    expect((stats.platformMeta as AnimeBytesPlatformMeta).freeleechUntil).toBe(1_790_000_000)
  })

  it("reports null counts when the tracker section is missing", async () => {
    const { tracker: _tracker, hnrs: _hnrs, ...partial } = RESPONSE
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(partial))

    const stats = await adapter.fetchStats(BASE, creds("fake-token"), PATH)

    expect(stats.seedingCount).toBeNull()
    expect(stats.leechingCount).toBeNull()
    expect(stats.hitAndRuns).toBeNull()
  })

  it("requests /api/stats/personal whatever api_path the row stored", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(okResponse(RESPONSE))

    await adapter.fetchStats(BASE, creds("fake-token"), "/ajax.php")
    const calls = await adapter.fetchRaw(BASE, creds("fake-token"), "/ajax.php")

    expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual([
      "https://animebytes.tv/api/stats/personal",
      "https://animebytes.tv/api/stats/personal",
    ])
    expect(calls[0].endpoint).toBe("/api/stats/personal")
  })
})

describe("parseAnimeBytesCredentials", () => {
  it("reads the token and the username", () => {
    expect(parseAnimeBytesCredentials(creds("tok", "someone"))).toEqual({
      token: "tok",
      username: "someone",
    })
  })

  it("rejects a bare token or a blob missing the username", () => {
    expect(() => parseAnimeBytesCredentials("tok")).toThrow("AnimeBytes credentials")
    expect(() => parseAnimeBytesCredentials(JSON.stringify({ token: "tok" }))).toThrow(
      "AnimeBytes credentials"
    )
  })

  it("rejects a username over 100 characters or carrying a control character", () => {
    expect(() => parseAnimeBytesCredentials(creds("tok", "a".repeat(101)))).toThrow(
      new Error("Invalid username: it is longer than 100 characters.")
    )
    expect(() => parseAnimeBytesCredentials(creds("tok", "some\tone"))).toThrow(
      new Error("Invalid username: it contains a control character (U+0009) at position 4.")
    )
  })
})

describe("AnimeBytesAdapter - failures", () => {
  const adapter = new AnimeBytesAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("surfaces the error when success is false, behind the unexpected-response prefix", async () => {
    // Unprefixed, the sanitizer shows "Poll failed", or "Invalid credentials"
    // for any text containing "invalid" (standard 2.4).
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({ success: false, error: "The request requires valid user authentication." })
    )

    await expect(adapter.fetchStats(BASE, creds("bad-token"), PATH)).rejects.toThrow(
      new Error(
        "Unexpected response from animebytes.tv: The request requires valid user authentication."
      )
    )
  })

  it("gives a fixed reason, not a TypeError, when error is missing or not a string", async () => {
    for (const body of [{ success: false }, { success: false, error: { code: 401 } }]) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(body))

      await expect(adapter.fetchStats(BASE, creds("bad-token"), PATH)).rejects.toThrow(
        new Error("Unexpected response from animebytes.tv: success was false")
      )
    }
  })

  it("rejects a missing account total instead of reading it as zero", async () => {
    for (const field of ["upload", "download"] as const) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        okResponse({ ...RESPONSE, [field]: { raw: RESPONSE[field].raw } })
      )

      await expect(adapter.fetchStats(BASE, creds("fake-token"), PATH)).rejects.toThrow(
        new Error(`Unexpected response from animebytes.tv: missing ${field}.account`)
      )
    }
  })

  it("throws on a 401", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    await expect(adapter.fetchStats(BASE, creds("bad-token"), PATH)).rejects.toThrow("401")
  })
})

describe("AnimeBytesAdapter - auth", () => {
  const adapter = new AnimeBytesAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("authenticates with a Bearer header and keeps the key out of the URL", async () => {
    let capturedUrl: string | undefined
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((url, init) => {
      capturedUrl = String(url)
      capturedInit = init
      return Promise.resolve(okResponse(RESPONSE))
    })

    await adapter.fetchStats(BASE, creds("secret-token"), PATH)

    const headers = capturedInit?.headers as Record<string, string> | undefined
    expect(headers?.Authorization).toBe("Bearer secret-token")
    expect(capturedUrl).toBe("https://animebytes.tv/api/stats/personal")
    expect(capturedUrl).not.toContain("secret-token")
  })
})

describe("AnimeBytesAdapter - fetchRaw", () => {
  const adapter = new AnimeBytesAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the raw response for the debug view", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(RESPONSE))

    const calls = await adapter.fetchRaw(BASE, creds("token"), PATH)

    expect(calls).toHaveLength(1)
    expect(calls[0].data).toEqual(RESPONSE)
    expect(calls[0].error).toBeNull()
  })

  it("reports the error instead of throwing when the request fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    const calls = await adapter.fetchRaw(BASE, creds("token"), PATH)

    expect(calls[0].data).toBeNull()
    expect(calls[0].error).toContain("401")
  })

  it("flags a 200 that fetchStats would fail, with the poll's message (standard 2.6)", async () => {
    const body = { success: false, error: "The request requires valid user authentication." }
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(body))

    const calls = await adapter.fetchRaw(BASE, creds("token"), PATH)

    expect(calls[0].error).toBe(
      "Unexpected response from animebytes.tv: The request requires valid user authentication."
    )
    // The offending body stays in data for the debug view.
    expect(calls[0].data).toEqual(body)
  })
})
