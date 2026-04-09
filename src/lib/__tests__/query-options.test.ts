// src/lib/__tests__/query-options.test.ts
//
// Tests for shared TanStack Query options objects.
// Verifies queryKey values and that queryFn is callable.
// Does not test fetch behavior (network/integration concern).

import { describe, expect, it } from "vitest"
import { clientQueryOptions, trackerQueryOptions } from "@/lib/query-options"

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

describe("query option key uniqueness", () => {
  it("clientQueryOptions and trackerQueryOptions have distinct queryKeys", () => {
    expect(clientQueryOptions.queryKey).not.toEqual(trackerQueryOptions.queryKey)
  })
})
