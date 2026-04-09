// src/lib/__tests__/snapshot-bucket.test.ts
//
// Tests for getSnapshotBucket — the pure bucketing function that picks
// a date_trunc granularity based on the requested day range.
//
// Boundary map:
//   days <= 0        -> "day"  (all-time / edge)
//   days 1-2         -> null   (raw, no bucketing)
//   days 3-90        -> "hour"
//   days >= 91       -> "day"

// ---------------------------------------------------------------------------
// Mocks required before server-only imports
// ---------------------------------------------------------------------------

import { vi } from "vitest"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/db", () => ({
  db: {
    select: vi
      .fn()
      .mockReturnValue({ from: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }),
    execute: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: {},
  trackers: {},
  trackerSnapshots: {},
  downloadClients: {},
  notificationTargets: {},
  dbSizeHistory: {},
  tagGroups: {},
  tagGroupMembers: {},
}))

vi.mock("@/lib/privacy-db", () => ({
  createPrivacyMaskSync: vi.fn().mockReturnValue((v: string | null) => v),
}))

vi.mock("@/lib/download-clients/qbt/qbitmanage-defaults", () => ({
  parseQbitmanageTags: vi.fn().mockReturnValue({}),
}))

vi.mock("@/lib/tracker-serializer", () => ({
  serializeTrackerResponse: vi.fn(),
}))

vi.mock("@/lib/constants", () => ({
  DEFAULT_TRACKER_COLOR: "#00d4ff",
}))

vi.mock("@/lib/formatters", () => ({
  localDateStr: vi.fn((d: Date) => d.toISOString().slice(0, 10)),
}))

vi.mock("@/lib/limits", () => ({
  SNAPSHOT_QUERY_MAX: 365,
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest"
import { getSnapshotBucket } from "@/lib/server-data"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getSnapshotBucket", () => {
  // ---- null (raw) range: days 1-2 -----------------------------------------

  it("returns null for days = 1 (raw snapshots, no bucketing)", () => {
    expect(getSnapshotBucket(1)).toBeNull()
  })

  it("returns null for days = 2 (upper edge of raw window)", () => {
    expect(getSnapshotBucket(2)).toBeNull()
  })

  // ---- "hour" range: days 3-90 --------------------------------------------

  it("returns 'hour' for days = 3 (lower edge of hourly window)", () => {
    expect(getSnapshotBucket(3)).toBe("hour")
  })

  it("returns 'hour' for days = 30 (typical monthly view)", () => {
    expect(getSnapshotBucket(30)).toBe("hour")
  })

  it("returns 'hour' for days = 90 (upper edge of hourly window)", () => {
    expect(getSnapshotBucket(90)).toBe("hour")
  })

  // ---- "day" range: days > 90 or days <= 0 --------------------------------

  it("returns 'day' for days = 91 (first value past hourly window)", () => {
    expect(getSnapshotBucket(91)).toBe("day")
  })

  it("returns 'day' for days = 365 (full year)", () => {
    expect(getSnapshotBucket(365)).toBe("day")
  })

  it("returns 'day' for days = 0 (all-time query)", () => {
    expect(getSnapshotBucket(0)).toBe("day")
  })

  it("returns 'day' for negative days (invalid input falls to else branch)", () => {
    expect(getSnapshotBucket(-1)).toBe("day")
  })
})
