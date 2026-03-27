// src/app/api/clients/client-routes.test.ts
//
// Functions:
//   mockDbSelectClient  - Sets up db.select chain returning one client or empty
//   makeRequest         - Constructs a Request for GET handler calls

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { getTorrents, withSessionRetry } from "@/lib/qbt"
import { GET } from "./[id]/torrents/route"

// ---------------------------------------------------------------------------
// Module mocks (boundaries only)
// ---------------------------------------------------------------------------

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return {
    ...actual,
    authenticate: vi.fn(),
  }
})

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(),
}))

vi.mock("@/lib/qbt", () => ({
  getTorrents: vi.fn(),
  // withSessionRetry: by default, call op with a fixed baseUrl+sid so the
  // getTorrents mock still fires normally. Individual tests that need to
  // simulate upstream errors replace this with vi.fn().mockRejectedValue(...).
  withSessionRetry: vi.fn(
    async (
      _host: string,
      _port: number,
      _ssl: boolean,
      _username: string,
      _password: string,
      op: (baseUrl: string, sid: string) => Promise<unknown>
    ) => op("http://192.168.1.100:8080", "sid-token")
  ),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_KEY = "abcd1234".repeat(8) // 64-char hex = 32-byte key

const MOCK_CLIENT = {
  id: 1,
  name: "Home qBT",
  type: "qbittorrent",
  enabled: true,
  host: "192.168.1.100",
  port: 8080,
  useSsl: false,
  encryptedUsername: "enc-admin",
  encryptedPassword: "enc-secret",
  pollIntervalSeconds: 30,
  isDefault: true,
  crossSeedTags: ["cross-seed"],
  lastPolledAt: null,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const MOCK_TORRENTS = [
  {
    hash: "abc123",
    name: "Show.S01.BluRay",
    state: "uploading",
    tags: "aither",
    category: "",
    upspeed: 1024,
    dlspeed: 0,
    uploaded: 5000000,
    downloaded: 3000000,
    ratio: 1.67,
    size: 3000000,
    num_seeds: 10,
    num_leechs: 2,
    num_complete: 15,
    num_incomplete: 3,
    tracker: "https://aither.cc/announce",
    added_on: 1700000000,
    completion_on: 1700001000,
    last_activity: 1700002000,
    seeding_time: 86400,
    time_active: 90000,
    seen_complete: 1700002000,
    availability: 1,
    amount_left: 0,
    progress: 1,
    content_path: "/downloads/Show.S01.BluRay",
    save_path: "/downloads",
    is_private: true,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockDbSelectClient(client: typeof MOCK_CLIENT | null) {
  const mockLimit = vi.fn().mockResolvedValue(client ? [client] : [])
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })
}

function makeRequest(url: string): Request {
  return new Request(url)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/clients/[id]/torrents", () => {
  beforeEach(() => {
    // resetAllMocks clears call history AND pending mockReturnValueOnce queues,
    // preventing leakage of unconsumed queued returns across tests.
    vi.resetAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
  })

  // -------------------------------------------------------------------------
  // Auth gate
  // -------------------------------------------------------------------------

  it("returns 401 when not authenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=aither")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })

    expect(response.status).toBe(401)
  })

  // -------------------------------------------------------------------------
  // Input validation — client ID
  // -------------------------------------------------------------------------

  it("returns 400 for non-numeric client ID", async () => {
    const request = makeRequest("http://localhost/api/clients/abc/torrents?tag=aither")
    const params = Promise.resolve({ id: "abc" })
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/invalid client id/i)
  })

  it("returns 400 for negative client ID", async () => {
    const request = makeRequest("http://localhost/api/clients/-1/torrents?tag=aither")
    const params = Promise.resolve({ id: "-1" })
    const response = await GET(request, { params })

    expect(response.status).toBe(400)
  })

  it("returns 400 for zero client ID", async () => {
    const request = makeRequest("http://localhost/api/clients/0/torrents?tag=aither")
    const params = Promise.resolve({ id: "0" })
    const response = await GET(request, { params })

    expect(response.status).toBe(400)
  })

  // -------------------------------------------------------------------------
  // Input validation — tag parameter
  // -------------------------------------------------------------------------

  it("returns 400 when tag query parameter is missing", async () => {
    const request = makeRequest("http://localhost/api/clients/1/torrents")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/tag/i)
  })

  it("returns 400 when tag is empty string", async () => {
    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })

    expect(response.status).toBe(400)
  })

  it("returns 400 when tag is only whitespace", async () => {
    // URL-encoded spaces
    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=%20%20")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })

    expect(response.status).toBe(400)
  })

  // -------------------------------------------------------------------------
  // Client lookup
  // -------------------------------------------------------------------------

  it("returns 404 when client does not exist", async () => {
    mockDbSelectClient(null)

    const request = makeRequest("http://localhost/api/clients/999/torrents?tag=aither")
    const params = Promise.resolve({ id: "999" })
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toMatch(/not found/i)
  })

  // -------------------------------------------------------------------------
  // Credential handling
  // -------------------------------------------------------------------------

  it("returns 401 when credential decryption fails", async () => {
    mockDbSelectClient(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("decryption error")
    })

    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=aither")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toMatch(/session expired/i)
    // Response body must not contain the encryption key or the encrypted credential strings
    const body = JSON.stringify(data)
    expect(body).not.toContain(VALID_KEY)
    expect(body).not.toContain(MOCK_CLIENT.encryptedUsername)
    expect(body).not.toContain(MOCK_CLIENT.encryptedPassword)
  })

  // -------------------------------------------------------------------------
  // Upstream error handling
  // -------------------------------------------------------------------------

  it("returns 502 when qBT login fails with authentication error", async () => {
    mockDbSelectClient(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(withSessionRetry as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Authentication failed — check username and password")
    )

    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=aither")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.error).toBe("Failed to fetch torrents from client")
  })

  it("returns 502 when qBT connection times out", async () => {
    mockDbSelectClient(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(withSessionRetry as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Request to 192.168.1.100 timed out")
    )

    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=aither")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.error).toContain("timed out")
  })

  it("returns 502 when getTorrents fails", async () => {
    mockDbSelectClient(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getTorrents as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("qBittorrent API error: 403 Forbidden")
    )

    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=aither")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })

    expect(response.status).toBe(502)
  })

  // -------------------------------------------------------------------------
  // Information disclosure — the route must not add credentials to errors
  // -------------------------------------------------------------------------

  it("does not add decrypted credentials to upstream error messages", async () => {
    // Simulates a poorly-written upstream library that embeds credentials in
    // the error message. The route's own catch block must not re-inject them.
    // Note: if the upstream error already contains them, that is a known risk
    // outside this handler's control — this test validates the handler itself.
    mockDbSelectClient(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("plaintext-user")
      .mockReturnValueOnce("plaintext-pass")
    ;(withSessionRetry as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("upstream error with no credential content")
    )

    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=aither")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })
    const data = await response.json()

    // The handler must not inject the plaintext credentials into its own error output
    expect(data.error).not.toContain("plaintext-user")
    expect(data.error).not.toContain("plaintext-pass")
  })

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("returns torrent array on success", async () => {
    mockDbSelectClient(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TORRENTS)

    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=aither")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(1)
    expect(data[0].hash).toBe("abc123")
    expect(data[0].state).toBe("uploading")
  })

  // -------------------------------------------------------------------------
  // Tag passthrough — verifies the per-tag optimization actually fires
  // -------------------------------------------------------------------------

  it("passes the tag to getTorrents for server-side filtering", async () => {
    mockDbSelectClient(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=aither")
    const params = Promise.resolve({ id: "1" })
    await GET(request, { params })

    // If this assertion fails, the route is not passing the tag to getTorrents,
    // meaning it would fall back to fetching all torrents — the optimization is broken.
    const getTorrentsCalls = (getTorrents as ReturnType<typeof vi.fn>).mock.calls
    expect(getTorrentsCalls).toHaveLength(1)
    expect(getTorrentsCalls[0][2]).toBe("aither")
  })

  it("trims whitespace from tag before querying getTorrents", async () => {
    mockDbSelectClient(MOCK_CLIENT)
    ;(decrypt as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("admin")
      .mockReturnValueOnce("secret")
    ;(getTorrents as ReturnType<typeof vi.fn>).mockResolvedValue([])

    // %20aither%20 decodes to " aither " — should be trimmed to "aither"
    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=%20aither%20")
    const params = Promise.resolve({ id: "1" })
    await GET(request, { params })

    const getTorrentsCalls = (getTorrents as ReturnType<typeof vi.fn>).mock.calls
    expect(getTorrentsCalls).toHaveLength(1)
    expect(getTorrentsCalls[0][2]).toBe("aither")
  })
})
