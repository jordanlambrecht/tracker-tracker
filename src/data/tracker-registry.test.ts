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
      expect(tracker.platform).toBe("unit3d")
      expect(tracker.apiPath).toBe("/api/user")
      expect(tracker.contentCategories.length).toBeGreaterThan(0)
      expect(tracker.userClasses.length).toBeGreaterThan(0)
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
