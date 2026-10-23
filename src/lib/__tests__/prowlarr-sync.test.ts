// src/lib/__tests__/prowlarr-sync.test.ts
//
// Functions:
//   chain        - A thenable stand-in for a Drizzle query builder
//   mockSelects  - Queues the results of successive db.select() calls
//   mockTx       - Records the writes made inside db.transaction()

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { log } from "@/lib/logger"
import {
  fetchHealth,
  fetchIndexerStats,
  fetchIndexerStatuses,
  fetchIndexers,
  fetchSystemStatus,
} from "@/lib/prowlarr/client"
import { loadTrackerProwlarrStates, pollProwlarrInstance } from "@/lib/prowlarr/sync"

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), update: vi.fn(), transaction: vi.fn() },
}))

vi.mock("@/lib/prowlarr/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prowlarr/client")>()
  return {
    ...actual,
    fetchSystemStatus: vi.fn(),
    fetchIndexers: vi.fn(),
    fetchIndexerStatuses: vi.fn(),
    fetchIndexerStats: vi.fn(),
    fetchHealth: vi.fn(),
  }
})

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const KEY = Buffer.alloc(32, 7)
const API_KEY = "fedcba9876543210fedcba9876543210"

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
  }
  const tx = {
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        writes.deletes++
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
        return { where: vi.fn(async () => undefined) }
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
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.select).mockReset()
  vi.mocked(fetchSystemStatus).mockResolvedValue({ version: "1.2.3.4567" })
  vi.mocked(fetchIndexers).mockResolvedValue([
    {
      indexerId: 12,
      name: "Example Indexer",
      definitionName: "exampleindexer",
      enabled: true,
      privacy: "private",
      hosts: ["example.org"],
    },
    {
      indexerId: 14,
      name: "Sample Indexer",
      definitionName: null,
      enabled: true,
      privacy: "public",
      hosts: ["sample.test"],
    },
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
  vi.mocked(fetchHealth).mockResolvedValue([
    { source: "IndexerStatusCheck", type: "warning", message: "Indexers unavailable" },
  ])
})

describe("pollProwlarrInstance", () => {
  it("stores every indexer with its failure state and stats, then clears the instance error", async () => {
    mockSelects([instanceRow({ lastError: "Connection refused" })])
    const writes = mockTx()

    await pollProwlarrInstance(1, KEY)

    expect(vi.mocked(fetchSystemStatus).mock.calls[0][0]).toEqual({
      url: "http://prowlarr.test:9696",
      apiKey: API_KEY,
    })
    // A 24 hour and a 7 day window.
    const windows = vi
      .mocked(fetchIndexerStats)
      .mock.calls.map(([, start, end]) => (end.getTime() - start.getTime()) / 3_600_000)
    expect(windows.sort((a, b) => a - b)).toEqual([24, 168])

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
    expect(writes.inserts[1]).toMatchObject({ indexerId: 14, disabledTill: null, stats24h: null })
    // The upsert also clears the old failure of an indexer that has recovered.
    expect(writes.conflictSets[1]).toMatchObject({ disabledTill: null, initialFailure: null })
    expect(writes.updates[0]).toMatchObject({
      lastError: null,
      errorSince: null,
      version: "1.2.3.4567",
      healthIssues: [
        { source: "IndexerStatusCheck", type: "warning", message: "Indexers unavailable" },
      ],
    })
  })

  it("records a sanitized error on the instance and writes nothing else", async () => {
    mockSelects([instanceRow()])
    mockTx()
    const sets = mockInstanceUpdate()
    vi.mocked(fetchIndexers).mockRejectedValue(new Error("Prowlarr API error: 401"))

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
    vi.mocked(fetchIndexers).mockRejectedValue(new Error("Prowlarr API error: 401"))

    await pollProwlarrInstance(1, KEY)

    expect(log.warn).not.toHaveBeenCalled()
  })

  it("asks for the key when none is stored", async () => {
    mockSelects([instanceRow({ encryptedApiKey: null })])
    const sets = mockInstanceUpdate()

    await pollProwlarrInstance(1, KEY)

    expect(fetchSystemStatus).not.toHaveBeenCalled()
    expect(sets[0].lastError).toMatch(/No API key stored/)
  })

  it("does nothing for a disabled or deleted instance", async () => {
    mockSelects([instanceRow({ enabled: false })], [])

    await pollProwlarrInstance(1, KEY)
    await pollProwlarrInstance(2, KEY)

    expect(fetchSystemStatus).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })
})

describe("loadTrackerProwlarrStates", () => {
  const fresh = new Date()

  function storedRow(overrides: Record<string, unknown> = {}) {
    return {
      instanceId: 1,
      indexerId: 12,
      name: "Example Indexer",
      enabled: true,
      hosts: ["example.org"],
      disabledTill: new Date(fresh.getTime() + 3_600_000),
      mostRecentFailure: fresh,
      initialFailure: fresh,
      stats24h: STATS,
      stats7d: null,
      checkedAt: fresh,
      ...overrides,
    }
  }

  const trackers = [
    { id: 1, baseUrl: "https://www.example.org", registrySlug: null, prowlarrIndexer: null },
    { id: 2, baseUrl: "https://unmatched.test", registrySlug: null, prowlarrIndexer: null },
    { id: 3, baseUrl: "https://example.org", registrySlug: null, prowlarrIndexer: "none" },
  ]

  it("attaches matched indexers with their instance's name and error", async () => {
    mockSelects([{ id: 1, name: "Home Prowlarr", lastError: null }], [storedRow()])

    const states = await loadTrackerProwlarrStates(trackers)

    expect([...states.keys()]).toEqual([1])
    expect(states.get(1)).toEqual({
      matchedBy: "auto",
      indexers: [
        {
          instanceId: 1,
          instanceName: "Home Prowlarr",
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
        },
      ],
    })
  })

  it("marks a reading from a stopped poller as stale", async () => {
    const old = new Date(Date.now() - 2 * 3_600_000)
    mockSelects(
      [{ id: 1, name: "Home Prowlarr", lastError: null }],
      [storedRow({ checkedAt: old })]
    )

    const states = await loadTrackerProwlarrStates(trackers)

    expect(states.get(1)?.indexers[0].stale).toBe(true)
  })

  it("costs one query when no instance is enabled", async () => {
    mockSelects([])

    expect((await loadTrackerProwlarrStates(trackers)).size).toBe(0)
    expect(db.select).toHaveBeenCalledTimes(1)
  })
})
