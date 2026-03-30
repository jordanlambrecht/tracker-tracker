// src/lib/adapters/gazelle.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GazelleAdapter } from "./gazelle"

// Minimal valid Gazelle index response
function mockGazelleResponse(overrides?: Record<string, unknown>) {
  return {
    status: "success",
    response: {
      username: "JohnDoe",
      id: 12345,
      authkey: "abc123",
      passkey: "def456",
      userstats: {
        uploaded: 536870912000,
        downloaded: 134217728000,
        ratio: 4.0,
        requiredratio: 0.6,
        class: "Power User",
        bonusPoints: 12500,
        freeleechTokens: 3,
        ...overrides,
      },
    },
  }
}

describe("GazelleAdapter", () => {
  const adapter = new GazelleAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("parses a valid Gazelle API response into TrackerStats", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockGazelleResponse(),
    } as Response)

    const stats = await adapter.fetchStats("https://redacted.sh", "fake-token", "/ajax.php")

    expect(stats.username).toBe("JohnDoe")
    expect(stats.group).toBe("Power User")
    expect(stats.uploadedBytes).toBe(BigInt(536870912000))
    expect(stats.downloadedBytes).toBe(BigInt(134217728000))
    expect(stats.ratio).toBeCloseTo(4.0)
    expect(stats.bufferBytes).toBe(BigInt(536870912000) - BigInt(134217728000))
    expect(stats.seedbonus).toBe(12500)
    expect(stats.seedingCount).toBe(0)
    expect(stats.leechingCount).toBe(0)
    expect(stats.hitAndRuns).toBeNull()
    expect(stats.requiredRatio).toBeCloseTo(0.6)
    expect(stats.freeleechTokens).toBe(3)
    expect(stats.warned).toBeNull()
  })

  it("handles numeric seeding/leeching when present", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockGazelleResponse({ seedingcount: 42, leechingcount: 3 }),
    } as Response)

    const stats = await adapter.fetchStats("https://redacted.sh", "token", "/ajax.php")

    expect(stats.seedingCount).toBe(42)
    expect(stats.leechingCount).toBe(3)
  })

  it("handles lowercase bonuspoints field name", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockGazelleResponse({ bonusPoints: undefined, bonuspoints: 9999 }),
    } as Response)

    const stats = await adapter.fetchStats("https://orpheus.network", "token", "/ajax.php")

    expect(stats.seedbonus).toBe(9999)
  })

  it("returns null for freeleechTokens when not present", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockGazelleResponse({ freeleechTokens: undefined }),
    } as Response)

    const stats = await adapter.fetchStats("https://gazellegames.net", "token", "/ajax.php")

    expect(stats.freeleechTokens).toBeNull()
  })

  it("returns null for requiredRatio when not present", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockGazelleResponse({ requiredratio: undefined }),
    } as Response)

    const stats = await adapter.fetchStats("https://gazellegames.net", "token", "/ajax.php")

    expect(stats.requiredRatio).toBeNull()
  })

  it("throws on non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    await expect(
      adapter.fetchStats("https://redacted.sh", "bad-token", "/ajax.php")
    ).rejects.toThrow("401")
  })

  it("throws on API-level failure status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "failure", error: "Invalid API key" }),
    } as Response)

    await expect(
      adapter.fetchStats("https://redacted.sh", "bad-token", "/ajax.php")
    ).rejects.toThrow("Invalid API key")
  })

  it("throws a sanitized error on network failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("fetch failed"))

    await expect(adapter.fetchStats("https://redacted.sh", "token", "/ajax.php")).rejects.toThrow(
      "Failed to connect to redacted.sh"
    )
  })

  it("constructs URL with action=index query param", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockGazelleResponse(),
    } as Response)

    await adapter.fetchStats("https://redacted.sh", "my-secret-token", "/ajax.php")

    const calledUrl = fetchSpy.mock.calls[0][0] as string
    expect(calledUrl).toContain("https://redacted.sh/ajax.php")
    expect(calledUrl).toContain("action=index")
    expect(calledUrl).not.toContain("my-secret-token")
  })

  it("sends Authorization header with token", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockGazelleResponse(),
    } as Response)

    await adapter.fetchStats("https://redacted.sh", "my-secret-token", "/ajax.php")

    const fetchOptions = fetchSpy.mock.calls[0][1] as RequestInit
    expect(fetchOptions.headers).toBeDefined()
    const headers = fetchOptions.headers as Record<string, string>
    expect(headers.Authorization).toBe("token my-secret-token")
  })

  it("sends raw Authorization header when authStyle is 'raw'", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockGazelleResponse(),
    } as Response)

    await adapter.fetchStats("https://redacted.sh", "my-secret-token", "/ajax.php", {
      authStyle: "raw",
    })

    const fetchOptions = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = fetchOptions.headers as Record<string, string>
    expect(headers.Authorization).toBe("my-secret-token")
  })

  it("captures giftTokens as freeleechTokens when userstats.freeleechTokens is absent", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "success",
        response: {
          username: "JohnDoe",
          id: 64605,
          giftTokens: 7,
          meritTokens: 3,
          userstats: {
            uploaded: 100000,
            downloaded: 50000,
            ratio: 2.0,
            class: "User",
          },
        },
      }),
    } as Response)

    const stats = await adapter.fetchStats("https://redacted.sh", "token", "/ajax.php")

    expect(stats.freeleechTokens).toBe(7)
    expect(stats.remoteUserId).toBe(64605)
  })

  it("enriches stats with user profile when enrich option is set", async () => {
    // First call: index response
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "success",
          response: {
            username: "JohnDoe",
            id: 64605,
            giftTokens: 7,
            meritTokens: 3,
            notifications: { messages: 1, notifications: 0, newAnnouncement: false, newBlog: true },
            userstats: {
              uploaded: 100000000000,
              downloaded: 50000000000,
              ratio: 2.0,
              requiredratio: 0.6,
              class: "Power User",
            },
          },
        }),
      } as Response)
      // Second call: user profile response
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "success",
          response: {
            username: "JohnDoe",
            avatar: "https://example.com/avatar.png",
            stats: {
              joinedDate: "2020-01-15 10:30:00",
              lastAccess: "2026-03-10 12:00:00",
              uploaded: 100000000000,
              downloaded: 50000000000,
              ratio: 2.0,
              requiredRatio: 0.6,
            },
            ranks: {
              uploaded: 85,
              downloaded: 70,
              uploads: 45,
              requests: 30,
              bounty: 60,
              posts: 90,
              artists: 15,
              overall: 72,
            },
            personal: {
              class: "Power User",
              paranoia: 0,
              paranoiaText: "Off",
              donor: true,
              warned: false,
              enabled: true,
            },
            community: {
              posts: 150,
              torrentComments: 25,
              collagesStarted: 2,
              collagesContrib: 10,
              requestsFilled: 5,
              requestsVoted: 30,
              perfectFlacs: 12,
              uploaded: 45,
              groups: 30,
              seeding: 250,
              leeching: 2,
              snatched: 500,
              invited: 3,
            },
          },
        }),
      } as Response)

    const stats = await adapter.fetchStats("https://redacted.sh", "token", "/ajax.php", {
      authStyle: "raw",
      enrich: true,
    })

    // Core stats from index
    expect(stats.username).toBe("JohnDoe")
    expect(stats.group).toBe("Power User")
    expect(stats.freeleechTokens).toBe(7)

    // Enriched from user profile
    expect(stats.warned).toBe(false)
    expect(stats.joinedDate).toBe("2020-01-15 10:30:00")
    expect(stats.seedingCount).toBe(250)
    expect(stats.leechingCount).toBe(2)

    // Platform meta
    expect(stats.platformMeta).toBeDefined()
    const meta = stats.platformMeta as import("./types").GazellePlatformMeta
    expect(meta.donor).toBe(true)
    expect(meta.ranks?.uploaded).toBe(85)
    expect(meta.ranks?.overall).toBe(72)
    expect(meta.community?.perfectFlacs).toBe(12)
    expect(meta.community?.snatched).toBe(500)
    expect(meta.notifications?.messages).toBe(1)
    expect(meta.giftTokens).toBe(7)
    expect(meta.meritTokens).toBe(3)
  })

  it("continues with core stats when enrichment fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "success",
          response: {
            username: "JohnDoe",
            id: 64605,
            userstats: {
              uploaded: 100000,
              downloaded: 50000,
              ratio: 2.0,
              class: "User",
            },
          },
        }),
      } as Response)
      // Enrichment call fails
      .mockRejectedValueOnce(new Error("network error"))

    const stats = await adapter.fetchStats("https://redacted.sh", "token", "/ajax.php", {
      enrich: true,
    })

    // Should still have core stats
    expect(stats.username).toBe("JohnDoe")
    expect(stats.warned).toBeNull() // Default when enrichment fails — null means "unknown"
  })

  it("handles zero buffer when downloaded exceeds uploaded", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockGazelleResponse({ uploaded: 100, downloaded: 500 }),
    } as Response)

    const stats = await adapter.fetchStats("https://redacted.sh", "token", "/ajax.php")

    expect(stats.bufferBytes).toBe(BigInt(0))
  })
})

describe("GazelleAdapter - security", () => {
  const adapter = new GazelleAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("does not expose the API token in error messages", async () => {
    const secretToken = "super-secret-api-token-12345"

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    } as Response)

    await expect(
      adapter.fetchStats("https://example.com", secretToken, "/ajax.php")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(secretToken)
      return true
    })
  })

  it("does not expose the API token on network failure", async () => {
    const secretToken = "super-secret-api-token-12345"

    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      new Error("request to https://example.com/ajax.php failed")
    )

    await expect(
      adapter.fetchStats("https://example.com", secretToken, "/ajax.php")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(secretToken)
      expect(err.message).toContain("example.com")
      return true
    })
  })

  it("throws a timeout-specific message when AbortSignal fires", async () => {
    const timeoutError = new DOMException("signal timed out", "TimeoutError")
    vi.spyOn(global, "fetch").mockRejectedValueOnce(timeoutError)

    await expect(adapter.fetchStats("https://example.com", "token", "/ajax.php")).rejects.toThrow(
      "Request to example.com timed out"
    )
  })

})
