// src/lib/__tests__/prowlarr-matching.test.ts

vi.mock("@/data/tracker-registry", () => ({
  registryEntryFor: vi.fn(() => undefined),
}))

import { beforeEach, describe, expect, it, vi } from "vitest"
import { registryEntryFor } from "@/data/tracker-registry"
import { hostsFromUrls, matchTrackerIndexers, normalizeHost } from "@/lib/prowlarr/matching"

const mockRegistryEntryFor = vi.mocked(registryEntryFor)

beforeEach(() => {
  mockRegistryEntryFor.mockReturnValue(undefined)
})

function indexer(indexerId: number, hosts: string[], instanceId = 1) {
  return { instanceId, indexerId, hosts }
}

function tracker(
  baseUrl: string,
  pin: { instanceId: number | null; indexerId: number | null } | "none" | null = null
) {
  return {
    baseUrl,
    registrySlug: null,
    prowlarrInstanceId: pin && pin !== "none" ? pin.instanceId : null,
    prowlarrIndexerId: pin && pin !== "none" ? pin.indexerId : null,
    prowlarrOptOut: pin === "none",
  }
}

describe("normalizeHost", () => {
  it("lowercases and drops www., a trailing dot, the port and the path", () => {
    expect(normalizeHost("https://WWW.Example.org.:8443/login")).toBe("example.org")
  })

  it("accepts a bare host", () => {
    expect(normalizeHost("tracker.example.net")).toBe("tracker.example.net")
  })

  it("keeps other subdomains", () => {
    expect(normalizeHost("https://api.example.org")).toBe("api.example.org")
  })

  it("returns null for empty or unparseable input", () => {
    expect(normalizeHost("")).toBeNull()
    expect(normalizeHost(null)).toBeNull()
    expect(normalizeHost("https://")).toBeNull()
  })
})

describe("hostsFromUrls", () => {
  it("dedupes and skips unusable entries", () => {
    expect(
      hostsFromUrls([
        "https://example.org/",
        "https://www.example.org",
        null,
        "",
        "https://alt.example.net",
      ])
    ).toEqual(["example.org", "alt.example.net"])
  })
})

describe("matchTrackerIndexers", () => {
  const indexers = [
    indexer(1, ["example.org", "example-mirror.org"]),
    indexer(2, ["other.example.net"]),
    indexer(3, ["example.net"]),
    indexer(4, ["example.org"], 2),
  ]

  it("matches by hostname, ignoring www., across every instance", () => {
    const match = matchTrackerIndexers(tracker("https://www.example.org"), indexers)
    expect(match?.matchedBy).toBe("auto")
    expect(match?.indexers.map((i) => [i.instanceId, i.indexerId])).toEqual([
      [1, 1],
      [2, 4],
    ])
  })

  it("matches an alternate URL listed on the indexer", () => {
    expect(matchTrackerIndexers(tracker("https://example-mirror.org"), indexers)?.indexers).toEqual(
      [indexers[0]]
    )
  })

  it("prefers an exact host over a sibling on the same domain", () => {
    expect(matchTrackerIndexers(tracker("https://example.net"), indexers)?.indexers).toEqual([
      indexers[2],
    ])
  })

  it("falls back to the registrable domain when no host matches exactly", () => {
    const only = [indexer(5, ["tracker.sample.io"])]
    expect(matchTrackerIndexers(tracker("https://sample.io"), only)?.indexers).toEqual(only)
  })

  it("also matches the registry entry's URL", () => {
    // biome-ignore lint/suspicious/noExplicitAny: partial registry entry, only url matters here
    mockRegistryEntryFor.mockReturnValue({ url: "https://example-mirror.org" } as any)
    const match = matchTrackerIndexers(tracker("https://renamed.example.com"), indexers)
    expect(match?.indexers).toEqual([indexers[0]])
  })

  it("returns null when nothing matches", () => {
    expect(matchTrackerIndexers(tracker("https://unrelated.example.com"), indexers)).toBeNull()
  })

  it("honours a pinned indexer even when the hosts differ", () => {
    const match = matchTrackerIndexers(
      tracker("https://example.org", { instanceId: 1, indexerId: 2 }),
      indexers
    )
    expect(match).toEqual({ matchedBy: "manual", indexers: [indexers[1]] })
  })

  it("matches nothing for a pin whose indexer is gone, or for an opted-out tracker", () => {
    const gone = tracker("https://example.org", { instanceId: 1, indexerId: 99 })
    expect(matchTrackerIndexers(gone, indexers)).toBeNull()
    expect(matchTrackerIndexers(tracker("https://example.org", "none"), indexers)).toBeNull()
  })

  // The foreign key clears only the instance id when an instance is deleted.
  it("matches by hostname when the pin has no instance", () => {
    const orphan = tracker("https://example.net", { instanceId: null, indexerId: 2 })
    expect(matchTrackerIndexers(orphan, indexers)).toEqual({
      matchedBy: "auto",
      indexers: [indexers[2]],
    })
  })
})
