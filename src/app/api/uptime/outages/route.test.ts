// src/app/api/uptime/outages/route.test.ts
//
// The route owns the coverage POLICY — how far back and forward the evidence is
// allowed to speak — so these tests focus on the boundaries rather than on the
// interval math, which is covered exhaustively in lib/__tests__/outages.test.ts.

import { NextResponse } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api-helpers", () => ({ authenticate: vi.fn() }))
vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }))
vi.mock("@/lib/app-liveness", () => ({
  getAppCoverage: vi.fn(),
  getCoverageGaps: vi.fn(),
}))
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { authenticate } from "@/lib/api-helpers"
import { getAppCoverage, getCoverageGaps } from "@/lib/app-liveness"
import { db } from "@/lib/db"
import { BUCKET_MS } from "@/lib/outages"
import { GET } from "./route"

const MINUTE = 60_000
const NOW = Date.UTC(2026, 7, 1, 12, 0, 0)
/** Minutes relative to NOW, in epoch ms. */
const m = (minutes: number): number => NOW + minutes * MINUTE

interface Seed {
  clientIds: number[]
  buckets: Array<{ clientId: number; bucketTs: Date; ok: number; fail: number }>
  earliestBucket: Date | null
  appCoverage: { start: number; end: number } | null
  gaps: Array<{ start: number; end: number; reason: string }>
}

function seed(overrides: Partial<Seed> = {}) {
  const data: Seed = {
    clientIds: [1],
    buckets: [],
    earliestBucket: new Date(m(-600)),
    appCoverage: { start: m(-600), end: m(0) },
    gaps: [],
    ...overrides,
  }

  vi.mocked(getAppCoverage).mockResolvedValue(data.appCoverage)
  vi.mocked(getCoverageGaps).mockResolvedValue(data.gaps)

  vi.mocked(db.select).mockImplementation(((columns: Record<string, unknown>) => {
    const keys = Object.keys(columns ?? {})
    let result: unknown[] = []
    if (keys.includes("ok")) result = data.buckets
    else if (keys.length === 1 && keys[0] === "bucketTs") {
      result = data.earliestBucket ? [{ bucketTs: data.earliestBucket }] : []
    } else result = data.clientIds.map((id) => ({ id }))

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
  }) as never)

  return data
}

/** `count` consecutive fully-failed buckets for one client, starting at `startMin`. */
function downRun(clientId: number, startMin: number, count: number) {
  return Array.from({ length: count }, (_unused, i) => ({
    clientId,
    bucketTs: new Date(m(startMin) + i * BUCKET_MS),
    ok: 0,
    fail: 12,
  }))
}

function call(query: string): Promise<Response> {
  return GET(new Request(`http://localhost/api/uptime/outages${query}`)) as Promise<Response>
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
  vi.clearAllMocks()
  vi.mocked(authenticate).mockResolvedValue({ encryptionKey: "ab".repeat(32) })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("GET /api/uptime/outages — guards", () => {
  it("401s when unauthenticated", async () => {
    vi.mocked(authenticate).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    expect((await call("?from=1&to=2")).status).toBe(401)
  })

  it.each([
    ["missing both", ""],
    ["missing to", "?from=1000"],
    ["non-numeric", "?from=yesterday&to=now"],
    ["fractional", "?from=1.5&to=2000"],
    ["infinite", "?from=1&to=Infinity"],
  ])("400s on %s", async (_label, query) => {
    expect((await call(query)).status).toBe(400)
  })

  it("400s when the window is inverted or empty", async () => {
    expect((await call("?from=2000&to=2000")).status).toBe(400)
    expect((await call("?from=3000&to=2000")).status).toBe(400)
  })

  it("400s on an absurdly wide window", async () => {
    expect((await call("?from=0&to=999999999999999")).status).toBe(400)
  })
})

describe("GET /api/uptime/outages — evidence", () => {
  it("returns a fleet band when the only client was down", async () => {
    seed({ buckets: downRun(1, -60, 6) })

    const body = await (await call(`?from=${m(-120)}&to=${m(0)}`)).json()

    expect(body.allDown).toEqual([{ start: m(-60), end: m(-30) }])
    expect(body.perClient).toEqual([{ clientId: 1, intervals: [{ start: m(-60), end: m(-30) }] }])
  })

  it("returns nothing when there is no evidence either way", async () => {
    seed({ buckets: [] })

    const body = await (await call(`?from=${m(-120)}&to=${m(0)}`)).json()

    expect(body.allDown).toEqual([])
    expect(body.app).toEqual([])
  })

  it("never draws qBT inside an app gap", async () => {
    seed({
      buckets: downRun(1, -60, 6),
      gaps: [{ start: m(-60), end: m(-30), reason: "unclean" }],
    })

    const body = await (await call(`?from=${m(-120)}&to=${m(0)}`)).json()

    expect(body.app).toEqual([{ start: m(-60), end: m(-30) }])
    expect(body.allDown).toEqual([])
  })

  it("does not band the in-flight bucket — the open present stays UNKNOWN", async () => {
    // "Now" is 12:00:00 exactly, so the last flushed bucket ends at 12:00:00 and
    // the bucket starting there is still accumulating in memory.
    vi.setSystemTime(new Date(NOW + 2 * MINUTE))
    seed({ buckets: downRun(1, -10, 3), appCoverage: { start: m(-600), end: m(2) } })

    const body = await (await call(`?from=${m(-120)}&to=${m(10)}`)).json()

    for (const band of body.allDown) {
      expect(band.end).toBeLessThanOrEqual(NOW)
    }
  })

  it("reports no qBT coverage when no client is enabled", async () => {
    seed({ clientIds: [], buckets: [], gaps: [{ start: m(-60), end: m(-30), reason: "stalled" }] })

    const body = await (await call(`?from=${m(-120)}&to=${m(0)}`)).json()

    expect(body.coverage.qbt).toBeNull()
    expect(body.allDown).toEqual([])
    // App bands do not depend on any download client existing.
    expect(body.app).toEqual([{ start: m(-60), end: m(-30) }])
  })

  it("reports no app coverage when the ledger has never been written", async () => {
    seed({ appCoverage: null, gaps: [] })

    const body = await (await call(`?from=${m(-120)}&to=${m(0)}`)).json()

    expect(body.coverage.app).toBeNull()
    expect(body.app).toEqual([])
  })

  it("reaches one bucket earlier than the window so a straddling band is whole", async () => {
    seed({ buckets: downRun(1, -125, 6) })

    await call(`?from=${m(-120)}&to=${m(0)}`)

    const [gapFrom] = vi.mocked(getCoverageGaps).mock.calls[0]
    expect(gapFrom).toBe(m(-120) - BUCKET_MS)
  })

  it("500s rather than leaking an error when a query fails", async () => {
    seed()
    vi.mocked(db.select).mockImplementation((() => {
      throw new Error("relation does not exist")
    }) as never)

    const response = await call(`?from=${m(-120)}&to=${m(0)}`)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "Failed to compute outage bands" })
  })
})
