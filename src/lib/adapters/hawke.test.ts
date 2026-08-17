// src/lib/adapters/hawke.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { HawkeAdapter } from "./hawke"
import type { HawkePlatformMeta } from "./types"

// The exact body returned by GET https://hawke.uno/api/profile with a live
// Bearer key, values included. Every expectation below is derived from this
// fixture rather than from what a UNIT3D response would have looked like.
const LIVE_RESPONSE = {
  success: true,
  data: {
    username: "CrispyBacon",
    group: "Dothraki",
    member_since: "2024-12-02T00:09:58+00:00",
    uploaded: 6117633757897,
    downloaded: 8744919810357,
    ratio: 0.7,
    buffer: -2627286052460,
    hunos: 5262138.81,
    active_seeds: 1436,
    active_leeches: 0,
    hit_and_runs: 4,
    seed_divisions: {
      vanguard: 18,
      squire: 467,
      knight: 670,
      champion: 279,
      legend: 0,
      guardian: 117,
    },
    warnings: 0,
    can_upload: true,
    can_download: true,
    can_request: true,
    can_invite: false,
  },
  message: "Profile retrieved successfully.",
}

const okResponse = (body: unknown) =>
  ({ ok: true, json: async () => body }) as Response

describe("HawkeAdapter", () => {
  const adapter = new HawkeAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("maps the live /api/profile response into TrackerStats", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const stats = await adapter.fetchStats("https://hawke.uno", "fake-token", "/api/profile")

    expect(stats.username).toBe("CrispyBacon")
    expect(stats.group).toBe("Dothraki")
    expect(stats.uploadedBytes).toBe(6117633757897n)
    expect(stats.downloadedBytes).toBe(8744919810357n)
    expect(stats.ratio).toBe(0.7)
    expect(stats.seedingCount).toBe(1436)
    expect(stats.leechingCount).toBe(0)
    expect(stats.seedbonus).toBe(5262138.81)
    expect(stats.hitAndRuns).toBe(4)
    expect(stats.joinedDate).toBe("2024-12-02T00:09:58+00:00")
  })

  it("preserves a negative buffer instead of clamping it to zero", async () => {
    // computeBufferBytes and floatBytesToBigInt both floor at 0, which would
    // turn this deficit account's -2.6 TB buffer into a confident 0 B. The
    // adapter must not route the signed buffer through either.
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const stats = await adapter.fetchStats("https://hawke.uno", "fake-token", "/api/profile")

    expect(stats.bufferBytes).toBe(-2627286052460n)
  })

  it("reports the tracker's own ratio rather than deriving it from byte totals", async () => {
    // Derivation would give 0.6996…; Hawke reports a rounded 0.7. The fixture
    // discriminates between the two, so this pins which source is used.
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const stats = await adapter.fetchStats("https://hawke.uno", "fake-token", "/api/profile")

    expect(stats.ratio).toBe(0.7)
    expect(stats.ratio).not.toBeCloseTo(
      Number(LIVE_RESPONSE.data.uploaded) / Number(LIVE_RESPONSE.data.downloaded),
      4
    )
  })

  it("leaves fields Hawke does not report as null", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const stats = await adapter.fetchStats("https://hawke.uno", "fake-token", "/api/profile")

    expect(stats.requiredRatio).toBeNull()
    expect(stats.freeleechTokens).toBeNull()
    // `warnings` is a count, so the boolean stays unknown.
    expect(stats.warned).toBeNull()
    // There is no avatar field in the response — nothing should be invented.
    expect(stats.avatarUrl).toBeUndefined()
  })

  it("populates platformMeta with the Hawke-specific fields", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const stats = await adapter.fetchStats("https://hawke.uno", "fake-token", "/api/profile")
    const meta = stats.platformMeta as HawkePlatformMeta

    expect(meta.seedDivisions).toEqual({
      vanguard: 18,
      squire: 467,
      knight: 670,
      champion: 279,
      legend: 0,
      guardian: 117,
    })
    expect(meta.warnings).toBe(0)
    expect(meta.canUpload).toBe(true)
    expect(meta.canDownload).toBe(true)
    expect(meta.canRequest).toBe(true)
    expect(meta.canInvite).toBe(false)
  })

  it("keeps an unknown seeding division instead of dropping it", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({
        ...LIVE_RESPONSE,
        data: {
          ...LIVE_RESPONSE.data,
          seed_divisions: { ...LIVE_RESPONSE.data.seed_divisions, warlord: 3 },
        },
      })
    )

    const stats = await adapter.fetchStats("https://hawke.uno", "fake-token", "/api/profile")
    const meta = stats.platformMeta as HawkePlatformMeta

    expect(meta.seedDivisions?.warlord).toBe(3)
  })
})

describe("HawkeAdapter - envelope handling", () => {
  const adapter = new HawkeAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("surfaces the envelope message when success is false", async () => {
    // Hawke answers a rejected-but-well-formed request with HTTP 200, so the
    // envelope is the only signal that the poll failed.
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({ success: false, message: "Invalid API key." })
    )

    await expect(
      adapter.fetchStats("https://hawke.uno", "bad-token", "/api/profile")
    ).rejects.toThrow("Invalid API key.")
  })

  it("throws a hostname-scoped error when success is false with no message", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse({ success: false }))

    await expect(
      adapter.fetchStats("https://hawke.uno", "bad-token", "/api/profile")
    ).rejects.toThrow("hawke.uno")
  })

  it("throws when the envelope reports success but carries no data", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({ success: true, message: "Profile retrieved successfully." })
    )

    await expect(
      adapter.fetchStats("https://hawke.uno", "fake-token", "/api/profile")
    ).rejects.toThrow("no data")
  })

  it("throws on a non-ok HTTP response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response)

    await expect(
      adapter.fetchStats("https://hawke.uno", "fake-token", "/api/user")
    ).rejects.toThrow("404")
  })
})

describe("HawkeAdapter - auth and security", () => {
  const adapter = new HawkeAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("authenticates with a Bearer header and keeps the token out of the URL", async () => {
    let capturedUrl: string | undefined
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((url, init) => {
      capturedUrl = String(url)
      capturedInit = init
      return Promise.resolve(okResponse(LIVE_RESPONSE))
    })

    await adapter.fetchStats("https://hawke.uno", "secret-token", "/api/profile")

    const headers = capturedInit?.headers as Record<string, string> | undefined
    expect(headers?.Authorization).toBe("Bearer secret-token")
    expect(capturedUrl).toBe("https://hawke.uno/api/profile")
    // Query strings leak into access logs and Referer headers.
    expect(capturedUrl).not.toContain("secret-token")
  })

  it("does not expose the API token in non-ok response errors", async () => {
    const secretToken = "super-secret-api-token-12345"

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    } as Response)

    await expect(
      adapter.fetchStats("https://hawke.uno", secretToken, "/api/profile")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(secretToken)
      return true
    })
  })

  it("does not expose the API token when fetch throws with a URL in the message", async () => {
    const secretToken = "super-secret-api-token-12345"
    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      new Error(
        `request to https://hawke.uno/api/profile?key=${secretToken} failed, reason: connect ECONNREFUSED`
      )
    )

    await expect(
      adapter.fetchStats("https://hawke.uno", secretToken, "/api/profile")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(secretToken)
      expect(err.message).toContain("hawke.uno")
      return true
    })
  })

  it("throws a timeout-specific message when AbortSignal fires", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      new DOMException("signal timed out", "TimeoutError")
    )

    await expect(
      adapter.fetchStats("https://hawke.uno", "token", "/api/profile")
    ).rejects.toThrow("Request to hawke.uno timed out")
  })
})

describe("HawkeAdapter - fetchRaw", () => {
  const adapter = new HawkeAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the raw envelope for the debug view", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const calls = await adapter.fetchRaw("https://hawke.uno", "token", "/api/profile")

    expect(calls).toHaveLength(1)
    expect(calls[0].endpoint).toBe("/api/profile")
    expect(calls[0].error).toBeNull()
    expect(calls[0].data).toEqual(LIVE_RESPONSE)
  })

  it("reports the error instead of throwing when the request fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    const calls = await adapter.fetchRaw("https://hawke.uno", "token", "/api/profile")

    expect(calls[0].data).toBeNull()
    expect(calls[0].error).toContain("401")
  })
})
