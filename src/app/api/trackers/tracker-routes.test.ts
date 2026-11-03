// src/app/api/trackers/tracker-routes.test.ts
import { NextResponse } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { TRACKER_REGISTRY } from "@/data/tracker-registry"
import { authenticate, parseJsonBody, parseTrackerId } from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { trackers as trackersTable } from "@/lib/db/schema"
import { pollTracker } from "@/lib/tracker-scheduler"
import {
  TRACKER_DEFUNCT_ERROR,
  TRACKER_UNLINKED_ERROR,
  UNLINKED_RESTORE_ERROR,
} from "@/lib/tracker-status"
import { POST as PollPOST } from "./[id]/poll/route"
import { GET as RolesGET, POST as RolesPOST } from "./[id]/roles/route"
import { DELETE, PATCH } from "./[id]/route"
import { GET as SnapshotsGET } from "./[id]/snapshots/route"
import { POST as PollAllPOST } from "./poll-all/route"
import { GET, POST } from "./route"

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return {
    ...actual,
    authenticate: vi.fn(),
    parseTrackerId: vi.fn(),
    parseJsonBody: vi.fn(),
  }
})

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    selectDistinctOn: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}))

// Operators become plain objects, so a test can replay a WHERE on a plain row.
vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  and: (...conditions: unknown[]) => ({ and: conditions }),
  or: (...conditions: unknown[]) => ({ or: conditions }),
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  ne: (column: unknown, value: unknown) => ({ ne: [column, value] }),
  isNull: (column: unknown) => ({ isNull: column }),
}))

vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn().mockReturnValue("encrypted-token"),
  decrypt: vi.fn().mockReturnValue("decrypted-value"),
}))

vi.mock("@/lib/tunnel", () => ({
  createProxyAgent: vi.fn(),
  buildProxyAgentFromSettings: vi.fn().mockReturnValue(undefined),
  VALID_PROXY_TYPES: new Set(["socks5", "http", "https"]),
}))

vi.mock("@/lib/tracker-scheduler", () => ({
  pollTracker: vi.fn(),
}))

// No Prowlarr configured. Its own query chain is covered in prowlarr-sync.test.ts.
vi.mock("@/lib/prowlarr/sync", () => ({
  loadTrackerProwlarrStates: vi.fn().mockResolvedValue(new Map()),
}))

vi.mock("@/lib/privacy", () => ({
  isRedacted: vi.fn().mockReturnValue(false),
  maskUsername: vi.fn((v: string) => `▓${v.length}`),
}))

vi.mock("@/lib/privacy-db", () => ({
  createPrivacyMask: vi
    .fn()
    .mockResolvedValue((v: string | null | undefined) => (v ? `▓${v.length}` : null)),
  createPrivacyMaskSync: vi.fn().mockReturnValue((v: string | null | undefined) => v ?? null),
}))

vi.mock("@/lib/server-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server-data")>()
  return {
    ...actual,
    getTrackerForClient: vi.fn().mockResolvedValue({
      id: 1,
      name: "Test Tracker",
      baseUrl: "https://example.com",
      platformType: "unit3d",
      isActive: true,
      lastPolledAt: null,
      lastError: null,
      consecutiveFailures: 0,
      pausedAt: null,
      userPausedAt: null,
      color: "#00d4ff",
      qbtTag: null,
      mouseholeUrl: null,
      useProxy: false,
      countCrossSeedUnsatisfied: false,
      hideUnreadBadges: false,
      isFavorite: false,
      sortOrder: null,
      joinedAt: null,
      lastAccessAt: null,
      remoteUserId: null,
      platformMeta: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      latestStats: null,
    }),
  }
})

const VALID_KEY = "abcd1234".repeat(8)

function makeRequest(url: string, body?: Record<string, unknown>, method = "GET"): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

type Condition =
  | { and: Condition[] }
  | { or: Condition[] }
  | { eq: [unknown, unknown] }
  | { ne: [unknown, unknown] }
  | { isNull: unknown }

/** The trackers key a column object belongs to. */
function columnKey(column: unknown): string {
  const entry = Object.entries(trackersTable).find(([, c]) => c === column)
  if (!entry) throw new Error("not a trackers column")
  return entry[0]
}

/** SQL three-valued logic: null is unknown, and only true matches a row. */
function holds(cond: Condition, row: Record<string, unknown>): boolean | null {
  if ("and" in cond) {
    const results = cond.and.map((c) => holds(c, row))
    return results.includes(false) ? false : results.includes(null) ? null : true
  }
  if ("or" in cond) {
    const results = cond.or.map((c) => holds(c, row))
    return results.includes(true) ? true : results.includes(null) ? null : false
  }
  if ("isNull" in cond) return row[columnKey(cond.isNull)] === null
  const [column, value] = "eq" in cond ? cond.eq : cond.ne
  const stored = row[columnKey(column)]
  if (stored === null) return null
  return "eq" in cond ? stored === value : stored !== value
}

describe("GET /api/trackers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
  })

  it("returns tracker list with latest stats", async () => {
    const tracker = {
      id: 1,
      name: "Aither",
      baseUrl: "https://aither.cc",
      platformType: "unit3d",
      isActive: true,
      lastPolledAt: null,
      lastError: null,
      color: CHART_THEME.accent,
      encryptedApiToken: "should-not-appear",
    }
    const snapshot = {
      id: 1,
      trackerId: 1,
      ratio: 2.5,
      uploadedBytes: BigInt("500000000000"),
      downloadedBytes: BigInt("200000000000"),
      seedingCount: 10,
      leechingCount: 2,
      username: "user1",
      group: "VIP",
      polledAt: new Date(),
      bufferBytes: null,
      seedbonus: null,
      hitAndRuns: null,
    }

    // Call 1: db.select().from(trackers).orderBy(...)
    const mockOrderByTrackers = vi.fn().mockResolvedValue([tracker])
    const mockFromTrackers = vi.fn().mockReturnValue({ orderBy: mockOrderByTrackers })
    // Call 2: db.select({storeUsernames}).from(appSettings).limit(1)
    const mockSettingsLimit = vi.fn().mockResolvedValue([{ storeUsernames: true }])
    const mockSettingsFrom = vi.fn().mockReturnValue({ limit: mockSettingsLimit })

    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ from: mockFromTrackers })
      .mockReturnValueOnce({ from: mockSettingsFrom })
    // DISTINCT ON query via db.selectDistinctOn
    ;(db.selectDistinctOn as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([snapshot]),
      }),
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe(1)
    expect(data[0].name).toBe("Aither")
    expect(data[0].latestStats).not.toBeNull()
    expect(data[0].latestStats.ratio).toBe(2.5)
  })

  it("returns empty array when no trackers", async () => {
    // Call 1: db.select().from(trackers).orderBy(...)
    const mockOrderBy = vi.fn().mockResolvedValue([])
    const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
    // Call 2: db.select({storeUsernames}).from(appSettings).limit(1)
    const mockSettingsLimit = vi.fn().mockResolvedValue([{ storeUsernames: true }])
    const mockSettingsFrom = vi.fn().mockReturnValue({ limit: mockSettingsLimit })

    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ from: mockFrom })
      .mockReturnValueOnce({ from: mockSettingsFrom })
    // DISTINCT ON query via db.selectDistinctOn
    ;(db.selectDistinctOn as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })

  it("returns 401 when unauthenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const response = await GET()
    expect(response.status).toBe(401)
  })

  it("never includes encryptedApiToken in response", async () => {
    const tracker = {
      id: 1,
      name: "Aither",
      baseUrl: "https://aither.cc",
      platformType: "unit3d",
      isActive: true,
      lastPolledAt: null,
      lastError: null,
      color: CHART_THEME.accent,
      encryptedApiToken: "super-secret-token",
    }

    // Call 1: db.select().from(trackers).orderBy(...)
    const mockOrderBy = vi.fn().mockResolvedValue([tracker])
    const mockFromTrackers = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
    // Call 2: db.select({storeUsernames}).from(appSettings).limit(1)
    const mockSettingsLimit = vi.fn().mockResolvedValue([{ storeUsernames: true }])
    const mockSettingsFrom = vi.fn().mockReturnValue({ limit: mockSettingsLimit })

    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ from: mockFromTrackers })
      .mockReturnValueOnce({ from: mockSettingsFrom })
    // DISTINCT ON query via db.selectDistinctOn
    ;(db.selectDistinctOn as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    })

    const response = await GET()
    const data = await response.json()

    expect(data[0]).not.toHaveProperty("encryptedApiToken")
  })
})

describe("POST /api/trackers", () => {
  // The rows the held-slug check reads, matched by its WHERE.
  let table: Record<string, unknown>[] = []
  // The settings row the proxy default reads.
  let settingsRows: Record<string, unknown>[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    table = []
    settingsRows = [{ proxyEnabled: false }]
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: () => ({
        limit: async () => settingsRows,
        where: (where: Condition) => ({
          limit: async (n: number) =>
            table
              .filter((row) => holds(where, row) === true)
              .slice(0, n)
              .map(({ id }) => ({ id })),
        }),
      }),
    }))
  })

  afterEach(() => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReset()
  })

  it("returns 201 with id and name on happy path", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Aither",
      slug: "aither",
      apiToken: "mytoken",
    })

    const mockReturning = vi.fn().mockResolvedValue([{ id: 42, name: "Aither" }])
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: "Aither",
        slug: "aither",
        apiToken: "mytoken",
      },
      "POST"
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data).toEqual({ id: 42, name: "Aither" })
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ registrySlug: "aither", baseUrl: "https://aither.cc" })
    )
  })

  // Only an explicit false polls directly. Anything else follows the proxy switch,
  // so a direct API call can't add a tracker that polls around a proxy that is on,
  // even one whose settings are broken: its polls are refused until they're fixed.
  it.each<[string, Record<string, unknown>[], unknown, boolean]>([
    ["the proxy is on and no choice is sent", [{ proxyEnabled: true }], undefined, true],
    [
      "the proxy is on but unusable and no choice is sent",
      [{ proxyEnabled: true, proxyHost: "proxy.example.test:1080" }],
      undefined,
      true,
    ],
    ["the proxy is on and the choice is true", [{ proxyEnabled: true }], true, true],
    ["the proxy is on and the choice is false", [{ proxyEnabled: true }], false, false],
    [
      'the proxy is on and the choice is the string "false"',
      [{ proxyEnabled: true }],
      "false",
      true,
    ],
    ["the proxy is off, whatever the choice", [{ proxyEnabled: false }], true, false],
    ["there is no settings row", [], true, false],
  ])("stores useProxy when %s", async (_case, rows, useProxy, stored) => {
    settingsRows = rows
    const body = { name: "Aither", slug: "aither", apiToken: "mytoken", useProxy }
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)
    const mockReturning = vi.fn().mockResolvedValue([{ id: 42, name: "Aither" }])
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })

    const response = await POST(makeRequest("http://localhost/api/trackers", body, "POST"))

    expect(response.status).toBe(201)
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ useProxy: stored }))
  })

  it("takes the platform, API path and default color from the registry entry", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Orpheus",
      slug: "orpheus",
      apiToken: "mytoken",
    })

    const mockReturning = vi.fn().mockResolvedValue([{ id: 7, name: "Orpheus" }])
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: "Orpheus",
        slug: "orpheus",
        apiToken: "mytoken",
      },
      "POST"
    )
    const response = await POST(request)

    expect(response.status).toBe(201)
    expect(mockValues.mock.calls[0][0]).toMatchObject({
      registrySlug: "orpheus",
      baseUrl: "https://orpheus.network",
      platformType: "gazelle",
      apiPath: "/ajax.php",
      color: "#1daf8b",
    })
  })

  it("stores the registry URL and platform, not the ones the body carries", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Aither",
      slug: "aither",
      apiToken: "mytoken",
      baseUrl: "http://169.254.169.254/latest/meta-data",
      platformType: "gazelle",
    })

    const mockReturning = vi.fn().mockResolvedValue([{ id: 42, name: "Aither" }])
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: "Aither",
        slug: "aither",
        apiToken: "mytoken",
        baseUrl: "http://169.254.169.254/latest/meta-data",
        platformType: "gazelle",
      },
      "POST"
    )
    const response = await POST(request)

    expect(response.status).toBe(201)
    expect(mockValues.mock.calls[0][0]).toMatchObject({
      baseUrl: "https://aither.cc",
      platformType: "unit3d",
    })
  })

  it("returns 400 for a slug the registry does not carry", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Aither",
      slug: "no-such-tracker",
      apiToken: "mytoken",
    })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: "Aither",
        slug: "no-such-tracker",
        apiToken: "mytoken",
      },
      "POST"
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Unknown tracker")
  })

  it("returns 400 when required fields are missing", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Aither",
    })

    const request = makeRequest("http://localhost/api/trackers", { name: "Aither" }, "POST")
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("required")
  })

  it("returns 400 when name exceeds 100 characters", async () => {
    const longName = "a".repeat(101)
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: longName,
      slug: "aither",
      apiToken: "mytoken",
    })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: longName,
        slug: "aither",
        apiToken: "mytoken",
      },
      "POST"
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/name/i)
  })

  it("returns 400 when API token exceeds 500 characters", async () => {
    const longToken = "t".repeat(501)
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Aither",
      slug: "aither",
      apiToken: longToken,
    })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: "Aither",
        slug: "aither",
        apiToken: longToken,
      },
      "POST"
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/token/i)
  })

  it("returns 400 when color exceeds 20 characters", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Aither",
      slug: "aither",
      apiToken: "mytoken",
      color: `#${"a".repeat(20)}`,
    })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: "Aither",
        slug: "aither",
        apiToken: "mytoken",
        color: `#${"a".repeat(20)}`,
      },
      "POST"
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/color/i)
  })

  it("returns 401 when unauthenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: "Aither",
        slug: "aither",
        apiToken: "mytoken",
      },
      "POST"
    )
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it("encrypts the Mousehole API token into its own column, never into the URL", async () => {
    const body = {
      name: "MAM",
      slug: "myanonamouse",
      apiToken: "mytoken",
      mouseholeUrl: "http://mousehole-test:5010",
      mouseholeToken: " fake-mousehole-token-7f3a ",
    }
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)

    const mockReturning = vi.fn().mockResolvedValue([{ id: 9, name: "MAM" }])
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })

    const response = await POST(makeRequest("http://localhost/api/trackers", body, "POST"))

    expect(response.status).toBe(201)
    expect(encrypt).toHaveBeenCalledWith("fake-mousehole-token-7f3a", expect.any(Buffer))
    const inserted = mockValues.mock.calls[0][0]
    expect(inserted.encryptedMouseholeToken).toBe("encrypted-token")
    expect(inserted.mouseholeUrl).toBe("http://mousehole-test:5010")
  })

  it("rejects a Mousehole API token holding a control character without echoing it", async () => {
    const body = {
      name: "MAM",
      slug: "myanonamouse",
      apiToken: "mytoken",
      mouseholeToken: "fake-token\r\nleak",
    }
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)

    const response = await POST(makeRequest("http://localhost/api/trackers", body, "POST"))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/control character \(U\+000D\) at position 10/)
    expect(data.error).not.toContain("fake-token")
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("rejects a Mousehole API token holding a non-Latin-1 character without echoing it", async () => {
    const body = {
      name: "MAM",
      slug: "myanonamouse",
      apiToken: "mytoken",
      mouseholeToken: "fake-token…",
    }
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)

    const response = await POST(makeRequest("http://localhost/api/trackers", body, "POST"))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/non-Latin-1 character \(U\+2026\) at position 10/)
    expect(data.error).not.toContain("fake-token")
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("rejects a Mousehole URL that carries userinfo and points at the token field", async () => {
    const body = {
      name: "MAM",
      slug: "myanonamouse",
      apiToken: "mytoken",
      mouseholeUrl: "http://:fake-token-7f3a@mousehole-test:5010",
    }
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)

    const response = await POST(makeRequest("http://localhost/api/trackers", body, "POST"))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/Mousehole API token field/)
    expect(data.error).not.toContain("fake-token-7f3a")
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("rejects a Mousehole API token without a Mousehole URL", async () => {
    const body = {
      name: "MAM",
      slug: "myanonamouse",
      apiToken: "mytoken",
      mouseholeToken: "fake-mousehole-token-7f3a",
    }
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)

    const response = await POST(makeRequest("http://localhost/api/trackers", body, "POST"))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Mousehole API token needs a Mousehole URL")
    expect(db.insert).not.toHaveBeenCalled()
  })

  // An archived row still holds its slug. Reactivating it brings that tracker
  // back, and a second row would split its history.
  it.each([
    ["an active", true],
    ["an archived", false],
  ])(
    "refuses a tracker %s row already uses, before encrypting anything",
    async (_holder, isActive) => {
      table = [{ id: 3, registrySlug: "aither", isActive }]
      const body = { name: "Aither", slug: "aither", apiToken: "mytoken" }
      ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)

      const response = await POST(makeRequest("http://localhost/api/trackers", body, "POST"))

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({ error: "You already track Aither" })
      expect(encrypt).not.toHaveBeenCalled()
      expect(db.insert).not.toHaveBeenCalled()
    }
  )

  it("adds a tracker while other rows hold other slugs", async () => {
    table = [
      { id: 3, registrySlug: "orpheus", isActive: true },
      { id: 4, registrySlug: null, isActive: false },
    ]
    const body = { name: "Aither", slug: "aither", apiToken: "mytoken" }
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)
    const mockReturning = vi.fn().mockResolvedValue([{ id: 42, name: "Aither" }])
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: mockReturning }),
    })

    const response = await POST(makeRequest("http://localhost/api/trackers", body, "POST"))

    expect(response.status).toBe(201)
  })

  it("refuses a tracker that has shut down, before reading or encrypting anything", async () => {
    const defunct = TRACKER_REGISTRY.find((t) => t.defunct)
    if (!defunct) throw new Error("the registry has no defunct entry left to test with")
    const body = { name: defunct.name, slug: defunct.slug, apiToken: "mytoken" }
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)

    const response = await POST(makeRequest("http://localhost/api/trackers", body, "POST"))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: TRACKER_DEFUNCT_ERROR })
    expect(db.select).not.toHaveBeenCalled()
    expect(encrypt).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })
})

describe("PATCH /api/trackers/[id]", () => {
  /** The row PATCH reads first, before it encrypts or writes anything. */
  function mockExistingRow(rows: Record<string, unknown>[]) {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
      }),
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(1)
    // A linked row, for the tests that queue no select of their own.
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ registrySlug: "aither", mouseholeUrl: null }]),
        }),
      }),
    })
  })

  afterEach(() => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReset()
  })

  it("answers its own 500 when reading the tracker fails, before encrypting anything", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ apiToken: "CANARY-token" })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error("connection refused")),
        }),
      }),
    })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { apiToken: "CANARY-token" },
      "PATCH"
    )
    const response = await PATCH(request, { params: Promise.resolve({ id: "1" }) })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Failed to load tracker" })
    expect(encrypt).not.toHaveBeenCalled()
  })

  it("answers 404 for a missing tracker before encrypting or writing anything", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ apiToken: "CANARY-token" })
    mockExistingRow([])

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { apiToken: "CANARY-token" },
      "PATCH"
    )
    const response = await PATCH(request, { params: Promise.resolve({ id: "1" }) })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Tracker not found" })
    expect(encrypt).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  it("returns 200 on happy path", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Updated Name",
    })

    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { name: "Updated Name" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe(1)
  })

  it("returns 400 when name exceeds 100 characters", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "a".repeat(101),
    })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { name: "a".repeat(101) },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/name/i)
  })

  // The URL is registry data copied in at create time, not a field a user edits,
  // so an edit body carrying one, valid or hostile, changes nothing.
  it("ignores a baseUrl in the body", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Updated Name",
      baseUrl: "http://localhost:9000/internal",
    })

    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { name: "Updated Name", baseUrl: "http://localhost:9000/internal" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    expect(mockSet).toHaveBeenCalledTimes(1)
    expect(mockSet.mock.calls[0][0]).not.toHaveProperty("baseUrl")
  })

  function mockPinInstance(rows: { id: number }[]) {
    mockExistingRow([{ registrySlug: "aither", mouseholeUrl: null }])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
      }),
    })
  }

  async function patchWith(body: Record<string, unknown>) {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)
    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })
    const request = makeRequest("http://localhost/api/trackers/1", {}, "PATCH")
    const response = await PATCH(request, { params: Promise.resolve({ id: "1" }) })
    return { response, mockSet }
  }

  it("pins a Prowlarr indexer of an existing instance", async () => {
    mockPinInstance([{ id: 2 }])
    const { response, mockSet } = await patchWith({ prowlarrPin: { instanceId: 2, indexerId: 15 } })

    expect(response.status).toBe(200)
    expect(mockSet.mock.calls[0][0]).toMatchObject({ prowlarrInstanceId: 2, prowlarrIndexerId: 15 })
  })

  it("clears the pin and stores the opt-out", async () => {
    const { response, mockSet } = await patchWith({ prowlarrPin: null, prowlarrOptOut: true })

    expect(response.status).toBe(200)
    expect(mockSet.mock.calls[0][0]).toMatchObject({
      prowlarrInstanceId: null,
      prowlarrIndexerId: null,
      prowlarrOptOut: true,
    })
  })

  it("refuses a pin to an instance that does not exist", async () => {
    mockPinInstance([])
    const { response } = await patchWith({ prowlarrPin: { instanceId: 9, indexerId: 15 } })

    expect(response.status).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })

  it.each([
    "2:15",
    { instanceId: 2 },
    { instanceId: 0, indexerId: 1 },
    { instanceId: 1.5, indexerId: 1 },
    { instanceId: 2 ** 31, indexerId: 1 },
  ])("rejects the Prowlarr pin %j", async (value) => {
    const { response } = await patchWith({ prowlarrPin: value })

    expect(response.status).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })

  it("returns 400 when color exceeds 20 characters", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      color: `#${"a".repeat(20)}`,
    })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { color: `#${"a".repeat(20)}` },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/color/i)
  })

  it("returns 400 when API token exceeds limit for non-avistaz tracker", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      apiToken: "t".repeat(501),
    })

    // Mock the slug lookup: select → from → where → limit
    const mockLimit = vi.fn().mockResolvedValue([{ registrySlug: "aither" }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: mockFrom })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { apiToken: "t".repeat(501) },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/token/i)
  })

  // A stored platform copy can be stale, so the cap follows the registry entry.
  // AvistaZ takes a cookie blob, which may run far past Gazelle's token cap.
  it("caps a new token by the registry entry's platform, not the stored copy", async () => {
    const token = "t".repeat(501)
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ apiToken: token })

    const mockLimit = vi
      .fn()
      .mockResolvedValue([{ platformType: "gazelle", registrySlug: "avistaz" }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: mockFrom })

    const mockUpdateWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest("http://localhost/api/trackers/1", { apiToken: token }, "PATCH")
    const response = await PATCH(request, { params: Promise.resolve({ id: "1" }) })

    expect(response.status).toBe(200)
    expect(mockSet.mock.calls[0]?.[0]).toMatchObject({ encryptedApiToken: "encrypted-token" })
  })

  // A new token can sign in as another account, whose id and avatar the next poll fetches.
  it("clears the cached member id and avatar when the API token is replaced", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ apiToken: "new-token" })

    const mockLimit = vi.fn().mockResolvedValue([{ registrySlug: "aither" }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: mockFrom })

    const mockUpdateWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { apiToken: "new-token" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    expect(mockSet.mock.calls[0]?.[0]).toMatchObject({
      encryptedApiToken: "encrypted-token",
      remoteUserId: null,
      avatarData: null,
      avatarMimeType: null,
      avatarCachedAt: null,
      avatarRemoteUrl: null,
    })
  })

  // A key reaches an unlinked row only by linking it, which tests the key on the
  // tracker picked. The settings sheet hides Change key there, and this refuses it.
  it.each([
    ["no slug", null],
    ["a slug the list no longer carries", "gone-tracker"],
  ])("refuses a new API token for a row with %s", async (_row, registrySlug) => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ apiToken: "new-token" })
    const mockLimit = vi.fn().mockResolvedValue([{ registrySlug }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: mockFrom })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { apiToken: "new-token" },
      "PATCH"
    )
    const response = await PATCH(request, { params: Promise.resolve({ id: "1" }) })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: TRACKER_UNLINKED_ERROR })
    expect(encrypt).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  it("keeps the cached member id and avatar when the body has no API token", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ name: "Renamed" })

    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest("http://localhost/api/trackers/1", { name: "Renamed" }, "PATCH")
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    const updates = mockSet.mock.calls[0]?.[0]
    for (const column of [
      "remoteUserId",
      "avatarData",
      "avatarMimeType",
      "avatarCachedAt",
      "avatarRemoteUrl",
    ]) {
      expect(updates).not.toHaveProperty(column)
    }
  })

  it("accepts boolean isActive update", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      isActive: false,
    })

    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest("http://localhost/api/trackers/1", { isActive: false }, "PATCH")
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe(1)
  })

  it("returns 401 when unauthenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const request = makeRequest("http://localhost/api/trackers/1", { name: "x" }, "PATCH")
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    expect(response.status).toBe(401)
  })

  it("returns 400 for invalid tracker ID", async () => {
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Invalid tracker ID" }, { status: 400 })
    )

    const request = makeRequest("http://localhost/api/trackers/abc", { name: "x" }, "PATCH")
    const params = Promise.resolve({ id: "abc" })
    const response = await PATCH(request, { params })
    expect(response.status).toBe(400)
  })

  it("accepts a valid lastAccessAt date", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      lastAccessAt: "2026-01-15",
    })

    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { lastAccessAt: "2026-01-15" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    const updates = mockSet.mock.calls[0]?.[0]
    expect(updates.lastAccessAt).toBe("2026-01-15")
  })

  it("clears lastAccessAt when set to null", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      lastAccessAt: null,
    })

    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest("http://localhost/api/trackers/1", { lastAccessAt: null }, "PATCH")
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    const updates = mockSet.mock.calls[0]?.[0]
    expect(updates.lastAccessAt).toBeNull()
  })

  it("returns 400 for malformed lastAccessAt", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      lastAccessAt: "not-a-date",
    })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { lastAccessAt: "not-a-date" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("lastAccessAt must be a valid YYYY-MM-DD date")
  })

  it("returns 400 for a future lastAccessAt date", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      lastAccessAt: "2099-01-01",
    })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { lastAccessAt: "2099-01-01" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Last login date cannot be in the future")
  })

  it("returns 400 when lastAccessAt is neither a string nor null", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      lastAccessAt: 12345,
    })

    const request = makeRequest("http://localhost/api/trackers/1", { lastAccessAt: 12345 }, "PATCH")
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("lastAccessAt must be a valid YYYY-MM-DD date or null")
  })

  it("returns 400 when joinedAt is neither a string nor null", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ joinedAt: 12345 })

    const request = makeRequest("http://localhost/api/trackers/1", { joinedAt: 12345 }, "PATCH")
    const response = await PATCH(request, { params: Promise.resolve({ id: "1" }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("joinedAt must be a valid YYYY-MM-DD date or null")
  })

  it("sets userPausedAt when pollingPaused is true", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      pollingPaused: true,
    })

    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest("http://localhost/api/trackers/1", { pollingPaused: true }, "PATCH")
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    const updates = mockSet.mock.calls[0]?.[0]
    expect(updates.userPausedAt).toBeInstanceOf(Date)
    expect(updates.pausedAt).toBeUndefined()
  })

  /** Runs PATCH and applies its tracker updates to `row` the way Postgres would. */
  async function patchRow(body: Record<string, unknown>, row: Record<string, unknown>) {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)
    // The un-pause reads the slug to decide whether the auto-pause may come off.
    const mockLimit = vi.fn().mockResolvedValue([{ registrySlug: row.registrySlug }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: mockWhere }),
    })
    const updates: { values: Record<string, unknown>; where: Condition }[] = []
    ;(db.update as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      set: (values: Record<string, unknown>) => ({
        where: (where: Condition) => {
          updates.push({ values, where })
          return Promise.resolve([])
        },
      }),
    }))
    const request = makeRequest("http://localhost/api/trackers/1", body, "PATCH")
    const response = await PATCH(request, { params: Promise.resolve({ id: "1" }) })
    for (const { values, where } of updates) {
      if (holds(where, row) === true) Object.assign(row, values)
    }
    return response
  }

  it("clears userPausedAt and auto-pause state when pollingPaused is false", async () => {
    const row = {
      id: 1,
      registrySlug: "aither",
      userPausedAt: new Date(),
      pausedAt: new Date(),
      consecutiveFailures: 4,
      lastError: "HTTP 503",
      lastErrorAt: new Date(),
    }

    const response = await patchRow({ pollingPaused: false }, row)

    expect(response.status).toBe(200)
    expect(row).toMatchObject({
      userPausedAt: null,
      pausedAt: null,
      consecutiveFailures: 0,
      lastError: null,
      lastErrorAt: null,
    })
  })

  // A condition on lastError would have to let NULL through, which ne() alone doesn't.
  it("clears the auto-pause of a linked row whose lastError is null", async () => {
    const row = {
      id: 1,
      registrySlug: "aither",
      userPausedAt: new Date(),
      pausedAt: new Date(),
      consecutiveFailures: 4,
      lastError: null,
      lastErrorAt: null,
    }

    const response = await patchRow({ pollingPaused: false }, row)

    expect(response.status).toBe(200)
    expect(row).toMatchObject({ userPausedAt: null, pausedAt: null, consecutiveFailures: 0 })
  })

  // On a row the user also paused, the banner shows only the user pause, so the
  // toggle must not send an unlinked row back to polling or drop its reason.
  it.each([
    ["a restore's marker", null, UNLINKED_RESTORE_ERROR],
    [
      "a slug the list no longer carries",
      "gone-tracker",
      "Not in the tracker list, so it isn't polled",
    ],
  ])(
    "keeps the auto-pause of an unlinked row with %s when pollingPaused is false",
    async (_form, registrySlug, lastError) => {
      const pausedAt = new Date()
      const row = {
        id: 1,
        registrySlug,
        userPausedAt: new Date(),
        pausedAt,
        consecutiveFailures: 0,
        lastError,
        lastErrorAt: pausedAt,
      }

      const response = await patchRow({ pollingPaused: false }, row)

      expect(response.status).toBe(200)
      expect(row).toMatchObject({ userPausedAt: null, pausedAt, lastError, lastErrorAt: pausedAt })
    }
  )

  it("ignores non-boolean pollingPaused values", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      pollingPaused: "yes",
    })

    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { pollingPaused: "yes" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    const updates = mockSet.mock.calls[0]?.[0]
    expect(updates.userPausedAt).toBeUndefined()
    expect(updates.pausedAt).toBeUndefined()
  })

  /** The row read when a token arrives without a URL in the body. */
  function mockStoredMouseholeUrl(mouseholeUrl: string | null) {
    const mockLimit = vi.fn().mockResolvedValue([{ mouseholeUrl }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: mockFrom })
  }

  it("replaces the Mousehole API token when the body carries one", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      mouseholeToken: "fake-mousehole-token-7f3a",
    })
    mockStoredMouseholeUrl("http://mousehole-test:5010")

    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { mouseholeToken: "fake-mousehole-token-7f3a" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    expect(encrypt).toHaveBeenCalledWith("fake-mousehole-token-7f3a", expect.any(Buffer))
    expect(mockSet.mock.calls[0]?.[0].encryptedMouseholeToken).toBe("encrypted-token")
  })

  it("clears the Mousehole API token when the body carries an empty string", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ mouseholeToken: "" })

    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest("http://localhost/api/trackers/1", { mouseholeToken: "" }, "PATCH")
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    const updates = mockSet.mock.calls[0]?.[0]
    expect(updates).toHaveProperty("encryptedMouseholeToken")
    expect(updates.encryptedMouseholeToken).toBeNull()
    expect(encrypt).not.toHaveBeenCalled()
  })

  it("rejects a Mousehole API token when the body clears the URL", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      mouseholeUrl: "",
      mouseholeToken: "fake-mousehole-token-7f3a",
    })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { mouseholeUrl: "", mouseholeToken: "fake-mousehole-token-7f3a" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Mousehole API token needs a Mousehole URL")
    expect(db.update).not.toHaveBeenCalled()
  })

  it("clears the token when the URL is emptied", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ mouseholeUrl: "" })

    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest("http://localhost/api/trackers/1", { mouseholeUrl: "" }, "PATCH")
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    const updates = mockSet.mock.calls[0]?.[0]
    expect(updates).toHaveProperty("mouseholeUrl", null)
    expect(updates).toHaveProperty("encryptedMouseholeToken", null)
  })

  it("saves a URL and token sent together, checking the token against the body's URL", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      mouseholeUrl: "http://mousehole-test:5010",
      mouseholeToken: "fake-mousehole-token-7f3a",
    })
    // No URL is stored, so only the one in the body can let the token through.
    mockExistingRow([{ registrySlug: "aither", mouseholeUrl: null }])

    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { mouseholeUrl: "http://mousehole-test:5010", mouseholeToken: "fake-mousehole-token-7f3a" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    expect(encrypt).toHaveBeenCalledWith("fake-mousehole-token-7f3a", expect.any(Buffer))
    const updates = mockSet.mock.calls[0]?.[0]
    expect(updates.mouseholeUrl).toBe("http://mousehole-test:5010")
    expect(updates.encryptedMouseholeToken).toBe("encrypted-token")
  })

  it("rejects a Mousehole API token when the row has no URL either", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      mouseholeToken: "fake-mousehole-token-7f3a",
    })
    mockStoredMouseholeUrl(null)

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { mouseholeToken: "fake-mousehole-token-7f3a" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Mousehole API token needs a Mousehole URL")
    expect(db.update).not.toHaveBeenCalled()
  })

  it("leaves the Mousehole API token alone when the body omits it", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ name: "Updated Name" })

    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { name: "Updated Name" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    expect(mockSet.mock.calls[0]?.[0]).not.toHaveProperty("encryptedMouseholeToken")
  })

  it("rejects a control character in a new Mousehole API token without writing", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      mouseholeToken: "fake-token\r\nleak",
    })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { mouseholeToken: "fake-token\r\nleak" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/control character \(U\+000D\) at position 10/)
    expect(data.error).not.toContain("fake-token")
    expect(db.update).not.toHaveBeenCalled()
  })

  it("rejects a Mousehole URL that carries userinfo without writing", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      mouseholeUrl: "http://:fake-token-7f3a@mousehole-test:5010",
    })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { mouseholeUrl: "http://:fake-token-7f3a@mousehole-test:5010" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/Mousehole API token field/)
    expect(data.error).not.toContain("fake-token-7f3a")
    expect(db.update).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/trackers/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(1)
  })

  it("returns 200 on happy path", async () => {
    const mockWhere = vi.fn().mockResolvedValue([])
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: mockWhere })

    const request = makeRequest("http://localhost/api/trackers/1", undefined, "DELETE")
    const params = Promise.resolve({ id: "1" })
    const response = await DELETE(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it("returns 401 when unauthenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const request = makeRequest("http://localhost/api/trackers/1", undefined, "DELETE")
    const params = Promise.resolve({ id: "1" })
    const response = await DELETE(request, { params })
    expect(response.status).toBe(401)
  })

  it("returns 400 for invalid tracker ID", async () => {
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Invalid tracker ID" }, { status: 400 })
    )

    const request = makeRequest("http://localhost/api/trackers/abc", undefined, "DELETE")
    const params = Promise.resolve({ id: "abc" })
    const response = await DELETE(request, { params })
    expect(response.status).toBe(400)
  })
})

describe("POST /api/trackers/[id]/poll", () => {
  const PREVIOUS_POLL = new Date("2026-11-01T10:00:00Z")
  let trackerRow: Record<string, unknown> | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(1)
    trackerRow = { registrySlug: "aither", lastPolledAt: PREVIOUS_POLL }

    // Poll route:
    //   1. db.select({ registrySlug, lastPolledAt }).from(trackers).where(...).limit(1), the tracker
    //   2. db.update(trackers).set(...).where(...).returning(...), atomic cooldown claim
    //   3. db.select({...}).from(appSettings).limit(1), settings query
    //   4. db.update(trackers).set(...).where(...), the claim given back after a poll that didn't succeed
    const mockReturning = vi.fn().mockResolvedValue([{ id: 1 }])
    const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementation((cols: Record<string, unknown>) => {
      if ("registrySlug" in cols) {
        const mockTrackerLimit = vi.fn().mockResolvedValue(trackerRow ? [trackerRow] : [])
        const mockTrackerWhere = vi.fn().mockReturnValue({ limit: mockTrackerLimit })
        return { from: vi.fn().mockReturnValue({ where: mockTrackerWhere }) }
      }
      const mockLimit = vi.fn().mockResolvedValue([
        {
          storeUsernames: true,
          proxyEnabled: false,
          proxyType: "socks5",
          proxyHost: null,
          proxyPort: 1080,
          proxyUsername: null,
          encryptedProxyPassword: null,
        },
      ])
      const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit })
      return { from: mockFrom }
    })
  })

  // A failed poll must not read as "last polled just now", or the scheduler
  // would wait a full interval before trying again.
  it.each<[string, () => void, number]>([
    ["records a failure", () => vi.mocked(pollTracker).mockResolvedValue(false), 200],
    ["throws", () => vi.mocked(pollTracker).mockRejectedValue(new Error("db down")), 500],
  ])("gives the cooldown claim back when the poll %s", async (_case, arrange, status) => {
    arrange()
    const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")

    const response = await PollPOST(request, { params: Promise.resolve({ id: "1" }) })

    expect(response.status).toBe(status)
    // Both updates share the mocked chain: the claim is call 1, the give-back call 2.
    expect(db.update).toHaveBeenCalledTimes(2)
    const set = vi.mocked(db.update).mock.results[1]?.value.set as ReturnType<typeof vi.fn>
    const claimedAt = set.mock.calls[0][0].lastPolledAt
    expect(set).toHaveBeenNthCalledWith(2, { lastPolledAt: PREVIOUS_POLL })
    // Only while the claim is still there, so a poll that succeeded meanwhile keeps its time.
    expect(set.mock.results[1]?.value.where).toHaveBeenNthCalledWith(2, {
      and: [{ eq: [trackersTable.id, 1] }, { eq: [trackersTable.lastPolledAt, claimedAt] }],
    })
  })

  it("keeps the claim as the poll time when the poll succeeds", async () => {
    vi.mocked(pollTracker).mockResolvedValue(true)
    const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")

    const response = await PollPOST(request, { params: Promise.resolve({ id: "1" }) })

    expect(response.status).toBe(200)
    expect(db.update).toHaveBeenCalledTimes(1)
  })

  it("returns 200 on happy path", async () => {
    ;(pollTracker as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
    const params = Promise.resolve({ id: "1" })
    const response = await PollPOST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  // Still 200, so Poll Now refetches the row and shows the error it recorded.
  it("answers success false for a poll that recorded a failure", async () => {
    vi.mocked(pollTracker).mockResolvedValue(false)

    const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
    const response = await PollPOST(request, { params: Promise.resolve({ id: "1" }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: false })
  })

  it("returns 500 with generic message when poll fails", async () => {
    ;(pollTracker as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection refused"))

    const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
    const params = Promise.resolve({ id: "1" })
    const response = await PollPOST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe("Poll failed")
  })

  it("returns 'Poll failed' when pollTracker rejects with non-Error", async () => {
    ;(pollTracker as ReturnType<typeof vi.fn>).mockRejectedValue("oops")

    const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
    const params = Promise.resolve({ id: "1" })
    const response = await PollPOST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe("Poll failed")
  })

  it("returns 503 without claiming the cooldown or polling when outbound requests are off", async () => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", "true")
    try {
      const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
      const params = Promise.resolve({ id: "1" })
      const response = await PollPOST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error).toBe(
        "Outbound requests are turned off on this instance (DISABLE_OUTBOUND_REQUESTS)"
      )
      expect(db.update).not.toHaveBeenCalled()
      expect(pollTracker).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it("still returns 401 before the outbound refusal when unauthenticated", async () => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", "true")
    try {
      ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      )
      const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
      const params = Promise.resolve({ id: "1" })
      const response = await PollPOST(request, { params })

      expect(response.status).toBe(401)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it("returns 429 when tracker was polled within cooldown period", async () => {
    // Atomic claim returns 0 rows = cooldown still active
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
    const params = Promise.resolve({ id: "1" })
    const response = await PollPOST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toMatch(/Poll cooldown/)
  })

  it("returns 404 without claiming a poll slot when the tracker does not exist", async () => {
    trackerRow = undefined

    const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
    const response = await PollPOST(request, { params: Promise.resolve({ id: "1" }) })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Tracker not found" })
    expect(db.update).not.toHaveBeenCalled()
  })

  // The refusal comes before the claim, so it never starts the cooldown.
  it.each([
    ["isn't in the tracker list", null, TRACKER_UNLINKED_ERROR],
    ["has shut down", TRACKER_REGISTRY.find((t) => t.defunct)?.slug, TRACKER_DEFUNCT_ERROR],
  ])(
    "refuses a tracker that %s before claiming a poll slot",
    async (_state, registrySlug, error) => {
      expect(
        registrySlug,
        "the registry has no defunct entry left to test with"
      ).not.toBeUndefined()
      trackerRow = { registrySlug }

      const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
      const response = await PollPOST(request, { params: Promise.resolve({ id: "1" }) })

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error })
      expect(db.update).not.toHaveBeenCalled()
      expect(pollTracker).not.toHaveBeenCalled()
    }
  )

  it("returns 401 when unauthenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
    const params = Promise.resolve({ id: "1" })
    const response = await PollPOST(request, { params })
    expect(response.status).toBe(401)
  })

  it("returns 400 for invalid tracker ID", async () => {
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Invalid tracker ID" }, { status: 400 })
    )

    const request = makeRequest("http://localhost/api/trackers/abc/poll", undefined, "POST")
    const params = Promise.resolve({ id: "abc" })
    const response = await PollPOST(request, { params })
    expect(response.status).toBe(400)
  })
})

describe("POST /api/trackers/poll-all", () => {
  const healthy = { pausedAt: null, userPausedAt: null, registrySlug: "aither", lastError: null }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: VALID_KEY })
    ;(pollTracker as ReturnType<typeof vi.fn>).mockResolvedValue(true)
  })

  function mockActiveTrackers(rows: Record<string, unknown>[]) {
    // Call 1: db.select({...}).from(appSettings).limit(1)
    const mockSettingsLimit = vi.fn().mockResolvedValue([{ storeUsernames: true }])
    const mockSettingsFrom = vi.fn().mockReturnValue({ limit: mockSettingsLimit })
    // Call 2: db.select({...}).from(trackers).where(isActive)
    const mockWhere = vi.fn().mockResolvedValue(rows)
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })

    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ from: mockSettingsFrom })
      .mockReturnValueOnce({ from: mockFrom })
  }

  it("polls failure-paused and healthy trackers but skips user pauses, unlinked rows and defunct entries", async () => {
    const pausedAt = new Date()
    const defunctSlug = TRACKER_REGISTRY.find((t) => t.defunct)?.slug
    expect(defunctSlug, "the registry has no defunct entry left to test with").toBeDefined()
    mockActiveTrackers([
      { ...healthy, id: 1, userPausedAt: pausedAt },
      { ...healthy, id: 2, pausedAt, registrySlug: null, lastError: UNLINKED_RESTORE_ERROR },
      { ...healthy, id: 3, pausedAt, lastError: "HTTP 503" },
      { ...healthy, id: 4 },
      { ...healthy, id: 5, registrySlug: null },
      { ...healthy, id: 6, registrySlug: defunctSlug },
    ])

    const response = await PollAllPOST()
    const lines = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))

    expect((pollTracker as ReturnType<typeof vi.fn>).mock.calls.map(([id]) => id)).toEqual([3, 4])
    expect(lines[0]).toEqual({ total: 2 })
    expect(lines.at(-1)).toEqual({ done: true, polled: 2, failed: 0 })
  })

  // pollTracker records a failure on the row and resolves false, so the button
  // read "All Polled" over a tracker that had just failed.
  it("counts a poll that recorded a failure as failed", async () => {
    vi.mocked(pollTracker).mockImplementation(async (id) => id !== 3)
    mockActiveTrackers([
      { ...healthy, id: 3 },
      { ...healthy, id: 4 },
    ])

    const response = await PollAllPOST()
    const lines = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))

    expect(lines).toContainEqual({ trackerId: 3, ok: false })
    expect(lines).toContainEqual({ trackerId: 4, ok: true })
    expect(lines.at(-1)).toEqual({ done: true, polled: 1, failed: 1 })
  })

  it("polls nothing when every active tracker is paused by the user", async () => {
    mockActiveTrackers([{ ...healthy, id: 1, userPausedAt: new Date() }])

    const response = await PollAllPOST()

    expect(pollTracker).not.toHaveBeenCalled()
    // One newline-ended NDJSON line, which the button's line reader parses.
    expect(response.headers.get("Content-Type")).toBe("application/x-ndjson")
    expect(await response.text()).toBe(
      `${JSON.stringify({ total: 0, done: true, polled: 0, failed: 0 })}\n`
    )
  })
})

describe("GET /api/trackers/[id]/snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(1)
  })

  function buildSnapshotDbMock(result: unknown[]) {
    // Call 1: db.selectDistinctOn([bucket], cols).from(...).where(...).orderBy(...)
    // (getSnapshotsForTracker uses selectDistinctOn for the default 30-day range)
    const mockOrderBy = vi.fn().mockResolvedValue(result)
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.selectDistinctOn as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: mockFrom })

    // Call 2: db.select({storeUsernames}).from(appSettings).limit(1)
    const mockSettingsLimit = vi.fn().mockResolvedValue([{ storeUsernames: true }])
    const mockSettingsFrom = vi.fn().mockReturnValue({ limit: mockSettingsLimit })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: mockSettingsFrom })
  }

  it("returns snapshots with default 30 days and serialized bigints", async () => {
    const snapshot = {
      id: 1,
      trackerId: 1,
      polledAt: new Date("2026-03-01"),
      uploadedBytes: BigInt("107374182400"),
      downloadedBytes: BigInt("53687091200"),
      ratio: 2.0,
      bufferBytes: BigInt("1073741824"),
      seedingCount: 5,
      leechingCount: 1,
      seedbonus: null,
      hitAndRuns: null,
      username: "user1",
      group: "VIP",
    }

    buildSnapshotDbMock([snapshot])

    const request = new Request("http://localhost/api/trackers/1/snapshots")
    const params = Promise.resolve({ id: "1" })
    const response = await SnapshotsGET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(typeof data[0].uploadedBytes).toBe("string")
    expect(typeof data[0].downloadedBytes).toBe("string")
    expect(typeof data[0].bufferBytes).toBe("string")
    expect(data[0].uploadedBytes).toBe("107374182400")
  })

  it("accepts custom days query param", async () => {
    buildSnapshotDbMock([])

    const request = new Request("http://localhost/api/trackers/1/snapshots?days=7")
    const params = Promise.resolve({ id: "1" })
    const response = await SnapshotsGET(request, { params })

    expect(response.status).toBe(200)
  })

  it("defaults to 30 days for non-numeric days param", async () => {
    buildSnapshotDbMock([])

    const request = new Request("http://localhost/api/trackers/1/snapshots?days=abc")
    const params = Promise.resolve({ id: "1" })
    const response = await SnapshotsGET(request, { params })

    expect(response.status).toBe(200)
  })

  it("returns 401 when unauthenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const request = new Request("http://localhost/api/trackers/1/snapshots")
    const params = Promise.resolve({ id: "1" })
    const response = await SnapshotsGET(request, { params })
    expect(response.status).toBe(401)
  })
})

describe("GET /api/trackers/[id]/roles", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(1)
  })

  it("returns roles list", async () => {
    const roles = [{ id: 1, trackerId: 1, roleName: "VIP", achievedAt: new Date(), notes: null }]

    const mockOrderBy = vi.fn().mockResolvedValue(roles)
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    const request = makeRequest("http://localhost/api/trackers/1/roles")
    const params = Promise.resolve({ id: "1" })
    const response = await RolesGET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].roleName).toBe("VIP")
  })

  it("returns 401 when unauthenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const request = makeRequest("http://localhost/api/trackers/1/roles")
    const params = Promise.resolve({ id: "1" })
    const response = await RolesGET(request, { params })
    expect(response.status).toBe(401)
  })
})

describe("POST /api/trackers/[id]/roles", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(1)
  })

  it("returns 201 on happy path", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      roleName: "VIP",
    })

    const role = { id: 1, trackerId: 1, roleName: "VIP", achievedAt: new Date(), notes: null }
    const mockReturning = vi.fn().mockResolvedValue([role])
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })

    const request = makeRequest(
      "http://localhost/api/trackers/1/roles",
      { roleName: "VIP" },
      "POST"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await RolesPOST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.roleName).toBe("VIP")
  })

  it("returns 400 when roleName is missing", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const request = makeRequest("http://localhost/api/trackers/1/roles", {}, "POST")
    const params = Promise.resolve({ id: "1" })
    const response = await RolesPOST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/roleName/i)
  })

  it("returns 400 when roleName is empty string", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ roleName: "" })

    const request = makeRequest("http://localhost/api/trackers/1/roles", { roleName: "" }, "POST")
    const params = Promise.resolve({ id: "1" })
    const response = await RolesPOST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/roleName/i)
  })

  it("returns 401 when unauthenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const request = makeRequest(
      "http://localhost/api/trackers/1/roles",
      { roleName: "VIP" },
      "POST"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await RolesPOST(request, { params })
    expect(response.status).toBe(401)
  })
})
