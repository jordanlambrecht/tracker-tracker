// src/app/api/trackers/[id]/debug/debug-route.test.ts
//
// POST /api/trackers/[id]/debug sends the tracker's token, so it goes only to the
// address the row's registry entry gives, and a row with no entry or a defunct
// one is refused before anything is sent.

import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTrackerBySlug, TRACKER_REGISTRY } from "@/data/tracker-registry"
import { authenticate, parseTrackerId } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { getAdapter } from "@/lib/tracker-platforms"
import { TRACKER_DEFUNCT_ERROR, TRACKER_UNLINKED_ERROR } from "@/lib/tracker-status"
import { POST } from "./route"

vi.mock("@/lib/api-helpers", () => ({
  authenticate: vi.fn(),
  decodeKey: vi.fn(() => Buffer.alloc(32)),
  parseTrackerId: vi.fn(),
  refuseIfOutboundDisabled: vi.fn(() => null),
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
    name: "Anthelion",
    registrySlug: "anthelion",
    encryptedApiToken: "enc",
    isActive: true,
    remoteUserId: null,
    useProxy: false,
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
  it.each([
    ["isn't in the tracker list", null, TRACKER_UNLINKED_ERROR],
    ["has shut down", TRACKER_REGISTRY.find((t) => t.defunct)?.slug, TRACKER_DEFUNCT_ERROR],
  ])("refuses a tracker that %s without contacting it", async (_state, registrySlug, error) => {
    expect(registrySlug, "the registry has no defunct entry left to test with").not.toBeUndefined()
    mockRow({ registrySlug })

    const res = await debug()

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error })
    // The refusal comes before the token is decrypted, not only before it is sent.
    expect(decrypt).not.toHaveBeenCalled()
    expect(fetchRaw).not.toHaveBeenCalled()
    expect(fetchStats).not.toHaveBeenCalled()
  })

  // Debugging is how a user looks into a tracker paused after failures.
  it("debugs a paused tracker at its registry address, API path and platform", async () => {
    const entry = getTrackerBySlug("anthelion")
    mockRow({ pausedAt: new Date("2026-10-30T00:00:00Z"), lastError: "HTTP 503" })

    const res = await debug()

    expect(res.status).toBe(200)
    expect(getAdapter).toHaveBeenCalledWith(entry?.platform)
    expect(fetchRaw).toHaveBeenCalledWith(entry?.url, "token", entry?.apiPath, {})
    expect(fetchStats).toHaveBeenCalledWith(entry?.url, "token", entry?.apiPath, {})
    await expect(res.json()).resolves.toMatchObject({ platform: entry?.platform })
  })
})
