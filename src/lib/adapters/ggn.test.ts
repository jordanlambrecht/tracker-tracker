// src/lib/adapters/ggn.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GGnAdapter } from "./ggn"

function mockQuickUserResponse() {
  return {
    status: "success",
    response: {
      username: "thesneakyrobot",
      id: 74360,
      authkey: "abc123",
      passkey: "def456",
      userstats: {
        uploaded: 372518353895,
        downloaded: 373640248681,
        ratio: 0.99,
        requiredratio: 0.012,
        class: "Elite Gamer",
      },
    },
  }
}

function mockUserResponse(overrides?: {
  stats?: Record<string, unknown>
  personal?: Record<string, unknown>
  community?: Record<string, unknown>
}) {
  return {
    status: "success",
    response: {
      id: 74360,
      username: "thesneakyrobot",
      stats: {
        uploaded: 372518353895,
        downloaded: 373640248681,
        ratio: "0.99699",
        requiredRatio: 0.012,
        gold: 39781,
        ...overrides?.stats,
      },
      personal: {
        class: "Elite Gamer",
        hnrs: null,
        warned: false,
        ...overrides?.personal,
      },
      community: {
        seeding: null,
        leeching: null,
        snatched: 4425,
        ...overrides?.community,
      },
    },
  }
}

/** Helper to mock both fetch calls (quick_user then user) */
function mockBothCalls(userOverrides?: Parameters<typeof mockUserResponse>[0]) {
  vi.spyOn(global, "fetch")
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuickUserResponse(),
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockUserResponse(userOverrides),
    } as Response)
}

describe("GGnAdapter", () => {
  const adapter = new GGnAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("parses a valid two-step GGn response into TrackerStats", async () => {
    mockBothCalls()

    const stats = await adapter.fetchStats("https://gazellegames.net", "fake-key", "/api.php")

    expect(stats.username).toBe("thesneakyrobot")
    expect(stats.group).toBe("Elite Gamer")
    expect(stats.uploadedBytes).toBe(BigInt(372518353895))
    expect(stats.downloadedBytes).toBe(BigInt(373640248681))
    expect(stats.ratio).toBeCloseTo(0.99699)
    expect(stats.bufferBytes).toBe(BigInt(0)) // downloaded > uploaded
    expect(stats.seedbonus).toBe(39781)
    expect(stats.seedingCount).toBe(0) // null → 0
    expect(stats.leechingCount).toBe(0) // null → 0
    expect(stats.hitAndRuns).toBeNull() // personal.hnrs not present → null
    expect(stats.requiredRatio).toBeCloseTo(0.012)
    expect(stats.warned).toBe(false)
    expect(stats.freeleechTokens).toBeNull()
  })

  it("handles seeding/leeching when paranoia allows", async () => {
    mockBothCalls({ community: { seeding: 150, leeching: 2 } })

    const stats = await adapter.fetchStats("https://gazellegames.net", "key", "/api.php")

    expect(stats.seedingCount).toBe(150)
    expect(stats.leechingCount).toBe(2)
  })

  it("handles warned=true from personal section", async () => {
    mockBothCalls({ personal: { warned: true } })

    const stats = await adapter.fetchStats("https://gazellegames.net", "key", "/api.php")

    expect(stats.warned).toBe(true)
  })

  it("handles non-null hnrs", async () => {
    mockBothCalls({ personal: { hnrs: 3 } })

    const stats = await adapter.fetchStats("https://gazellegames.net", "key", "/api.php")

    expect(stats.hitAndRuns).toBe(3)
  })

  it("calculates positive buffer when uploaded > downloaded", async () => {
    mockBothCalls({ stats: { uploaded: 1000, downloaded: 400 } })

    const stats = await adapter.fetchStats("https://gazellegames.net", "key", "/api.php")

    expect(stats.bufferBytes).toBe(BigInt(600))
  })

  it("returns null for requiredRatio when not a number", async () => {
    mockBothCalls({ stats: { requiredRatio: undefined } })

    const stats = await adapter.fetchStats("https://gazellegames.net", "key", "/api.php")

    expect(stats.requiredRatio).toBeNull()
  })

  it("throws on quick_user API failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "failure", error: "Invalid API key" }),
    } as Response)

    await expect(
      adapter.fetchStats("https://gazellegames.net", "bad-key", "/api.php")
    ).rejects.toThrow("Invalid API key")
  })

  it("throws on user API failure", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuickUserResponse(),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "failure", error: "bad id parameter" }),
      } as Response)

    await expect(adapter.fetchStats("https://gazellegames.net", "key", "/api.php")).rejects.toThrow(
      "bad id parameter"
    )
  })

  it("throws on non-ok HTTP response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    } as Response)

    await expect(adapter.fetchStats("https://gazellegames.net", "key", "/api.php")).rejects.toThrow(
      "403"
    )
  })

  it("throws a sanitized error on network failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("fetch failed"))

    await expect(adapter.fetchStats("https://gazellegames.net", "key", "/api.php")).rejects.toThrow(
      "Failed to connect to gazellegames.net"
    )
  })
})

describe("GGnAdapter - URL construction", () => {
  const adapter = new GGnAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("constructs quick_user URL with key param", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuickUserResponse(),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserResponse(),
      } as Response)

    await adapter.fetchStats("https://gazellegames.net", "my-api-key", "/api.php")

    const firstUrl = fetchSpy.mock.calls[0][0] as string
    expect(firstUrl).toContain("api.php")
    expect(firstUrl).toContain("request=quick_user")
    expect(firstUrl).toContain("key=my-api-key")
  })

  it("constructs user URL with id and key params", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuickUserResponse(),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserResponse(),
      } as Response)

    await adapter.fetchStats("https://gazellegames.net", "my-api-key", "/api.php")

    const secondUrl = fetchSpy.mock.calls[1][0] as string
    expect(secondUrl).toContain("request=user")
    expect(secondUrl).toContain("id=74360")
    expect(secondUrl).toContain("key=my-api-key")
  })
})

describe("GGnAdapter - security", () => {
  const adapter = new GGnAdapter()

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
      adapter.fetchStats("https://gazellegames.net", secretKey, "/api.php")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(secretKey)
      return true
    })
  })

  it("does not expose the API key in error messages on network failure", async () => {
    const secretKey = "super-secret-api-key-12345"

    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      new Error("request to https://gazellegames.net/api.php failed")
    )

    await expect(
      adapter.fetchStats("https://gazellegames.net", secretKey, "/api.php")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(secretKey)
      expect(err.message).toContain("gazellegames.net")
      return true
    })
  })

  it("throws a timeout-specific message", async () => {
    const timeoutError = new DOMException("signal timed out", "TimeoutError")
    vi.spyOn(global, "fetch").mockRejectedValueOnce(timeoutError)

    await expect(adapter.fetchStats("https://gazellegames.net", "key", "/api.php")).rejects.toThrow(
      "Request to gazellegames.net timed out"
    )
  })

})
