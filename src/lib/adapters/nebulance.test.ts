// src/lib/adapters/nebulance.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NebulanceAdapter } from "./nebulance"

function mockNebulanceResponse(
  overrides?: Partial<{
    ID: number
    Username: string
    Uploaded: number
    Downloaded: number
    SeedCount: number
    HnR: number
    Invites: number
    Class: string
    SubClass: string | null
    JoinDate: string
    Grabbed: number
    Snatched: number
    ForumPosts: number
    LastAccess: string
  }>
) {
  return {
    status: "success",
    response: {
      ID: 9001,
      Username: "seedqueen",
      Uploaded: 1073741824000,
      Downloaded: 536870912000,
      SeedCount: 42,
      HnR: 0,
      Invites: 5,
      Class: "Power User",
      SubClass: null,
      JoinDate: "2021-06-15",
      Grabbed: 300,
      Snatched: 280,
      ForumPosts: 17,
      LastAccess: "2026-03-10",
      ...overrides,
    },
  }
}

describe("NebulanceAdapter", () => {
  const adapter = new NebulanceAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("parses a valid Nebulance API response into TrackerStats", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse(),
    } as Response)

    const stats = await adapter.fetchStats("https://nebulance.io", "fake-api-key", "/api.php")

    expect(stats.username).toBe("seedqueen")
    expect(stats.group).toBe("Power User")
    expect(stats.uploadedBytes).toBe(BigInt(1073741824000))
    expect(stats.downloadedBytes).toBe(BigInt(536870912000))
    expect(stats.ratio).toBeCloseTo(2.0)
    expect(stats.bufferBytes).toBe(BigInt(1073741824000) - BigInt(536870912000))
    expect(stats.seedingCount).toBe(42)
    expect(stats.leechingCount).toBe(0)
    expect(stats.seedbonus).toBeNull()
    expect(stats.hitAndRuns).toBe(0)
    expect(stats.requiredRatio).toBeNull()
    expect(stats.warned).toBeNull()
    expect(stats.freeleechTokens).toBeNull()
    expect(stats.remoteUserId).toBe(9001)
    expect(stats.joinedDate).toBe("2021-06-15")
  })

  it("populates platformMeta with Nebulance-specific fields", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse(),
    } as Response)

    const stats = await adapter.fetchStats("https://nebulance.io", "fake-api-key", "/api.php")

    expect(stats.platformMeta).toBeDefined()
    const meta = stats.platformMeta as {
      snatched: number
      grabbed: number
      forumPosts: number
      invites: number
    }
    expect(meta.snatched).toBe(280)
    expect(meta.grabbed).toBe(300)
    expect(meta.forumPosts).toBe(17)
    expect(meta.invites).toBe(5)
  })

  it("combines Class and SubClass with ' / ' separator when SubClass is present", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse({ Class: "Elite", SubClass: "VIP" }),
    } as Response)

    const stats = await adapter.fetchStats("https://nebulance.io", "fake-api-key", "/api.php")

    expect(stats.group).toBe("Elite / VIP")
  })

  it("uses just Class when SubClass is absent", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse({ Class: "Member" }),
    } as Response)

    const stats = await adapter.fetchStats("https://nebulance.io", "fake-api-key", "/api.php")

    expect(stats.group).toBe("Member")
  })

  it("calculates zero buffer when downloaded >= uploaded", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse({ Uploaded: 100, Downloaded: 200 }),
    } as Response)

    const stats = await adapter.fetchStats("https://nebulance.io", "fake-api-key", "/api.php")

    expect(stats.bufferBytes).toBe(0n)
  })

  it("returns Infinity ratio when downloaded is zero and uploaded is non-zero", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse({ Uploaded: 1000, Downloaded: 0 }),
    } as Response)

    const stats = await adapter.fetchStats("https://nebulance.io", "fake-api-key", "/api.php")

    expect(stats.ratio).toBe(Infinity)
  })

  it("returns 0 ratio when both uploaded and downloaded are zero", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse({ Uploaded: 0, Downloaded: 0 }),
    } as Response)

    const stats = await adapter.fetchStats("https://nebulance.io", "fake-api-key", "/api.php")

    expect(stats.ratio).toBe(0)
  })

  it("handles non-zero HnR count", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse({ HnR: 2 }),
    } as Response)

    const stats = await adapter.fetchStats("https://nebulance.io", "fake-api-key", "/api.php")

    expect(stats.hitAndRuns).toBe(2)
  })

  it("uses userId 1 on first poll when remoteUserId is not cached", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse(),
    } as Response)

    await adapter.fetchStats("https://nebulance.io", "fake-api-key", "/api.php")

    const calledUrl = fetchSpy.mock.calls[0][0] as string
    expect(calledUrl).toContain("user=1")
  })

  it("uses cached remoteUserId when provided in options", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse(),
    } as Response)

    await adapter.fetchStats("https://nebulance.io", "fake-api-key", "/api.php", {
      remoteUserId: 9001,
    })

    const calledUrl = fetchSpy.mock.calls[0][0] as string
    expect(calledUrl).toContain("user=9001")
  })

  it("throws when API returns an error object", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 401, message: "Invalid API key" } }),
    } as Response)

    await expect(adapter.fetchStats("https://nebulance.io", "bad-key", "/api.php")).rejects.toThrow(
      "Invalid API key"
    )
  })

  it("throws when response wrapper is missing response field", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: "success" }),
    } as Response)

    await expect(adapter.fetchStats("https://nebulance.io", "bad-key", "/api.php")).rejects.toThrow(
      "missing user data"
    )
  })

  it("throws on non-ok HTTP response with error body", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: 403, message: "Forbidden" } }),
    } as Response)

    await expect(
      adapter.fetchStats("https://nebulance.io", "fake-api-key", "/api.php")
    ).rejects.toThrow("Forbidden")
  })

  it("throws a sanitized error on network failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("fetch failed"))

    await expect(
      adapter.fetchStats("https://nebulance.io", "fake-api-key", "/api.php")
    ).rejects.toThrow("Failed to connect to nebulance.io")
  })
})

describe("NebulanceAdapter - URL construction", () => {
  const adapter = new NebulanceAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("constructs the URL with all required query params", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse(),
    } as Response)

    await adapter.fetchStats("https://nebulance.io", "my-api-key", "/api.php")

    const calledUrl = fetchSpy.mock.calls[0][0] as string
    expect(calledUrl).toContain("action=user")
    expect(calledUrl).toContain("api_key=my-api-key")
    expect(calledUrl).toContain("method=getuserinfo")
    expect(calledUrl).toContain("type=id")
    expect(calledUrl).toContain("user=1")
  })

  it("does not send an Authorization header", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse(),
    } as Response)

    await adapter.fetchStats("https://nebulance.io", "my-api-key", "/api.php")

    const callOptions = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = callOptions?.headers as Record<string, string> | undefined
    expect(headers?.Authorization).toBeUndefined()
  })
})

describe("NebulanceAdapter - Anthelion compatibility", () => {
  const adapter = new NebulanceAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  function mockAnthelionResponse(
    overrides?: Partial<{
      ID: number
      Username: string
      Uploaded: number
      Downloaded: number
      SeedCount: number
      Invites: number
      Class: string
      SubClasses: string | null
      JoinDate: string
      Grabbed: number
      Snatched: number
      ForumPosts: number
    }>
  ) {
    return {
      status: "success",
      response: {
        ID: 1646,
        Username: "Kitty",
        Uploaded: 5368709120,
        Downloaded: 2684354560,
        SeedCount: 88,
        Invites: 3,
        Class: "Power User",
        SubClasses: null,
        JoinDate: "2020-01-12 19:00:42",
        Grabbed: 150,
        Snatched: 120,
        ForumPosts: 42,
        ...overrides,
      },
    }
  }

  it("uses 'apikey' param for anthelion.me", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockAnthelionResponse(),
    } as Response)

    await adapter.fetchStats("https://anthelion.me", "my-key", "/api.php")

    const calledUrl = fetchSpy.mock.calls[0][0] as string
    expect(calledUrl).toContain("apikey=my-key")
    expect(calledUrl).not.toContain("api_key=")
  })

  it("parses Anthelion response into TrackerStats", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockAnthelionResponse(),
    } as Response)

    const stats = await adapter.fetchStats("https://anthelion.me", "key", "/api.php")

    expect(stats.username).toBe("Kitty")
    expect(stats.group).toBe("Power User")
    expect(stats.uploadedBytes).toBe(BigInt(5368709120))
    expect(stats.seedingCount).toBe(88)
    expect(stats.hitAndRuns).toBeNull() // No HnR field → null
    expect(stats.remoteUserId).toBe(1646)
  })

  it("uses SubClasses (plural) for group when present", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockAnthelionResponse({ Class: "Elite", SubClasses: "VIP" }),
    } as Response)

    const stats = await adapter.fetchStats("https://anthelion.me", "key", "/api.php")
    expect(stats.group).toBe("Elite / VIP")
  })

  it("handles flat (unwrapped) response format", async () => {
    const flatResponse = {
      ID: 1646,
      Username: "Kitty",
      Uploaded: 5368709120,
      Downloaded: 2684354560,
      SeedCount: 88,
      Invites: 3,
      Class: "Power User",
      SubClasses: null,
      JoinDate: "2020-01-12 19:00:42",
      Grabbed: 150,
      Snatched: 120,
      ForumPosts: 42,
    }

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => flatResponse,
    } as Response)

    const stats = await adapter.fetchStats("https://anthelion.me", "key", "/api.php")
    expect(stats.username).toBe("Kitty")
    expect(stats.remoteUserId).toBe(1646)
  })
})

describe("NebulanceAdapter - security", () => {
  const adapter = new NebulanceAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("does not expose the API key in error messages on HTTP failure", async () => {
    const secretKey = "super-secret-api-key-12345"

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    } as Response)

    await expect(
      adapter.fetchStats("https://nebulance.io", secretKey, "/api.php")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(secretKey)
      return true
    })
  })

  it("throws a timeout-specific message", async () => {
    const timeoutError = new DOMException("signal timed out", "TimeoutError")
    vi.spyOn(global, "fetch").mockRejectedValueOnce(timeoutError)

    await expect(adapter.fetchStats("https://nebulance.io", "key", "/api.php")).rejects.toThrow(
      "Request to nebulance.io timed out"
    )
  })

  it("uses AbortSignal for timeout protection", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse(),
    } as Response)

    await adapter.fetchStats("https://nebulance.io", "key", "/api.php")

    const callOptions = fetchSpy.mock.calls[0][1] as RequestInit
    expect(callOptions.signal).toBeDefined()
  })
})
