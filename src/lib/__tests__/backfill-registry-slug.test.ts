// src/lib/__tests__/backfill-registry-slug.test.ts
//
// A row created before trackers.registry_slug existed carries no slug, so every
// registry lookup for it returns undefined and its poll address is whatever
// spelling happens to be stored. The startup backfill is the one chance to name
// the entry, and it matches on hostname, the rule the no-two-hostnames test in
// tracker-registry.test.ts keeps unambiguous. A site the registry does not
// carry has to survive untouched: that row is a custom tracker, not a mistake.

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/scheduler-key-store", () => ({ loadSchedulerKey: vi.fn(async () => null) }))
vi.mock("@/lib/scheduler", () => ({ startScheduler: vi.fn() }))
vi.mock("@/lib/cookie-security", () => ({ shouldSecureCookies: vi.fn(() => true) }))

import { registryHostname, TRACKER_REGISTRY } from "@/data/tracker-registry"
import { register } from "@/instrumentation"
import { db } from "@/lib/db"
import { backfillRegistrySlugs } from "@/lib/db/backfill-registry-slug"
import { log } from "@/lib/logger"

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

// Two real entries, read from the registry rather than spelled out, so a URL
// edit in a release cannot leave this test asserting a dead address.
const EXACT = TRACKER_REGISTRY[0]
const NORMALISED = TRACKER_REGISTRY[1]

/** The three shapes a null-slug row can have, in one run. */
function nullSlugRows() {
  return [
    { id: 1, baseUrl: EXACT.url, registrySlug: null },
    { id: 2, baseUrl: `http://www.${registryHostname(NORMALISED.url)}`, registrySlug: null },
    { id: 3, baseUrl: "https://private-vault.invented.example", registrySlug: null },
  ]
}

const setCalls: Record<string, unknown>[] = []

function mockSelect(result: unknown) {
  vi.mocked(db.select).mockImplementation((() => chain(result)) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  setCalls.length = 0
  // The once-guard lives on globalThis, which outlives a test file's modules,
  // so every test here has to start from an unlatched process.
  delete (globalThis as typeof globalThis & { __registrySlugBackfilled?: boolean })
    .__registrySlugBackfilled
  mockSelect(nullSlugRows())
  vi.mocked(db.update).mockImplementation((() => ({
    set: (values: Record<string, unknown>) => {
      setCalls.push(values)
      return chain([])
    },
  })) as never)
})

describe("backfillRegistrySlugs", () => {
  it("picks two distinct registry entries to work from", () => {
    expect(EXACT).toBeDefined()
    expect(NORMALISED).toBeDefined()
    expect(registryHostname(EXACT.url)).not.toBe(registryHostname(NORMALISED.url))
  })

  it("names the entry and leaves the URL alone when the spelling already matches", async () => {
    await backfillRegistrySlugs()

    expect(setCalls).toContainEqual({ registrySlug: EXACT.slug })
  })

  it("rewrites a www. spelling to the registry URL", async () => {
    await backfillRegistrySlugs()

    expect(setCalls).toContainEqual({ registrySlug: NORMALISED.slug, baseUrl: NORMALISED.url })
  })

  it("leaves a row on a host the registry does not carry untouched", async () => {
    await backfillRegistrySlugs()

    expect(setCalls).toHaveLength(2)
    expect(JSON.stringify(setCalls)).not.toContain("invented.example")
  })

  it("logs the counts once and names each matched slug", async () => {
    await backfillRegistrySlugs()

    expect(vi.mocked(log.info).mock.calls[0]?.[0]).toMatchObject({
      matched: 2,
      normalised: 1,
      left: 1,
    })
    const debugged = vi.mocked(log.debug).mock.calls.map(([fields]) => fields)
    expect(debugged).toContainEqual(expect.objectContaining({ slug: EXACT.slug }))
    expect(debugged).toContainEqual(expect.objectContaining({ slug: NORMALISED.slug }))
  })

  it("makes a second call in the same process a no-op", async () => {
    await backfillRegistrySlugs()
    await backfillRegistrySlugs()

    expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1)
    expect(setCalls).toHaveLength(2)
  })

  it("runs again when forced, for rows a restore wrote after boot", async () => {
    await backfillRegistrySlugs()
    await backfillRegistrySlugs({ force: true })

    expect(vi.mocked(db.select)).toHaveBeenCalledTimes(2)
  })

  it("logs a failed select and does not throw it into boot", async () => {
    mockSelect(Promise.reject(new Error("connection refused")))

    await expect(backfillRegistrySlugs()).resolves.toBeUndefined()

    expect(vi.mocked(log.warn).mock.calls[0]?.[0]).toMatchObject({ error: "connection refused" })
    expect(setCalls).toHaveLength(0)
  })
})

describe("the boot hook", () => {
  it("backfills even when no persisted key starts the scheduler", async () => {
    // register() returns early when loadSchedulerKey finds nothing, so a boot
    // that never starts polling must still have repaired the rows by then.
    const previous = process.env.NEXT_RUNTIME
    process.env.NEXT_RUNTIME = "nodejs"
    try {
      await register()
    } finally {
      if (previous === undefined) delete process.env.NEXT_RUNTIME
      else process.env.NEXT_RUNTIME = previous
    }

    expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1)
    expect(setCalls).toHaveLength(2)
  })
})
