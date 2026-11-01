// src/app/api/trackers/[id]/link/link-route.test.ts
//
// Linking points an unlinked row at a tracker in the list. That row was saved for
// another host, so the link takes a new key typed for the tracker picked, and the
// key saved for the old host must never be read, decrypted or sent. The row keeps
// its history, loses the pause and failures from before, and keeps the user's own
// pause. Every refusal leaves the row as it was and encrypts nothing.

import { NextResponse } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  and: (...conditions: unknown[]) => ({ and: conditions }),
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  isNull: (column: unknown) => ({ isNull: column }),
}))
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }))
vi.mock("@/lib/api-helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-helpers")>()),
  authenticate: vi.fn(),
}))
vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn(() => "new-ciphertext"),
  decrypt: vi.fn(() => "decrypted"),
}))
vi.mock("@/lib/server-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server-data")>()),
  getTrackerForClient: vi.fn(async (id: number) => ({ id, linked: true })),
}))
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { getTrackerBySlug, TRACKER_REGISTRY } from "@/data/tracker-registry"
import { ALL_TRACKERS } from "@/data/trackers"
import { authenticate } from "@/lib/api-helpers"
import { maxTokenLengthFor } from "@/lib/credential-forms"
import { decrypt, encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { TRACKER_TOKEN_MAX } from "@/lib/limits"
import { getTrackerForClient } from "@/lib/server-data"
import {
  TRACKER_ALREADY_LINKED_ERROR,
  TRACKER_DEFUNCT_ERROR,
  UNLINKED_RESTORE_ERROR,
} from "@/lib/tracker-status"
import { POST } from "./route"

const AITHER = getTrackerBySlug("aither")
if (!AITHER) throw new Error("the registry has no Aither entry left to test with")
const DEFUNCT = TRACKER_REGISTRY.find((t) => t.defunct)
const DRAFT = ALL_TRACKERS.find((t) => t.draft)
const LONG_FORM = TRACKER_REGISTRY.find(
  (t) => !t.defunct && maxTokenLengthFor(t.platform) > TRACKER_TOKEN_MAX
)
if (!DEFUNCT || !DRAFT || !LONG_FORM) {
  throw new Error("the registry has no defunct, draft or cookie-form entry left to test with")
}

const VALID_KEY = "abcd1234".repeat(8)
const CREATED = new Date("2026-01-01T00:00:00Z")
const PAUSED = new Date("2026-10-25T00:00:00Z")
const USER_PAUSED = new Date("2026-10-20T00:00:00Z")

type Row = Record<string, unknown>
type Condition = { and: Condition[] } | { eq: [unknown, unknown] } | { isNull: unknown }

/** An unlinked row as a restore leaves it, with an account cached from the old host. */
function unlinkedRow(overrides: Row = {}): Row {
  return {
    id: 42,
    registrySlug: null,
    isActive: true,
    baseUrl: "https://old-host.example",
    apiPath: "/api/old",
    platformType: "gazelle",
    encryptedApiToken: "stored-ciphertext",
    pausedAt: PAUSED,
    lastError: UNLINKED_RESTORE_ERROR,
    lastErrorAt: PAUSED,
    consecutiveFailures: 3,
    userPausedAt: USER_PAUSED,
    remoteUserId: "1234",
    avatarData: "base64-avatar",
    avatarMimeType: "image/png",
    avatarCachedAt: PAUSED,
    avatarRemoteUrl: "https://old-host.example/avatar.png",
    updatedAt: CREATED,
    ...overrides,
  }
}

let table: Row[] = []
/** Every projection the route selected, so a test can see what it read. */
let selections: string[][] = []
// Runs between the route's reads and its write.
let beforeWrite: () => void = () => {}

function columnKey(column: unknown): string {
  const entry = Object.entries(trackers).find(([, c]) => c === column)
  if (!entry) throw new Error("not a trackers column")
  return entry[0]
}

function matches(row: Row, condition: Condition): boolean {
  if ("and" in condition) return condition.and.every((c) => matches(row, c))
  if ("eq" in condition) return row[columnKey(condition.eq[0])] === condition.eq[1]
  return row[columnKey(condition.isNull)] === null
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  table = []
  selections = []
  beforeWrite = () => {}
  vi.stubGlobal("fetch", fetchMock)
  vi.mocked(authenticate).mockResolvedValue({ encryptionKey: VALID_KEY })
  vi.mocked(db.select).mockImplementation(((projection: Record<string, unknown>) => {
    selections.push(Object.keys(projection))
    return {
      from: () => ({
        where: (condition: Condition) => ({
          limit: async (n: number) =>
            table
              .filter((row) => matches(row, condition))
              .slice(0, n)
              .map((row) => Object.fromEntries(Object.keys(projection).map((k) => [k, row[k]]))),
        }),
      }),
    }
  }) as never)
  vi.mocked(db.update).mockImplementation((() => ({
    set: (values: Row) => ({
      where: (condition: Condition) => ({
        returning: async () => {
          beforeWrite()
          const hit = table.filter((row) => matches(row, condition))
          for (const row of hit) Object.assign(row, values)
          return hit.map(({ id }) => ({ id }))
        },
      }),
    }),
  })) as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function link(body: unknown, id = "42") {
  return POST(
    new Request(`http://localhost/api/trackers/${id}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  )
}

describe("POST /api/trackers/[id]/link", () => {
  it("points the row at the tracker picked, with the new key, and clears what the old host left", async () => {
    const before = unlinkedRow()
    table = [{ ...before }, { id: 7, registrySlug: "orpheus", isActive: true }]

    const response = await link({ slug: "aither", apiToken: "  fresh-token  " })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 42, linked: true })
    expect(getTrackerForClient).toHaveBeenCalledWith(42)
    expect(encrypt).toHaveBeenCalledWith("fresh-token", Buffer.from(VALID_KEY, "hex"))
    expect(table[0]).toEqual({
      ...before,
      registrySlug: "aither",
      baseUrl: AITHER.url,
      apiPath: AITHER.apiPath,
      platformType: AITHER.platform,
      encryptedApiToken: "new-ciphertext",
      pausedAt: null,
      lastError: null,
      lastErrorAt: null,
      consecutiveFailures: 0,
      remoteUserId: null,
      avatarData: null,
      avatarMimeType: null,
      avatarCachedAt: null,
      avatarRemoteUrl: null,
      updatedAt: expect.any(Date),
    })
    expect(table[0].userPausedAt).toBe(USER_PAUSED)
    expect(table[0].updatedAt).not.toBe(CREATED)
  })

  // The stored key was saved for a host no entry carries. Reading it, decrypting
  // it or sending it anywhere would hand it to the tracker picked.
  it("never reads, decrypts or sends the key saved for the old host", async () => {
    table = [unlinkedRow()]

    const response = await link({ slug: "aither", apiToken: "fresh-token" })

    expect(response.status).toBe(200)
    expect(selections.flat()).not.toContain("encryptedApiToken")
    expect(decrypt).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  const KEY = "fresh-token"

  // Run on id 99, which doesn't exist, so a read before these would answer 404.
  it.each<[string, Row, string | RegExp]>([
    [
      "a slug the list doesn't carry",
      { slug: "no-such-tracker", apiToken: KEY },
      "Unknown tracker",
    ],
    ["a draft entry's slug", { slug: DRAFT.slug, apiToken: KEY }, "Unknown tracker"],
    ["a tracker that shut down", { slug: DEFUNCT.slug, apiToken: KEY }, TRACKER_DEFUNCT_ERROR],
    ["no key", { slug: "aither" }, "apiToken is required"],
    ["a blank key", { slug: "aither", apiToken: "   " }, "apiToken is required"],
    ["a key past the platform's limit", { slug: "aither", apiToken: "t".repeat(501) }, /token/i],
  ])("refuses %s before reading anything", async (_case, body, error) => {
    table = [unlinkedRow()]

    const response = await link(body, "99")

    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(error)
    expect(db.select).not.toHaveBeenCalled()
    expect(encrypt).not.toHaveBeenCalled()
  })

  it.each<[string, Row[], string]>([
    // Already on the tracker asked for, so the held check would refuse it too.
    [
      "a row already linked",
      [unlinkedRow({ registrySlug: "aither" })],
      TRACKER_ALREADY_LINKED_ERROR,
    ],
    [
      "a tracker an active row already uses",
      [unlinkedRow(), { id: 7, registrySlug: "aither", isActive: true }],
      "You already track Aither",
    ],
    [
      "a tracker an archived row already uses",
      [unlinkedRow(), { id: 7, registrySlug: "aither", isActive: false }],
      "You already track Aither",
    ],
  ])("refuses %s and writes nothing", async (_case, rows, error) => {
    table = rows
    const before = structuredClone(table)

    const response = await link({ slug: "aither", apiToken: KEY })

    expect(response.status).toBe(409)
    expect((await response.json()).error).toBe(error)
    expect(encrypt).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
    expect(table).toEqual(before)
  })

  // A cookie or login form stores a longer credential than a token does.
  it("takes a key past the token limit for a tracker whose form allows one", async () => {
    table = [unlinkedRow()]
    const longKey = "k".repeat(TRACKER_TOKEN_MAX + 1)

    const response = await link({ slug: LONG_FORM.slug, apiToken: longKey })

    expect(response.status).toBe(200)
    expect(encrypt).toHaveBeenCalledWith(longKey, expect.any(Buffer))
    expect(table[0].registrySlug).toBe(LONG_FORM.slug)
  })

  // The dialog hands the response to the page as the linked row.
  it("answers 404, not an empty row, when the row is deleted right after the link", async () => {
    table = [unlinkedRow()]
    vi.mocked(getTrackerForClient).mockResolvedValueOnce(null)

    const response = await link({ slug: "aither", apiToken: "fresh-token" })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "Tracker not found" })
  })

  it("answers 404 for a row that doesn't exist", async () => {
    table = [unlinkedRow()]

    const response = await link({ slug: "aither", apiToken: "fresh-token" }, "99")

    expect(response.status).toBe(404)
    expect(db.update).not.toHaveBeenCalled()
  })

  it("keeps a link made while it ran and answers that the row is already linked", async () => {
    table = [unlinkedRow()]
    let linkedMeanwhile: Row | undefined
    beforeWrite = () => {
      Object.assign(table[0], { registrySlug: "orpheus", baseUrl: "https://orpheus.network" })
      linkedMeanwhile = { ...table[0] }
    }

    const response = await link({ slug: "aither", apiToken: "fresh-token" })

    expect(response.status).toBe(409)
    expect((await response.json()).error).toBe(TRACKER_ALREADY_LINKED_ERROR)
    expect(table[0]).toEqual(linkedMeanwhile)
  })

  it("answers 401 without reading anything when the session is gone", async () => {
    vi.mocked(authenticate).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )
    table = [unlinkedRow()]

    const response = await link({ slug: "aither", apiToken: "fresh-token" })

    expect(response.status).toBe(401)
    expect(db.select).not.toHaveBeenCalled()
  })
})
