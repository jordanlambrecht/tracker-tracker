// src/lib/tracker-platforms/__tests__/ggn.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GGnAdapter } from "../adapters/ggn"

function mockQuickUserResponse() {
  return {
    status: "success",
    response: {
      username: "lanternfoxtail",
      id: 70813,
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
      id: 70813,
      username: "lanternfoxtail",
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

  it("refuses a byte total the user call omitted rather than reading it as zero", async () => {
    // A missing byte total must throw, not read as 0, or the fallback ratio
    // derived from it is fabricated too.
    for (const field of ["uploaded", "downloaded"] as const) {
      mockBothCalls({ stats: { [field]: undefined } })

      await expect(
        adapter.fetchStats("https://gazellegames.net", "fake-key", "/api.php")
      ).rejects.toThrow(`Unexpected response from gazellegames.net: missing ${field}`)
    }
  })

  it("parses a valid two-step GGn response into TrackerStats", async () => {
    mockBothCalls()

    const stats = await adapter.fetchStats("https://gazellegames.net", "fake-key", "/api.php")

    expect(stats.username).toBe("lanternfoxtail")
    expect(stats.group).toBe("Elite Gamer")
    expect(stats.uploadedBytes).toBe(BigInt(372518353895))
    expect(stats.downloadedBytes).toBe(BigInt(373640248681))
    expect(stats.ratio).toBeCloseTo(0.99699)
    // downloaded > uploaded, a real deficit, reported signed rather than clamped
    expect(stats.bufferBytes).toBe(BigInt(372518353895) - BigInt(373640248681))
    expect(stats.seedbonus).toBe(39781)
    expect(stats.seedingCount).toBeNull() // community block absent → unknown
    expect(stats.leechingCount).toBeNull() // community block absent → unknown
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

  it("reports no class when the user call carries none", async () => {
    for (const className of [undefined, "", "   "]) {
      mockBothCalls({ personal: { class: className } })

      const stats = await adapter.fetchStats("https://gazellegames.net", "key", "/api.php")

      expect(stats.group).toBeNull()
    }
  })

  it("reports an infinite ratio when nothing has been downloaded", async () => {
    mockBothCalls({ stats: { uploaded: 1000, downloaded: 0, ratio: 0 } })

    const stats = await adapter.fetchStats("https://gazellegames.net", "key", "/api.php")

    expect(stats.ratio).toBe(Number.POSITIVE_INFINITY)
  })

  it("reads a missing downloaded as zero when the ratio says nothing was downloaded", async () => {
    for (const ratio of [0, "0", "∞", null, undefined]) {
      mockBothCalls({ stats: { uploaded: 1000, downloaded: null, ratio } })

      const stats = await adapter.fetchStats("https://gazellegames.net", "key", "/api.php")

      expect(stats.downloadedBytes).toBe(0n)
      expect(stats.ratio).toBe(Number.POSITIVE_INFINITY)
    }
  })

  it("reads the shape GGn sends for an account whose downloads all were freeleech", async () => {
    // A live response's shape: the infinity sign arrives mis-decoded as Latin-1
    mockBothCalls({
      stats: {
        uploaded: 100_000_000_000,
        downloaded: null,
        fullDownloaded: 90_000_000_000,
        ratio: "\u00e2\u0088\u009e",
      },
    })

    const stats = await adapter.fetchStats("https://gazellegames.net", "key", "/api.php")

    expect(stats.downloadedBytes).toBe(0n)
    expect(stats.ratio).toBe(Number.POSITIVE_INFINITY)
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

  it.each([
    ["quick_user", [{ status: "failure", error: "   " }]],
    ["user", [mockQuickUserResponse(), { status: "failure", error: "   " }]],
  ])("names the status when a %s failure carries a blank reason", async (_call, bodies) => {
    const fetchSpy = vi.spyOn(global, "fetch")
    for (const body of bodies) {
      fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => body } as Response)
    }

    await expect(adapter.fetchStats("https://gazellegames.net", "key", "/api.php")).rejects.toThrow(
      "GGn API returned status: failure"
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
    expect(secondUrl).toContain("id=70813")
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

describe("GGnAdapter.fetchRaw", () => {
  const adapter = new GGnAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the quick user call as a successful call", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => mockQuickUserResponse() } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => mockUserResponse() } as Response)

    const calls = await adapter.fetchRaw("https://gazellegames.net", "fake-token", "/api.php")

    expect(calls.length).toBeGreaterThan(0)
    expect(calls[0].label).toBe("Quick User")
    expect(calls[0].error).toBeNull()
    expect(calls[0].data).not.toBeNull()
  })

  it("stops at a quick user body the poll rejects, since the poll never makes the user call", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "success", response: { id: 70813 } }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => mockUserResponse() } as Response)

    const calls = await adapter.fetchRaw("https://gazellegames.net", "fake-token", "/api.php")

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(calls).toHaveLength(2)
    expect(calls[0].error).toBe(
      "Unexpected response from gazellegames.net: missing user ID or username"
    )
    expect(calls[1]).toEqual({
      label: "User Profile",
      endpoint: "/api.php?request=user",
      data: null,
      error: "Skipped: Quick User failed and no user id is cached",
    })
  })

  it("records a failed quick user request instead of throwing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    const calls = await adapter.fetchRaw("https://gazellegames.net", "fake-token", "/api.php")

    expect(calls).toHaveLength(2)
    expect(calls[0].data).toBeNull()
    expect(calls[0].error).toBeTruthy()
    // A view that ends after one entry cannot be told from a one-call adapter.
    expect(calls[1]).toEqual({
      label: "User Profile",
      endpoint: "/api.php?request=user",
      data: null,
      error: "Skipped: Quick User failed and no user id is cached",
    })
  })

  it("goes straight to the user call when the id is cached", async () => {
    const body = mockUserResponse()
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => body } as Response)

    const calls = await adapter.fetchRaw("https://gazellegames.net", "fake-token", "/api.php", {
      remoteUserId: 70813,
    })

    // The poll skips quick_user on a cached id, and so does the view.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([
      {
        label: "User Profile",
        endpoint: "/api.php?request=user&id=70813",
        data: body,
        error: null,
      },
    ])
  })
})

// ratio reaches the stored snapshot and the ratio_danger alert
// (tracker-scheduler.ts:336), so an unparseable string must not become 0.
// GGn types the field string | number and prints a glyph for an account that
// has downloaded nothing, which parseFloat cannot read.
describe("GGnAdapter ratio", () => {
  const adapter = new GGnAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("derives the ratio from the byte totals when the reported one will not parse", async () => {
    mockBothCalls({ stats: { ratio: "∞", uploaded: 5_000_000_000, downloaded: 0 } })

    const stats = await adapter.fetchStats("https://gazellegames.net", "key", "/api.php")

    // Infinity, not 0. A zero here reads as critically in debt.
    expect(stats.ratio).toBe(Number.POSITIVE_INFINITY)
    expect(stats.ratio).not.toBe(0)
  })

  it("derives rather than zeroing when the string is plain nonsense", async () => {
    mockBothCalls({ stats: { ratio: "N/A", uploaded: 300, downloaded: 100 } })

    const stats = await adapter.fetchStats("https://gazellegames.net", "key", "/api.php")

    expect(stats.ratio).toBe(3)
  })

  it("still prefers a ratio the tracker did report", async () => {
    mockBothCalls({ stats: { ratio: "0.99699" } })

    const stats = await adapter.fetchStats("https://gazellegames.net", "key", "/api.php")

    expect(stats.ratio).toBeCloseTo(0.99699, 5)
  })

  it("accepts a numeric ratio unchanged", async () => {
    mockBothCalls({ stats: { ratio: 2.5 } })

    const stats = await adapter.fetchStats("https://gazellegames.net", "key", "/api.php")

    expect(stats.ratio).toBe(2.5)
  })
})
