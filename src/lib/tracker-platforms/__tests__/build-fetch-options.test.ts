// src/lib/tracker-platforms/__tests__/build-fetch-options.test.ts
//
// buildFetchOptions is the only wiring between a registry entry and the
// per-tracker auth spellings the adapters read. A tracker row names its entry
// by slug; the stored URL is the poll address and never the key.

import { describe, expect, it } from "vitest"
import { buildFetchOptions } from "@/lib/tracker-platforms"

describe("buildFetchOptions registry lookup", () => {
  it("gives Anthelion the apikey spelling by slug", () => {
    expect(buildFetchOptions({ registrySlug: "anthelion" }).nebulanceAuthParam).toBe("apikey")
  })

  it("leaves the auth param unset for a nebulance entry the registry does not spell out", () => {
    expect(buildFetchOptions({ registrySlug: "nebulance" }).nebulanceAuthParam).toBeUndefined()
  })

  it("leaves every registry option unset for a row with no slug", () => {
    expect(buildFetchOptions({ registrySlug: null })).toEqual({})
    expect(buildFetchOptions({})).toEqual({})
  })

  it("resolves the gazelle and unit3d auth styles through the same slug lookup", () => {
    expect(buildFetchOptions({ registrySlug: "redacted" }).authStyle).toBe("raw")
    expect(buildFetchOptions({ registrySlug: "blutopia" }).unit3dAuthStyle).toBe("bearer")
  })

  it("keeps the caller's infrastructure options alongside the registry ones", () => {
    expect(buildFetchOptions({ registrySlug: "anthelion", remoteUserId: 7 })).toMatchObject({
      remoteUserId: 7,
      nebulanceAuthParam: "apikey",
    })
  })

  it("passes FlareSolverr in place of the proxy, which it replaces", () => {
    const flaresolverr = { url: "http://flaresolverr:8191", maxTimeout: 60000 }
    const options = buildFetchOptions({ proxyAgent: {} as never, flaresolverr })
    expect(options.flaresolverr).toEqual(flaresolverr)
    expect(options.proxyAgent).toBeUndefined()
  })
})
