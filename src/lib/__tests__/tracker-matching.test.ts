// src/lib/__tests__/tracker-matching.test.ts
//
// Issue #152: torrents were matched to trackers only by qBittorrent tag, so
// users without per-tracker tags saw empty dashboards.

import { describe, expect, it } from "vitest"
import {
  announceMatchesTracker,
  resolveTorrentTracker,
  trackerHostKey,
} from "@/lib/tracker-matching"

describe("trackerHostKey", () => {
  it("reduces a host to its registrable core", () => {
    expect(trackerHostKey("https://aither.cc/announce")).toBe("aither.cc")
    expect(trackerHostKey("tracker.example.org")).toBe("example.org")
    expect(trackerHostKey("https://www.example.org")).toBe("example.org")
  })

  it("handles the udp and non-http announce schemes trackers use", () => {
    expect(trackerHostKey("udp://tracker.example.org:2810/announce")).toBe("example.org")
  })

  it("does not collapse distinct sites sharing a two-label public suffix", () => {
    // Naive last-two-labels would make both of these "co.uk".
    expect(trackerHostKey("tracker.alpha.co.uk")).toBe("alpha.co.uk")
    expect(trackerHostKey("tracker.bravo.co.uk")).toBe("bravo.co.uk")
    expect(trackerHostKey("tracker.alpha.co.uk")).not.toBe(trackerHostKey("tracker.bravo.co.uk"))
  })

  it("leaves IPs and single-label hosts alone", () => {
    expect(trackerHostKey("192.168.1.50:8080")).toBe("192.168.1.50")
    expect(trackerHostKey("localhost")).toBe("localhost")
  })

  it("returns null for unusable input", () => {
    expect(trackerHostKey("")).toBeNull()
    expect(trackerHostKey(null)).toBeNull()
    expect(trackerHostKey(undefined)).toBeNull()
  })
})

describe("announceMatchesTracker", () => {
  it("matches an announce subdomain to the site's base URL", () => {
    expect(announceMatchesTracker("https://tracker.example.org/announce", "https://example.org")).toBe(true)
    expect(announceMatchesTracker("https://aither.cc/announce?passkey=x", "https://aither.cc")).toBe(true)
  })

  it("does not match unrelated sites", () => {
    expect(announceMatchesTracker("https://tracker.other.org/announce", "https://example.org")).toBe(false)
  })

  it("is false when either side is missing", () => {
    expect(announceMatchesTracker(null, "https://example.org")).toBe(false)
    expect(announceMatchesTracker("https://example.org/announce", null)).toBe(false)
  })
})

describe("resolveTorrentTracker", () => {
  const trackers = [
    { qbtTag: "aith", baseUrl: "https://aither.cc" },
    { qbtTag: null, baseUrl: "https://example.org" },
  ]

  it("prefers an explicit tag over the announce URL", () => {
    const hit = resolveTorrentTracker(
      { tags: "aith,cross-seed", tracker: "https://tracker.example.org/announce" },
      trackers
    )
    expect(hit?.tracker.baseUrl).toBe("https://aither.cc")
    expect(hit?.matchedTag).toBe("aith")
  })

  it("falls back to the announce URL when no tag matches — the #152 case", () => {
    const hit = resolveTorrentTracker(
      { tags: "cross-seed", tracker: "https://tracker.example.org/announce" },
      trackers
    )
    expect(hit?.tracker.baseUrl).toBe("https://example.org")
    expect(hit?.matchedTag).toBeNull()
  })

  it("resolves a torrent with no tags at all", () => {
    const hit = resolveTorrentTracker({ tags: "", tracker: "https://aither.cc/announce" }, trackers)
    expect(hit?.tracker.baseUrl).toBe("https://aither.cc")
  })

  it("returns null when nothing matches", () => {
    expect(
      resolveTorrentTracker({ tags: "misc", tracker: "https://unknown.test/announce" }, trackers)
    ).toBeNull()
  })
})
