// src/data/tracker-registry.test.ts
import { describe, expect, it } from "vitest"
import { getAllTrackers, getTrackerBySlug, TRACKER_REGISTRY } from "./tracker-registry"

describe("tracker registry", () => {
  it("has at least 2 trackers", () => {
    expect(TRACKER_REGISTRY.length).toBeGreaterThanOrEqual(2)
  })

  it("all entries have required fields", () => {
    for (const tracker of TRACKER_REGISTRY) {
      expect(tracker.slug).toBeTruthy()
      expect(tracker.name).toBeTruthy()
      expect(tracker.url).toMatch(/^https:\/\//)
      expect(["unit3d", "gazelle", "ggn"]).toContain(tracker.platform)
      if (tracker.platform === "unit3d") {
        expect(tracker.apiPath).toBe("/api/user")
      } else if (tracker.platform === "gazelle") {
        expect(tracker.apiPath).toBe("/ajax.php")
      } else if (tracker.platform === "ggn") {
        expect(tracker.apiPath).toBe("/api.php")
      }
      expect(tracker.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it("has unique slugs", () => {
    const slugs = TRACKER_REGISTRY.map((t) => t.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("getTrackerBySlug returns correct tracker", () => {
    const aither = getTrackerBySlug("aither")
    expect(aither?.name).toBe("Aither")
  })

  it("getTrackerBySlug returns undefined for unknown slug", () => {
    expect(getTrackerBySlug("nonexistent")).toBeUndefined()
  })

  it("getAllTrackers returns all entries", () => {
    expect(getAllTrackers().length).toBe(TRACKER_REGISTRY.length)
  })
})
