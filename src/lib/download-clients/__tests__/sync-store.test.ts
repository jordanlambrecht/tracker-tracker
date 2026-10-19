// src/lib/download-clients/__tests__/sync-store.test.ts

import { afterEach, describe, expect, it, vi } from "vitest"
import type { DeltaSyncResponse } from "@/lib/download-clients"
import { SYNC_STORE_MAX_TORRENTS } from "@/lib/limits"
import { log } from "@/lib/logger"
import {
  applyMaindataUpdate,
  clearAllStores,
  getStoredTorrents,
  getStoreRevision,
  isStoreFresh,
  isStoreInitialized,
  replaceStoreTorrents,
  resetStore,
} from "../sync-store"

afterEach(() => {
  clearAllStores()
  vi.restoreAllMocks()
})

const BASE_URL = "http://localhost:8080"
const BASE = BASE_URL

function makeTorrent(hash: string, overrides: Record<string, unknown> = {}) {
  return {
    hash,
    name: `Torrent ${hash}`,
    state: "stalledUP",
    tags: "🕵️ Aither",
    category: "movies",
    uploadSpeed: 0,
    downloadSpeed: 0,
    uploaded: 1000,
    downloaded: 500,
    ratio: 2.0,
    size: 1_000_000,
    seedCount: 5,
    leechCount: 1,
    swarmSeeders: 10,
    swarmLeechers: 2,
    tracker: "https://tracker.example.com/announce",
    addedAt: 1700000000,
    completedAt: 1700001000,
    lastActivityAt: 1700002000,
    seedingTime: 86400,
    activeTime: 86400,
    lastSeenComplete: 1700001500,
    availability: 1.0,
    remaining: 0,
    progress: 1.0,
    contentPath: "/data/movies/torrent",
    savePath: "/data/movies",
    ...overrides,
  }
}

describe("sync-store", () => {
  it("starts uninitialized with rid=0", () => {
    expect(isStoreInitialized(BASE_URL)).toBe(false)
    expect(getStoreRevision(BASE_URL)).toBe(0)
    expect(getStoredTorrents(BASE_URL)).toEqual([])
  })

  it("applies a full update (rid=0 response)", () => {
    const response: DeltaSyncResponse = {
      rid: 1,
      fullUpdate: true,
      torrents: {
        abc123: makeTorrent("abc123"),
        def456: makeTorrent("def456", { name: "Second Torrent" }),
      },
    }
    applyMaindataUpdate(BASE_URL, response)

    expect(isStoreInitialized(BASE_URL)).toBe(true)
    expect(getStoreRevision(BASE_URL)).toBe(1)
    expect(getStoredTorrents(BASE_URL)).toHaveLength(2)
  })

  it("applies a delta update — merges changed fields only", () => {
    // Initial full sync
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      fullUpdate: true,
      torrents: {
        abc123: makeTorrent("abc123", { seedingTime: 100, uploaded: 1000 }),
      },
    })

    // Delta: only seedingTime changed
    applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents: { abc123: { seedingTime: 200 } },
    })

    expect(getStoreRevision(BASE_URL)).toBe(2)
    const torrents = getStoredTorrents(BASE_URL)
    expect(torrents).toHaveLength(1)
    expect(torrents[0].seedingTime).toBe(200) // updated
    expect(torrents[0].uploaded).toBe(1000) // preserved
    expect(torrents[0].name).toBe("Torrent abc123") // preserved
  })

  it("handles torrentsRemoved", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      fullUpdate: true,
      torrents: {
        abc123: makeTorrent("abc123"),
        def456: makeTorrent("def456"),
      },
    })

    applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrentsRemoved: ["abc123"],
    })

    expect(getStoredTorrents(BASE_URL)).toHaveLength(1)
    expect(getStoredTorrents(BASE_URL)[0].hash).toBe("def456")
  })

  it("adds new torrents via delta (not fullUpdate)", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      fullUpdate: true,
      torrents: { abc123: makeTorrent("abc123") },
    })

    applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents: { newone: makeTorrent("newone") },
    })

    expect(getStoredTorrents(BASE_URL)).toHaveLength(2)
  })

  it("coerces a missing numeric field when a delta inserts a new torrent", () => {
    // New torrents can arrive through the delta path, which skips
    // mapQbtTorrent's coercion, and the shape check does not cover seedingTime.
    const partial = makeTorrent("newone") as Record<string, unknown>
    delete partial.seedingTime
    applyMaindataUpdate(BASE_URL, { rid: 1, fullUpdate: true, torrents: { newone: partial } })
    expect(getStoredTorrents(BASE_URL)[0]?.seedingTime).toBe(0)
  })

  it("fullUpdate clears existing data before applying", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      fullUpdate: true,
      torrents: { abc123: makeTorrent("abc123") },
    })

    // Second fullUpdate with different data
    applyMaindataUpdate(BASE_URL, {
      rid: 5,
      fullUpdate: true,
      torrents: { xyz999: makeTorrent("xyz999") },
    })

    expect(getStoredTorrents(BASE_URL)).toHaveLength(1)
    expect(getStoredTorrents(BASE_URL)[0].hash).toBe("xyz999")
    expect(getStoreRevision(BASE_URL)).toBe(5)
  })

  it("resetStore clears state and forces re-sync", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 10,
      fullUpdate: true,
      torrents: { abc123: makeTorrent("abc123") },
    })

    resetStore(BASE_URL)

    expect(isStoreInitialized(BASE_URL)).toBe(false)
    expect(getStoreRevision(BASE_URL)).toBe(0)
    expect(getStoredTorrents(BASE_URL)).toEqual([])
  })

  it("isolates stores by baseUrl", () => {
    applyMaindataUpdate("http://client-a:8080", {
      rid: 1,
      fullUpdate: true,
      torrents: { aaa: makeTorrent("aaa") },
    })
    applyMaindataUpdate("http://client-b:8080", {
      rid: 1,
      fullUpdate: true,
      torrents: { bbb: makeTorrent("bbb"), ccc: makeTorrent("ccc") },
    })

    expect(getStoredTorrents("http://client-a:8080")).toHaveLength(1)
    expect(getStoredTorrents("http://client-b:8080")).toHaveLength(2)
  })

  it("returns a snapshot array, not a live reference", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      fullUpdate: true,
      torrents: { abc123: makeTorrent("abc123") },
    })

    const first = getStoredTorrents(BASE_URL)
    const second = getStoredTorrents(BASE_URL)
    expect(first).not.toBe(second) // different array instances
    expect(first).toEqual(second) // same content
  })

  it("delta on uninitialized store does NOT mark it initialized", () => {
    // A delta without a prior fullUpdate should not be trusted
    applyMaindataUpdate(BASE_URL, {
      rid: 5,
      torrents: { abc123: makeTorrent("abc123") },
    })

    expect(isStoreInitialized(BASE_URL)).toBe(false)
    expect(getStoredTorrents(BASE_URL)).toEqual([])
    expect(getStoreRevision(BASE_URL)).toBe(5)
  })

  it("handles empty delta (no changes)", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      fullUpdate: true,
      torrents: { abc123: makeTorrent("abc123") },
    })

    // Empty delta, nothing changed
    applyMaindataUpdate(BASE_URL, { rid: 2 })

    expect(getStoredTorrents(BASE_URL)).toHaveLength(1)
    expect(getStoreRevision(BASE_URL)).toBe(2)
  })

  it("torrentsRemoved for non-existent hash is a no-op", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      fullUpdate: true,
      torrents: { abc123: makeTorrent("abc123") },
    })

    applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrentsRemoved: ["nonexistent"],
    })

    expect(getStoredTorrents(BASE_URL)).toHaveLength(1)
  })

  it("skips incomplete new torrents in delta (missing required fields)", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      fullUpdate: true,
      torrents: { abc123: makeTorrent("abc123") },
    })

    // Delta adds a torrent with only partial fields (no name, state, size, ratio)
    applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents: { incomplete: { uploadSpeed: 100 } },
    })

    // Should not add the incomplete torrent
    expect(getStoredTorrents(BASE_URL)).toHaveLength(1)
  })

  it("isStoreFresh returns false for uninitialized store", () => {
    expect(isStoreFresh(BASE_URL, 60_000)).toBe(false)
  })

  it("isStoreFresh returns true when within max age, false when exceeded", () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
      applyMaindataUpdate(BASE_URL, {
        rid: 1,
        fullUpdate: true,
        torrents: { abc123: makeTorrent("abc123") },
      })

      // Immediately after update, within 5 min
      expect(isStoreFresh(BASE_URL, 5 * 60 * 1000)).toBe(true)

      // Advance 6 minutes, exceeds 5 min max age
      vi.advanceTimersByTime(6 * 60 * 1000)
      expect(isStoreFresh(BASE_URL, 5 * 60 * 1000)).toBe(false)

      // But still within 10 min max age
      expect(isStoreFresh(BASE_URL, 10 * 60 * 1000)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it("returned torrents are shallow copies — mutating them does not corrupt the store", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      fullUpdate: true,
      torrents: { abc123: makeTorrent("abc123", { uploaded: 1000 }) },
    })

    const first = getStoredTorrents(BASE_URL)
    first[0].uploaded = 999_999

    const second = getStoredTorrents(BASE_URL)
    expect(second[0].uploaded).toBe(1000) // store unaffected
  })
})

describe("replaceStoreTorrents", () => {
  it("replaces all torrents for a client", () => {
    replaceStoreTorrents(BASE, [makeTorrent("h1"), makeTorrent("h2")])
    expect(getStoredTorrents(BASE)).toHaveLength(2)
  })

  it("marks store as initialized", () => {
    replaceStoreTorrents(BASE, [])
    expect(isStoreInitialized(BASE)).toBe(true)
  })

  it("clears previous torrents before replacing", () => {
    replaceStoreTorrents(BASE, [makeTorrent("old")])
    replaceStoreTorrents(BASE, [makeTorrent("new")])
    const stored = getStoredTorrents(BASE)
    expect(stored).toHaveLength(1)
    expect(stored[0].hash).toBe("new")
  })

  it("updates lastUpdatedAt so isStoreFresh returns true", () => {
    replaceStoreTorrents(BASE, [])
    expect(isStoreFresh(BASE, 60_000)).toBe(true)
  })
})

describe("applyMaindataUpdate validates a delta for a torrent it already holds", () => {
  // The insert path coerces and shape-checks. The update path used to be a
  // bare Object.assign, so once a hash had been seen, a hostile or buggy host
  // could put any type into any field. The store outlives the poll and is
  // serialized into cachedTorrents, so a bad value persisted rather than
  // clearing on the next sync.
  const seed = {
    rid: 1,
    fullUpdate: true,
    torrents: {
      abc: {
        hash: "abc",
        name: "Example",
        state: "uploading",
        size: 100,
        ratio: 1.5,
        tags: "aither, cross-seed",
      },
    },
  } as unknown as DeltaSyncResponse

  it("keeps the stored tags when a delta sends a number", () => {
    applyMaindataUpdate(BASE_URL, seed)
    applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents: { abc: { tags: 123 } },
    } as unknown as DeltaSyncResponse)

    const [torrent] = getStoredTorrents(BASE_URL)
    expect(typeof torrent.tags).toBe("string")
    expect(torrent.tags).toBe("aither, cross-seed")
    // parseTorrentTags does rawTags.split(","), so a number used to throw here
    // and take the whole aggregation with it.
    expect(() => torrent.tags.split(",")).not.toThrow()
  })

  it("keeps the stored number when a delta sends a string", () => {
    applyMaindataUpdate(BASE_URL, seed)
    applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents: { abc: { ratio: "not a number" } },
    } as unknown as DeltaSyncResponse)

    const [torrent] = getStoredTorrents(BASE_URL)
    expect(typeof torrent.ratio).toBe("number")
    expect(torrent.ratio).toBe(1.5)
  })

  it("defaults a non-string to empty when a full update carries it", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      fullUpdate: true,
      torrents: {
        abc: { hash: "abc", name: "Example", state: "uploading", size: 100, ratio: 1.5, tags: 123 },
      },
    } as unknown as DeltaSyncResponse)

    const [torrent] = getStoredTorrents(BASE_URL)
    expect(torrent.tags).toBe("")
  })

  it("still applies an ordinary delta", () => {
    applyMaindataUpdate(BASE_URL, seed)
    applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents: { abc: { ratio: 2.5, tags: "aither" } },
    } as unknown as DeltaSyncResponse)

    const [torrent] = getStoredTorrents(BASE_URL)
    expect(torrent.ratio).toBe(2.5)
    expect(torrent.tags).toBe("aither")
  })

  it("keeps the previous record when a delta would break the shape", () => {
    applyMaindataUpdate(BASE_URL, seed)
    applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents: { abc: { name: 42 } },
    } as unknown as DeltaSyncResponse)

    const [torrent] = getStoredTorrents(BASE_URL)
    expect(torrent.name).toBe("Example")
  })
})

describe("applyMaindataUpdate torrent cap", () => {
  // The store is keyed by hashes the host chooses and is never aged out, so
  // without a ceiling a host naming fresh hashes each poll grows it forever.
  const CAP = SYNC_STORE_MAX_TORRENTS

  // Complete records, so a bulk fixture large enough to reach the cap does not
  // spend the test run in coerceRequiredNumeric's per-field warning.
  function bulkTorrents(count: number, prefix: string, overrides: Record<string, unknown> = {}) {
    const torrents: Record<string, unknown> = {}
    for (let i = 0; i < count; i++) {
      torrents[`${prefix}${i}`] = makeTorrent(`${prefix}${i}`, overrides)
    }
    return torrents
  }

  function bulk(count: number, prefix: string) {
    return { rid: 1, fullUpdate: true, torrents: bulkTorrents(count, prefix) } as DeltaSyncResponse
  }

  it("accepts an update inside the cap", () => {
    expect(applyMaindataUpdate(BASE_URL, bulk(50, "a"))).toBeUndefined()
    expect(getStoredTorrents(BASE_URL)).toHaveLength(50)
  })

  it("refuses an update that would exceed the cap, keeping the last good state", () => {
    applyMaindataUpdate(BASE_URL, bulk(10, "a"))
    const huge = bulk(2, "b") as unknown as { torrents: Record<string, unknown> }
    for (let i = 0; i < CAP + 1; i++) {
      huge.torrents[`flood${i}`] = { hash: `flood${i}`, name: "x", state: "up", size: 1, ratio: 1 }
    }

    applyMaindataUpdate(BASE_URL, huge as unknown as DeltaSyncResponse)

    // The previous ten survive; nothing from the refused update landed.
    expect(getStoredTorrents(BASE_URL)).toHaveLength(10)
  })

  it("reports the refusal and leaves the revision where it was", () => {
    applyMaindataUpdate(BASE_URL, bulk(10, "a"))

    const refusal = applyMaindataUpdate(BASE_URL, {
      rid: 99,
      fullUpdate: true,
      torrents: bulkTorrents(CAP + 1, "b"),
    } as DeltaSyncResponse)

    expect(refusal).toMatchObject({ cap: CAP, projected: CAP + 1 })
    // A refused update is not a new revision. Advancing the rid would make the
    // next poll ask for a delta the store never applied.
    expect(getStoreRevision(BASE_URL)).toBe(1)
  })

  it("logs the refusal without the base URL, whose path can carry a proxy key", () => {
    const pathUrl = "http://localhost:8080/proxy/qui-client-key"
    applyMaindataUpdate(pathUrl, bulk(10, "a"))
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => undefined)

    applyMaindataUpdate(pathUrl, {
      rid: 99,
      fullUpdate: true,
      torrents: bulkTorrents(CAP + 1, "b"),
    } as DeltaSyncResponse)

    expect(warnSpy).toHaveBeenCalledWith(
      { held: 10, projected: CAP + 1, cap: CAP },
      expect.any(String)
    )
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("qui-client-key")
  })

  it("accepts a delta that only updates hashes it already holds", () => {
    applyMaindataUpdate(BASE_URL, bulk(60_000, "a"))

    const refusal = applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents: bulkTorrents(60_000, "a", { ratio: 3 }),
    } as DeltaSyncResponse)

    expect(refusal).toBeUndefined()
    expect(getStoredTorrents(BASE_URL)).toHaveLength(60_000)
    expect(getStoredTorrents(BASE_URL)[0].ratio).toBe(3)
    expect(getStoreRevision(BASE_URL)).toBe(2)
  })

  it("refuses a delta whose new hashes would cross the cap", () => {
    applyMaindataUpdate(BASE_URL, bulk(50_000, "a"))

    const refusal = applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents: bulkTorrents(50_001, "b"),
    } as DeltaSyncResponse)

    expect(refusal).toMatchObject({ cap: CAP })
    expect(getStoredTorrents(BASE_URL)).toHaveLength(50_000)
    expect(getStoreRevision(BASE_URL)).toBe(1)
  })

  it("counts what a delta removes against what it adds", () => {
    applyMaindataUpdate(BASE_URL, bulk(CAP, "a"))

    const refusal = applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents: bulkTorrents(10, "b"),
      torrentsRemoved: Array.from({ length: 10 }, (_, i) => `a${i}`),
    } as DeltaSyncResponse)

    expect(refusal).toBeUndefined()
    expect(getStoredTorrents(BASE_URL)).toHaveLength(CAP)
    expect(getStoreRevision(BASE_URL)).toBe(2)
  })

  it("credits a removal once, and only for a hash it holds", () => {
    applyMaindataUpdate(BASE_URL, bulk(50_000, "a"))

    // Removing a hash the store never held, or naming the same hash twice,
    // would buy 50,002 new torrents room under the cap if either counted.
    const refusal = applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents: bulkTorrents(50_002, "b"),
      torrentsRemoved: ["a0", "a0", "never-held"],
    } as DeltaSyncResponse)

    expect(refusal).toMatchObject({ cap: CAP })
    expect(getStoredTorrents(BASE_URL)).toHaveLength(50_000)
  })
})
