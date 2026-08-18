// src/lib/__tests__/tracker-outages.test.ts
//
// The tracker connectability ledger is the only thing standing between "this
// tracker was unreachable here" and a fabricated band, so every write path is
// pinned: when a failure opens a new outage, when it extends the current one,
// and the two places the distinction can go wrong — a configurable poll interval
// and a clock that jumps backwards.
//
// The load-bearing negative is pinned too: recording is FAILURE-ONLY. Nothing
// here reaches toward the successful polls on either side of an outage, because
// the app never observed the tracker's state in between. See the header of
// tracker-outages.ts for why that differs from app-liveness.ts on purpose.
//
// Fake timers throughout. No real sleeps.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { db } from "@/lib/db"
import { appSettings, trackerOutages } from "@/lib/db/schema"
import { POLL_INTERVAL_DEFAULT } from "@/lib/limits"
import {
  getTrackerOutages,
  OUTAGE_STITCH_INTERVALS,
  OUTAGE_STITCH_TOLERANCE_MS,
  pruneTrackerOutages,
  recordTrackerPollFailure,
  trackerOutageStitchWindowMs,
} from "@/lib/tracker-outages"

const MINUTE = 60_000
const T0 = Date.UTC(2026, 7, 1, 12, 0, 0)
const TRACKER = 42

interface Call {
  table: unknown
  method: string
  args: unknown[]
}

let calls: Call[] = []

/** Same Drizzle-shaped chain the app-liveness tests use. */
function chain(table: unknown, result: unknown): Record<string, unknown> {
  const settled = Promise.resolve(result)
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return settled.then.bind(settled)
        if (prop === "catch") return settled.catch.bind(settled)
        if (prop === "finally") return settled.finally.bind(settled)
        return (...args: unknown[]) => {
          calls.push({ table, method: String(prop), args })
          return proxy
        }
      },
    }
  )
  return proxy
}

interface SeedData {
  /** null means the settings row does not exist at all. */
  pollIntervalMinutes: number | null
  /** The most recent outage row for the tracker, if any. */
  latest: Array<{ id: number; endedAt: Date }>
  /** Rows getTrackerOutages should hand back. */
  rows: Array<{ startedAt: Date; endedAt: Date; reason: string }>
  deleted: Array<{ id: number }>
}

function seed(data: Partial<SeedData> = {}) {
  const full: SeedData = {
    pollIntervalMinutes: 15,
    latest: [],
    rows: [],
    deleted: [],
    ...data,
  }

  vi.mocked(db.select).mockImplementation(((columns: Record<string, unknown>) => {
    const keys = Object.keys(columns ?? {})
    if (keys.includes("trackerPollIntervalMinutes")) {
      return chain(
        appSettings,
        full.pollIntervalMinutes === null
          ? []
          : [{ trackerPollIntervalMinutes: full.pollIntervalMinutes }]
      )
    }
    // `{ id, endedAt }` is the latest-row probe; `{ startedAt, endedAt, reason }`
    // is the read path. Only the latter names startedAt.
    if (keys.includes("startedAt")) return chain(trackerOutages, full.rows)
    return chain(trackerOutages, full.latest)
  }) as never)

  vi.mocked(db.insert).mockImplementation(((table: unknown) => chain(table, undefined)) as never)
  vi.mocked(db.update).mockImplementation(((table: unknown) => chain(table, undefined)) as never)
  vi.mocked(db.delete).mockImplementation(((table: unknown) =>
    chain(table, full.deleted)) as never)

  return full
}

function insertedValues(): Record<string, unknown>[] {
  return calls
    .filter((c) => c.table === trackerOutages && c.method === "values")
    .map((c) => c.args[0] as Record<string, unknown>)
}

function updatedValues(): Record<string, unknown>[] {
  return calls
    .filter((c) => c.table === trackerOutages && c.method === "set")
    .map((c) => c.args[0] as Record<string, unknown>)
}

/**
 * Column names compared by a Drizzle condition.
 *
 * Follows `queryChunks` and nothing else. That recursion is what makes an
 * `and(...)` of several comparisons readable, while still never reaching a
 * column's `.table` back-reference — a walk that followed arbitrary properties
 * would enumerate every column on the table and make "does this filter on
 * endedAt?" unanswerable.
 */
function comparedColumns(condition: unknown): string[] {
  const out: string[] = []
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== "object") return
    if (Array.isArray(node)) {
      for (const child of node) visit(child)
      return
    }
    const chunks = (node as { queryChunks?: unknown }).queryChunks
    if (chunks !== undefined) {
      visit(chunks)
      return
    }
    const name = (node as { name?: unknown }).name
    if (typeof name === "string") out.push(name)
  }
  visit(condition)
  return out
}

/** Literal SQL fragments in a condition, e.g. ["", " < ", ""] for lt(). */
function conditionOperators(condition: unknown): string {
  const out: string[] = []
  const visit = (n: unknown): void => {
    if (n === null || typeof n !== "object") return
    if (Array.isArray(n)) { for (const c of n) visit(c); return }
    const chunks = (n as { queryChunks?: unknown }).queryChunks
    if (chunks !== undefined) { visit(chunks); return }
    const v = (n as { value?: unknown }).value
    if (Array.isArray(v)) { for (const c of v) if (typeof c === "string") out.push(c) }
  }
  visit(condition)
  return out.join("|")
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(T0))
  vi.clearAllMocks()
  calls = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe("trackerOutageStitchWindowMs", () => {
  it("scales with the configured interval instead of being a fixed constant", () => {
    // A fixed window would reduce an hourly poller to a string of zero-length
    // rows, every one below MIN_BAND_MS, and the feature would draw nothing.
    expect(trackerOutageStitchWindowMs(15)).toBe(15 * MINUTE * OUTAGE_STITCH_INTERVALS + OUTAGE_STITCH_TOLERANCE_MS)
    expect(trackerOutageStitchWindowMs(60)).toBe(60 * MINUTE * OUTAGE_STITCH_INTERVALS + OUTAGE_STITCH_TOLERANCE_MS)
    expect(trackerOutageStitchWindowMs(60)).toBeGreaterThan(trackerOutageStitchWindowMs(15))
  })

  it("forgives at least one late batch, matching the scheduler's own tolerance", () => {
    expect(trackerOutageStitchWindowMs(15)).toBeGreaterThan(15 * MINUTE)
  })
})

describe("recordTrackerPollFailure", () => {
  it("opens a zero-length outage on the first observed failure", async () => {
    seed({ latest: [] })
    await recordTrackerPollFailure(TRACKER, "poll", T0)

    expect(insertedValues()).toEqual([
      {
        trackerId: TRACKER,
        startedAt: new Date(T0),
        endedAt: new Date(T0),
        reason: "poll",
      },
    ])
    expect(updatedValues()).toEqual([])
  })

  it("anchors at the failure, NEVER at the last successful poll", async () => {
    // The head anchor is the whole reason a month-long user pause cannot become
    // a month-long "unreachable" band. startedAt must be the observed instant.
    seed({ latest: [] })
    await recordTrackerPollFailure(TRACKER, "poll", T0)

    expect(insertedValues()[0].startedAt).toEqual(new Date(T0))
  })

  it("extends the open outage when the next failure lands inside the stitch window", async () => {
    seed({ latest: [{ id: 9, endedAt: new Date(T0) }] })
    await recordTrackerPollFailure(TRACKER, "poll", T0 + 15 * MINUTE)

    expect(updatedValues()).toEqual([{ endedAt: new Date(T0 + 15 * MINUTE) }])
    expect(insertedValues()).toEqual([])
  })

  it("keeps a single missed cycle from shattering one outage into two", async () => {
    // One skipped sweep is routine — a late batch, a slow tracker, a restart.
    // Treating it as a recovery would produce a run of zero-length rows, every
    // one filtered out at render, and the band would silently never appear.
    seed({ latest: [{ id: 9, endedAt: new Date(T0) }] })
    await recordTrackerPollFailure(TRACKER, "poll", T0 + 30 * MINUTE)

    expect(updatedValues()).toHaveLength(1)
    expect(insertedValues()).toEqual([])
  })

  it("opens a SEPARATE outage once the silence exceeds the stitch window", async () => {
    seed({ latest: [{ id: 9, endedAt: new Date(T0) }] })
    const beyond = T0 + trackerOutageStitchWindowMs(15) + 1
    await recordTrackerPollFailure(TRACKER, "poll", beyond)

    expect(updatedValues()).toEqual([])
    expect(insertedValues()).toEqual([
      { trackerId: TRACKER, startedAt: new Date(beyond), endedAt: new Date(beyond), reason: "poll" },
    ])
  })

  it("does not stitch across a circuit-breaker pause", async () => {
    // Four failures trip the breaker and the app STOPS ASKING. A manual poll
    // days later must not extend the old row across the whole pause — nothing
    // observed the tracker during it, so that span stays UNKNOWN.
    seed({ latest: [{ id: 9, endedAt: new Date(T0) }] })
    await recordTrackerPollFailure(TRACKER, "manual", T0 + 3 * 24 * 60 * MINUTE)

    expect(updatedValues()).toEqual([])
    expect(insertedValues()).toHaveLength(1)
    expect(insertedValues()[0].reason).toBe("manual")
  })

  it("stitches a longer interval that a fixed window would have torn apart", async () => {
    // 60-minute poller: two consecutive failures are 60 minutes apart and are
    // one outage. A hard-coded 30-minute window would call them two.
    seed({ pollIntervalMinutes: 60, latest: [{ id: 9, endedAt: new Date(T0) }] })
    await recordTrackerPollFailure(TRACKER, "poll", T0 + 60 * MINUTE)

    expect(updatedValues()).toEqual([{ endedAt: new Date(T0 + 60 * MINUTE) }])
    expect(insertedValues()).toEqual([])
  })

  it("falls back to the default interval when settings are missing", async () => {
    seed({ pollIntervalMinutes: null, latest: [{ id: 9, endedAt: new Date(T0) }] })
    await recordTrackerPollFailure(TRACKER, "poll", T0 + POLL_INTERVAL_DEFAULT * MINUTE)

    expect(updatedValues()).toHaveLength(1)
  })

  it("ignores a non-positive configured interval rather than collapsing the window", async () => {
    // A zero interval would make the stitch window the bare tolerance and tear
    // every real outage into zero-length rows.
    seed({ pollIntervalMinutes: 0, latest: [{ id: 9, endedAt: new Date(T0) }] })
    await recordTrackerPollFailure(TRACKER, "poll", T0 + POLL_INTERVAL_DEFAULT * MINUTE)

    expect(updatedValues()).toHaveLength(1)
  })

  it("keeps recording a DRAWABLE outage after the clock jumps backwards", async () => {
    // Regression. The probe used to take the row with the greatest endedAt with
    // no clamp, so a future-dated row kept winning, sinceMs stayed negative, and
    // every later failure opened a fresh zero-length row. mergeIntervals drops
    // those, so a tracker that really was down drew NOTHING until wall clock
    // caught up. Silently correct-looking, and the worst outcome available.
    //
    // A row dated 30 minutes in the future must simply be ignored.
    seed({ latest: [] })
    let store: Array<{ id: number; endedAt: Date }> = [{ id: 1, endedAt: new Date(T0) }]
    vi.mocked(db.select).mockImplementation(((columns: Record<string, unknown>) => {
      const keys = Object.keys(columns ?? {})
      if (keys.includes("trackerPollIntervalMinutes")) {
        return chain(appSettings, [{ trackerPollIntervalMinutes: 15 }])
      }
      // Mirror `endedAt <= now ORDER BY endedAt DESC LIMIT 1`. `nowRef` is the
      // instant the call under test is using.
      const usable = store
        .filter((r) => r.endedAt.getTime() <= nowRef)
        .sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime())
      return chain(trackerOutages, usable.length > 0 ? [usable[0]] : [])
    }) as never)
    vi.mocked(db.insert).mockImplementation((() => chain(trackerOutages, undefined)) as never)
    vi.mocked(db.update).mockImplementation((() => chain(trackerOutages, undefined)) as never)

    let nowRef = T0
    const rollback = T0 - 30 * MINUTE
    // First failure after the jump opens a new row (nothing usable exists yet).
    nowRef = rollback
    await recordTrackerPollFailure(TRACKER, "poll", rollback)
    expect(insertedValues()).toHaveLength(1)
    store = [...store, { id: 2, endedAt: new Date(rollback) }]

    // The NEXT failure must EXTEND that row, not open another one.
    nowRef = rollback + 5 * MINUTE
    calls = []
    await recordTrackerPollFailure(TRACKER, "poll", nowRef)

    expect(updatedValues()).toEqual([{ endedAt: new Date(rollback + 5 * MINUTE) }])
    expect(insertedValues()).toEqual([])
  })

  it("ignores future-dated rows when choosing the stitch candidate", async () => {
    // The clamp itself, asserted at the query level.
    seed({ latest: [] })
    await recordTrackerPollFailure(TRACKER, "poll", T0)

    const where = calls.find((c) => c.table === trackerOutages && c.method === "where")
    expect(comparedColumns(where?.args[0])).toContain("ended_at")
  })

  it("takes the NEWEST usable row as the stitch candidate, not the oldest", async () => {
    // desc -> asc would compare against the OLDEST row, so sinceMs would always
    // exceed the window and stitching would stop entirely for any tracker with
    // more than one row in its history — every failure a zero-length row, and
    // nothing ever drawn. Asserted behaviourally: the mock returns whichever row
    // the real ORDER BY would have picked.
    const rows = [
      { id: 1, endedAt: new Date(T0 - 10 * 24 * 60 * MINUTE) }, // ancient
      { id: 9, endedAt: new Date(T0) }, // newest
    ]
    seed()
    vi.mocked(db.select).mockImplementation(((columns: Record<string, unknown>) => {
      const keys = Object.keys(columns ?? {})
      if (keys.includes("trackerPollIntervalMinutes")) {
        return chain(appSettings, [{ trackerPollIntervalMinutes: 15 }])
      }
      const newest = [...rows].sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime())[0]
      return chain(trackerOutages, [newest])
    }) as never)

    await recordTrackerPollFailure(TRACKER, "poll", T0 + 5 * MINUTE)

    // Extended the newest row. Against the ancient one it would have inserted.
    expect(updatedValues()).toEqual([{ endedAt: new Date(T0 + 5 * MINUTE) }])
    expect(insertedValues()).toEqual([])

    // The behavioural half above can only be as good as the mock's own sort, so
    // pin the real ORDER BY direction too — otherwise desc -> asc passes here
    // while stitching is dead in production.
    const order = calls.find((c) => c.table === trackerOutages && c.method === "orderBy")
    expect(conditionOperators(order?.args[0]).toLowerCase()).toContain("desc")
  })

  it("extends ONLY the candidate row, never every row of the tracker", async () => {
    // Targeting the tracker instead of the row id would drag every long-closed
    // outage forward to the present on the next failure.
    seed({ latest: [{ id: 9, endedAt: new Date(T0) }] })
    await recordTrackerPollFailure(TRACKER, "poll", T0 + 5 * MINUTE)

    const updateWhere = calls
      .filter((c) => c.table === trackerOutages && c.method === "where")
      .at(-1)
    expect(comparedColumns(updateWhere?.args[0])).toEqual(["id"])
  })

  it("opens a fresh row instead of writing an endedAt that precedes its own start", async () => {
    // Clock jumped backwards (container restart plus an NTP correction).
    seed({ latest: [{ id: 9, endedAt: new Date(T0) }] })
    await recordTrackerPollFailure(TRACKER, "poll", T0 - 5 * MINUTE)

    expect(updatedValues()).toEqual([])
    expect(insertedValues()).toHaveLength(1)
    const row = insertedValues()[0]
    expect(row.startedAt).toEqual(row.endedAt)
  })

  it("never throws into the poll path when the ledger write fails", async () => {
    seed()
    vi.mocked(db.select).mockImplementation((() => {
      throw new Error("connection lost")
    }) as never)

    await expect(recordTrackerPollFailure(TRACKER, "poll", T0)).resolves.toBeUndefined()
  })

  it("scopes the latest-row probe to the tracker being recorded", async () => {
    // Without this, two trackers failing at once would stitch into each other's
    // rows and each would inherit the other's outage.
    seed({ latest: [] })
    await recordTrackerPollFailure(TRACKER, "poll", T0)

    const where = calls.find((c) => c.table === trackerOutages && c.method === "where")
    expect(comparedColumns(where?.args[0])).toContain("tracker_id")
  })
})

describe("getTrackerOutages", () => {
  it("returns epoch-millisecond intervals for one tracker", async () => {
    seed({
      rows: [
        { startedAt: new Date(T0), endedAt: new Date(T0 + 30 * MINUTE), reason: "poll" },
      ],
    })

    await expect(getTrackerOutages(TRACKER, T0 - MINUTE, T0 + 60 * MINUTE)).resolves.toEqual([
      { start: T0, end: T0 + 30 * MINUTE, reason: "poll" },
    ])
  })

  it("filters by tracker as well as by window", async () => {
    seed({ rows: [] })
    await getTrackerOutages(TRACKER, T0, T0 + MINUTE)

    const where = calls.find((c) => c.table === trackerOutages && c.method === "where")
    const cols = comparedColumns(where?.args[0])
    expect(cols).toContain("tracker_id")
    expect(cols).toContain("ended_at")
    expect(cols).toContain("started_at")
  })
})

describe("pruneTrackerOutages", () => {
  it("keys on endedAt so an outage straddling the cutoff outlives it", async () => {
    // startedAt would delete an outage that began before the horizon but ended
    // inside it — pruning the explanation while the chart data it explains
    // survives, which is the exact asymmetry that makes gap-inference a lie.
    seed({ deleted: [{ id: 1 }, { id: 2 }] })
    await pruneTrackerOutages(30)

    const where = calls.find((c) => c.table === trackerOutages && c.method === "where")
    const cols = comparedColumns(where?.args[0])
    expect(cols).toContain("ended_at")
    expect(cols).not.toContain("started_at")
  })

  it("deletes rows OLDER than the cutoff, never the live ledger", async () => {
    // lt -> gte here would delete every current outage and keep only ancient
    // ones: charts lose exactly the bands they need and keep the ones they must
    // not have. Asserting the column alone does not catch it.
    seed({ deleted: [] })
    await pruneTrackerOutages(30)

    const where = calls.find((c) => c.table === trackerOutages && c.method === "where")
    const ops = conditionOperators(where?.args[0])
    expect(ops).toContain("<")
    expect(ops).not.toContain(">")
  })

  it("puts the cutoff exactly retentionDays back, not some other horizon", async () => {
    seed({ deleted: [] })
    await pruneTrackerOutages(30)

    const where = calls.find((c) => c.table === trackerOutages && c.method === "where")
    const dates: Date[] = []
    const walk = (n: unknown): void => {
      if (n === null || typeof n !== "object") return
      if (n instanceof Date) { dates.push(n); return }
      if (Array.isArray(n)) { for (const c of n) walk(c); return }
      const chunks = (n as { queryChunks?: unknown; value?: unknown }).queryChunks
      if (chunks !== undefined) { walk(chunks); return }
      const v = (n as { value?: unknown }).value
      if (v !== undefined) walk(v)
    }
    walk(where?.args[0])
    expect(dates).toHaveLength(1)
    expect(dates[0].getTime()).toBe(T0 - 30 * 24 * 60 * MINUTE)
  })

  it("reports how many rows it removed", async () => {
    seed({ deleted: [{ id: 1 }, { id: 2 }, { id: 3 }] })
    await expect(pruneTrackerOutages(30)).resolves.toBe(3)
  })
})
