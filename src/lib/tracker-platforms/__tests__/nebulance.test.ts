// src/lib/tracker-platforms/__tests__/nebulance.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { NebulanceAdapter } from "../adapters/nebulance"

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

  it("refuses a byte total the response omitted rather than reading it as zero", async () => {
    // The shape check only looks at Username, so a body missing the totals must
    // throw here or it reads as an account that stopped seeding.
    for (const field of ["Uploaded", "Downloaded"] as const) {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockNebulanceResponse({ [field]: undefined }),
      } as Response)

      await expect(
        adapter.fetchStats("https://nebulance.io", "fake-api-key", "/api.php")
      ).rejects.toThrow(`Unexpected response from nebulance.io: missing ${field}`)
    }
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
    expect(stats.leechingCount).toBeNull()
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

  // A deficit account must report its actual shortfall, not 0.
  it("calculates a negative buffer when downloaded exceeds uploaded", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse({ Uploaded: 100, Downloaded: 200 }),
    } as Response)

    const stats = await adapter.fetchStats("https://nebulance.io", "fake-api-key", "/api.php")

    expect(stats.bufferBytes).toBe(-100n)
  })

  it("calculates a zero buffer only at genuine breakeven", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNebulanceResponse({ Uploaded: 200, Downloaded: 200 }),
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
        ID: 2853,
        Username: "Marigold",
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

  it("spells the parameter the way the registry says, not the way the hostname reads", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockAnthelionResponse(),
    } as Response)

    await adapter.fetchStats("https://anthelion.me", "my-key", "/api.php", {
      nebulanceAuthParam: "apikey",
    })

    const calledUrl = fetchSpy.mock.calls[0][0] as string
    expect(calledUrl).toContain("apikey=my-key")
    expect(calledUrl).not.toContain("api_key=")
  })

  it("defaults to api_key when the registry says nothing", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockAnthelionResponse(),
    } as Response)

    await adapter.fetchStats("https://nebulance.io", "my-key", "/api.php")

    expect(fetchSpy.mock.calls[0][0] as string).toContain("api_key=my-key")
  })

  it("spells it the same way in the debug call, which used to build its own URL", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => mockAnthelionResponse(),
    } as Response)

    await adapter.fetchRaw("https://anthelion.me", "my-key", "/api.php", {
      nebulanceAuthParam: "apikey",
    })

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

    expect(stats.username).toBe("Marigold")
    expect(stats.group).toBe("Power User")
    expect(stats.uploadedBytes).toBe(BigInt(5368709120))
    expect(stats.seedingCount).toBe(88)
    expect(stats.hitAndRuns).toBeNull() // No HnR field → null
    expect(stats.remoteUserId).toBe(2853)
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
      ID: 2853,
      Username: "Marigold",
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
    expect(stats.username).toBe("Marigold")
    expect(stats.remoteUserId).toBe(2853)
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

// ---------------------------------------------------------------------------
// Nebulance routes through the shared adapterRequest helper, so the proxy path
// sends the app User-Agent like the direct one.
// ---------------------------------------------------------------------------

describe("NebulanceAdapter - proxy routing", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("sends the app User-Agent through the proxy and never falls back to a direct fetch", async () => {
    const proxyFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => mockNebulanceResponse(),
      buffer: async () => Buffer.from("{}"),
    })
    vi.doMock("@/lib/tunnel", () => ({ proxyFetch }))

    const { NebulanceAdapter: FreshAdapter } = await import("../adapters/nebulance")
    const { DEFAULT_USER_AGENT } = await import("@/lib/user-agent")
    const fetchSpy = vi.spyOn(global, "fetch")

    await new FreshAdapter().fetchStats("https://nebulance.io", "key", "/api.php", {
      proxyAgent: {} as never,
    })

    expect(proxyFetch).toHaveBeenCalledTimes(1)
    expect(proxyFetch.mock.calls[0][2].headers["User-Agent"]).toBe(DEFAULT_USER_AGENT)
    // A direct fetch here would leak the user's real IP past their tunnel.
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.doUnmock("@/lib/tunnel")
  })
})

describe("NebulanceAdapter.fetchRaw", () => {
  const adapter = new NebulanceAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("records a failed call as an error rather than a successful one", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: "bad key" }),
    } as Response)

    const calls = await adapter.fetchRaw("https://nebulance.io", "bad-key", "/api.php")

    // A null error is what marks a call healthy in the debug view, so an error
    // body rendered as a success was the whole defect.
    expect(calls).toHaveLength(1)
    expect(calls[0].data).toBeNull()
    expect(calls[0].error).toContain("401")
  })

  it("returns the body on a successful call", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ response: { Username: "seedqueen" } }),
    } as Response)

    const calls = await adapter.fetchRaw("https://nebulance.io", "good-key", "/api.php")

    expect(calls[0].error).toBeNull()
    expect(calls[0].data).not.toBeNull()
  })
})

describe("NebulanceAdapter.fetchRaw body-level errors", () => {
  // fetchRaw applies the same failure test as fetchStats, so a 200 carrying an
  // error body shows as a failed call in the debug view.
  const adapter = new NebulanceAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("reports an error object carried in a 200 as a failed call", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ error: { code: 401, message: "bad api key" } }),
    } as unknown as Response)

    const calls = await adapter.fetchRaw("https://nebulance.io", "key", "/api.php")

    expect(calls).toHaveLength(1)
    expect(calls[0].error).toContain("bad api key")
    // The offending body is kept so the tab can still show what arrived.
    expect(calls[0].data).not.toBeNull()
  })

  it("still reports a healthy call as healthy", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ Username: "someone", ID: 1 }),
    } as unknown as Response)

    const calls = await adapter.fetchRaw("https://nebulance.io", "key", "/api.php")
    expect(calls[0].error).toBeNull()
  })
})

describe("NebulanceAdapter error wording is an interface", () => {
  // sanitizeNetworkError picks a rule by matching the raw message, so the wording
  // carries the status class itself. A rejection that falls through reads as
  // "Poll failed", the same as a host that never answered.
  const adapter = new NebulanceAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("classifies a 401 whatever words the tracker chose", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: { code: 401, message: "key not recognised" } }),
    } as Response)

    const err = await adapter
      .fetchStats("https://nebulance.io", "bad-key", "/api.php")
      .then(() => null)
      .catch((e: unknown) => (e instanceof Error ? e : null))

    expect(err).not.toBeNull()
    // The tracker never says "invalid", so only the status can classify this.
    expect(sanitizeNetworkError(err?.message ?? "")).toBe("Authentication failed")
    // And the tracker message survives for the log line.
    expect(err?.message).toContain("key not recognised")
  })

  it("classifies a body-level error on a 200 as a shape problem", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ error: { code: 9, message: "account parked" } }),
    } as Response)

    const err = await adapter
      .fetchStats("https://nebulance.io", "key", "/api.php")
      .then(() => null)
      .catch((e: unknown) => (e instanceof Error ? e : null))

    expect(sanitizeNetworkError(err?.message ?? "")).toBe("Tracker returned an unexpected response")
  })
})
