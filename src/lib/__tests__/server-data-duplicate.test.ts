// src/lib/__tests__/server-data-duplicate.test.ts
//
// An unlinked row whose address belongs to a tracker another row already uses is
// a duplicate: the startup backfill left it unlinked for that reason, and its card
// says so by the tracker's name. The list and the detail must agree, archived
// holders count, and a row on a host the list doesn't carry is no duplicate.

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
}))
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), selectDistinctOn: vi.fn() } }))
vi.mock("@/lib/prowlarr/sync", () => ({
  loadTrackerProwlarrStates: vi.fn(async () => new Map()),
}))
vi.mock("@/lib/privacy-db", () => ({
  createPrivacyMaskSync: () => (value: string | null | undefined) => value ?? null,
}))

import {
  registryHostname,
  TRACKER_REGISTRY,
  type TrackerRegistryEntry,
} from "@/data/tracker-registry"
import { db } from "@/lib/db"
import { appSettings, trackers } from "@/lib/db/schema"
import { getTrackerForClient, getTrackerListForDashboard } from "@/lib/server-data"

function entryWhere(what: string, test: (entry: TrackerRegistryEntry) => boolean) {
  const entry = TRACKER_REGISTRY.find(test)
  if (!entry) throw new Error(`the registry has no ${what} left to test with`)
  return entry
}

const MOVED = entryWhere("entry with previousHosts", (e) => Boolean(e.previousHosts?.length))
const OLD_HOME = `https://${MOVED.previousHosts?.[0]}`
const EXACT = entryWhere("plain live entry", (e) => !e.defunct && e !== MOVED)
const UNHELD = entryWhere(
  "second plain live entry",
  (e) => !e.defunct && e !== MOVED && e !== EXACT
)

const CREATED = new Date("2026-01-01T00:00:00Z")

type Row = Record<string, unknown>

function row(id: number, fields: Row): Row {
  return {
    id,
    name: `Tracker ${id}`,
    baseUrl: "https://placeholder.example",
    apiPath: "/api/user",
    platformType: "unit3d",
    registrySlug: null,
    isActive: true,
    lastPolledAt: null,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: null,
    qbtTag: null,
    mouseholeUrl: null,
    hasMouseholeToken: false,
    remoteUserId: null,
    platformMeta: null,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    hideUnreadBadges: false,
    isFavorite: false,
    sortOrder: null,
    joinedAt: null,
    lastAccessAt: null,
    profileUrl: null,
    prowlarrInstanceId: null,
    prowlarrIndexerId: null,
    prowlarrOptOut: false,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...fields,
  }
}

let table: Row[] = []
/** The column sets each trackers select asked for. */
let trackerSelects: string[][] = []

function columnKey(column: unknown): string {
  const entry = Object.entries(trackers).find(([, c]) => c === column)
  if (!entry) throw new Error("not a trackers column")
  return entry[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  table = []
  trackerSelects = []
  vi.mocked(db.selectDistinctOn).mockImplementation((() => ({
    from: () => ({ orderBy: async () => [] }),
  })) as never)
  vi.mocked(db.select).mockImplementation(((projection?: Record<string, unknown>) => ({
    from: (source: unknown) => {
      if (source === trackers && projection) trackerSelects.push(Object.keys(projection))
      const rows = (keep: (r: Row) => boolean = () => true) => {
        if (source === appSettings) return [{ storeUsernames: true }]
        if (source !== trackers || !projection) return []
        return table
          .filter(keep)
          .map((r) => Object.fromEntries(Object.keys(projection).map((k) => [k, r[k]])))
      }
      return {
        orderBy: async () => rows(),
        limit: async () => rows(),
        where: ({ eq: [column, value] }: { eq: [unknown, unknown] }) => {
          const keep = (r: Row) => r[columnKey(column)] === value
          return {
            limit: async (n: number) => rows(keep).slice(0, n),
            orderBy: () => ({ limit: async () => [] }),
          }
        },
      }
    },
  })) as never)
})

describe("duplicateOf in the tracker list", () => {
  it("names the tracker an unlinked row's address belongs to when another row uses it", async () => {
    table = [
      row(1, { registrySlug: MOVED.slug, baseUrl: MOVED.url }),
      row(2, { baseUrl: OLD_HOME }),
      row(3, { registrySlug: EXACT.slug, baseUrl: EXACT.url, isActive: false }),
      row(4, { baseUrl: `https://www.${registryHostname(EXACT.url)}` }),
      row(5, { baseUrl: "https://private-vault.invented.example" }),
      row(6, { baseUrl: UNHELD.url }),
    ]

    const list = await getTrackerListForDashboard()

    expect(list.map((t) => [t.id, t.duplicateOf])).toEqual([
      [1, null],
      [2, MOVED.name],
      [3, null],
      [4, EXACT.name],
      [5, null],
      [6, null],
    ])
  })
})

describe("duplicateOf on one tracker", () => {
  it.each<[string, Row[], string | null]>([
    [
      "a row on a domain its tracker used before, while another row uses it",
      [row(1, { registrySlug: MOVED.slug, isActive: false }), row(2, { baseUrl: OLD_HOME })],
      MOVED.name,
    ],
    ["a row whose tracker nobody uses yet", [row(2, { baseUrl: UNHELD.url })], null],
    [
      "a row on a host the list doesn't carry",
      [row(2, { baseUrl: "https://nowhere.example" })],
      null,
    ],
  ])("reads %s", async (_case, rows, duplicateOf) => {
    table = rows

    expect((await getTrackerForClient(2))?.duplicateOf).toBe(duplicateOf)
  })

  it("never looks for a holder for a linked row", async () => {
    table = [row(2, { registrySlug: EXACT.slug, baseUrl: EXACT.url })]

    expect((await getTrackerForClient(2))?.duplicateOf).toBeNull()
    expect(trackerSelects).toHaveLength(1)
  })
})
