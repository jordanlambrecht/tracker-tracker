// src/app/api/trackers/[id]/avatar/avatar-route.test.ts
//
// Tests for GET /api/trackers/[id]/avatar, focused on redirect handling.
//
// The avatar URL comes from the tracker's own API response
// (tracker-scheduler.ts writes stats.avatarUrl into trackers.avatarRemoteUrl),
// so a hostile tracker chooses it. Validating only the first URL leaves the
// redirect chain unguarded, which is what these tests pin down.
//
// The fetch mock below deliberately emulates undici's redirect semantics.
// It follows Location itself unless the caller passes redirect: "manual".
// so a test that passes here would also pass against a real fetch. A mock
// that never followed would make the security assertions vacuous.

import type { Mock } from "vitest"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, parseTrackerId } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { GET } from "./route"

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return {
    // validateHttpUrl stays real: it is the guard under test at the first hop,
    // and it is purely syntactic (no DNS), so it needs no network.
    ...actual,
    authenticate: vi.fn(),
    parseTrackerId: vi.fn(),
  }
})

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}))

// ---------------------------------------------------------------------------
// fetch mock: emulates undici redirect semantics
// ---------------------------------------------------------------------------

interface MockRoute {
  status: number
  location?: string
  body?: Buffer
  contentType?: string
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/** URLs actually requested over the wire, in order, across every hop. */
let requested: string[] = []
let routes: Map<string, MockRoute>

function buildResponse(route: MockRoute): Response {
  const headers = new Headers()
  if (route.location) headers.set("location", route.location)
  if (route.contentType) headers.set("content-type", route.contentType)
  const body = route.body ? new Uint8Array(route.body) : null
  return new Response(body, { status: route.status, headers })
}

function installFetchMock(): Mock {
  const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const manual = init?.redirect === "manual"
    let url = String(input)

    for (let hop = 0; hop < 20; hop++) {
      requested.push(url)
      const route = routes.get(url)
      if (!route) throw new Error(`unmocked fetch: ${url}`)

      const response = buildResponse(route)
      // With redirect: "manual" the 3xx is handed back untouched. Otherwise
      // undici follows Location transparently and only the final response is
      // ever visible to the caller. This is the behaviour that made this a bug.
      if (manual) return response
      if (!REDIRECT_STATUSES.has(route.status) || !route.location) return response
      url = new URL(route.location, url).href
    }
    throw new Error("mock fetch: redirect loop")
  })

  vi.stubGlobal("fetch", mockFetch)
  return mockFetch
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
])

const TRACKER_AVATAR = "https://tracker.example/avatar.png"
const METADATA_URL = "http://169.254.169.254/latest/meta-data/iam/security-credentials/"

function mockTrackerRow(overrides: Record<string, unknown> = {}) {
  const row = {
    platformType: "gazelle",
    remoteUserId: 42,
    useProxy: false,
    avatarData: null,
    avatarMimeType: null,
    avatarCachedAt: null,
    avatarRemoteUrl: TRACKER_AVATAR,
    ...overrides,
  }
  const limit = vi.fn().mockResolvedValue([row])
  const where = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ where })
  ;(db.select as Mock).mockReturnValue({ from })
}

function mockUpdate(): Mock {
  const updateWhere = vi.fn().mockResolvedValue(undefined)
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere })
  ;(db.update as Mock).mockReturnValue({ set: updateSet })
  return updateSet
}

function makeContext() {
  return { params: Promise.resolve({ id: "1" }) }
}

// ---------------------------------------------------------------------------

describe("GET /api/trackers/[id]/avatar redirect handling", () => {
  let updateSet: Mock

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    requested = []
    routes = new Map()
    ;(authenticate as Mock).mockResolvedValue({ encryptionKey: "a".repeat(64) })
    ;(parseTrackerId as Mock).mockResolvedValue(1)
    updateSet = mockUpdate()
    installFetchMock()
  })

  it("refuses a redirect to a link-local metadata address and never requests it", async () => {
    routes.set(TRACKER_AVATAR, { status: 302, location: METADATA_URL })
    routes.set(METADATA_URL, {
      status: 200,
      body: Buffer.from("SECRET-CREDENTIALS"),
      contentType: "text/plain",
    })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Avatar not found" })
    // The decisive assertion: the private address is never contacted.
    expect(requested).toEqual([TRACKER_AVATAR])
    expect(requested).not.toContain(METADATA_URL)
    // Nothing from the refused hop reaches the cache.
    expect(updateSet).not.toHaveBeenCalled()
  })

  it("refuses a redirect to a loopback address", async () => {
    const loopback = "http://127.0.0.1:8080/admin"
    routes.set(TRACKER_AVATAR, { status: 301, location: loopback })
    routes.set(loopback, { status: 200, body: Buffer.from("internal"), contentType: "text/html" })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(404)
    expect(requested).not.toContain(loopback)
    expect(updateSet).not.toHaveBeenCalled()
  })

  it("refuses a redirect that leaves http(s)", async () => {
    routes.set(TRACKER_AVATAR, { status: 302, location: "file:///etc/passwd" })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(404)
    expect(requested).toEqual([TRACKER_AVATAR])
  })

  it("serves and caches a non-redirecting avatar", async () => {
    routes.set(TRACKER_AVATAR, { status: 200, body: PNG, contentType: "image/png" })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("image/png")
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PNG)
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ avatarData: PNG.toString("base64"), avatarMimeType: "image/png" })
    )
  })

  it("follows a redirect to another public origin (CDN-hosted avatars keep working)", async () => {
    const cdn = "https://cdn.example.net/images/42.png"
    routes.set(TRACKER_AVATAR, { status: 302, location: cdn })
    routes.set(cdn, { status: 200, body: PNG, contentType: "image/png" })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(200)
    expect(requested).toEqual([TRACKER_AVATAR, cdn])
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PNG)
  })

  it("resolves a relative Location against the current hop", async () => {
    routes.set(TRACKER_AVATAR, { status: 307, location: "/images/42.png" })
    routes.set("https://tracker.example/images/42.png", {
      status: 200,
      body: PNG,
      contentType: "image/png",
    })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(200)
    expect(requested).toEqual([TRACKER_AVATAR, "https://tracker.example/images/42.png"])
  })

  it("gives up once the hop limit is exceeded", async () => {
    routes.set(TRACKER_AVATAR, { status: 302, location: "https://a.example/1" })
    routes.set("https://a.example/1", { status: 302, location: "https://a.example/2" })
    routes.set("https://a.example/2", { status: 302, location: "https://a.example/3" })
    routes.set("https://a.example/3", { status: 302, location: "https://a.example/4" })
    routes.set("https://a.example/4", { status: 200, body: PNG, contentType: "image/png" })
    mockTrackerRow()

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(404)
    // Initial request plus three followed hops, then it stops.
    expect(requested).toHaveLength(4)
    expect(requested).not.toContain("https://a.example/4")
    expect(updateSet).not.toHaveBeenCalled()
  })

  it("rejects an avatar URL that already points at a private address", async () => {
    mockTrackerRow({ avatarRemoteUrl: "http://192.168.1.1/admin.png" })

    const response = await GET(new Request("http://localhost"), makeContext())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid avatar URL" })
    expect(requested).toEqual([])
  })
})
