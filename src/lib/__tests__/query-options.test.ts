// src/lib/__tests__/query-options.test.ts
//
// Tests for shared TanStack Query options objects.
// Verifies queryKey values and that queryFn is callable.
// Does not test fetch behavior (network/integration concern).

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clientQueryOptions,
  fleetCachedQueryOptions,
  trackerQueryOptions,
} from "@/lib/query-options"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("clientQueryOptions", () => {
  it("has the correct queryKey", () => {
    expect(clientQueryOptions.queryKey).toEqual(["clients"])
  })

  it("has a queryFn function", () => {
    expect(typeof clientQueryOptions.queryFn).toBe("function")
  })
})

describe("trackerQueryOptions", () => {
  it("has the correct queryKey", () => {
    expect(trackerQueryOptions.queryKey).toEqual(["trackers"])
  })

  it("has a queryFn function", () => {
    expect(typeof trackerQueryOptions.queryFn).toBe("function")
  })
})

// TanStack ALWAYS supplies `signal`, so the previous `signal ?? AbortSignal.timeout(...)`
// could never evaluate its right-hand side: the timeout was dead code that still
// satisfied the security audit's "every fetch has a timeout" check. Pinning the
// composition rather than the 15s duration keeps this fast and avoids fake timers,
// which cannot advance the internal timer behind AbortSignal.timeout.
describe("shared query timeouts", () => {
  it("composes the caller's signal with the timeout instead of discarding one", async () => {
    let seen: AbortSignal | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        seen = init?.signal ?? undefined
        return { ok: true, status: 200, json: async () => ({}) } as Response
      })
    )

    const caller = new AbortController()
    const run = fleetCachedQueryOptions.queryFn as unknown as (
      ctx: unknown
    ) => Promise<unknown>
    await run({ signal: caller.signal, queryKey: fleetCachedQueryOptions.queryKey })

    expect(seen).toBeDefined()
    // Not the caller's signal passed straight through — that is what made the
    // 15s ceiling unreachable.
    expect(seen).not.toBe(caller.signal)
    // ...and caller-driven cancellation still propagates through the composite.
    expect(seen?.aborted).toBe(false)
    caller.abort()
    expect(seen?.aborted).toBe(true)
  })
})

describe("query option key uniqueness", () => {
  it("clientQueryOptions and trackerQueryOptions have distinct queryKeys", () => {
    expect(clientQueryOptions.queryKey).not.toEqual(trackerQueryOptions.queryKey)
  })
})
