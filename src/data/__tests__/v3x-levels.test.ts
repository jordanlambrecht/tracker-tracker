// src/data/__tests__/v3x-levels.test.ts
import { describe, expect, it } from "vitest"
import { v3x } from "@/data/trackers/v3x"
import { levelCost, v3xClassLevel, v3xClassName, xpToReach } from "@/data/v3x-levels"
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

  it("lists the five ranks with the level and XP each starts at", () => {
    expect(v3x.userClasses).toEqual([
      { name: "Figurant", requirements: "Level 1, 0 XP" },
      { name: "Second rôle", requirements: "Level 10, 11 088 XP" },
      { name: "Tête d'affiche", requirements: "Level 25, 100 128 XP" },
      { name: "Réalisateur", requirements: "Level 45, 479 248 XP" },
      { name: "Palme d'Or", requirements: "Level 70, 1 641 648 XP" },
    ])
  })

  it("places every level on its rank", () => {
    const ranks = v3x.userClasses.map((c) => c.name)
    for (let level = 1; level <= 100; level++) {
      const index = findClassIndex(v3x.userClasses, v3xClassName(level), v3xClassLevel)
      expect(ranks[index]).toBe(v3xClassName(level)?.replace(/ N\d+$/, ""))
    }
  })

  it.each([
    ["Figurant N1", "Figurant", 0],
    ["Second rôle N10", "Second rôle", 0],
    ["Palme d'Or N100", "Palme d'Or", 1],
  ])("reads %s as %s at %f of the rank", (name, rank, fraction) => {
    expect(v3xClassLevel(name)).toEqual({ rank, level: Number(name.split(" N")[1]), fraction })
  })

  it("weighs the share of a rank by XP, not by level count", () => {
    // Level 17 is half of Second rôle's levels but well under half of its XP.
    expect(v3xClassLevel("Second rôle N17")?.fraction).toBeCloseTo(
      (xpToReach(17) - 11_088) / (100_128 - 11_088),
      10
    )
  })

  it.each(["Figurant", "Second rôle N3", "Figurant N101", "Somebody N4"])(
    "does not read %s as a level",
    (name) => {
      expect(v3xClassLevel(name)).toBeNull()
    }
  )
})
