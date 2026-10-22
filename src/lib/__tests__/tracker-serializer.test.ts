// src/lib/__tests__/tracker-serializer.test.ts
import { describe, expect, it } from "vitest"
import { ALL_TRACKERS } from "@/data/trackers"
import { parsePlatformMeta, serializeTrackerResponse } from "@/lib/tracker-serializer"

const mockTracker = {
  id: 1,
  name: "Test Tracker",
  baseUrl: "https://example.com",
  registrySlug: null,
  apiPath: "/api/user",
  platformType: "unit3d",
  encryptedApiToken: "should-never-appear",
  isActive: true,
  lastPolledAt: new Date("2026-01-01"),
  lastError: null,
  lastErrorAt: null,
  consecutiveFailures: 0,
  pausedAt: null,
  userPausedAt: null,
  color: "#00d4ff",
  qbtTag: null,
  mouseholeUrl: null,
  hasMouseholeToken: false,
  hideUnreadBadges: false,
  remoteUserId: null,
  platformMeta: null,
  avatarData: null,
  avatarMimeType: null,
  avatarCachedAt: null,
  avatarRemoteUrl: null,
  useProxy: false,
  countCrossSeedUnsatisfied: false,
  isFavorite: false,
  sortOrder: null,
  joinedAt: null,
  lastAccessAt: null,
  profileUrl: null,
  prowlarrInstanceId: null,
  prowlarrIndexerId: null,
  prowlarrOptOut: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

const mockSnapshot = {
  id: 1,
  trackerId: 1,
  polledAt: new Date("2026-01-01"),
  ratio: 2.5,
  uploadedBytes: BigInt(1000),
  downloadedBytes: BigInt(500),
  seedingCount: 10,
  leechingCount: 2,
  requiredRatio: null,
  warned: false,
  freeleechTokens: null,
  username: "testuser",
  group: "Elite",
  bufferBytes: BigInt(500),
  seedbonus: null,
  hitAndRuns: null,
  shareScore: null,
  isManual: false,
}

describe("parsePlatformMeta", () => {
  it("returns null for null input", () => {
    expect(parsePlatformMeta(null)).toBeNull()
  })
  it("parses valid JSON", () => {
    expect(parsePlatformMeta('{"rank":"Elite"}')).toEqual({ rank: "Elite" })
  })
  it("returns null for malformed JSON", () => {
    expect(parsePlatformMeta("{broken")).toBeNull()
  })
})

describe("serializeTrackerResponse", () => {
  it("has no overview for a tracker that never reported one", () => {
    expect(serializeTrackerResponse(mockTracker, null, (v) => v ?? null).overview).toBeNull()
  })

  it("serializes tracker without stats", () => {
    const result = serializeTrackerResponse(mockTracker, null, (v) => v ?? null)
    expect(result.id).toBe(1)
    expect(result.latestStats).toBeNull()
    expect(result).not.toHaveProperty("encryptedApiToken")
  })
  it("exposes hasMouseholeToken as a boolean and never the ciphertext column", () => {
    // A variable rather than a literal, because the input type omits the
    // ciphertext column; the row still carries it, as a careless caller's would.
    const row = {
      ...mockTracker,
      hasMouseholeToken: true,
      encryptedMouseholeToken: "ciphertext-must-not-appear",
    }
    const result = serializeTrackerResponse(row, null, (v) => v ?? null)
    expect(result.hasMouseholeToken).toBe(true)
    expect(result).not.toHaveProperty("encryptedMouseholeToken")
    expect(JSON.stringify(result)).not.toContain("ciphertext-must-not-appear")
  })
  it("serializes tracker with stats and applies privacy mask", () => {
    const mask = () => "▓▓▓"
    const result = serializeTrackerResponse(mockTracker, mockSnapshot, mask)
    expect(result.latestStats?.username).toBe("▓▓▓")
    expect(result.latestStats?.uploadedBytes).toBe("1000")
  })
})

describe("serializeTrackerResponse infinite ratio", () => {
  it("reports an infinite ratio, not a stored 0, when nothing was downloaded", () => {
    const snapshot = { ...mockSnapshot, ratio: 0, downloadedBytes: BigInt(0) }
    const result = serializeTrackerResponse(mockTracker, snapshot, (v) => v ?? null)
    expect(result.latestStats?.ratioIsInfinite).toBe(true)
    expect(result.latestStats?.ratio).toBeNull()
  })
})

describe("serializeTrackerResponse new fields", () => {
  it("serializes bufferBytes as decimal string", () => {
    const snapshotWithBuffer = { ...mockSnapshot, bufferBytes: BigInt(10737418240) }
    const result = serializeTrackerResponse(mockTracker, snapshotWithBuffer, (v) => v ?? null)
    expect(result.latestStats?.bufferBytes).toBe("10737418240")
  })

  it("serializes null bufferBytes as null", () => {
    const snapshotWithNullBuffer = { ...mockSnapshot, bufferBytes: null }
    const result = serializeTrackerResponse(mockTracker, snapshotWithNullBuffer, (v) => v ?? null)
    expect(result.latestStats?.bufferBytes).toBeNull()
  })

  it("serializes hitAndRuns, seedbonus, shareScore when present", () => {
    const snapshotWithStats = {
      ...mockSnapshot,
      hitAndRuns: 2,
      seedbonus: 1500.5,
      shareScore: 3.14,
    }
    const result = serializeTrackerResponse(mockTracker, snapshotWithStats, (v) => v ?? null)
    expect(result.latestStats?.hitAndRuns).toBe(2)
    expect(result.latestStats?.seedbonus).toBe(1500.5)
    expect(result.latestStats?.shareScore).toBe(3.14)
  })

  it("serializes null hitAndRuns, seedbonus, shareScore as null", () => {
    const snapshotWithNulls = {
      ...mockSnapshot,
      hitAndRuns: null,
      seedbonus: null,
      shareScore: null,
    }
    const result = serializeTrackerResponse(mockTracker, snapshotWithNulls, (v) => v ?? null)
    expect(result.latestStats?.hitAndRuns).toBeNull()
    expect(result.latestStats?.seedbonus).toBeNull()
    expect(result.latestStats?.shareScore).toBeNull()
  })
})

describe("serializeTrackerResponse userPausedAt", () => {
  it("serializes userPausedAt as ISO string when set", () => {
    const tracker = { ...mockTracker, userPausedAt: new Date("2026-03-21T12:00:00Z") }
    const result = serializeTrackerResponse(tracker, null, (v) => v ?? null)
    expect(result.userPausedAt).toBe("2026-03-21T12:00:00.000Z")
  })

  it("serializes null userPausedAt as null", () => {
    const result = serializeTrackerResponse(mockTracker, null, (v) => v ?? null)
    expect(result.userPausedAt).toBeNull()
  })
})

describe("serializeTrackerResponse tracker list fields", () => {
  const keep = (v: string | null | undefined) => v ?? null

  it("serializes a linked row whose stored copies match its entry unchanged, plus linked", () => {
    const row = { ...mockTracker, registrySlug: "aither", baseUrl: "https://aither.cc" }
    expect(serializeTrackerResponse(row, mockSnapshot, keep)).toEqual({
      id: 1,
      name: "Test Tracker",
      baseUrl: "https://aither.cc",
      registrySlug: "aither",
      platformType: "unit3d",
      linked: true,
      duplicateOf: null,
      isActive: true,
      lastPolledAt: "2026-01-01T00:00:00.000Z",
      lastError: null,
      lastErrorAt: null,
      consecutiveFailures: 0,
      pausedAt: null,
      userPausedAt: null,
      color: "#00d4ff",
      qbtTag: null,
      mouseholeUrl: null,
      hasMouseholeToken: false,
      useProxy: false,
      countCrossSeedUnsatisfied: false,
      hideUnreadBadges: false,
      isFavorite: false,
      sortOrder: null,
      joinedAt: null,
      lastAccessAt: null,
      remoteUserId: null,
      platformMeta: null,
      overview: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      prowlarrPin: null,
      prowlarrOptOut: false,
      prowlarr: null,
      latestStats: {
        ratioIsInfinite: false,
        ratio: 2.5,
        uploadedBytes: "1000",
        downloadedBytes: "500",
        seedingCount: 10,
        leechingCount: 2,
        requiredRatio: null,
        warned: false,
        freeleechTokens: null,
        bufferBytes: "500",
        hitAndRuns: null,
        seedbonus: null,
        shareScore: null,
        username: "testuser",
        group: "Elite",
      },
    })
  })

  it.each([
    ["orpheus", "https://orpheus.network", "gazelle"],
    ["myanonamouse", "https://www.myanonamouse.net", "mam"],
    // A shut-down entry is still in the list, so its row stays linked
    ["fearnopeer", "https://fearnopeer.com", "unit3d"],
  ])("keeps the address and platform of a linked %s row", (slug, url, platform) => {
    const row = { ...mockTracker, registrySlug: slug, baseUrl: url, platformType: platform }
    expect(serializeTrackerResponse(row, null, keep)).toMatchObject({
      baseUrl: url,
      platformType: platform,
      linked: true,
    })
  })

  it("sends a linked row's address and platform from its entry, not its stale copies", () => {
    const row = {
      ...mockTracker,
      registrySlug: "animebytes",
      baseUrl: "https://old-host.example",
      platformType: "gazelle",
    }
    expect(serializeTrackerResponse(row, null, keep)).toMatchObject({
      baseUrl: "https://animebytes.tv",
      platformType: "animebytes",
      registrySlug: "animebytes",
      linked: true,
    })
  })

  const draftSlug = ALL_TRACKERS.find((t) => t.draft)?.slug

  it.each([
    ["no slug", null],
    ["a slug the list no longer has", "gone-tracker"],
    ["a draft entry's slug", draftSlug],
  ])("keeps the stored copies of a row with %s and marks it unlinked", (_, slug) => {
    expect(slug, "the registry has no draft entry left to test with").not.toBeUndefined()
    const row = {
      ...mockTracker,
      registrySlug: slug ?? null,
      baseUrl: "https://old-host.example",
      platformType: "gazelle",
    }
    expect(serializeTrackerResponse(row, null, keep)).toMatchObject({
      baseUrl: "https://old-host.example",
      platformType: "gazelle",
      registrySlug: slug ?? null,
      linked: false,
    })
  })
})
