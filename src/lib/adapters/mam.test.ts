// src/lib/adapters/mam.test.ts
//
// Functions: mockMamResponse, mockFetch, describe(MamAdapter - parsing),
//            describe(MamAdapter - auth), describe(MamAdapter - error handling),
//            describe(MamAdapter - fetchRaw)

import { beforeEach, describe, expect, it, vi } from "vitest"
import { MamAdapter } from "./mam"

function mockMamResponse(overrides?: Partial<Record<string, unknown>>) {
  return {
    username: "trackerfan",
    uid: 12345,
    classname: "VIP",
    ratio: 2.47,
    uploaded: "500.25 GiB",
    downloaded: "202.57 GiB",
    uploaded_bytes: 537062408601,
    downloaded_bytes: 217524183040,
    seedbonus: 98765,
    wedges: 3,
    vip_until: "2027-01-01",
    connectable: "Yes",
    recently_deleted: 0,
    leeching: { name: "Leeching", count: 2, red: false, size: null },
    sSat: { name: "Seeding Satisfied", count: 10, red: false, size: null },
    seedHnr: { name: "Seeding HnR", count: 1, red: true, size: null },
    seedUnsat: { name: "Seeding Unsatisfied", count: 3, red: true, size: null },
    upAct: { name: "Upload Active", count: 4, red: false, size: null },
    upInact: { name: "Upload Inactive", count: 0, red: false, size: null },
    inactHnr: { name: "Inactive HnR", count: 5, red: true, size: null },
    inactSat: { name: "Inactive Satisfied", count: 8, red: false, size: null },
    inactUnsat: { name: "Inactive Unsatisfied", count: 2, red: true, size: null },
    unsat: { name: "Unsatisfied", count: 2, red: true, size: null, limit: 10 },
    duplicates: { name: "Duplicates", count: 0, red: false, size: null },
    reseed: { name: "Reseed", count: 0, inactive: 0, red: false },
    ite: { name: "Tracker Errors", count: 1, latest: 1711000000 },
    notifs: {
      pms: 3,
      aboutToDropClient: 0,
      tickets: 1,
      waiting_tickets: 0,
      requests: 2,
      topics: 5,
    },
    ...overrides,
  }
}

function mockFetch(overrides?: Partial<Record<string, unknown>>) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: true,
    json: async () => mockMamResponse(overrides),
  } as Response)
}

describe("MamAdapter - parsing", () => {
  const adapter = new MamAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("parses a valid response into TrackerStats", async () => {
    mockFetch()

    const stats = await adapter.fetchStats(
      "https://www.myanonamouse.net",
      "a1b2c3a1b2c3a1b2c3a1b2c3a1b2c3a1",
      "/jsonLoad.php"
    )

    expect(stats.username).toBe("trackerfan")
    expect(stats.group).toBe("VIP")
    expect(stats.remoteUserId).toBe(12345)
    expect(stats.uploadedBytes).toBe(BigInt(537062408601))
    expect(stats.downloadedBytes).toBe(BigInt(217524183040))
    expect(stats.ratio).toBeCloseTo(2.47)
    expect(stats.bufferBytes).toBe(BigInt(537062408601) - BigInt(217524183040))
    expect(stats.seedbonus).toBe(98765)
    expect(stats.freeleechTokens).toBe(3)
    expect(stats.hitAndRuns).toBe(5)
    expect(stats.requiredRatio).toBeNull()
    expect(stats.warned).toBeNull()
  })

  it("aggregates seedingCount from sSat + seedHnr + seedUnsat + upAct", async () => {
    mockFetch()

    const stats = await adapter.fetchStats(
      "https://www.myanonamouse.net",
      "a1b2c3a1b2c3a1b2c3a1b2c3a1b2c3a1",
      "/jsonLoad.php"
    )

    // 10 + 1 + 3 + 4 = 18
    expect(stats.seedingCount).toBe(18)
  })

  it("returns zero bufferBytes when downloaded exceeds uploaded", async () => {
    mockFetch({
      uploaded_bytes: 100_000_000,
      downloaded_bytes: 500_000_000,
    })

    const stats = await adapter.fetchStats(
      "https://www.myanonamouse.net",
      "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0",
      "/jsonLoad.php"
    )

    expect(stats.bufferBytes).toBe(BigInt(0))
  })

  it("handles missing snatch_summary fields and returns seedingCount of 0", async () => {
    mockFetch({
      sSat: undefined,
      seedHnr: undefined,
      seedUnsat: undefined,
      upAct: undefined,
      leeching: undefined,
      inactHnr: undefined,
    })

    const stats = await adapter.fetchStats(
      "https://www.myanonamouse.net",
      "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0",
      "/jsonLoad.php"
    )

    expect(stats.seedingCount).toBe(0)
    expect(stats.leechingCount).toBe(0)
    expect(stats.hitAndRuns).toBeNull()
  })

  it("maps wedges to freeleechTokens", async () => {
    mockFetch({ wedges: 7 })

    const stats = await adapter.fetchStats(
      "https://www.myanonamouse.net",
      "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0",
      "/jsonLoad.php"
    )

    expect(stats.freeleechTokens).toBe(7)
  })

  it("maps inactHnr.count to hitAndRuns", async () => {
    mockFetch({ inactHnr: { name: "Inactive HnR", count: 12, red: true, size: null } })

    const stats = await adapter.fetchStats(
      "https://www.myanonamouse.net",
      "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0",
      "/jsonLoad.php"
    )

    expect(stats.hitAndRuns).toBe(12)
  })

  it("populates MamPlatformMeta with all expected fields", async () => {
    mockFetch()

    const stats = await adapter.fetchStats(
      "https://www.myanonamouse.net",
      "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0",
      "/jsonLoad.php"
    )

    const meta = stats.platformMeta as {
      vipUntil?: string
      connectable?: string
      unsatisfiedCount?: number
      unsatisfiedLimit?: number
      inactiveSatisfiedCount?: number
      seedingHnrCount?: number
      trackerErrorCount?: number
      recentlyDeleted?: number
      unreadPMs?: number
      openTickets?: number
      pendingRequests?: number
      unreadTopics?: number
    }

    expect(meta).toBeDefined()
    expect(meta.vipUntil).toBe("2027-01-01")
    expect(meta.connectable).toBe("Yes")
    expect(meta.unsatisfiedCount).toBe(2)
    expect(meta.unsatisfiedLimit).toBe(10)
    expect(meta.inactiveSatisfiedCount).toBe(8)
    expect(meta.seedingHnrCount).toBe(1)
    expect(meta.trackerErrorCount).toBe(1)
    expect(meta.recentlyDeleted).toBe(0)
    expect(meta.unreadPMs).toBe(3)
    expect(meta.openTickets).toBe(1)
    expect(meta.pendingRequests).toBe(2)
    expect(meta.unreadTopics).toBe(5)
  })
})

describe("MamAdapter - auth", () => {
  const adapter = new MamAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("sends mam_id as Cookie header", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockMamResponse(),
    } as Response)

    await adapter.fetchStats(
      "https://www.myanonamouse.net",
      "abc123abc123abc123abc123abc123ab",
      "/jsonLoad.php"
    )

    const callOpts = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = callOpts.headers as Record<string, string>
    expect(headers.Cookie).toBe("mam_id=abc123abc123abc123abc123abc123ab")
  })

  it("includes snatch_summary in the request URL", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockMamResponse(),
    } as Response)

    await adapter.fetchStats(
      "https://www.myanonamouse.net",
      "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0",
      "/jsonLoad.php"
    )

    const calledUrl = fetchSpy.mock.calls[0][0] as string
    expect(calledUrl).toContain("snatch_summary")
    expect(calledUrl).toContain("notif")
    expect(calledUrl).toContain("jsonLoad.php")
  })
})

describe("MamAdapter - mam_id validation", () => {
  const adapter = new MamAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("strips mam_id= prefix if user pasted the full cookie", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockMamResponse(),
    } as Response)

    await adapter.fetchStats(
      "https://www.myanonamouse.net",
      "mam_id=abc123session",
      "/jsonLoad.php"
    )

    const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers.Cookie).toBe("mam_id=abc123session")
  })

  it("throws on empty token", async () => {
    await expect(
      adapter.fetchStats("https://www.myanonamouse.net", "  ", "/jsonLoad.php")
    ).rejects.toThrow("cannot be empty")
  })

  it("throws when token contains semicolons", async () => {
    await expect(
      adapter.fetchStats("https://www.myanonamouse.net", "abc;evil=1", "/jsonLoad.php")
    ).rejects.toThrow("invalid characters")
  })

  it("throws when token contains newlines", async () => {
    await expect(
      adapter.fetchStats("https://www.myanonamouse.net", "abc\nSet-Cookie: evil", "/jsonLoad.php")
    ).rejects.toThrow("invalid characters")
  })

  it("allows non-hex characters in session cookies", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockMamResponse(),
    } as Response)

    // MAM cookies can contain alphanumeric + other safe chars
    const stats = await adapter.fetchStats(
      "https://www.myanonamouse.net",
      "abc123XYZ_session.value",
      "/jsonLoad.php"
    )
    expect(stats.username).toBe("trackerfan")
  })
})

describe("MamAdapter - error handling", () => {
  const adapter = new MamAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("throws when username is missing from response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockMamResponse({ username: "" }),
    } as Response)

    await expect(
      adapter.fetchStats(
        "https://www.myanonamouse.net",
        "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0",
        "/jsonLoad.php"
      )
    ).rejects.toThrow("missing username")
  })

  it("does not leak the session cookie in error messages", async () => {
    const secretToken = "aabbccaabbccaabbccaabbccaabbccaa"

    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("fetch failed"))

    await expect(
      adapter.fetchStats("https://www.myanonamouse.net", secretToken, "/jsonLoad.php")
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(secretToken)
      expect(err.message).toContain("www.myanonamouse.net")
      return true
    })
  })

  it("throws a timeout-specific message on TimeoutError", async () => {
    const timeoutError = new DOMException("signal timed out", "TimeoutError")
    vi.spyOn(global, "fetch").mockRejectedValueOnce(timeoutError)

    await expect(
      adapter.fetchStats(
        "https://www.myanonamouse.net",
        "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0",
        "/jsonLoad.php"
      )
    ).rejects.toThrow("Request to www.myanonamouse.net timed out")
  })
})

describe("MamAdapter - fetchRaw", () => {
  const adapter = new MamAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a single debug call with label 'User Stats'", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockMamResponse(),
    } as Response)

    const calls = await adapter.fetchRaw(
      "https://www.myanonamouse.net",
      "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0",
      "/jsonLoad.php"
    )

    expect(calls).toHaveLength(1)
    expect(calls[0].label).toBe("User Stats")
    expect(calls[0].error).toBeNull()
    expect(calls[0].data).toBeDefined()
  })
})
