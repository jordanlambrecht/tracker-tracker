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
  color: "#00d4ff",
  qbtTag: null,
  remoteUserId: null,
  platformMeta: null,
  avatarData: null,
  avatarCachedAt: null,
  avatarRemoteUrl: null,
  useProxy: false,
  countCrossSeedUnsatisfied: false,
  isFavorite: false,
  sortOrder: null,
  joinedAt: null,
  lastAccessAt: null,
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
