// src/lib/download-clients/__tests__/sync-store.test.ts

import { afterEach, describe, expect, it, vi } from "vitest"
import type { DeltaSyncResponse } from "@/lib/download-clients"
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

afterEach(() => clearAllStores())

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

    // Empty delta — nothing changed
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

    // Should NOT add the incomplete torrent
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

      // Immediately after update — within 5 min
      expect(isStoreFresh(BASE_URL, 5 * 60 * 1000)).toBe(true)

      // Advance 6 minutes — exceeds 5 min max age
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
