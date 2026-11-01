// src/lib/__tests__/backfill-registry-slug.test.ts
//
// A tracker row with no slug is never polled. The startup backfill links it to
// the entry on its host, by the entry's url or a domain the entry used before,
// and the registry test keeps each host to one entry. A slug another row holds
// is never handed out again, a row on a host the list doesn't carry is left
// alone, and a linked row loses the pause from before but keeps the user's own.

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  and: (...conditions: unknown[]) => ({ and: conditions }),
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  isNull: (column: unknown) => ({ isNull: column }),
}))
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }))
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/scheduler-key-store", () => ({ loadSchedulerKey: vi.fn(async () => null) }))
vi.mock("@/lib/scheduler", () => ({ startScheduler: vi.fn() }))
vi.mock("@/lib/cookie-security", () => ({ shouldSecureCookies: vi.fn(() => true) }))

import {
  registryHostname,
  TRACKER_REGISTRY,
  type TrackerRegistryEntry,
} from "@/data/tracker-registry"
import { ALL_TRACKERS } from "@/data/trackers"
import { register } from "@/instrumentation"
import { db } from "@/lib/db"
import { backfillRegistrySlugs, planRegistryLinks } from "@/lib/db/backfill-registry-slug"
import { trackers } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { UNLINKED_RESTORE_ERROR } from "@/lib/tracker-status"

function entryWhere(
  what: string,
  test: (entry: TrackerRegistryEntry) => boolean,
  list: readonly TrackerRegistryEntry[] = TRACKER_REGISTRY
): TrackerRegistryEntry {
  const entry = list.find(test)
  if (!entry) throw new Error(`the registry has no ${what} left to test with`)
  return entry
}

// Real entries, read from the registry rather than spelled out, so a url edit
// in a release cannot leave these tests asserting a dead address.
const MOVED = entryWhere("entry with previousHosts", (e) => Boolean(e.previousHosts?.length))
const OLD_HOME = `https://${MOVED.previousHosts?.[0]}`
const EXACT = entryWhere("plain live entry", (e) => !e.defunct && e !== MOVED)
const WWW = entryWhere("second plain live entry", (e) => !e.defunct && e !== MOVED && e !== EXACT)
const DEFUNCT = entryWhere("defunct entry", (e) => Boolean(e.defunct))
const DRAFT = entryWhere("draft entry", (e) => Boolean(e.draft), ALL_TRACKERS)

const EARLIER = new Date("2026-10-01T00:00:00Z")
const LATER = new Date("2026-10-20T00:00:00Z")

/** The columns planRegistryLinks reads. */
function linkRow(
  id: number,
  baseUrl: string,
  fields: { registrySlug?: string; isActive?: boolean; lastPolledAt?: Date } = {}
) {
  return {
    id,
    baseUrl,
    registrySlug: fields.registrySlug ?? null,
    isActive: fields.isActive ?? true,
    lastPolledAt: fields.lastPolledAt ?? null,
  }
}

describe("planRegistryLinks", () => {
  it.each([
    ["its entry's url", EXACT.url, EXACT],
    ["a www. spelling of its entry's host", `http://www.${registryHostname(WWW.url)}`, WWW],
    ["a domain its entry used before", OLD_HOME, MOVED],
    ["the host of a tracker that shut down", DEFUNCT.url, DEFUNCT],
  ])("links a row stored on %s", (_where, baseUrl, entry) => {
    expect(planRegistryLinks([linkRow(1, baseUrl)])).toEqual({
      links: [{ id: 1, entry }],
      blocked: [],
    })
  })

  it.each([
    ["a host the list doesn't carry", "https://private-vault.invented.example"],
    ["a draft entry's host", DRAFT.url],
    ["an address that won't parse", "not a url"],
  ])("leaves a row stored on %s unlinked", (_where, baseUrl) => {
    expect(planRegistryLinks([linkRow(1, baseUrl)])).toEqual({ links: [], blocked: [] })
  })

  it.each([
    ["an active row", true],
    ["an archived row", false],
  ])("never hands out a slug %s already holds", (_holder, isActive) => {
    const holder = linkRow(2, "https://anywhere.example", { registrySlug: EXACT.slug, isActive })

    expect(planRegistryLinks([linkRow(1, EXACT.url), holder])).toEqual({
      links: [],
      blocked: [{ id: 1, slug: EXACT.slug }],
    })
  })

  // Each case lists the loser first, so input order alone can't pick the winner.
  it.each([
    [
      "an active row beats an archived one that polled later and is older",
      [
        linkRow(1, OLD_HOME, { isActive: false, lastPolledAt: LATER }),
        linkRow(2, MOVED.url, { lastPolledAt: EARLIER }),
      ],
      2,
      1,
    ],
    [
      "the later poll beats the earlier one",
      [
        linkRow(1, MOVED.url, { lastPolledAt: EARLIER }),
        linkRow(2, OLD_HOME, { lastPolledAt: LATER }),
      ],
      2,
      1,
    ],
    [
      "a polled row beats one never polled",
      [linkRow(1, MOVED.url), linkRow(2, OLD_HOME, { lastPolledAt: EARLIER })],
      2,
      1,
    ],
    [
      "the older row wins a full tie",
      [
        linkRow(2, MOVED.url, { lastPolledAt: EARLIER }),
        linkRow(1, OLD_HOME, { lastPolledAt: EARLIER }),
      ],
      1,
      2,
    ],
  ])("links one of two rows on one tracker: %s", (_rule, rows, winner, loser) => {
    expect(planRegistryLinks(rows)).toEqual({
      links: [{ id: winner, entry: MOVED }],
      blocked: [{ id: loser, slug: MOVED.slug }],
    })
  })

  it("links nothing on a second run", () => {
    const rows = [
      linkRow(1, EXACT.url),
      linkRow(2, MOVED.url),
      linkRow(3, OLD_HOME),
      linkRow(4, "https://private-vault.invented.example"),
    ]
    const first = planRegistryLinks(rows)
    expect(first.links.map(({ id }) => id)).toEqual([1, 2])

    const after = rows.map((row) => ({
      ...row,
      registrySlug: first.links.find(({ id }) => id === row.id)?.entry.slug ?? null,
    }))
    expect(planRegistryLinks(after).links).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// The writes, against an in-memory trackers table
// ---------------------------------------------------------------------------

interface TrackerRow {
  id: number
  baseUrl: string
  apiPath: string
  platformType: string
  registrySlug: string | null
  isActive: boolean
  lastPolledAt: Date | null
  pausedAt: Date | null
  lastError: string | null
  lastErrorAt: Date | null
  consecutiveFailures: number
  userPausedAt: Date | null
  updatedAt: Date
}

const CREATED = new Date("2026-01-01T00:00:00Z")
const PAUSED = new Date("2026-10-25T00:00:00Z")

function trackerRow(id: number, baseUrl: string, fields: Partial<TrackerRow> = {}): TrackerRow {
  return {
    id,
    baseUrl,
    apiPath: "/api/stale",
    platformType: "gazelle",
    registrySlug: null,
    isActive: true,
    lastPolledAt: null,
    pausedAt: null,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    userPausedAt: null,
    updatedAt: CREATED,
    ...fields,
  }
}

/** `before` as the backfill leaves it once linked to `entry`. */
function linkedTo(entry: TrackerRegistryEntry, before: TrackerRow): TrackerRow {
  return {
    ...before,
    registrySlug: entry.slug,
    baseUrl: entry.url,
    apiPath: entry.apiPath,
    platformType: entry.platform,
    pausedAt: null,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    updatedAt: expect.any(Date),
  }
}

let table: TrackerRow[] = []
// Runs between the backfill's read and its writes.
let afterSelect: () => void = () => {}

const COLUMN = new Map<unknown, keyof TrackerRow>([
  [trackers.id, "id"],
  [trackers.registrySlug, "registrySlug"],
])

type Condition = { and: Condition[] } | { eq: [unknown, unknown] } | { isNull: unknown }

function field(row: TrackerRow, column: unknown): unknown {
  const key = COLUMN.get(column)
  if (!key) throw new Error("the fake table has no mapping for that column")
  return row[key]
}

function matches(row: TrackerRow, condition: Condition): boolean {
  if ("and" in condition) return condition.and.every((c) => matches(row, c))
  if ("eq" in condition) return field(row, condition.eq[0]) === condition.eq[1]
  return field(row, condition.isNull) === null
}

beforeEach(() => {
  vi.clearAllMocks()
  // The once-guard lives on globalThis, which outlives a test file's modules,
  // so every test here has to start from an unlatched process.
  delete (globalThis as typeof globalThis & { __registrySlugBackfilled?: boolean })
    .__registrySlugBackfilled
  table = []
  afterSelect = () => {}
  vi.mocked(db.select).mockImplementation(((projection: Record<string, unknown>) => ({
    from: async () => {
      const read = table.map((row) =>
        Object.fromEntries(
          Object.keys(projection).map((key) => [key, row[key as keyof TrackerRow]])
        )
      )
      afterSelect()
      return read
    },
  })) as never)
  vi.mocked(db.update).mockImplementation((() => ({
    set: (values: Partial<TrackerRow>) => ({
      where: (condition: Condition) => ({
        returning: async () => {
          const hit = table.filter((row) => matches(row, condition))
          for (const row of hit) Object.assign(row, values)
          return hit.map(({ id }) => ({ id }))
        },
      }),
    }),
  })) as never)
})

describe("backfillRegistrySlugs", () => {
  it.each([
    ["a restore's pause and marker", EXACT, EXACT.url, { lastError: UNLINKED_RESTORE_ERROR }],
    [
      "the poll's pause from before the list carried its host",
      MOVED,
      OLD_HOME,
      {
        lastError: `Not in the tracker list, so it isn't polled. It was set up for ${registryHostname(OLD_HOME)}`,
      },
    ],
    [
      "a pause for failures on its old domain",
      MOVED,
      OLD_HOME,
      { lastError: "HTTP 301", consecutiveFailures: 4, lastPolledAt: EARLIER },
    ],
  ])("links a row with %s and clears it", async (_state, entry, baseUrl, state) => {
    const before = trackerRow(1, baseUrl, { pausedAt: PAUSED, lastErrorAt: PAUSED, ...state })
    table = [{ ...before }]

    await backfillRegistrySlugs()

    expect(table[0]).toEqual(linkedTo(entry, before))
    expect(table[0].updatedAt).not.toBe(CREATED)
  })

  it("keeps the user's own pause on a row it links", async () => {
    table = [trackerRow(1, OLD_HOME, { userPausedAt: EARLIER, pausedAt: PAUSED })]

    await backfillRegistrySlugs()

    expect(table[0]).toMatchObject({
      registrySlug: MOVED.slug,
      pausedAt: null,
      userPausedAt: EARLIER,
    })
  })

  it("keeps a link made while it ran, and counts that row as left", async () => {
    const other = trackerRow(2, OLD_HOME)
    table = [trackerRow(1, EXACT.url), { ...other }]
    let linkedMeanwhile: TrackerRow | undefined
    afterSelect = () => {
      Object.assign(table[0], {
        registrySlug: WWW.slug,
        baseUrl: WWW.url,
        apiPath: WWW.apiPath,
        platformType: WWW.platform,
      })
      linkedMeanwhile = { ...table[0] }
    }

    await backfillRegistrySlugs()

    expect(table[0]).toEqual(linkedMeanwhile)
    expect(table[1]).toEqual(linkedTo(MOVED, other))
    expect(log.info).toHaveBeenCalledTimes(1)
    expect(vi.mocked(log.info).mock.calls[0]?.[0]).toEqual({ linked: 1, left: 1 })
    expect(log.debug).toHaveBeenCalledWith(
      { trackerId: 1, slug: EXACT.slug },
      "Tracker left unlinked, it was linked or deleted while the backfill ran"
    )
  })

  it("keeps the links written before a failed one, and runs again on the next call", async () => {
    const before = [
      trackerRow(1, EXACT.url, { pausedAt: PAUSED, lastError: UNLINKED_RESTORE_ERROR }),
      trackerRow(2, OLD_HOME),
      trackerRow(3, WWW.url),
    ]
    table = before.map((row) => ({ ...row }))
    const write = vi.mocked(db.update).getMockImplementation() as never
    vi.mocked(db.update)
      .mockImplementationOnce(write)
      .mockImplementationOnce((() => ({
        set: () => ({
          where: () => ({
            returning: async () => {
              throw new Error("deadlock detected")
            },
          }),
        }),
      })) as never)

    await expect(backfillRegistrySlugs()).resolves.toBeUndefined()

    expect(table[0]).toEqual(linkedTo(EXACT, before[0]))
    expect(table.slice(1)).toEqual(before.slice(1))
    expect(log.warn).toHaveBeenCalledTimes(1)
    expect(vi.mocked(log.warn).mock.calls[0]?.[0]).toMatchObject({ error: "deadlock detected" })

    await backfillRegistrySlugs()

    expect(table.map((row) => row.registrySlug)).toEqual([EXACT.slug, MOVED.slug, WWW.slug])
  })

  it("writes nothing on a second run", async () => {
    table = [
      trackerRow(1, EXACT.url),
      trackerRow(2, OLD_HOME),
      trackerRow(3, MOVED.url, { lastPolledAt: EARLIER }),
    ]

    await backfillRegistrySlugs()
    const firstRun = vi.mocked(db.update).mock.calls.length
    await backfillRegistrySlugs({ force: true })

    expect(firstRun).toBe(2)
    expect(vi.mocked(db.update)).toHaveBeenCalledTimes(2)
    expect(table.map((row) => row.registrySlug)).toEqual([EXACT.slug, null, MOVED.slug])
  })

  it("logs one count when it links, and each row it leaves to another", async () => {
    table = [
      trackerRow(1, "https://anywhere.example", { registrySlug: EXACT.slug }),
      trackerRow(2, EXACT.url),
      trackerRow(3, MOVED.url),
      trackerRow(4, "https://private-vault.invented.example"),
    ]

    await backfillRegistrySlugs()

    expect(log.info).toHaveBeenCalledTimes(1)
    expect(vi.mocked(log.info).mock.calls[0]?.[0]).toEqual({ linked: 1, left: 2 })
    expect(log.debug).toHaveBeenCalledWith(
      { trackerId: 2, slug: EXACT.slug },
      "Tracker left unlinked, another tracker holds its slug"
    )
    expect(log.debug).toHaveBeenCalledWith(
      { trackerId: 3, slug: MOVED.slug },
      "Tracker linked to a registry entry"
    )
  })

  it("says nothing at info when it links nothing", async () => {
    table = [trackerRow(1, "https://private-vault.invented.example")]

    await backfillRegistrySlugs()

    expect(log.info).not.toHaveBeenCalled()
    expect(table[0].registrySlug).toBeNull()
  })

  it("makes a second call in the same process a no-op", async () => {
    await backfillRegistrySlugs()
    await backfillRegistrySlugs()

    expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1)
  })

  it("runs again when forced, for rows a restore wrote after boot", async () => {
    await backfillRegistrySlugs()
    table = [trackerRow(1, EXACT.url)]
    await backfillRegistrySlugs({ force: true })

    expect(vi.mocked(db.select)).toHaveBeenCalledTimes(2)
    expect(table[0].registrySlug).toBe(EXACT.slug)
  })

  it("logs a failed select and does not throw it into boot", async () => {
    vi.mocked(db.select).mockImplementation((() => ({
      from: async () => {
        throw new Error("connection refused")
      },
    })) as never)

    await expect(backfillRegistrySlugs()).resolves.toBeUndefined()

    expect(vi.mocked(log.warn).mock.calls[0]?.[0]).toMatchObject({ error: "connection refused" })
    expect(db.update).not.toHaveBeenCalled()
  })
})

describe("the boot hook", () => {
  it("backfills even when no persisted key starts the scheduler", async () => {
    // register() returns early when loadSchedulerKey finds nothing, so a boot
    // that never starts polling must still have linked the rows by then.
    table = [trackerRow(1, EXACT.url)]
    const previous = process.env.NEXT_RUNTIME
    process.env.NEXT_RUNTIME = "nodejs"
    try {
      await register()
    } finally {
      if (previous === undefined) delete process.env.NEXT_RUNTIME
      else process.env.NEXT_RUNTIME = previous
    }

    expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1)
    expect(table[0].registrySlug).toBe(EXACT.slug)
  })
})
