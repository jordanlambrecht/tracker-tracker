// src/app/api/clients/client-routes.test.ts

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { createAdapterForClient } from "@/lib/download-clients"
import { CREDENTIAL_MAX } from "@/lib/limits"
import { PATCH } from "./[id]/route"
import { GET } from "./[id]/torrents/route"
import { POST } from "./route"

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

const mockAdapter = {
  type: "qbittorrent" as const,
  baseUrl: "http://192.168.1.100:8080",
  testConnection: vi.fn(),
  getTorrents: vi.fn().mockResolvedValue([]),
  getTransferInfo: vi.fn().mockResolvedValue({ uploadSpeed: 0, downloadSpeed: 0 }),
  getDeltaSync: vi.fn(),
  dispose: vi.fn(),
}

vi.mock("@/lib/download-clients", () => ({
  createAdapterForClient: vi.fn(() => mockAdapter),
  VALID_CLIENT_TYPES: ["qbittorrent", "deluge", "transmission", "rtorrent"],
  stripSensitiveTorrentFields: vi.fn((t: Record<string, unknown>) => {
    const { tracker: _t, content_path: _cp, save_path: _sp, ...rest } = t
    return rest
  }),
}))

vi.mock("@/lib/server-data", () => ({
  fetchDownloadClients: vi.fn().mockResolvedValue([]),
  serializeDownloadClientResponse: vi.fn((c: unknown) => c),
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
    vi.mocked(createAdapterForClient).mockReturnValue(mockAdapter)
    mockAdapter.getTorrents.mockResolvedValue([])
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
  // Input validation, client ID
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
  // Input validation, tag parameter
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
    // Decryption now happens inside createAdapterForClient. Simulate it throwing
    // an AES-GCM authentication failure, which isDecryptionError detects as 401.
    vi.mocked(createAdapterForClient).mockImplementation(() => {
      throw new Error("EVP_DecryptFinal_ex: bad decrypt")
    })

    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=aither")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toMatch(/session expired/i)
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
    mockAdapter.getTorrents.mockRejectedValue(
      new Error("Authentication failed. Check username and password")
    )

    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=aither")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.error).toBe("Failed to fetch torrents")
  })

  it("returns 502 when qBT connection times out", async () => {
    mockDbSelectClient(MOCK_CLIENT)
    mockAdapter.getTorrents.mockRejectedValue(new Error("Request to 192.168.1.100 timed out"))

    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=aither")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.error).toContain("timed out")
  })

  it("returns 502 when getTorrents fails", async () => {
    mockDbSelectClient(MOCK_CLIENT)
    mockAdapter.getTorrents.mockRejectedValue(new Error("qBittorrent API error: 403 Forbidden"))

    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=aither")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })

    expect(response.status).toBe(502)
  })

  // -------------------------------------------------------------------------
  // Information disclosure, the route must not add credentials to errors
  // -------------------------------------------------------------------------

  it("does not add decrypted credentials to upstream error messages", async () => {
    // Simulates a poorly-written upstream library that embeds credentials in
    // the error message. The route's own catch block must not re-inject them.
    // Note: if the upstream error already contains them, that is a known risk
    // outside this handler's control, this test validates the handler itself.
    mockDbSelectClient(MOCK_CLIENT)
    mockAdapter.getTorrents.mockRejectedValue(
      new Error("upstream error with no credential content")
    )

    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=aither")
    const params = Promise.resolve({ id: "1" })
    const response = await GET(request, { params })
    const data = await response.json()

    // The handler must not inject plaintext credentials into its own error output
    expect(data.error).not.toContain("plaintext-user")
    expect(data.error).not.toContain("plaintext-pass")
  })

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("returns torrent array on success", async () => {
    mockDbSelectClient(MOCK_CLIENT)
    mockAdapter.getTorrents.mockResolvedValue(MOCK_TORRENTS)

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
  // Tag passthrough, verifies the per-tag optimization actually fires
  // -------------------------------------------------------------------------

  it("passes the tag to getTorrents for server-side filtering", async () => {
    mockDbSelectClient(MOCK_CLIENT)

    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=aither")
    const params = Promise.resolve({ id: "1" })
    await GET(request, { params })

    // If this assertion fails, the route is not passing the tag to adapter.getTorrents,
    // meaning it would fall back to fetching all torrents, the optimization is broken.
    expect(mockAdapter.getTorrents).toHaveBeenCalledOnce()
    expect(mockAdapter.getTorrents).toHaveBeenCalledWith({ tag: "aither" })
  })

  it("trims whitespace from tag before querying getTorrents", async () => {
    mockDbSelectClient(MOCK_CLIENT)

    // %20aither%20 decodes to " aither ", should be trimmed to "aither"
    const request = makeRequest("http://localhost/api/clients/1/torrents?tag=%20aither%20")
    const params = Promise.resolve({ id: "1" })
    await GET(request, { params })

    expect(mockAdapter.getTorrents).toHaveBeenCalledOnce()
    expect(mockAdapter.getTorrents).toHaveBeenCalledWith({ tag: "aither" })
  })
})

// ---------------------------------------------------------------------------
// POST /api/clients, credentials are optional (issue #150)
//
// qBittorrent skips authentication entirely for loopback clients when "Bypass
// authentication for clients on localhost" is set, so a blank username and
// password is a valid configuration. PATCH has always accepted "", these
// tests pin the matching behaviour on create.
// ---------------------------------------------------------------------------

describe("POST /api/clients", () => {
  let inserted: Record<string, unknown> | null = null

  beforeEach(() => {
    vi.resetAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    inserted = null
    ;(db as unknown as { transaction: ReturnType<typeof vi.fn> }).transaction = vi
      .fn()
      .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          update: () => ({ set: async () => undefined }),
          insert: () => ({
            values: (v: Record<string, unknown>) => {
              inserted = v
              return { returning: async () => [{ id: 7, name: v.name }] }
            },
          }),
        })
      )
  })

  function postBody(body: Record<string, unknown>): Request {
    return new Request("http://localhost/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  it("creates a client when username and password are blank strings", async () => {
    const res = await POST(
      postBody({ name: "Local qBT", host: "localhost", username: "", password: "" })
    )

    expect(res.status).toBe(201)
    expect(inserted).not.toBeNull()
    // Stored as real ciphertext, not NULL, the NOT NULL columns are satisfied.
    expect(typeof inserted?.encryptedUsername).toBe("string")
    expect(inserted?.encryptedUsername).not.toBe("")
  })

  it("creates a client when username and password are omitted entirely", async () => {
    const res = await POST(postBody({ name: "Local qBT", host: "localhost" }))

    expect(res.status).toBe(201)
    expect(typeof inserted?.encryptedPassword).toBe("string")
  })

  it("round-trips blank credentials back to empty strings", async () => {
    await POST(postBody({ name: "Local qBT", host: "localhost", username: "", password: "" }))

    const key = Buffer.from(VALID_KEY, "hex")
    expect(decrypt(inserted?.encryptedUsername as string, key)).toBe("")
    expect(decrypt(inserted?.encryptedPassword as string, key)).toBe("")
  })

  it("still rejects a missing name", async () => {
    const res = await POST(postBody({ host: "localhost", username: "admin", password: "pw" }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("name and host are required")
  })

  it("still rejects a missing host", async () => {
    const res = await POST(postBody({ name: "Local qBT", username: "admin", password: "pw" }))

    expect(res.status).toBe(400)
  })

  it("still rejects a non-string username", async () => {
    const res = await POST(postBody({ name: "Local qBT", host: "localhost", username: 42 }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Invalid field types")
  })

  it("still enforces the length limit when credentials are supplied", async () => {
    const res = await POST(
      postBody({
        name: "Local qBT",
        host: "localhost",
        username: "a".repeat(CREDENTIAL_MAX + 1),
        password: "pw",
      })
    )

    expect(res.status).toBe(400)
  })

  // ── API-key auth ─────────────────────────────────────────────────────
  //
  // Unlike a password, a key has no blank-is-valid case: there is no
  // localhost bypass for it, so an absent key is always a mistake.

  it("defaults to password auth when authMethod is omitted", async () => {
    const res = await POST(postBody({ name: "Local qBT", host: "localhost" }))

    expect(res.status).toBe(201)
    expect(inserted?.authMethod).toBe("password")
    expect(inserted?.encryptedApiKey).toBe("")
  })

  it("stores an API key encrypted and leaves the password columns blank", async () => {
    const res = await POST(
      postBody({
        name: "Local qBT",
        host: "localhost",
        authMethod: "apikey",
        apiKey: "qbt_examplekey",
      })
    )

    expect(res.status).toBe(201)
    expect(inserted?.authMethod).toBe("apikey")
    // Real encrypt() runs here, the plaintext must not survive into the row.
    expect(inserted?.encryptedApiKey).not.toBe("")
    expect(JSON.stringify(inserted)).not.toContain("qbt_examplekey")
    expect(decrypt(inserted?.encryptedApiKey as string, Buffer.from(VALID_KEY, "hex"))).toBe(
      "qbt_examplekey"
    )
    expect(decrypt(inserted?.encryptedUsername as string, Buffer.from(VALID_KEY, "hex"))).toBe("")
  })

  it("never writes a password into the API key column", async () => {
    await POST(
      postBody({ name: "Local qBT", host: "localhost", username: "admin", password: "hunter2" })
    )

    expect(inserted?.encryptedApiKey).toBe("")
    expect(JSON.stringify(inserted)).not.toContain("hunter2")
  })

  it("rejects apikey auth with no key", async () => {
    const res = await POST(postBody({ name: "Local qBT", host: "localhost", authMethod: "apikey" }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/apiKey is required/)
  })

  it("rejects an unknown authMethod", async () => {
    const res = await POST(
      postBody({ name: "Local qBT", host: "localhost", authMethod: "carrier-pigeon" })
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/authMethod must be one of/)
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/clients/[id], the mode and its secret move together
//
// The invariant these pin: naming an auth method without supplying that
// method's credential is refused. Without it, PATCH {"authMethod":"apikey"}
// on a password client would re-label the stored password as a key, and the
// next poll would send that password in an Authorization header.
// ---------------------------------------------------------------------------

describe("PATCH /api/clients/[id] credential handling", () => {
  let updates: Record<string, unknown> | null = null

  beforeEach(() => {
    vi.resetAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: VALID_KEY })
    updates = null
    mockDbSelectClient(MOCK_CLIENT)
    ;(db as unknown as { transaction: ReturnType<typeof vi.fn> }).transaction = vi
      .fn()
      .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          update: () => ({
            set: (v: Record<string, unknown>) => {
              updates = v
              return { where: async () => undefined }
            },
          }),
        })
      )
  })

  function patchBody(body: Record<string, unknown>): Request {
    return new Request("http://localhost/api/clients/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  const routeProps = { params: Promise.resolve({ id: "1" }) }

  it("refuses to switch to apikey without a key", async () => {
    const res = await PATCH(patchBody({ authMethod: "apikey" }), routeProps)

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/apiKey is required/)
    // Nothing was written, the stored password was not re-labelled.
    expect(updates).toBeNull()
  })

  it("refuses to switch to password without both fields", async () => {
    const res = await PATCH(patchBody({ authMethod: "password", username: "admin" }), routeProps)

    expect(res.status).toBe(400)
    expect(updates).toBeNull()
  })

  it("blanks the password columns when switching to a key", async () => {
    const res = await PATCH(patchBody({ authMethod: "apikey", apiKey: "qbt_newkey" }), routeProps)

    expect(res.status).toBe(200)
    expect(updates?.authMethod).toBe("apikey")
    const key = Buffer.from(VALID_KEY, "hex")
    expect(decrypt(updates?.encryptedApiKey as string, key)).toBe("qbt_newkey")
    expect(decrypt(updates?.encryptedUsername as string, key)).toBe("")
    expect(decrypt(updates?.encryptedPassword as string, key)).toBe("")
  })

  it("clears the key when switching back to a password", async () => {
    const res = await PATCH(
      patchBody({ authMethod: "password", username: "admin", password: "pw" }),
      routeProps
    )

    expect(res.status).toBe(200)
    expect(updates?.authMethod).toBe("password")
    expect(updates?.encryptedApiKey).toBe("")
  })

  it("still accepts blank username and password — localhost bypass", async () => {
    const res = await PATCH(
      patchBody({ authMethod: "password", username: "", password: "" }),
      routeProps
    )

    expect(res.status).toBe(200)
    const key = Buffer.from(VALID_KEY, "hex")
    expect(decrypt(updates?.encryptedPassword as string, key)).toBe("")
  })

  it("infers password mode from a legacy body with no authMethod", async () => {
    const res = await PATCH(patchBody({ username: "admin", password: "pw" }), routeProps)

    expect(res.status).toBe(200)
    expect(updates?.authMethod).toBe("password")
  })

  it("refuses to guess when both modes' secrets arrive with no authMethod", async () => {
    const res = await PATCH(
      patchBody({ apiKey: "qbt_k", username: "admin", password: "pw" }),
      routeProps
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/authMethod is required/)
    expect(updates).toBeNull()
  })

  it("leaves credentials untouched when the patch is unrelated", async () => {
    const res = await PATCH(patchBody({ name: "Renamed" }), routeProps)

    expect(res.status).toBe(200)
    expect(updates?.name).toBe("Renamed")
    expect(updates).not.toHaveProperty("authMethod")
    expect(updates).not.toHaveProperty("encryptedPassword")
    expect(updates).not.toHaveProperty("encryptedApiKey")
  })
})
