// src/lib/__tests__/prowlarr-sync.test.ts
//
// Functions:
//   chain        - A thenable stand-in for a Drizzle query builder
//   mockSelects  - Queues the results of successive db.select() calls
//   mockTx       - Records the writes made inside db.transaction()

// @vitest-environment node

import { and, eq, notInArray } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { prowlarrIndexers } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import {
  fetchIndexerStats,
  fetchIndexerStatuses,
  fetchIndexers,
  fetchSystemStatus,
} from "@/lib/prowlarr/client"
import { loadTrackerProwlarrStates, pollProwlarrInstance } from "@/lib/prowlarr/sync"

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), update: vi.fn(), transaction: vi.fn() },
}))

// Tagged, so a test can read which rows a write was limited to.
vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  notInArray: vi.fn((...args: unknown[]) => ({ op: "notInArray", args })),
}))

vi.mock("@/lib/prowlarr/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prowlarr/client")>()
  return {
    ...actual,
    fetchSystemStatus: vi.fn(),
    fetchIndexers: vi.fn(),
    fetchIndexerStatuses: vi.fn(),
    fetchIndexerStats: vi.fn(),
  }
})

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const KEY = Buffer.alloc(32, 7)
const OTHER_KEY = Buffer.alloc(32, 9)
const API_KEY = "fedcba9876543210fedcba9876543210"
const HOUR_MS = 3_600_000

const STATS = {
  averageResponseTime: 250,
  queries: 10,
  grabs: 2,
  rssQueries: 48,
  authQueries: 0,
  failedQueries: 1,
  failedGrabs: 0,
  failedRssQueries: 2,
  failedAuthQueries: 0,
}

function chain(result: unknown) {
  const builder = Object.assign(Promise.resolve(result), {} as Record<string, unknown>)
  for (const method of ["from", "where", "limit", "orderBy"]) {
    builder[method] = vi.fn(() => builder)
  }
  return builder
}

function mockSelects(...results: unknown[]) {
  const select = vi.mocked(db.select)
  for (const result of results) {
    select.mockReturnValueOnce(chain(result) as unknown as ReturnType<typeof db.select>)
  }
}

function mockTx() {
  const writes = {
    deletes: 0,
    inserts: [] as Record<string, unknown>[],
    conflictSets: [] as Record<string, unknown>[],
    updates: [] as Record<string, unknown>[],
    deleteWheres: [] as unknown[],
    // Each update's values, keyed to the condition it was limited to.
    updateWheres: new Map<Record<string, unknown>, unknown>(),
  }
  const tx = {
    delete: vi.fn(() => ({
      where: vi.fn(async (condition: unknown) => {
        writes.deletes++
        writes.deleteWheres.push(condition)
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        writes.inserts.push(values)
        return {
          onConflictDoUpdate: vi.fn(async (cfg: { set: Record<string, unknown> }) => {
            writes.conflictSets.push(cfg.set)
          }),
        }
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        writes.updates.push(values)
        return {
          where: vi.fn(async (condition: unknown) => {
            writes.updateWheres.set(values, condition)
          }),
        }
      }),
    })),
  }
  vi.mocked(db.transaction).mockImplementation(async (fn) => fn(tx as never))
  return writes
}

function mockInstanceUpdate() {
  const sets: Record<string, unknown>[] = []
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn((values: Record<string, unknown>) => {
      sets.push(values)
      return { where: vi.fn(async () => undefined) }
    }),
  } as unknown as ReturnType<typeof db.update>)
  return sets
}

function instanceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    url: "http://prowlarr.test:9696",
    encryptedApiKey: encrypt(API_KEY, KEY),
    enabled: true,
    lastError: null,
    indexersReadAt: null,
    statsAttemptedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.select).mockReset()
  vi.mocked(fetchSystemStatus).mockResolvedValue({ version: "1.2.3.4567" })
  vi.mocked(fetchIndexers).mockResolvedValue([
    { indexerId: 12, name: "Example Indexer", enabled: true, hosts: ["example.org"] },
    { indexerId: 14, name: "Sample Indexer", enabled: true, hosts: ["sample.test"] },
  ])
  vi.mocked(fetchIndexerStatuses).mockResolvedValue([
    {
      indexerId: 12,
      disabledTill: new Date("2026-05-02T10:00:00Z"),
      mostRecentFailure: new Date("2026-05-01T10:00:00Z"),
      initialFailure: new Date("2026-04-30T10:00:00Z"),
    },
  ])
  vi.mocked(fetchIndexerStats).mockResolvedValue(new Map([[12, STATS]]))
})

describe("pollProwlarrInstance", () => {
  it("reads the indexer list on the first poll and stores each indexer's status", async () => {
    mockSelects([instanceRow({ lastError: "Prowlarr unreachable: Connection refused" })])
    const writes = mockTx()

    await pollProwlarrInstance(1, KEY)

    expect(vi.mocked(fetchIndexers).mock.calls[0][0]).toEqual({
      url: "http://prowlarr.test:9696",
      apiKey: API_KEY,
    })
    expect(writes.deletes).toBe(1)
    expect(writes.inserts).toHaveLength(2)
    expect(writes.inserts[0]).toMatchObject({
      instanceId: 1,
      indexerId: 12,
      name: "Example Indexer",
      hosts: ["example.org"],
      disabledTill: new Date("2026-05-02T10:00:00Z"),
      initialFailure: new Date("2026-04-30T10:00:00Z"),
      stats24h: STATS,
      stats7d: STATS,
    })
    expect(writes.inserts[1]).toMatchObject({ indexerId: 14, stats24h: null })
    // A 24 hour and a 7 day window.
    const windows = vi
      .mocked(fetchIndexerStats)
      .mock.calls.map(([, start, end]) => (end.getTime() - start.getTime()) / HOUR_MS)
    expect(windows.sort((a, b) => a - b)).toEqual([24, 168])
    // The upsert also clears the old failure of an indexer that has recovered.
    expect(writes.conflictSets[1]).toMatchObject({ disabledTill: null, initialFailure: null })
    expect(writes.updates[0]).toMatchObject({
      lastError: null,
      errorSince: null,
      version: "1.2.3.4567",
      indexersReadAt: expect.any(Date),
      statsAttemptedAt: expect.any(Date),
      statsReadAt: expect.any(Date),
      stats7dReadAt: expect.any(Date),
    })
  })

  it("reads only the status while the indexer list and the stats are recent", async () => {
    mockSelects([
      instanceRow({
        indexersReadAt: new Date(Date.now() - HOUR_MS),
        statsAttemptedAt: new Date(Date.now() - HOUR_MS / 2),
      }),
    ])
    const writes = mockTx()

    await pollProwlarrInstance(1, KEY)

    expect(fetchIndexers).not.toHaveBeenCalled()
    expect(fetchSystemStatus).not.toHaveBeenCalled()
    expect(fetchIndexerStats).not.toHaveBeenCalled()
    expect(writes.inserts).toHaveLength(0)
    expect(writes.updates[0]).not.toHaveProperty("stats24h")
    // Every row is cleared, then the failing one is set again.
    expect(writes.updates[0]).toMatchObject({ disabledTill: null, initialFailure: null })
    expect(writes.updates[1]).toMatchObject({
      disabledTill: new Date("2026-05-02T10:00:00Z"),
      initialFailure: new Date("2026-04-30T10:00:00Z"),
    })
    expect(writes.updates[2]).toMatchObject({ lastError: null })
    expect(writes.updates[2]).not.toHaveProperty("indexersReadAt")
    expect(writes.updates[2]).not.toHaveProperty("version")
    // Stamping a skipped read would push the next one back forever.
    expect(writes.updates[2]).not.toHaveProperty("statsAttemptedAt")
  })

  it("reads the list again once it is due, or when asked to", async () => {
    mockSelects(
      [instanceRow({ indexersReadAt: new Date(Date.now() - 7 * HOUR_MS) })],
      [instanceRow({ indexersReadAt: new Date() })]
    )
    mockTx()

    await pollProwlarrInstance(1, KEY)
    await pollProwlarrInstance(1, KEY, { readIndexers: true })

    expect(fetchIndexers).toHaveBeenCalledTimes(2)
  })

  it("reads only the 24 hour stats hourly between list reads", async () => {
    mockSelects([
      instanceRow({
        indexersReadAt: new Date(Date.now() - HOUR_MS),
        statsAttemptedAt: new Date(Date.now() - 2 * HOUR_MS),
      }),
    ])
    const writes = mockTx()

    await pollProwlarrInstance(1, KEY)

    expect(fetchIndexers).not.toHaveBeenCalled()
    expect(fetchIndexerStats).toHaveBeenCalledTimes(1)
    const [, start, end] = vi.mocked(fetchIndexerStats).mock.calls[0]
    expect((end.getTime() - start.getTime()) / HOUR_MS).toBe(24)
    // Every row is cleared, then the indexer with a status or stats is set again.
    expect(writes.updates[0]).toMatchObject({ stats24h: null })
    expect(writes.updates[0]).not.toHaveProperty("stats7d")
    expect(writes.updates[1]).toMatchObject({ stats24h: STATS, disabledTill: expect.any(Date) })
    expect(writes.updates[2]).toMatchObject({
      statsAttemptedAt: expect.any(Date),
      statsReadAt: expect.any(Date),
    })
    expect(writes.updates[2]).not.toHaveProperty("stats7dReadAt")
  })

  it("does not retry a failed stats read on the next poll", async () => {
    vi.mocked(fetchIndexerStats).mockRejectedValue(new Error("Prowlarr API error: 500"))
    mockSelects([instanceRow()])
    const first = mockTx()

    await pollProwlarrInstance(1, KEY)

    const written = first.updates.at(-1) ?? {}
    expect(written).toMatchObject({
      indexersReadAt: expect.any(Date),
      statsAttemptedAt: expect.any(Date),
    })
    expect(written).not.toHaveProperty("statsReadAt")
    expect(written).not.toHaveProperty("stats7dReadAt")

    // The next poll sees what the failed one stored.
    vi.mocked(fetchIndexerStats).mockClear()
    mockSelects([
      instanceRow({
        indexersReadAt: written.indexersReadAt,
        statsAttemptedAt: written.statsAttemptedAt,
      }),
    ])
    mockTx()

    await pollProwlarrInstance(1, KEY)

    expect(fetchIndexerStats).not.toHaveBeenCalled()
  })

  // With several instances, a poll may only touch its own instance's rows.
  it("deletes only its own instance's indexers that left the list", async () => {
    mockSelects([instanceRow({ id: 7 })])
    const writes = mockTx()

    await pollProwlarrInstance(7, KEY)

    expect(writes.deleteWheres).toEqual([
      and(eq(prowlarrIndexers.instanceId, 7), notInArray(prowlarrIndexers.indexerId, [12, 14])),
    ])
  })

  it("clears and sets the status of its own instance's indexers only", async () => {
    mockSelects([instanceRow({ id: 7, indexersReadAt: new Date(), statsAttemptedAt: new Date() })])
    const writes = mockTx()

    await pollProwlarrInstance(7, KEY)

    expect(writes.updates.slice(0, 2).map((u) => writes.updateWheres.get(u))).toEqual([
      eq(prowlarrIndexers.instanceId, 7),
      and(eq(prowlarrIndexers.instanceId, 7), eq(prowlarrIndexers.indexerId, 12)),
    ])
  })

  it("keeps the stored stats and the status read when a stats request fails", async () => {
    mockSelects([instanceRow()])
    const writes = mockTx()
    vi.mocked(fetchIndexerStats).mockRejectedValue(new Error("Prowlarr API error: 500"))

    await pollProwlarrInstance(1, KEY)

    expect(writes.inserts).toHaveLength(2)
    expect(writes.inserts[0]).not.toHaveProperty("stats24h")
    expect(writes.updates[0]).toMatchObject({ lastError: null })
    expect(writes.updates[0]).not.toHaveProperty("statsReadAt")
    expect(writes.updates[0]).not.toHaveProperty("stats7dReadAt")
  })

  it("logs a failed stats read once per window and cause, and its recovery", async () => {
    mockTx()
    vi.mocked(fetchIndexerStats).mockRejectedValue(new Error("Prowlarr API error: 500"))
    mockSelects([instanceRow({ id: 5 })], [instanceRow({ id: 5 })])
    await pollProwlarrInstance(5, KEY)
    await pollProwlarrInstance(5, KEY)

    expect(vi.mocked(log.warn).mock.calls.map(([, msg]) => msg)).toEqual([
      expect.stringMatching(/^Prowlarr 24h stats read failed/),
      expect.stringMatching(/^Prowlarr 7d stats read failed/),
    ])

    vi.mocked(fetchIndexerStats).mockRejectedValue(new Error("Prowlarr API error: 401"))
    mockSelects([instanceRow({ id: 5 })])
    await pollProwlarrInstance(5, KEY)
    expect(log.warn).toHaveBeenCalledTimes(4)

    vi.mocked(fetchIndexerStats).mockResolvedValue(new Map())
    mockSelects([instanceRow({ id: 5 })])
    await pollProwlarrInstance(5, KEY)
    expect(vi.mocked(log.info).mock.calls.map(([, msg]) => msg)).toEqual([
      "Prowlarr stats read recovered",
      "Prowlarr stats read recovered",
    ])
  })

  it("keeps the status read when the version request fails", async () => {
    mockSelects([instanceRow()])
    const writes = mockTx()
    vi.mocked(fetchSystemStatus).mockRejectedValue(new Error("Prowlarr API error: 500"))

    await pollProwlarrInstance(1, KEY)

    expect(writes.inserts).toHaveLength(2)
    expect(writes.updates[0]).toMatchObject({ lastError: null })
    expect(writes.updates[0]).not.toHaveProperty("version")
  })

  it("records a sanitized error on the instance and writes nothing else", async () => {
    mockSelects([instanceRow()])
    mockTx()
    const sets = mockInstanceUpdate()
    vi.mocked(fetchIndexerStatuses).mockRejectedValue(new Error("Prowlarr API error: 401"))

    await pollProwlarrInstance(1, KEY)

    expect(db.transaction).not.toHaveBeenCalled()
    expect(sets).toHaveLength(1)
    expect(sets[0].lastError).toBe("API key rejected by Prowlarr")
    expect(log.warn).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(log.warn).mock.calls)).not.toContain(API_KEY)
  })

  it("logs a repeated failure only once", async () => {
    mockSelects([instanceRow({ lastError: "API key rejected by Prowlarr" })])
    mockInstanceUpdate()
    vi.mocked(fetchIndexerStatuses).mockRejectedValue(new Error("Prowlarr API error: 401"))

    await pollProwlarrInstance(1, KEY)

    expect(log.warn).not.toHaveBeenCalled()
  })

  it("asks for the key when none is stored", async () => {
    mockSelects([instanceRow({ encryptedApiKey: null })])
    const sets = mockInstanceUpdate()

    await pollProwlarrInstance(1, KEY)

    expect(fetchIndexerStatuses).not.toHaveBeenCalled()
    expect(sets[0].lastError).toMatch(/No API key stored/)
  })

  // Asking to re-enter the key would have a stale session seal it under the wrong key.
  it("reports a key that does not decrypt without asking for it again", async () => {
    mockSelects([instanceRow({ encryptedApiKey: encrypt(API_KEY, OTHER_KEY) })])
    const sets = mockInstanceUpdate()

    await pollProwlarrInstance(1, KEY)

    expect(sets[0].lastError).toBe("Stored API key could not be decrypted")
  })

  it("does nothing for a disabled or deleted instance", async () => {
    mockSelects([instanceRow({ enabled: false })], [])

    await pollProwlarrInstance(1, KEY)
    await pollProwlarrInstance(2, KEY)

    expect(fetchIndexerStatuses).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })
})

describe("loadTrackerProwlarrStates", () => {
  const fresh = new Date()
  const INSTANCE = {
    id: 1,
    name: "Home Prowlarr",
    url: "http://prowlarr.test:9696",
    lastError: null,
    statsReadAt: fresh,
    stats7dReadAt: fresh,
  }

  function storedRow(overrides: Record<string, unknown> = {}) {
    return {
      instanceId: 1,
      indexerId: 12,
      name: "Example Indexer",
      enabled: true,
      hosts: ["example.org"],
      disabledTill: new Date(fresh.getTime() + HOUR_MS),
      mostRecentFailure: fresh,
      initialFailure: fresh,
      stats24h: STATS,
      stats7d: null,
      checkedAt: fresh,
      ...overrides,
    }
  }

  const unpinned = { prowlarrInstanceId: null, prowlarrIndexerId: null, prowlarrOptOut: false }
  const trackers = [
    { id: 1, baseUrl: "https://www.example.org", registrySlug: null, ...unpinned },
    { id: 2, baseUrl: "https://unmatched.test", registrySlug: null, ...unpinned },
    {
      id: 3,
      baseUrl: "https://example.org",
      registrySlug: null,
      ...unpinned,
      prowlarrOptOut: true,
    },
  ]

  it("attaches matched indexers with their instance's name, URL and error", async () => {
    mockSelects([INSTANCE], [storedRow()])

    const states = await loadTrackerProwlarrStates(trackers)

    expect([...states.keys()]).toEqual([1])
    expect(states.get(1)).toEqual({
      matchedBy: "auto",
      indexers: [
        {
          instanceId: 1,
          instanceName: "Home Prowlarr",
          instanceUrl: "http://prowlarr.test:9696",
          instancePublicUrl: null,
          instanceError: null,
          stale: false,
          indexerId: 12,
          name: "Example Indexer",
          enabled: true,
          disabledTill: storedRow().disabledTill.toISOString(),
          mostRecentFailure: fresh.toISOString(),
          initialFailure: fresh.toISOString(),
          checkedAt: fresh.toISOString(),
          stats24h: STATS,
          stats7d: null,
          statsStaleSince: null,
        },
      ],
    })
  })

  it("leaves out stats not read for two refresh intervals, with their age", async () => {
    const dayOld = new Date(Date.now() - 2.5 * HOUR_MS)
    mockSelects(
      [{ ...INSTANCE, statsReadAt: dayOld, stats7dReadAt: new Date(Date.now() - 11 * HOUR_MS) }],
      [storedRow({ stats7d: STATS })]
    )

    const [indexer] = (await loadTrackerProwlarrStates(trackers)).get(1)?.indexers ?? []

    expect(indexer.stats24h).toBeNull()
    expect(indexer.stats7d).toEqual(STATS)
    expect(indexer.statsStaleSince).toBe(dayOld.toISOString())
  })

  it("reports the oldest of two stale windows", async () => {
    const weekOld = new Date(Date.now() - 13 * HOUR_MS)
    mockSelects(
      [{ ...INSTANCE, statsReadAt: new Date(Date.now() - 3 * HOUR_MS), stats7dReadAt: weekOld }],
      [storedRow({ stats7d: STATS })]
    )

    const [indexer] = (await loadTrackerProwlarrStates(trackers)).get(1)?.indexers ?? []

    expect(indexer.stats24h).toBeNull()
    expect(indexer.stats7d).toBeNull()
    expect(indexer.statsStaleSince).toBe(weekOld.toISOString())
  })

  it("reports no age for a window that never had stats", async () => {
    mockSelects([{ ...INSTANCE, stats7dReadAt: null }], [storedRow()])

    const [indexer] = (await loadTrackerProwlarrStates(trackers)).get(1)?.indexers ?? []

    expect(indexer.stats24h).toEqual(STATS)
    expect(indexer.statsStaleSince).toBeNull()
  })

  it("marks a reading from a stopped poller as stale", async () => {
    const old = new Date(Date.now() - 2 * HOUR_MS)
    mockSelects([INSTANCE], [storedRow({ checkedAt: old })])

    const states = await loadTrackerProwlarrStates(trackers)

    expect(states.get(1)?.indexers[0].stale).toBe(true)
  })

  it("costs one query when no instance is enabled", async () => {
    mockSelects([])

    expect((await loadTrackerProwlarrStates(trackers)).size).toBe(0)
    expect(db.select).toHaveBeenCalledTimes(1)
  })
})
