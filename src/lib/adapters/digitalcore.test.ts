// src/lib/adapters/digitalcore.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DigitalCoreAdapter, parseDigitalCoreCredentials } from "./digitalcore"
import type { DigitalCorePlatformMeta } from "./types"

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function mockStatusResponse(overrides?: Partial<Record<string, unknown>>) {
  return {
    user: {
      id: 54321,
      username: "dcuser",
      class: 20,
      avatar: "https://digitalcore.club/avatars/dcuser.jpg",
      uploaded: 536870912000,
      downloaded: 134217728000,
      warned: "no",
      bonuspoang: 4200,
      hit_and_run_total: 1,
      hnr: 1,
      hnr_warned: "no",
      myseedstotal: 88,
      invites: 2,
      donor: "no",
      seedboxdonor: "yes",
      enabled: "yes",
      leechbonus: 0,
      parkerad: 0,
      downloadban: 0,
      uploadban: 0,
      connectable: 1,
      crown: 0,
      skull: 0,
      pokal: 1,
      coin: 0,
      ...overrides,
    },
    settings: { serverTime: 1712500000 },
  }
}

function mockUserProfileResponse(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 54321,
    username: "dcuser",
    added: "2021-06-15 09:00:00",
    last_access: "2026-04-08 12:30:00",
    uploaded: 536870912000,
    downloaded: 134217728000,
    uploaded_real: 536870912000,
    downloaded_real: 134217728000,
    class: 20,
    avatar: "https://digitalcore.club/avatars/dcuser.jpg",
    warned: "no",
    bonuspoang: 4200,
    donor: "no",
    seedboxdonor: "yes",
    enabled: "yes",
    parkerad: 0,
    peersSeeder: 88,
    peersLeecher: 3,
    torrents: 120,
    requests: 5,
    forumPosts: 42,
    torrentComments: 10,
    invites: 2,
    invitees: 7,
    leechbonus: 0,
    hnr_warned: "no",
    crown: 0,
    skull: 0,
    pokal: 1,
    coin: 0,
    hearts: 2,
    ...overrides,
  }
}

/** Build a mock Response that uses .text() (matching fetchDCJson's parseJsonSafe path) */
function mockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : `Error ${status}`,
    text: async () => JSON.stringify(data),
  } as Response
}

function mockErrorResponse(status: number, body?: string): Response {
  return {
    ok: false,
    status,
    statusText: `Error ${status}`,
    text: async () => body ?? "",
  } as Response
}

// ---------------------------------------------------------------------------
// parseDigitalCoreCredentials
// ---------------------------------------------------------------------------

describe("parseDigitalCoreCredentials", () => {
  it("parses a valid JSON credential blob with uid and pass", () => {
    const json = JSON.stringify({ uid: "54321", pass: "abc123xyz" })
    const creds = parseDigitalCoreCredentials(json)
    expect(creds.uid).toBe("54321")
    expect(creds.pass).toBe("abc123xyz")
  })

  it("trims whitespace from uid and pass", () => {
    const json = JSON.stringify({ uid: "  54321  ", pass: "  abc123xyz  " })
    const creds = parseDigitalCoreCredentials(json)
    expect(creds.uid).toBe("54321")
    expect(creds.pass).toBe("abc123xyz")
  })

  it("throws on non-JSON string", () => {
    expect(() => parseDigitalCoreCredentials("just-a-plain-string")).toThrow(
      "DigitalCore credentials must be a JSON object"
    )
  })

  it("throws on missing uid field", () => {
    const json = JSON.stringify({ pass: "abc123xyz" })
    expect(() => parseDigitalCoreCredentials(json)).toThrow("uid")
  })

  it("throws on missing pass field", () => {
    const json = JSON.stringify({ uid: "54321" })
    expect(() => parseDigitalCoreCredentials(json)).toThrow("pass")
  })

  it("throws when uid is not a string", () => {
    const json = JSON.stringify({ uid: 54321, pass: "abc123xyz" })
    expect(() => parseDigitalCoreCredentials(json)).toThrow()
  })

  it("throws when pass is not a string", () => {
    const json = JSON.stringify({ uid: "54321", pass: 9999 })
    expect(() => parseDigitalCoreCredentials(json)).toThrow()
  })

  it("throws on empty uid after trimming", () => {
    const json = JSON.stringify({ uid: "   ", pass: "abc123xyz" })
    expect(() => parseDigitalCoreCredentials(json)).toThrow("uid cannot be empty")
  })

  it("throws on empty pass after trimming", () => {
    const json = JSON.stringify({ uid: "54321", pass: "   " })
    expect(() => parseDigitalCoreCredentials(json)).toThrow("pass cannot be empty")
  })

  it("throws when uid contains a semicolon (injection guard)", () => {
    const json = JSON.stringify({ uid: "54321; HttpOnly", pass: "abc123xyz" })
    expect(() => parseDigitalCoreCredentials(json)).toThrow("invalid characters")
  })

  it("throws when pass contains a newline (injection guard)", () => {
    const json = JSON.stringify({ uid: "54321", pass: "abc\nSet-Cookie: evil=1" })
    expect(() => parseDigitalCoreCredentials(json)).toThrow("invalid characters")
  })

  it("throws when uid contains a carriage return (injection guard)", () => {
    const json = JSON.stringify({ uid: "543\r21", pass: "abc123xyz" })
    expect(() => parseDigitalCoreCredentials(json)).toThrow("invalid characters")
  })

  it("throws on a JSON array instead of object", () => {
    expect(() => parseDigitalCoreCredentials('["uid", "pass"]')).toThrow()
  })

  it("throws on a JSON null value", () => {
    expect(() => parseDigitalCoreCredentials("null")).toThrow()
  })
})

// ---------------------------------------------------------------------------
// DigitalCoreAdapter.fetchStats — happy path
// ---------------------------------------------------------------------------

describe("DigitalCoreAdapter.fetchStats — core stats", () => {
  const adapter = new DigitalCoreAdapter()
  const validToken = JSON.stringify({ uid: "54321", pass: "abc123xyz" })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns correct username and class group name from status", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.username).toBe("dcuser")
    expect(stats.group).toBe("Viceroy") // class 20 maps to "Viceroy"
  })

  it("converts uploaded/downloaded to BigInt from integer bytes", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.uploadedBytes).toBe(BigInt(536870912000))
    expect(stats.downloadedBytes).toBe(BigInt(134217728000))
  })

  it("floors float values before BigInt conversion", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        mockResponse(mockStatusResponse({ uploaded: 1073741824.9, downloaded: 536870912.7 }))
      )
      .mockResolvedValueOnce(
        mockResponse(mockUserProfileResponse({ uploaded: 1073741824.9, downloaded: 536870912.7 }))
      )

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.uploadedBytes).toBe(BigInt(1073741824))
    expect(stats.downloadedBytes).toBe(BigInt(536870912))
  })

  it("computes ratio as uploaded / downloaded", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    // 536870912000 / 134217728000 = 4.0
    expect(stats.ratio).toBeCloseTo(4.0)
  })

  it("returns Infinity for ratio when downloaded is zero and uploaded is positive", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ uploaded: 1000000, downloaded: 0 })))
      .mockResolvedValueOnce(
        mockResponse(mockUserProfileResponse({ uploaded: 1000000, downloaded: 0 }))
      )

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.ratio).toBe(Infinity)
  })

  it("returns 0 for ratio when both uploaded and downloaded are zero", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ uploaded: 0, downloaded: 0 })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ uploaded: 0, downloaded: 0 })))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.ratio).toBe(0)
  })

  it("computes bufferBytes as max(uploaded - downloaded, 0)", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.bufferBytes).toBe(BigInt(536870912000) - BigInt(134217728000))
  })

  it("clamps bufferBytes to zero when downloaded exceeds uploaded", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ uploaded: 100, downloaded: 500 })))
      .mockResolvedValueOnce(
        mockResponse(mockUserProfileResponse({ uploaded: 100, downloaded: 500 }))
      )

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.bufferBytes).toBe(BigInt(0))
  })

  it("maps seedingCount from myseedstotal", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ myseedstotal: 77 })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ peersSeeder: 77 })))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.seedingCount).toBe(77)
  })

  it("maps hitAndRuns from hit_and_run_total", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ hit_and_run_total: 3 })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.hitAndRuns).toBe(3)
  })

  it("maps seedbonus from bonuspoang", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ bonuspoang: 9876 })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ bonuspoang: 9876 })))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.seedbonus).toBe(9876)
  })

  it("sets warned to false when warned is 'no'", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ warned: "no" })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ warned: "no" })))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.warned).toBe(false)
  })

  it("sets warned to true when warned is 'yes'", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ warned: "yes" })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ warned: "yes" })))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.warned).toBe(true)
  })

  it("resolves requiredRatio as null (DigitalCore does not expose required ratio)", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.requiredRatio).toBeNull()
  })

  it("resolves freeleechTokens as null (DigitalCore does not expose freeleech tokens)", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.freeleechTokens).toBeNull()
  })

  it("sets avatarUrl from user.avatar when present", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.avatarUrl).toBe("https://digitalcore.club/avatars/dcuser.jpg")
  })

  it("sets avatarUrl to undefined when avatar is empty string", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ avatar: "" })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ avatar: "" })))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.avatarUrl).toBeUndefined()
  })

  it("sets remoteUserId from user.id", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.remoteUserId).toBe(54321)
  })
})

// ---------------------------------------------------------------------------
// DigitalCoreAdapter.fetchStats — "yes"/"no" boolean normalization
// ---------------------------------------------------------------------------

describe("DigitalCoreAdapter.fetchStats — boolean string normalization", () => {
  const adapter = new DigitalCoreAdapter()
  const validToken = JSON.stringify({ uid: "54321", pass: "abc123xyz" })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("normalizes donor 'yes' to true in baseMeta", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ donor: "yes" })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ donor: "yes" })))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")
    const meta = stats.platformMeta as DigitalCorePlatformMeta

    expect(meta.donor).toBe(true)
  })

  it("normalizes donor 'no' to false in baseMeta", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ donor: "no" })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ donor: "no" })))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")
    const meta = stats.platformMeta as DigitalCorePlatformMeta

    expect(meta.donor).toBe(false)
  })

  it("normalizes seedboxdonor 'yes' to seedboxDonor true", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ seedboxdonor: "yes" })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ seedboxdonor: "yes" })))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")
    const meta = stats.platformMeta as DigitalCorePlatformMeta

    expect(meta.seedboxDonor).toBe(true)
  })

  it("normalizes parkerad 1 to parked true", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ parkerad: 1 })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ parkerad: 1 })))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")
    const meta = stats.platformMeta as DigitalCorePlatformMeta

    expect(meta.parked).toBe(true)
  })

  it("normalizes downloadban 1 to downloadBan true", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ downloadban: 1 })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")
    const meta = stats.platformMeta as DigitalCorePlatformMeta

    expect(meta.downloadBan).toBe(true)
  })

  it("normalizes uploadban 1 to uploadBan true", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ uploadban: 1 })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")
    const meta = stats.platformMeta as DigitalCorePlatformMeta

    expect(meta.uploadBan).toBe(true)
  })

  it("normalizes connectable 1 to true, connectable 0 to false", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ connectable: 0 })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")
    const meta = stats.platformMeta as DigitalCorePlatformMeta

    expect(meta.connectable).toBe(false)
  })

  it("normalizes hnr_warned 'yes' to hnrWarned true", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ hnr_warned: "yes" })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ hnr_warned: "yes" })))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")
    const meta = stats.platformMeta as DigitalCorePlatformMeta

    expect(meta.hnrWarned).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DigitalCoreAdapter.fetchStats — class ID mapping
// ---------------------------------------------------------------------------

describe("DigitalCoreAdapter.fetchStats — class ID mapping", () => {
  const adapter = new DigitalCoreAdapter()
  const validToken = JSON.stringify({ uid: "54321", pass: "abc123xyz" })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const knownClasses: Array<[number, string]> = [
    [0, "Rogue"],
    [10, "Sentinel"],
    [20, "Viceroy"],
    [30, "Sentry"],
    [31, "Guardian"],
    [32, "Vanguard"],
    [50, "Uploader"],
    [51, "Titan"],
    [60, "Developer"],
    [70, "VIP"],
    [75, "FLS"],
    [80, "Moderator"],
    [90, "Administrator"],
  ]

  for (const [classId, expectedName] of knownClasses) {
    it(`maps class ID ${classId} to "${expectedName}"`, async () => {
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(mockResponse(mockStatusResponse({ class: classId })))
        .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ class: classId })))

      const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

      expect(stats.group).toBe(expectedName)
    })
  }

  it("falls back to 'Class N' for an unknown class ID", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ class: 99 })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ class: 99 })))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.group).toBe("Class 99")
  })
})

// ---------------------------------------------------------------------------
// DigitalCoreAdapter.fetchStats — enrichment (second call)
// ---------------------------------------------------------------------------

describe("DigitalCoreAdapter.fetchStats — enrichment", () => {
  const adapter = new DigitalCoreAdapter()
  const validToken = JSON.stringify({ uid: "54321", pass: "abc123xyz" })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("populates joinedDate and lastAccessDate from user profile", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.joinedDate).toBe("2021-06-15 09:00:00")
    expect(stats.lastAccessDate).toBe("2026-04-08 12:30:00")
  })

  it("populates leechingCount from peersLeecher in user profile", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ peersLeecher: 7 })))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.leechingCount).toBe(7)
  })

  it("overrides warned with user profile value (more authoritative)", async () => {
    // Status says not warned, profile says warned — profile wins
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ warned: "no" })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ warned: "yes" })))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.warned).toBe(true)
  })

  it("merges extended platformMeta fields from user profile", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")
    const meta = stats.platformMeta as DigitalCorePlatformMeta

    expect(meta.uploadedReal).toBe(536870912000)
    expect(meta.downloadedReal).toBe(134217728000)
    expect(meta.torrents).toBe(120)
    expect(meta.requests).toBe(5)
    expect(meta.forumPosts).toBe(42)
    expect(meta.torrentComments).toBe(10)
    expect(meta.invitees).toBe(7)
    expect(meta.hearts).toBe(2)
  })

  it("preserves baseMeta fields after enrichment merge", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ donor: "yes", crown: 1, pokal: 1 })))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")
    const meta = stats.platformMeta as DigitalCorePlatformMeta

    // baseMeta fields must survive the enrichment merge
    expect(meta.donor).toBe(true)
    expect(meta.crown).toBe(true)
    expect(meta.pokal).toBe(true)
  })

  it("uses options.remoteUserId for the enrichment call URL when provided", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse({ id: 99999 })))

    await adapter.fetchStats("https://digitalcore.club", validToken, "", {
      remoteUserId: 99999,
    })

    const enrichmentUrl = fetchSpy.mock.calls[1][0] as string
    expect(enrichmentUrl).toContain("/api/v1/users/99999")
  })

  it("falls back to status user.id for enrichment URL when remoteUserId not provided", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    await adapter.fetchStats("https://digitalcore.club", validToken, "")

    const enrichmentUrl = fetchSpy.mock.calls[1][0] as string
    expect(enrichmentUrl).toContain("/api/v1/users/54321")
  })
})

// ---------------------------------------------------------------------------
// DigitalCoreAdapter.fetchStats — enrichment failure fallback
// ---------------------------------------------------------------------------

describe("DigitalCoreAdapter.fetchStats — enrichment failure fallback", () => {
  const adapter = new DigitalCoreAdapter()
  const validToken = JSON.stringify({ uid: "54321", pass: "abc123xyz" })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("still returns core stats when enrichment call throws a network error", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockRejectedValueOnce(new Error("network error"))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.username).toBe("dcuser")
    expect(stats.uploadedBytes).toBe(BigInt(536870912000))
    expect(stats.downloadedBytes).toBe(BigInt(134217728000))
  })

  it("retains baseMeta (not undefined) when enrichment fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse({ donor: "yes", invites: 3 })))
      .mockRejectedValueOnce(new Error("timeout"))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")
    const meta = stats.platformMeta as DigitalCorePlatformMeta

    expect(meta).toBeDefined()
    expect(meta.donor).toBe(true)
    expect(meta.invites).toBe(3)
  })

  it("leaves joinedDate and lastAccessDate undefined when enrichment fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockRejectedValueOnce(new Error("network error"))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.joinedDate).toBeUndefined()
    expect(stats.lastAccessDate).toBeUndefined()
  })

  it("leaves leechingCount at 0 when enrichment fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockRejectedValueOnce(new Error("network error"))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    // leechingCount comes only from enrichment; falls back to initialised-to-0 value
    expect(stats.leechingCount).toBe(0)
  })

  it("logs a warning (does not throw) when enrichment fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockRejectedValueOnce(new Error("upstream timeout"))

    await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toMatch(/\[digitalcore\].*Enrichment failed/i)
  })

  it("still returns stats when enrichment returns a non-ok HTTP response", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockErrorResponse(500))

    const stats = await adapter.fetchStats("https://digitalcore.club", validToken, "")

    expect(stats.username).toBe("dcuser")
  })
})

// ---------------------------------------------------------------------------
// DigitalCoreAdapter.fetchStats — 401 / error responses
// ---------------------------------------------------------------------------

describe("DigitalCoreAdapter.fetchStats — HTTP error handling", () => {
  const adapter = new DigitalCoreAdapter()
  const validToken = JSON.stringify({ uid: "54321", pass: "abc123xyz" })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("throws session-expired message on 401 from status endpoint", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockErrorResponse(401))

    await expect(adapter.fetchStats("https://digitalcore.club", validToken, "")).rejects.toThrow(
      "Session expired"
    )
  })

  it("throws session-expired on 401 from enrichment (auth errors propagate)", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockErrorResponse(401))

    // Auth failures during enrichment are NOT swallowed. They propagate so
    // the user knows their cookies need refreshing.
    await expect(adapter.fetchStats("https://digitalcore.club", validToken, "")).rejects.toThrow(
      "Session expired"
    )
  })

  it("throws on non-401 non-ok response from status endpoint", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockErrorResponse(503))

    await expect(adapter.fetchStats("https://digitalcore.club", validToken, "")).rejects.toThrow(
      "503"
    )
  })

  it("throws with sanitized message on network failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("fetch failed"))

    await expect(adapter.fetchStats("https://digitalcore.club", validToken, "")).rejects.toThrow(
      "Failed to connect to digitalcore.club"
    )
  })

  it("throws a timeout message when AbortSignal fires", async () => {
    const timeoutError = new DOMException("signal timed out", "TimeoutError")
    vi.spyOn(global, "fetch").mockRejectedValueOnce(timeoutError)

    await expect(adapter.fetchStats("https://digitalcore.club", validToken, "")).rejects.toThrow(
      "timed out"
    )
  })

  it("throws when status response is missing user data", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockResponse({ user: null, settings: {} }))

    await expect(adapter.fetchStats("https://digitalcore.club", validToken, "")).rejects.toThrow(
      "missing user data"
    )
  })

  it("throws when status response is missing upload/download fields", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      mockResponse({
        user: { id: 1, username: "dcuser", class: 20, uploaded: undefined, downloaded: undefined },
        settings: {},
      })
    )

    await expect(adapter.fetchStats("https://digitalcore.club", validToken, "")).rejects.toThrow(
      "missing upload/download data"
    )
  })
})

// ---------------------------------------------------------------------------
// parseJsonSafe — HTML/Cloudflare/invalid JSON detection
// ---------------------------------------------------------------------------

describe("DigitalCoreAdapter.fetchStats — non-JSON response handling", () => {
  const adapter = new DigitalCoreAdapter()
  const validToken = JSON.stringify({ uid: "54321", pass: "abc123xyz" })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("throws a clear message when the API returns an HTML page (maintenance)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "<!DOCTYPE html><html><body>Maintenance</body></html>",
    } as Response)

    await expect(adapter.fetchStats("https://digitalcore.club", validToken, "")).rejects.toThrow(
      "HTML instead of JSON"
    )
  })

  it("throws a clear message when the API returns a Cloudflare challenge page", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () =>
        "<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>",
    } as Response)

    await expect(adapter.fetchStats("https://digitalcore.club", validToken, "")).rejects.toThrow(
      "HTML instead of JSON"
    )
  })

  it("throws invalid JSON message for non-HTML non-JSON responses", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "this is not json or html",
    } as Response)

    await expect(adapter.fetchStats("https://digitalcore.club", validToken, "")).rejects.toThrow(
      "invalid JSON"
    )
  })

  it("handles empty response body gracefully", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
    } as Response)

    await expect(adapter.fetchStats("https://digitalcore.club", validToken, "")).rejects.toThrow(
      "invalid JSON"
    )
  })
})

// ---------------------------------------------------------------------------
// DigitalCoreAdapter.fetchStats — cookie header construction
// ---------------------------------------------------------------------------

describe("DigitalCoreAdapter.fetchStats — cookie header", () => {
  const adapter = new DigitalCoreAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("sends uid and pass as Cookie header", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const token = JSON.stringify({ uid: "54321", pass: "secretpass" })
    await adapter.fetchStats("https://digitalcore.club", token, "")

    const fetchOptions = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = fetchOptions.headers as Record<string, string>
    expect(headers.Cookie).toBe("uid=54321; pass=secretpass")
  })

  it("hits the /api/v1/status endpoint for the first call", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    await adapter.fetchStats(
      "https://digitalcore.club",
      JSON.stringify({ uid: "1", pass: "p" }),
      ""
    )

    const statusUrl = fetchSpy.mock.calls[0][0] as string
    expect(statusUrl).toBe("https://digitalcore.club/api/v1/status")
  })
})

// ---------------------------------------------------------------------------
// DigitalCoreAdapter.fetchRaw
// ---------------------------------------------------------------------------

describe("DigitalCoreAdapter.fetchRaw", () => {
  const adapter = new DigitalCoreAdapter()
  const validToken = JSON.stringify({ uid: "54321", pass: "abc123xyz" })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns two DebugApiCall entries on full success", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const calls = await adapter.fetchRaw("https://digitalcore.club", validToken, "")

    expect(calls).toHaveLength(2)
    expect(calls[0].label).toBe("Status")
    expect(calls[0].endpoint).toBe("/api/v1/status")
    expect(calls[0].data).toBeDefined()
    expect(calls[0].error).toBeNull()

    expect(calls[1].label).toBe("User Profile")
    expect(calls[1].endpoint).toBe("/api/v1/users/54321")
    expect(calls[1].data).toBeDefined()
    expect(calls[1].error).toBeNull()
  })

  it("returns only the status entry (with error) when status call fails", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("network failure"))

    const calls = await adapter.fetchRaw("https://digitalcore.club", validToken, "")

    expect(calls).toHaveLength(1)
    expect(calls[0].label).toBe("Status")
    expect(calls[0].data).toBeNull()
    expect(calls[0].error).toMatch(/network failure|Failed to connect/)
  })

  it("captures error on user profile call when that call fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockRejectedValueOnce(new Error("profile timeout"))

    const calls = await adapter.fetchRaw("https://digitalcore.club", validToken, "")

    expect(calls).toHaveLength(2)
    expect(calls[1].label).toBe("User Profile")
    expect(calls[1].data).toBeNull()
    expect(calls[1].error).toMatch(/profile timeout|Failed to connect/)
  })

  it("uses options.remoteUserId in user profile endpoint when provided", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse(mockStatusResponse()))
      .mockResolvedValueOnce(mockResponse(mockUserProfileResponse()))

    const calls = await adapter.fetchRaw("https://digitalcore.club", validToken, "", {
      remoteUserId: 77777,
    })

    expect(calls[1].endpoint).toBe("/api/v1/users/77777")
  })

  it("throws immediately on invalid credentials before any fetch", async () => {
    await expect(adapter.fetchRaw("https://digitalcore.club", "not-json", "")).rejects.toThrow(
      "DigitalCore credentials"
    )
  })
})
