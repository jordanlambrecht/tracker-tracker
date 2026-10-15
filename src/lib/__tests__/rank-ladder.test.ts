// src/lib/__tests__/rank-ladder.test.ts

import { describe, expect, it } from "vitest"
import type { TrackerUserClass } from "@/data/tracker-registry"
import { REDACTED_PREFIX } from "@/lib/privacy"
import { buildRankLadder, findClassIndex } from "@/lib/rank-ladder"

const classes: TrackerUserClass[] = [
  { name: "Banned", requirements: "Broke the rules", outsideLadder: "below" },
  { name: "Leech", requirements: "Ratio below 0.4", outsideLadder: "below" },
  { name: "User", requirements: "Ratio at or above 0.4" },
  { name: "Power User", requirements: "1 TiB up" },
  { name: "VIP", requirements: "Donation", outsideLadder: "above" },
  { name: "Uploader", requirements: "Staff", outsideLadder: "above" },
]

describe("findClassIndex", () => {
  it("matches class names case-insensitively", () => {
    expect(findClassIndex(classes, "power user")).toBe(3)
    expect(findClassIndex(classes, "POWER USER")).toBe(3)
  })

  it("returns -1 for null, unknown, or redacted names", () => {
    expect(findClassIndex(classes, null)).toBe(-1)
    expect(findClassIndex(classes, undefined)).toBe(-1)
    expect(findClassIndex(classes, "Elite")).toBe(-1)
    expect(findClassIndex(classes, `${REDACTED_PREFIX}abc`)).toBe(-1)
  })
})

describe("buildRankLadder", () => {
  it("keeps only earned classes, in order, and points at the current one", () => {
    const ladder = buildRankLadder(classes, "User")
    expect(ladder?.rungs.map((r) => r.name)).toEqual(["User", "Power User"])
    expect(ladder?.currentIndex).toBe(0)
    expect(ladder?.appointedClass).toBeNull()
    expect(ladder?.shownClass).toBe("User")
    expect(ladder?.unknownClass).toBe(false)
    expect(ladder?.summary).toBe("User, rank 1 of 2")
  })

  it("carries the requirements text onto each rung", () => {
    const ladder = buildRankLadder(classes, "User")
    expect(ladder?.rungs[1]).toEqual({ name: "Power User", requirements: "1 TiB up" })
  })

  it("uses the registry casing for the shown class, not the tracker's", () => {
    const ladder = buildRankLadder(classes, "power user")
    expect(ladder?.shownClass).toBe("Power User")
    expect(ladder?.summary).toBe("Power User, rank 2 of 2")
  })

  it("renders a class above the ladder as a full stack under its own name", () => {
    const ladder = buildRankLadder(classes, "vip")
    expect(ladder?.currentIndex).toBe(1)
    expect(ladder?.appointedClass).toBe("VIP")
    expect(ladder?.shownClass).toBe("VIP")
    expect(ladder?.summary).toBe("VIP, above the 2-rank ladder")
  })

  it("renders a class below the ladder as an empty stack under its own name", () => {
    const ladder = buildRankLadder(classes, "Leech")
    expect(ladder?.currentIndex).toBe(-1)
    expect(ladder?.appointedClass).toBeNull()
    expect(ladder?.shownClass).toBe("Leech")
    expect(ladder?.unknownClass).toBe(false)
    expect(ladder?.summary).toBe("Leech, rank 0 of 2")
  })

  it("flags a class the registry does not list and keeps the reported name", () => {
    const ladder = buildRankLadder(classes, "Elite")
    expect(ladder?.currentIndex).toBe(-1)
    expect(ladder?.shownClass).toBe("Elite")
    expect(ladder?.unknownClass).toBe(true)
    expect(ladder?.summary).toBe("Elite, not on the registry ladder")
  })

  it("treats a missing class as not reported, not unknown", () => {
    const ladder = buildRankLadder(classes, null)
    expect(ladder?.currentIndex).toBe(-1)
    expect(ladder?.shownClass).toBeNull()
    expect(ladder?.unknownClass).toBe(false)
    expect(ladder?.summary).toBe("class not reported, rank 0 of 2")
  })

  it("passes a redacted class through for masking without calling it unknown", () => {
    const masked = `${REDACTED_PREFIX}abc`
    const ladder = buildRankLadder(classes, masked)
    expect(ladder?.currentIndex).toBe(-1)
    expect(ladder?.shownClass).toBe(masked)
    expect(ladder?.unknownClass).toBe(false)
    expect(ladder?.summary).toBe("class redacted, rank 0 of 2")
  })

  it("returns null when the tracker has no earned classes at all", () => {
    expect(buildRankLadder([], "User")).toBeNull()
    expect(buildRankLadder([{ name: "Staff", outsideLadder: "above" }], "Staff")).toBeNull()
  })
})
