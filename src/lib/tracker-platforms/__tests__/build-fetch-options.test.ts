// src/lib/tracker-platforms/__tests__/build-fetch-options.test.ts
//
// buildFetchOptions is the only wiring between a registry entry and the
// per-tracker auth spellings the adapters read. The caller hands it the entry,
// so it never looks one up.

import { describe, expect, it } from "vitest"
import { getTrackerBySlug, type TrackerRegistryEntry } from "@/data/tracker-registry"
import { buildFetchOptions } from "@/lib/tracker-platforms"

function entry(slug: string): TrackerRegistryEntry {
  const found = getTrackerBySlug(slug)
  if (!found) throw new Error(`no registry entry "${slug}"`)
  return found
}

describe("buildFetchOptions", () => {
  it("gives Anthelion the apikey spelling", () => {
    expect(buildFetchOptions({ entry: entry("anthelion") }).nebulanceAuthParam).toBe("apikey")
  })

  it("leaves the auth param unset for a nebulance entry that does not spell it out", () => {
    expect(buildFetchOptions({ entry: entry("nebulance") }).nebulanceAuthParam).toBeUndefined()
  })

  it("carries the gazelle and unit3d auth styles", () => {
    expect(buildFetchOptions({ entry: entry("redacted") }).authStyle).toBe("raw")
    expect(buildFetchOptions({ entry: entry("blutopia") }).unit3dAuthStyle).toBe("bearer")
  })

  it("keeps the caller's infrastructure options alongside the entry's", () => {
    expect(buildFetchOptions({ entry: entry("anthelion"), remoteUserId: 7 })).toMatchObject({
      remoteUserId: 7,
      nebulanceAuthParam: "apikey",
    })
  })
})
