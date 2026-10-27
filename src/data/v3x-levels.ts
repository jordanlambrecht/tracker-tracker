// src/data/v3x-levels.ts
//
// Functions: levelCost, xpToReach, rankForLevel, v3xClassName, v3xUserClasses
//
// V3X's ranks and levels. The site names a member "<rank> N<level>", with the
// level counted over the whole ladder, so each level is a class of its own.

import type { TrackerUserClass } from "@/data/tracker-registry"

export const V3X_MAX_LEVEL = 100

// Rank names from the level each starts at, as the site's rules list them.
const RANKS: readonly [number, string][] = [
  [70, "Palme d'Or"],
  [45, "Réalisateur"],
  [25, "Tête d'affiche"],
  [10, "Second rôle"],
  [1, "Figurant"],
]

/** XP to go from level L to L+1: 400 + (L-1)×140 + (L-1)²×12, from the site's rules. */
export function levelCost(level: number): number {
  const n = level - 1
  return 400 + n * 140 + n * n * 12
}

/** Cumulative XP at which a level is reached. Level 1 starts at 0. */
export function xpToReach(level: number): number {
  let xp = 0
  for (let l = 1; l < level; l++) xp += levelCost(l)
  return xp
}

export function rankForLevel(level: number): string | null {
  return RANKS.find(([min]) => level >= min)?.[1] ?? null
}

/** The site's own name for a level, like "Figurant N4", or null outside the ladder. */
export function v3xClassName(level: unknown): string | null {
  if (typeof level !== "number" || !Number.isInteger(level) || level < 1) return null
  if (level > V3X_MAX_LEVEL) return null
  const rank = rankForLevel(level)
  return rank ? `${rank} N${level}` : null
}

const groupThousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")

/** One rung per level, each with the cumulative XP it needs. */
export function v3xUserClasses(): TrackerUserClass[] {
  return Array.from({ length: V3X_MAX_LEVEL }, (_, i) => {
    const level = i + 1
    return {
      name: v3xClassName(level) as string,
      requirements: `Level ${level}, ${groupThousands(xpToReach(level))} XP`,
    }
  })
}
