// src/lib/download-clients/__tests__/test-connection.test.ts
//
// Tests for testClientConnection in coordinator.ts

import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Module mocks (must be before any imports from the module under test)
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}))

// Drizzle operators: pass-through identity stubs
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  isNotNull: vi.fn((col: unknown) => ({ type: "isNotNull", col })),
}))

// DB mock
const mockSelect = vi.fn()

vi.mock("@/lib/db", () => ({
  db: { select: (...args: unknown[]) => mockSelect(...args) },
}))

vi.mock("@/lib/db/schema", () => ({
  trackers: {
    id: "trackers.id",
    name: "trackers.name",
    qbtTag: "trackers.qbtTag",
    isActive: "trackers.isActive",
    color: "trackers.color",
  },
  downloadClients: {
    id: "downloadClients.id",
    name: "downloadClients.name",
    host: "downloadClients.host",
    port: "downloadClients.port",
    useSsl: "downloadClients.useSsl",
    type: "downloadClients.type",
    enabled: "downloadClients.enabled",
    encryptedUsername: "downloadClients.encryptedUsername",
    encryptedPassword: "downloadClients.encryptedPassword",
    crossSeedTags: "downloadClients.crossSeedTags",
    cachedTorrents: "downloadClients.cachedTorrents",
    cachedTorrentsAt: "downloadClients.cachedTorrentsAt",
    lastPolledAt: "downloadClients.lastPolledAt",
    lastError: "downloadClients.lastError",
    pollIntervalSeconds: "downloadClients.pollIntervalSeconds",
  },
}))

vi.mock("@/lib/fleet", () => ({
  parseTorrentTags: vi.fn((tags: string) =>
    tags
      .split(",")
      .map((t: string) => t.trim().toLowerCase())
      .filter(Boolean)
  ),
}))

vi.mock("@/lib/fleet-aggregation", () => ({
  computeFleetAggregation: vi.fn(() => ({})),
}))

// Mock adapter
const mockAdapter = {
  testConnection: vi.fn(),
  getTorrents: vi.fn(),
  getTransferInfo: vi.fn(),
  dispose: vi.fn(),
  type: "qbittorrent" as const,
  baseUrl: "http://localhost:8080",
}

vi.mock("../factory", () => ({
  createAdapterForClient: vi.fn(() => mockAdapter),
}))

vi.mock("@/lib/error-utils", () => ({
  classifyConnectionError: vi.fn((raw: string) => {
    if (/timed?\s*out/i.test(raw)) return " (timed out)"
    if (/ECONNREFUSED/i.test(raw)) return " (connection refused)"
    if (/40[13]/.test(raw)) return " (auth failed)"
    return ""
  }),
  isDecryptionError: vi.fn((err: unknown) => {
    if (!(err instanceof Error)) return false
    return /decrypt|bad\s*decrypt/i.test(err.message)
  }),
}))

vi.mock("../credentials", () => ({
  CLIENT_CONNECTION_COLUMNS: {
    name: "downloadClients.name",
    host: "downloadClients.host",
    port: "downloadClients.port",
    useSsl: "downloadClients.useSsl",
    encryptedUsername: "downloadClients.encryptedUsername",
    encryptedPassword: "downloadClients.encryptedPassword",
  },
}))

vi.mock("../fetch", () => ({
  fetchAndMergeTorrents: vi.fn(),
  stripSensitiveTorrentFields: vi.fn((t: Record<string, unknown>) => t),
}))

vi.mock("../merge", () => ({
  mergeTorrentLists: vi.fn((lists: unknown[][]) => lists.flat()),
  stampClientNames: vi.fn(
    (
      clientTorrents: { clientName: string; torrents: { hash: string }[] }[],
      merged: { hash: string }[]
    ) => {
      const hashClients = new Map<string, string[]>()
      for (const { clientName, torrents } of clientTorrents) {
        for (const t of torrents) {
          const names = hashClients.get(t.hash) ?? []
          names.push(clientName)
          hashClients.set(t.hash, names)
        }
      }
      return merged.map((t) => ({
        ...t,
        clientName: (hashClients.get(t.hash) ?? []).join(", "),
      }))
    }
  ),
  aggregateCrossSeedTags: vi.fn((clients: { crossSeedTags: string[] }[]) => {
    const tagSet = new Set<string>()
    for (const c of clients) {
      for (const tag of c.crossSeedTags) tagSet.add(tag)
    }
    return [...tagSet]
  }),
}))

vi.mock("../sync-store", () => ({
  STORE_MAX_AGE_MS: 10 * 60 * 1000,
  isStoreFresh: vi.fn(() => false),
  getFilteredTorrents: vi.fn(() => []),
}))

vi.mock("../transforms", () => ({
  slimTorrentForCache: vi.fn((t: unknown) => t),
}))

vi.mock("../qbt/transport", () => ({
  buildBaseUrl: vi.fn(
    (host: string, port: number, ssl: boolean) => `${ssl ? "https" : "http"}://${host}:${port}`
  ),
  parseCachedTorrents: vi.fn(() => []),
}))

// ---------------------------------------------------------------------------
// Re-import mocked modules + module under test
// ---------------------------------------------------------------------------

import { testClientConnection } from "../coordinator"
import { createAdapterForClient } from "../factory"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupDbSelect(rows: unknown[]) {
  const mockLimit = vi.fn().mockResolvedValue(rows)
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

function makeClientRow() {
  return {
    name: "Home qBT",
    host: "localhost",
    port: 8080,
    useSsl: false,
    type: "qbittorrent",
    encryptedUsername: "enc-admin",
    encryptedPassword: "enc-pass",
    crossSeedTags: null,
  }
}

const FAKE_KEY = Buffer.from("0".repeat(64), "hex")

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("testClientConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdapter.testConnection.mockReset()
    vi.mocked(createAdapterForClient).mockReturnValue(mockAdapter)
  })

  it("returns 404 when no client is found in the DB", async () => {
    setupDbSelect([])

    const result = await testClientConnection(99, FAKE_KEY)

    expect(result).toEqual({ error: "Client not found", status: 404 })
  })

  it("returns 401 when credential decryption fails (stale key)", async () => {
    setupDbSelect([makeClientRow()])
    vi.mocked(createAdapterForClient).mockImplementation(() => {
      throw new Error("decrypt credentials failed for client")
    })

    const result = await testClientConnection(1, FAKE_KEY)

    expect(result).toEqual({ error: "Session expired. Please log in again", status: 401 })
  })

  it("returns { success: true } when adapter.testConnection() resolves", async () => {
    setupDbSelect([makeClientRow()])
    mockAdapter.testConnection.mockResolvedValue(undefined)

    const result = await testClientConnection(1, FAKE_KEY)

    expect(result).toEqual({ success: true })
    expect(createAdapterForClient).toHaveBeenCalledWith(
      expect.objectContaining({ host: "localhost", type: "qbittorrent" }),
      FAKE_KEY
    )
  })

  it("returns 422 with '(timed out)' detail on timeout error", async () => {
    setupDbSelect([makeClientRow()])
    mockAdapter.testConnection.mockRejectedValue(new Error("request timed out after 10s"))

    const result = await testClientConnection(1, FAKE_KEY)

    expect(result).toEqual({
      error: "Connection test failed (timed out)",
      status: 422,
    })
  })

  it("returns 422 with '(connection refused)' detail on ECONNREFUSED", async () => {
    setupDbSelect([makeClientRow()])
    mockAdapter.testConnection.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:8080"))

    const result = await testClientConnection(1, FAKE_KEY)

    expect(result).toEqual({
      error: "Connection test failed (connection refused)",
      status: 422,
    })
  })

  it("returns 422 with '(auth failed)' detail on 403 error", async () => {
    setupDbSelect([makeClientRow()])
    mockAdapter.testConnection.mockRejectedValue(new Error("HTTP 403 Forbidden"))

    const result = await testClientConnection(1, FAKE_KEY)

    expect(result).toEqual({
      error: "Connection test failed (auth failed)",
      status: 422,
    })
  })

  it("returns 422 with no detail suffix for unknown errors", async () => {
    setupDbSelect([makeClientRow()])
    mockAdapter.testConnection.mockRejectedValue(new Error("some unexpected problem"))

    const result = await testClientConnection(1, FAKE_KEY)

    expect(result).toEqual({
      error: "Connection test failed",
      status: 422,
    })
  })

  it("handles non-Error throws (raw string)", async () => {
    setupDbSelect([makeClientRow()])
    mockAdapter.testConnection.mockRejectedValue("something went wrong")

    const result = await testClientConnection(1, FAKE_KEY)

    expect(result).toEqual({
      error: "Connection test failed",
      status: 422,
    })
  })
})
