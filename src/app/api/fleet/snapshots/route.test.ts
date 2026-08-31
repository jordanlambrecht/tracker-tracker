// src/app/api/fleet/snapshots/route.test.ts
//
// Regression tests for GET /api/fleet/snapshots day-range handling.
//
// The route used to clamp with Math.max(1, days), so the "All" sentinel (days=0)
// became a ONE DAY window, it could not express all-history at all. It also built
// its cutoff unconditionally: `new Date(Date.now() - 0)` is *now*, so a naive
// days=0 path would filter with gte(polledAt, now) and return nothing.
//
// These assert on the WHERE clause actually handed to Drizzle, not just the status.

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { GET } from "./route"

vi.mock("@/lib/api-helpers", () => ({
  authenticate: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    selectDistinctOn: vi.fn(),
  },
}))

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const CLIENT = { id: 1, name: "qbit" }

interface Captured {
  /** WHERE argument for the snapshot query. undefined === no time filter. */
  where: unknown
  /** True when the route ran the min(polledAt) span probe (the days=0 path). */
  spanProbed: boolean
  /** date_trunc bucket the route chose, or null when it selected raw rows. */
  bucket: string | null
}

/** Recursively collects every string reachable from a (circular) Drizzle SQL node. */
function collectStrings(node: unknown, seen = new Set<unknown>(), out: string[] = []): string[] {
  if (typeof node === "string") {
    out.push(node)
    return out
  }
  if (!node || typeof node !== "object" || seen.has(node)) return out
  seen.add(node)
  for (const value of Object.values(node as Record<string, unknown>)) {
    collectStrings(value, seen, out)
  }
  return out
}

/**
 * Wires db.select / db.selectDistinctOn by inspecting the requested columns, so the
 * assertions do not depend on the route's internal call ordering.
 *
 * @param oldestPolledAt oldest stored snapshot, or null for an empty table.
 */
function mockDb(oldestPolledAt: Date | null, snapshots: unknown[] = []): Captured {
  const captured: Captured = { where: "NOT_CALLED", spanProbed: false, bucket: null }

  ;(db.select as ReturnType<typeof vi.fn>).mockImplementation(
    (columns: Record<string, unknown>) => {
      const keys = Object.keys(columns ?? {})

      // The span probe: db.select({ polledAt }).from().orderBy().limit(1)
      if (keys.length === 1 && keys[0] === "polledAt") {
        captured.spanProbed = true
        return {
          from: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve(oldestPolledAt ? [{ polledAt: oldestPolledAt }] : []),
            }),
          }),
        }
      }

      // The download-client name lookup.
      if (keys.includes("id") && keys.includes("name")) {
        return { from: () => Promise.resolve([CLIENT]) }
      }

      // Unbucketed (raw) snapshot query.
      return {
        from: () => ({
          where: (arg: unknown) => {
            captured.where = arg
            captured.bucket = null
            return Promise.resolve(snapshots)
          },
        }),
      }
    }
  )
  ;(db.selectDistinctOn as ReturnType<typeof vi.fn>).mockImplementation(
    (distinctCols: unknown[]) => {
      // The bucket literal is embedded via sql.raw in the second distinct-on column.
      // Drizzle SQL nodes are circular (column -> table -> column), so walk rather
      // than stringify.
      const strings = collectStrings(distinctCols?.[1])
      captured.bucket = strings.some((s) => s.includes("'hour'"))
        ? "hour"
        : strings.some((s) => s.includes("'day'"))
          ? "day"
          : "unknown"
      return {
        from: () => ({
          where: (arg: unknown) => {
            captured.where = arg
            return { orderBy: () => Promise.resolve(snapshots) }
          },
        }),
      }
    }
  )

  return captured
}

function get(query: string) {
  return GET(new Request(`http://localhost/api/fleet/snapshots${query}`))
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 })
})

describe("GET /api/fleet/snapshots", () => {
  it("applies NO time filter for days=0 (All)", async () => {
    // 400 days of history: comfortably past FLEET_SNAPSHOT_QUERY_MAX (365), which
    // a clamped implementation could never reach.
    const captured = mockDb(new Date(Date.now() - 400 * 86_400_000))

    const response = await get("?days=0")

    expect(response.status).toBe(200)
    expect(captured.spanProbed).toBe(true)
    // The whole point: no cutoff predicate at all.
    expect(captured.where).toBeUndefined()
  })

  it("applies a time filter for a bounded range", async () => {
    const captured = mockDb(new Date(Date.now() - 400 * 86_400_000))

    const response = await get("?days=7")

    expect(response.status).toBe(200)
    expect(captured.spanProbed).toBe(false)
    expect(captured.where).toBeDefined()
    expect(captured.where).not.toBeUndefined()
  })

  it("defaults to 7 days when the param is missing", async () => {
    const captured = mockDb(new Date(Date.now() - 400 * 86_400_000))

    await get("")

    // A missing param must NOT be read as the All sentinel.
    expect(captured.spanProbed).toBe(false)
    expect(captured.where).toBeDefined()
  })

  it("defaults to 7 days for a non-numeric param", async () => {
    const captured = mockDb(new Date(Date.now() - 400 * 86_400_000))

    await get("?days=abc")

    expect(captured.spanProbed).toBe(false)
    expect(captured.where).toBeDefined()
  })

  // Buckets for days=0 follow the ACTUAL span of stored data. getSnapshotBucket(0)
  // hardcodes "day", which on a shallow database collapses every client to a single
  // point, making "All" coarser than any bounded range and firing the charts'
  // "need at least 2 days of data" empty states.
  it("uses hourly buckets for days=0 when history is shallow", async () => {
    const captured = mockDb(new Date(Date.now() - 10 * 86_400_000))

    await get("?days=0")

    expect(captured.bucket).toBe("hour")
  })

  it("uses raw rows for days=0 when history is under two days", async () => {
    const captured = mockDb(new Date(Date.now() - 18 * 60 * 60 * 1000))

    await get("?days=0")

    expect(captured.bucket).toBeNull()
    expect(captured.where).toBeUndefined()
  })

  it("uses daily buckets for days=0 over a long history", async () => {
    const captured = mockDb(new Date(Date.now() - 400 * 86_400_000))

    await get("?days=0")

    expect(captured.bucket).toBe("day")
  })

  it("returns an empty array when no snapshots exist", async () => {
    mockDb(null)

    const response = await get("?days=0")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
  })

  it("returns 401 when unauthenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const response = await get("?days=0")

    expect(response.status).toBe(401)
  })
})
