// src/lib/__tests__/app-liveness.test.ts
//
// The ledger is the only thing standing between "the app was down here" and a
// fabricated outage, so every write path is pinned: the first-boot floor, the
// clock-jump clamp, the throttle, and the stall detection that catches an outage
// inside a process that never actually died.
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

import {
  clearAppLivenessState,
  getCoverageGaps,
  LIVENESS_WRITE_THROTTLE_MS,
  markAppStopped,
  pruneCoverageGaps,
  touchAppLiveness,
} from "@/lib/app-liveness"
import { db } from "@/lib/db"
import { appCoverageGaps, appLiveness } from "@/lib/db/schema"

const MINUTE = 60_000
const T0 = Date.UTC(2026, 7, 1, 12, 0, 0)

interface Call {
  table: unknown
  method: string
  args: unknown[]
}

let calls: Call[] = []

/**
 * A Drizzle-shaped chain: every method returns the chain and records its call,
 * and awaiting anywhere along it resolves to `result`. Shapes like
 * `.values().returning()` and `.set().where()` both fall out of that without
 * hand-building each one.
 */
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

/** Rows the mocked SELECTs hand back, keyed by which projection asked. */
interface SeedData {
  liveness: Array<{
    id: number
    firstSeenAt: Date
    lastSeenAt: Date
    stoppedAt: Date | null
  }>
  gaps: Array<{ startedAt: Date; endedAt: Date; reason: string }>
  deleted: Array<{ id: number }>
}

function seed(data: Partial<SeedData> = {}) {
  const full: SeedData = { liveness: [], gaps: [], deleted: [], ...data }

  vi.mocked(db.select).mockImplementation(((columns: Record<string, unknown>) => {
    const keys = Object.keys(columns ?? {})
    if (keys.includes("startedAt")) return chain(appCoverageGaps, full.gaps)
    return chain(appLiveness, full.liveness)
  }) as never)

  vi.mocked(db.insert).mockImplementation(((table: unknown) =>
    chain(table, [{ id: 1 }])) as never)
  vi.mocked(db.update).mockImplementation(((table: unknown) => chain(table, undefined)) as never)
  vi.mocked(db.delete).mockImplementation(((table: unknown) =>
    chain(table, full.deleted)) as never)

  return full
}

/** Every row handed to `.values()` for a given table. */
function insertedValues(table: unknown): Record<string, unknown>[] {
  return calls
    .filter((c) => c.table === table && c.method === "values")
    .map((c) => c.args[0] as Record<string, unknown>)
}

function updatedValues(table: unknown): Record<string, unknown>[] {
  return calls
    .filter((c) => c.table === table && c.method === "set")
    .map((c) => c.args[0] as Record<string, unknown>)
}

/**
 * Column names named DIRECTLY by a Drizzle condition. Deliberately shallow: a
 * deep walk reaches the table definition and therefore every column on it, which
 * would make "does this filter on endedAt?" unanswerable.
 */
function comparedColumns(condition: unknown): string[] {
  const chunks = (condition as { queryChunks?: unknown[] })?.queryChunks ?? []
  return chunks
    .filter((c): c is { name: string } => c !== null && typeof c === "object" && "name" in c)
    .map((c) => c.name)
}

const existingRow = (lastSeenAt: Date, stoppedAt: Date | null = null) => ({
  id: 7,
  firstSeenAt: new Date(T0 - 30 * 24 * 60 * MINUTE),
  lastSeenAt,
  stoppedAt,
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(T0))
  vi.clearAllMocks()
  calls = []
  clearAppLivenessState()
})

afterEach(() => {
  vi.useRealTimers()
  clearAppLivenessState()
})

describe("touchAppLiveness — first boot", () => {
  it("creates the ledger row and records NO gap", async () => {
    seed({ liveness: [] })

    await touchAppLiveness(T0)

    const inserted = insertedValues(appLiveness)
    expect(inserted).toHaveLength(1)
    expect((inserted[0].firstSeenAt as Date).getTime()).toBe(T0)
    expect((inserted[0].lastSeenAt as Date).getTime()).toBe(T0)
    // The floor. Without it, the first chart would be banded back to 1970.
    expect(insertedValues(appCoverageGaps)).toHaveLength(0)
  })
})

describe("touchAppLiveness — reconciling a restart", () => {
  it("records one closed gap for a long absence", async () => {
    const lastSeen = new Date(T0 - 45 * MINUTE)
    seed({ liveness: [existingRow(lastSeen)] })

    await touchAppLiveness(T0)

    const gaps = insertedValues(appCoverageGaps)
    expect(gaps).toHaveLength(1)
    expect((gaps[0].startedAt as Date).getTime()).toBe(lastSeen.getTime())
    expect((gaps[0].endedAt as Date).getTime()).toBe(T0)
    expect(gaps[0].reason).toBe("unclean")
  })

  it("records nothing for an absence under five minutes", async () => {
    seed({ liveness: [existingRow(new Date(T0 - 4 * MINUTE))] })

    await touchAppLiveness(T0)

    expect(insertedValues(appCoverageGaps)).toHaveLength(0)
    // …but the heartbeat stamp is still refreshed.
    expect(updatedValues(appLiveness)).toHaveLength(1)
  })

  it("records a gap of exactly five minutes", async () => {
    seed({ liveness: [existingRow(new Date(T0 - 5 * MINUTE))] })

    await touchAppLiveness(T0)

    expect(insertedValues(appCoverageGaps)).toHaveLength(1)
  })

  it("starts the gap at stoppedAt and labels it a clean shutdown", async () => {
    const lastSeen = new Date(T0 - 60 * MINUTE)
    const stopped = new Date(T0 - 59 * MINUTE)
    seed({ liveness: [existingRow(lastSeen, stopped)] })

    await touchAppLiveness(T0)

    const gaps = insertedValues(appCoverageGaps)
    expect(gaps).toHaveLength(1)
    expect((gaps[0].startedAt as Date).getTime()).toBe(stopped.getTime())
    expect(gaps[0].reason).toBe("shutdown")
  })

  it("ignores a stoppedAt that predates lastSeenAt — a consumed marker", async () => {
    const lastSeen = new Date(T0 - 60 * MINUTE)
    const stale = new Date(T0 - 90 * MINUTE)
    seed({ liveness: [existingRow(lastSeen, stale)] })

    await touchAppLiveness(T0)

    const gaps = insertedValues(appCoverageGaps)
    expect((gaps[0].startedAt as Date).getTime()).toBe(lastSeen.getTime())
    expect(gaps[0].reason).toBe("unclean")
  })

  it("writes NO gap when the clock jumped backwards, and does not throw", async () => {
    // lastSeenAt is in the future: NTP correction after a container restart.
    seed({ liveness: [existingRow(new Date(T0 + 90 * MINUTE))] })

    await expect(touchAppLiveness(T0)).resolves.toBeUndefined()

    expect(insertedValues(appCoverageGaps)).toHaveLength(0)
    // Re-anchored rather than left in the future.
    expect(updatedValues(appLiveness)).toHaveLength(1)
  })

  it("clears stoppedAt once the app is collecting again", async () => {
    seed({ liveness: [existingRow(new Date(T0 - 60 * MINUTE), new Date(T0 - 59 * MINUTE))] })

    await touchAppLiveness(T0)

    expect(updatedValues(appLiveness)[0].stoppedAt).toBeNull()
  })

  it("reads the ledger only once per process", async () => {
    seed({ liveness: [existingRow(new Date(T0 - 60 * MINUTE))] })

    await touchAppLiveness(T0)
    await touchAppLiveness(T0 + 5_000)
    await touchAppLiveness(T0 + 10_000)

    const reads = calls.filter((c) => c.method === "from" && c.table === appLiveness)
    expect(reads).toHaveLength(1)
  })
})

describe("touchAppLiveness — a stall inside a living process", () => {
  it("records a gap when collection stops without the process dying", async () => {
    seed({ liveness: [existingRow(new Date(T0 - 10_000))] })

    await touchAppLiveness(T0) // boot
    calls = []
    // A lockdown, a restore, or a suspended host: twenty minutes with no ticks.
    await touchAppLiveness(T0 + 20 * MINUTE)

    const gaps = insertedValues(appCoverageGaps)
    expect(gaps).toHaveLength(1)
    expect((gaps[0].startedAt as Date).getTime()).toBe(T0)
    expect((gaps[0].endedAt as Date).getTime()).toBe(T0 + 20 * MINUTE)
    expect(gaps[0].reason).toBe("stalled")
  })

  it("records nothing for an ordinary run of ticks", async () => {
    seed({ liveness: [existingRow(new Date(T0 - 10_000))] })

    await touchAppLiveness(T0)
    calls = []
    for (let i = 1; i <= 60; i++) {
      await touchAppLiveness(T0 + i * 5_000)
    }

    expect(insertedValues(appCoverageGaps)).toHaveLength(0)
  })

  it("re-anchors without recording when the clock jumps backwards mid-process", async () => {
    seed({ liveness: [existingRow(new Date(T0 - 10_000))] })

    await touchAppLiveness(T0)
    calls = []
    await touchAppLiveness(T0 - 60 * MINUTE)

    expect(insertedValues(appCoverageGaps)).toHaveLength(0)
  })
})

describe("touchAppLiveness — write throttle", () => {
  it("does not write again within the throttle window", async () => {
    seed({ liveness: [existingRow(new Date(T0 - 10_000))] })

    await touchAppLiveness(T0) // reconcile writes once
    calls = []
    await touchAppLiveness(T0 + 5_000)
    await touchAppLiveness(T0 + 10_000)
    await touchAppLiveness(T0 + LIVENESS_WRITE_THROTTLE_MS - 1)

    expect(updatedValues(appLiveness)).toHaveLength(0)
  })

  it("writes once the throttle window has passed", async () => {
    seed({ liveness: [existingRow(new Date(T0 - 10_000))] })

    await touchAppLiveness(T0)
    calls = []
    await touchAppLiveness(T0 + LIVENESS_WRITE_THROTTLE_MS)

    expect(updatedValues(appLiveness)).toHaveLength(1)
  })

  it("throttling the WRITE never suppresses gap detection", async () => {
    seed({ liveness: [existingRow(new Date(T0 - 10_000))] })

    await touchAppLiveness(T0)
    // A write happened at T0, so the throttle is armed; the gap must be recorded
    // regardless of it.
    calls = []
    await touchAppLiveness(T0 + 6 * MINUTE)

    expect(insertedValues(appCoverageGaps)).toHaveLength(1)
    expect(updatedValues(appLiveness)).toHaveLength(1)
  })
})

describe("markAppStopped", () => {
  it("stamps both lastSeenAt and stoppedAt", async () => {
    seed({ liveness: [existingRow(new Date(T0 - 10_000))] })

    await markAppStopped(T0)

    const values = updatedValues(appLiveness)
    expect(values).toHaveLength(1)
    expect((values[0].lastSeenAt as Date).getTime()).toBe(T0)
    expect((values[0].stoppedAt as Date).getTime()).toBe(T0)
  })

  it("lets a later touch in the same process record the stall it caused", async () => {
    seed({ liveness: [existingRow(new Date(T0 - 10_000))] })

    await touchAppLiveness(T0)
    await markAppStopped(T0 + MINUTE)
    calls = []
    await touchAppLiveness(T0 + 31 * MINUTE)

    const gaps = insertedValues(appCoverageGaps)
    expect(gaps).toHaveLength(1)
    expect((gaps[0].startedAt as Date).getTime()).toBe(T0 + MINUTE)
    expect(gaps[0].reason).toBe("stalled")
  })

  it("swallows a database failure rather than breaking shutdown", async () => {
    seed({ liveness: [existingRow(new Date(T0 - 10_000))] })
    vi.mocked(db.update).mockImplementation((() => {
      throw new Error("connection closed")
    }) as never)

    await expect(markAppStopped(T0)).resolves.toBeUndefined()
  })
})

describe("getCoverageGaps", () => {
  it("returns gaps as epoch milliseconds", async () => {
    seed({
      gaps: [
        {
          startedAt: new Date(T0 - 60 * MINUTE),
          endedAt: new Date(T0 - 30 * MINUTE),
          reason: "unclean",
        },
      ],
    })

    const gaps = await getCoverageGaps(T0 - 120 * MINUTE, T0)

    expect(gaps).toEqual([
      { start: T0 - 60 * MINUTE, end: T0 - 30 * MINUTE, reason: "unclean" },
    ])
  })
})

describe("pruneCoverageGaps", () => {
  it("keys the delete on endedAt, NOT startedAt", async () => {
    // A gap that began before the horizon but ended inside it still explains
    // surviving chart data. Pruning on startedAt would delete the explanation
    // while the snapshots it explains remain. The exact drift the retention
    // coupling exists to prevent.
    seed({ deleted: [{ id: 1 }, { id: 2 }] })

    await pruneCoverageGaps(90)

    const where = calls.find((c) => c.table === appCoverageGaps && c.method === "where")
    expect(where).toBeDefined()
    expect(comparedColumns(where?.args[0])).toEqual(["ended_at"])
  })

  it("returns the number of rows removed", async () => {
    seed({ deleted: [{ id: 1 }, { id: 2 }, { id: 3 }] })

    expect(await pruneCoverageGaps(90)).toBe(3)
  })
})
