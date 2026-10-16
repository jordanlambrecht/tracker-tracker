// src/lib/tracker-platforms/__tests__/tr4ker.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Tr4kerAdapter } from "../adapters/tr4ker"

// Invented fixture in the shape returned by GET /api/me. Figures are
// anonymised; the account name and id are not real.
const LIVE_RESPONSE = {
  id: 123456,
  username: "example-user",
  role: "user",
  power: 0,
  uploaded: 1234567890123,
  downloaded: 234567890123,
  bonus_upload: 10737418240,
  bonus_download: 1073741824,
  money: 4242,
  avatar_url: null,
  joined_at: "2026-08-08T14:37:30.007777Z",
  last_seen_at: "2026-10-09T18:54:38.432277Z",
}

const okResponse = (body: unknown) =>
  ({ ok: true, json: async () => body }) as Response

describe("Tr4kerAdapter", () => {
  const adapter = new Tr4kerAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("maps the /api/me response into TrackerStats", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const stats = await adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")

    expect(stats.username).toBe("example-user")
    expect(stats.group).toBe("User")
    expect(stats.uploadedBytes).toBe(1234567890123n)
    expect(stats.downloadedBytes).toBe(234567890123n)
    expect(stats.ratio).toBeCloseTo(1234567890123 / 234567890123, 4)
    expect(stats.bufferBytes).toBe(1234567890123n - 234567890123n)
    expect(stats.seedbonus).toBe(4242)
    expect(stats.remoteUserId).toBe(123456)
    expect(stats.joinedDate).toBe("2026-08-08T14:37:30.007777Z")
    expect(stats.lastAccessDate).toBe("2026-10-09T18:54:38.432277Z")
    expect(stats.avatarUrl).toBeUndefined()
  })

  it("title-cases the role and falls back to User when missing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({ ...LIVE_RESPONSE, role: "vip" })
    )

    const stats = await adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")
    expect(stats.group).toBe("Vip")

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      okResponse({ ...LIVE_RESPONSE, role: undefined })
    )
    const fallback = await adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")
    expect(fallback.group).toBe("User")
  })

  it("rejects a missing byte total instead of reading it as zero", async () => {
    for (const field of ["uploaded", "downloaded"] as const) {
      const { [field]: _dropped, ...body } = LIVE_RESPONSE
      vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(body))

      await expect(
        adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")
      ).rejects.toThrow(`Unexpected response from tr4ker.net: missing ${field}`)
    }
  })

  it("leaves fields TR4KER does not report as null", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const stats = await adapter.fetchStats("https://tr4ker.net", "fake-token", "/api/me")

    expect(stats.seedingCount).toBeNull()
    expect(stats.leechingCount).toBeNull()
    expect(stats.hitAndRuns).toBeNull()
    expect(stats.requiredRatio).toBeNull()
    expect(stats.warned).toBeNull()
    expect(stats.freeleechTokens).toBeNull()
  })

  it("sends the API key in the X-Api-Key header and not in the URL", async () => {
    let capturedUrl: string | undefined
    let capturedInit: RequestInit | undefined
    vi.spyOn(global, "fetch").mockImplementationOnce((url, init) => {
      capturedUrl = String(url)
      capturedInit = init
      return Promise.resolve(okResponse(LIVE_RESPONSE))
    })

    await adapter.fetchStats("https://tr4ker.net", "secret-token", "/api/me")

    const headers = capturedInit?.headers as Record<string, string> | undefined
    expect(headers?.["X-Api-Key"]).toBe("secret-token")
    expect(capturedUrl).toBe("https://tr4ker.net/api/me")
    expect(capturedUrl).not.toContain("secret-token")
    expect(capturedUrl).not.toContain("apikey")
  })

  it("does not expose the API token in non-ok response errors", async () => {
    const secretToken = "super-secret-api-token-12345"

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    await expect(
      adapter.fetchStats("https://tr4ker.net", secretToken, "/api/me")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(secretToken)
      return true
    })
  })

  it("throws on a non-ok HTTP response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    await expect(
      adapter.fetchStats("https://tr4ker.net", "bad-token", "/api/me")
    ).rejects.toThrow("401")
  })
})

describe("Tr4kerAdapter - fetchRaw", () => {
  const adapter = new Tr4kerAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the raw response for the debug view", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okResponse(LIVE_RESPONSE))

    const calls = await adapter.fetchRaw("https://tr4ker.net", "token", "/api/me")

    expect(calls).toHaveLength(1)
    expect(calls[0].label).toBe("User Stats")
    expect(calls[0].endpoint).toBe("/api/me")
    expect(calls[0].error).toBeNull()
    expect(calls[0].data).toEqual(LIVE_RESPONSE)
  })

  it("reports an error DebugApiCall instead of throwing when fetch rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("fetch failed"))

    const calls = await adapter.fetchRaw("https://tr4ker.net", "token", "/api/me")

    expect(calls[0].data).toBeNull()
    expect(calls[0].error).toBeTruthy()
    expect(calls[0].endpoint).toBe("/api/me")
  })
})
