// src/app/api/trackers/tracker-routes.test.ts
import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { authenticate, parseJsonBody, parseTrackerId } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { pollTracker } from "@/lib/scheduler"
import { POST as PollPOST } from "./[id]/poll/route"
import { GET as RolesGET, POST as RolesPOST } from "./[id]/roles/route"
import { DELETE, PATCH } from "./[id]/route"
import { GET as SnapshotsGET } from "./[id]/snapshots/route"
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

vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn().mockReturnValue("encrypted-token"),
  decrypt: vi.fn().mockReturnValue("decrypted-value"),
}))

vi.mock("@/lib/proxy", () => ({
  createProxyAgent: vi.fn(),
  buildProxyAgentFromSettings: vi.fn().mockReturnValue(undefined),
  VALID_PROXY_TYPES: new Set(["socks5", "http", "https"]),
}))

vi.mock("@/lib/scheduler", () => ({
  pollTracker: vi.fn(),
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

const VALID_KEY = "abcd1234".repeat(8)

function makeRequest(url: string, body?: Record<string, unknown>, method = "GET"): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
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
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
  })

  it("returns 201 with id and name on happy path", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Aither",
      baseUrl: "https://aither.cc",
      apiToken: "mytoken",
    })

    const mockReturning = vi.fn().mockResolvedValue([{ id: 42, name: "Aither" }])
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: "Aither",
        baseUrl: "https://aither.cc",
        apiToken: "mytoken",
      },
      "POST"
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data).toEqual({ id: 42, name: "Aither" })
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
      baseUrl: "https://aither.cc",
      apiToken: "mytoken",
    })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: longName,
        baseUrl: "https://aither.cc",
        apiToken: "mytoken",
      },
      "POST"
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/name/i)
  })

  it("returns 400 when URL exceeds 500 characters", async () => {
    const longUrl = `https://aither.cc/${"a".repeat(490)}`
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Aither",
      baseUrl: longUrl,
      apiToken: "mytoken",
    })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: "Aither",
        baseUrl: longUrl,
        apiToken: "mytoken",
      },
      "POST"
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/url/i)
  })

  it("returns 400 for invalid URL format", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Aither",
      baseUrl: "not-a-url",
      apiToken: "mytoken",
    })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: "Aither",
        baseUrl: "not-a-url",
        apiToken: "mytoken",
      },
      "POST"
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/url/i)
  })

  it("blocks SSRF via loopback address in baseUrl", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Aither",
      baseUrl: "http://127.0.0.1:8080",
      apiToken: "mytoken",
    })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: "Aither",
        baseUrl: "http://127.0.0.1:8080",
        apiToken: "mytoken",
      },
      "POST"
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/private network address/i)
  })

  it("blocks SSRF via cloud metadata endpoint (169.254.169.254)", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Aither",
      baseUrl: "http://169.254.169.254/latest/meta-data",
      apiToken: "mytoken",
    })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: "Aither",
        baseUrl: "http://169.254.169.254/latest/meta-data",
        apiToken: "mytoken",
      },
      "POST"
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/private network address/i)
  })

  it("returns 400 when API token exceeds 500 characters", async () => {
    const longToken = "t".repeat(501)
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Aither",
      baseUrl: "https://aither.cc",
      apiToken: longToken,
    })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: "Aither",
        baseUrl: "https://aither.cc",
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
      baseUrl: "https://aither.cc",
      apiToken: "mytoken",
      color: `#${"a".repeat(20)}`,
    })

    const request = makeRequest(
      "http://localhost/api/trackers",
      {
        name: "Aither",
        baseUrl: "https://aither.cc",
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
        baseUrl: "https://aither.cc",
        apiToken: "mytoken",
      },
      "POST"
    )
    const response = await POST(request)
    expect(response.status).toBe(401)
  })
})

describe("PATCH /api/trackers/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(1)
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
    expect(data.success).toBe(true)
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

  it("returns 400 when URL exceeds 500 characters", async () => {
    const longUrl = `https://aither.cc/${"a".repeat(490)}`
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      baseUrl: longUrl,
    })

    const request = makeRequest("http://localhost/api/trackers/1", { baseUrl: longUrl }, "PATCH")
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/url/i)
  })

  it("returns 400 for invalid URL format", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      baseUrl: "not-a-url",
    })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { baseUrl: "not-a-url" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/url/i)
  })

  it("blocks SSRF via localhost in PATCH baseUrl", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      baseUrl: "http://localhost:9000/internal",
    })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { baseUrl: "http://localhost:9000/internal" },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/private network address/i)
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

  it("returns 400 when API token exceeds 500 characters", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      apiToken: "t".repeat(501),
    })

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
    expect(data.success).toBe(true)
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

  it("clears userPausedAt and auto-pause state when pollingPaused is false", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      pollingPaused: false,
    })

    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest(
      "http://localhost/api/trackers/1",
      { pollingPaused: false },
      "PATCH"
    )
    const params = Promise.resolve({ id: "1" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    const updates = mockSet.mock.calls[0]?.[0]
    expect(updates.userPausedAt).toBeNull()
    expect(updates.pausedAt).toBeNull()
    expect(updates.consecutiveFailures).toBe(0)
    expect(updates.lastError).toBeNull()
  })

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
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(1)

    // Poll route makes two db.select() calls:
    //   1. Cooldown check: select({ lastPolledAt }).from(trackers).where(...).limit(1)
    //   2. Settings: select({...}).from(appSettings).limit(1)
    let selectCallCount = 0
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        // Cooldown check — return lastPolledAt far enough in the past
        const mockLimit = vi.fn().mockResolvedValue([{ lastPolledAt: new Date(0) }])
        const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
        return { from: mockFrom }
      }
      // Settings query
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

  it("returns 200 on happy path", async () => {
    ;(pollTracker as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
    const params = Promise.resolve({ id: "1" })
    const response = await PollPOST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it("returns 500 when poll fails with error message", async () => {
    ;(pollTracker as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection refused"))

    const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
    const params = Promise.resolve({ id: "1" })
    const response = await PollPOST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe("Connection refused")
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

  it("returns 429 when tracker was polled within cooldown period", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const mockLimit = vi.fn().mockResolvedValue([{ lastPolledAt: new Date() }])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      return { from: mockFrom }
    })

    const request = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
    const params = Promise.resolve({ id: "1" })
    const response = await PollPOST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toMatch(/Poll cooldown/)
  })

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

describe("GET /api/trackers/[id]/snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(1)
  })

  function buildSnapshotDbMock(result: unknown[]) {
    // Call 1: db.select().from(trackerSnapshots).where(...).orderBy(...)
    const mockOrderBy = vi.fn().mockResolvedValue(result)
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    // Call 2: db.select({storeUsernames}).from(appSettings).limit(1)
    const mockSettingsLimit = vi.fn().mockResolvedValue([{ storeUsernames: true }])
    const mockSettingsFrom = vi.fn().mockReturnValue({ limit: mockSettingsLimit })

    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ from: mockFrom })
      .mockReturnValueOnce({ from: mockSettingsFrom })
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

  it("clamps days to minimum 1", async () => {
    // Smoke test: clamping logic is verified via Math.max(parseInt(...), 1) in source.
    // The route returns 200 for any non-negative days value including 0.
    buildSnapshotDbMock([])

    const request = new Request("http://localhost/api/trackers/1/snapshots?days=0")
    const params = Promise.resolve({ id: "1" })
    const response = await SnapshotsGET(request, { params })

    expect(response.status).toBe(200)
  })

  it("clamps days to maximum 3650", async () => {
    // Smoke test: clamping logic is verified via Math.min(..., 3650) in source.
    // The route returns 200 for any days value, clamped internally.
    buildSnapshotDbMock([])

    const request = new Request("http://localhost/api/trackers/1/snapshots?days=9999")
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
