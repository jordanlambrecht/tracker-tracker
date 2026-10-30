// src/app/api/trackers/[id]/debug/debug-route.test.ts
//
// POST /api/trackers/[id]/debug sends the tracker's token to its stored
// address, so a row a restore paused for an unknown address must not reach it.

import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, parseTrackerId } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { UNLINKED_RESTORE_ERROR } from "@/lib/tracker-status"
import { POST } from "./route"

vi.mock("@/lib/api-helpers", () => ({
  authenticate: vi.fn(),
  decodeKey: vi.fn(() => Buffer.alloc(32)),
  parseTrackerId: vi.fn(),
}))
vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }))
vi.mock("@/lib/crypto", () => ({ decrypt: vi.fn(() => "token") }))
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/tunnel", () => ({ buildProxyAgentFromSettings: vi.fn(() => undefined) }))

const fetchRaw = vi.fn()
const fetchStats = vi.fn()
vi.mock("@/lib/tracker-platforms", () => ({
  getAdapter: vi.fn(() => ({ fetchRaw, fetchStats })),
  buildFetchOptions: vi.fn(() => ({})),
}))

/** Drizzle-shaped chain: any method sequence resolves to `result`. */
function chain(result: unknown): Record<string, unknown> {
  const settled = Promise.resolve(result)
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return settled.then.bind(settled)
        if (prop === "catch") return settled.catch.bind(settled)
        if (prop === "finally") return settled.finally.bind(settled)
        return () => proxy
      },
    }
  )
  return proxy
}

function mockRow(overrides: Record<string, unknown>) {
  const tracker = {
    id: 7,
    name: "Custom",
    baseUrl: "https://custom.example",
    apiPath: "/api/user",
    platformType: "unit3d",
    registrySlug: null,
    encryptedApiToken: "enc",
    isActive: true,
    remoteUserId: null,
    useProxy: false,
    pausedAt: new Date("2026-10-30T00:00:00Z"),
    ...overrides,
  }
  vi.mocked(db.select).mockImplementation(((cols: Record<string, unknown>) =>
    chain(Object.keys(cols ?? {}).includes("encryptedApiToken") ? [tracker] : [])) as never)
}

function debug(): Promise<Response> {
  return POST(new Request("http://localhost/api/trackers/7/debug", { method: "POST" }), {
    params: Promise.resolve({ id: "7" }),
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authenticate).mockResolvedValue({ encryptionKey: "ab".repeat(32) } as never)
  vi.mocked(parseTrackerId).mockResolvedValue(7)
  fetchRaw.mockResolvedValue([])
  fetchStats.mockResolvedValue({ uploadedBytes: 1n, downloadedBytes: 1n, bufferBytes: 0n })
})

describe("POST /api/trackers/[id]/debug", () => {
  it("refuses a restore-paused tracker without contacting it", async () => {
    mockRow({ lastError: UNLINKED_RESTORE_ERROR })

    const res = await debug()

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Resume this tracker before debugging it" })
    expect(fetchRaw).not.toHaveBeenCalled()
    expect(fetchStats).not.toHaveBeenCalled()
  })

  // Debugging is how a user looks into a tracker paused after failures.
  it("still debugs a tracker paused for any other reason", async () => {
    mockRow({ lastError: "HTTP 503" })

    const res = await debug()

    expect(res.status).toBe(200)
    expect(fetchRaw).toHaveBeenCalledWith("https://custom.example", "token", "/api/user", {})
    expect(fetchStats).toHaveBeenCalledWith("https://custom.example", "token", "/api/user", {})
  })
})
