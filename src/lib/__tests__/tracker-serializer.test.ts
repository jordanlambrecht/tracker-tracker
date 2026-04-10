// src/lib/__tests__/tracker-serializer.test.ts
import { describe, expect, it } from "vitest"
import { parsePlatformMeta, serializeTrackerResponse } from "@/lib/tracker-serializer"

const mockTracker = {
  id: 1,
  name: "Test Tracker",
  baseUrl: "https://example.com",
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
  it("serializes tracker without stats", () => {
    const result = serializeTrackerResponse(mockTracker, null, (v) => v ?? null)
    expect(result.id).toBe(1)
    expect(result.latestStats).toBeNull()
    expect(result).not.toHaveProperty("encryptedApiToken")
  })
  it("serializes tracker with stats and applies privacy mask", () => {
    const mask = () => "▓▓▓"
    const result = serializeTrackerResponse(mockTracker, mockSnapshot, mask)
    expect(result.latestStats?.username).toBe("▓▓▓")
    expect(result.latestStats?.uploadedBytes).toBe("1000")
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
