// src/data/__tests__/v3x-levels.test.ts
import { describe, expect, it } from "vitest"
import { v3x } from "@/data/trackers/v3x"
import { levelCost, v3xClassName, xpToReach } from "@/data/v3x-levels"
import { findClassIndex } from "@/lib/rank-ladder"

describe("V3X levels", () => {
  // The cumulative XP the site's rank table lists for each rank's first level.
  it.each([
    [1, 0],
    [10, 11_088],
    [25, 100_128],
    [45, 479_248],
    [70, 1_641_648],
  ])("level %i is reached at %i XP", (level, xp) => {
    expect(xpToReach(level)).toBe(xp)
  })

  it("prices level 14 to 15 at 4 248 XP", () => {
    expect(levelCost(14)).toBe(4248)
  })

  it("lists one class per level, named as the site names it", () => {
    const names = v3x.userClasses.map((c) => c.name)
    expect(names).toHaveLength(100)
    expect(names[0]).toBe("Figurant N1")
    expect(names[9]).toBe("Second rôle N10")
    expect(names[99]).toBe("Palme d'Or N100")
    expect(v3x.userClasses[9].requirements).toBe("Level 10, 11 088 XP")
  })

  it("places every class the adapter reports on the ladder", () => {
    for (let level = 1; level <= 100; level++) {
      expect(findClassIndex(v3x.userClasses, v3xClassName(level))).toBe(level - 1)
    }
  })
})
