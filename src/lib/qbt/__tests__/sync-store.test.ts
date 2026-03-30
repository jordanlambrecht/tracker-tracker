// src/lib/qbt/__tests__/sync-store.test.ts

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  applyMaindataUpdate,
  clearAllStores,
  getStoredTorrents,
  getStoreRevision,
  isStoreFresh,
  isStoreInitialized,
  resetStore,
} from "../sync-store"
import type { QbtMaindataResponse } from "../types"

afterEach(() => clearAllStores())

const BASE_URL = "http://localhost:8080"

function makeTorrent(hash: string, overrides: Record<string, unknown> = {}) {
  return {
    hash,
    name: `Torrent ${hash}`,
    state: "stalledUP",
    tags: "🕵️ Aither",
    category: "movies",
    upspeed: 0,
    dlspeed: 0,
    uploaded: 1000,
    downloaded: 500,
    ratio: 2.0,
    size: 1_000_000,
    num_seeds: 5,
    num_leechs: 1,
    num_complete: 10,
    num_incomplete: 2,
    tracker: "https://tracker.example.com/announce",
    added_on: 1700000000,
    completion_on: 1700001000,
    last_activity: 1700002000,
    seeding_time: 86400,
    time_active: 86400,
    seen_complete: 1700001500,
    availability: 1.0,
    amount_left: 0,
    progress: 1.0,
    content_path: "/data/movies/torrent",
    save_path: "/data/movies",
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
    const response: QbtMaindataResponse = {
      rid: 1,
      full_update: true,
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
      full_update: true,
      torrents: {
        abc123: makeTorrent("abc123", { seeding_time: 100, uploaded: 1000 }),
      },
    })

    // Delta: only seeding_time changed
    applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents: { abc123: { seeding_time: 200 } },
    })

    expect(getStoreRevision(BASE_URL)).toBe(2)
    const torrents = getStoredTorrents(BASE_URL)
    expect(torrents).toHaveLength(1)
    expect(torrents[0].seeding_time).toBe(200) // updated
    expect(torrents[0].uploaded).toBe(1000) // preserved
    expect(torrents[0].name).toBe("Torrent abc123") // preserved
  })

  it("handles torrents_removed", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      full_update: true,
      torrents: {
        abc123: makeTorrent("abc123"),
        def456: makeTorrent("def456"),
      },
    })

    applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents_removed: ["abc123"],
    })

    expect(getStoredTorrents(BASE_URL)).toHaveLength(1)
    expect(getStoredTorrents(BASE_URL)[0].hash).toBe("def456")
  })

  it("adds new torrents via delta (not full_update)", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      full_update: true,
      torrents: { abc123: makeTorrent("abc123") },
    })

    applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents: { newone: makeTorrent("newone") },
    })

    expect(getStoredTorrents(BASE_URL)).toHaveLength(2)
  })

  it("full_update clears existing data before applying", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      full_update: true,
      torrents: { abc123: makeTorrent("abc123") },
    })

    // Second full_update with different data
    applyMaindataUpdate(BASE_URL, {
      rid: 5,
      full_update: true,
      torrents: { xyz999: makeTorrent("xyz999") },
    })

    expect(getStoredTorrents(BASE_URL)).toHaveLength(1)
    expect(getStoredTorrents(BASE_URL)[0].hash).toBe("xyz999")
    expect(getStoreRevision(BASE_URL)).toBe(5)
  })

  it("resetStore clears state and forces re-sync", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 10,
      full_update: true,
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
      full_update: true,
      torrents: { aaa: makeTorrent("aaa") },
    })
    applyMaindataUpdate("http://client-b:8080", {
      rid: 1,
      full_update: true,
      torrents: { bbb: makeTorrent("bbb"), ccc: makeTorrent("ccc") },
    })

    expect(getStoredTorrents("http://client-a:8080")).toHaveLength(1)
    expect(getStoredTorrents("http://client-b:8080")).toHaveLength(2)
  })

  it("returns a snapshot array, not a live reference", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      full_update: true,
      torrents: { abc123: makeTorrent("abc123") },
    })

    const first = getStoredTorrents(BASE_URL)
    const second = getStoredTorrents(BASE_URL)
    expect(first).not.toBe(second) // different array instances
    expect(first).toEqual(second) // same content
  })

  it("delta on uninitialized store does NOT mark it initialized", () => {
    // A delta without a prior full_update should not be trusted
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
      full_update: true,
      torrents: { abc123: makeTorrent("abc123") },
    })

    // Empty delta — nothing changed
    applyMaindataUpdate(BASE_URL, { rid: 2 })

    expect(getStoredTorrents(BASE_URL)).toHaveLength(1)
    expect(getStoreRevision(BASE_URL)).toBe(2)
  })

  it("torrents_removed for non-existent hash is a no-op", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      full_update: true,
      torrents: { abc123: makeTorrent("abc123") },
    })

    applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents_removed: ["nonexistent"],
    })

    expect(getStoredTorrents(BASE_URL)).toHaveLength(1)
  })

  it("skips incomplete new torrents in delta (missing required fields)", () => {
    applyMaindataUpdate(BASE_URL, {
      rid: 1,
      full_update: true,
      torrents: { abc123: makeTorrent("abc123") },
    })

    // Delta adds a torrent with only partial fields (no name, state, size, ratio)
    applyMaindataUpdate(BASE_URL, {
      rid: 2,
      torrents: { incomplete: { upspeed: 100 } },
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
        full_update: true,
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
      full_update: true,
      torrents: { abc123: makeTorrent("abc123", { uploaded: 1000 }) },
    })

    const first = getStoredTorrents(BASE_URL)
    first[0].uploaded = 999_999

    const second = getStoredTorrents(BASE_URL)
    expect(second[0].uploaded).toBe(1000) // store unaffected
  })
})
