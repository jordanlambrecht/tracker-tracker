// src/lib/rank-ladder.ts
//
// Functions: findClassIndex, buildRankLadder, ladderPosition
// Constants: OUTSIDE_LADDER_NOTE

import type { TrackerRegistryEntry, TrackerUserClass } from "@/data/tracker-registry"
import { isRedacted } from "@/lib/privacy"

/** Hover text for a class that is not a rung, shared by the pills and the rank tooltip. */
export const OUTSIDE_LADDER_NOTE = {
  above: "Granted by staff, donation or invitation, not a rung of the ladder",
  below: "Demotion or administrative state, not a rung of the ladder",
} as const

export interface RankRung {
  name: string
  requirements?: string
}

export interface RankLadder {
  /** Earned classes only, lowest first. */
  rungs: RankRung[]
  /** Position in `rungs`, or -1 when nothing is lit. */
  currentIndex: number
  /**
   * How much of the current rung is earned: below 1 only for a class that
   * carries a level inside its rank, such as V3X's "Second rôle N14".
   */
  currentFraction: number
  /**
   * Set when the member holds a class above the ladder (staff, donor). There
   * is no rung for it, so the stack renders fully lit under this name.
   */
  appointedClass: string | null
  /**
   * What to print under the stack: the matched class, or the raw name the
   * tracker reported when the registry has no entry for it. Null when the
   * tracker reported no class. A redacted name passes through untouched so
   * RedactedText can mask it.
   */
  shownClass: string | null
  /** True when the tracker reported a class the registry does not list at all. */
  unknownClass: boolean
  /**
   * One sentence for assistive tech, "Power User, rank 2 of 5". Kept
   * here so the visual label and the spoken one cannot drift apart.
   */
  summary: string
}

/**
 * Trackers report the class name as free text and registry names are the
 * canonical casing, so the match is case-insensitive. A redacted name is a
 * privacy mask, not a class, and never matches.
 */
/** Maps a class carrying a level onto its rank; see TrackerRegistryEntry.classLevel. */
export type ClassLevelParser = TrackerRegistryEntry["classLevel"]

export function findClassIndex(
  classes: TrackerUserClass[],
  className: string | null | undefined,
  classLevel?: ClassLevelParser
): number {
  if (!className || isRedacted(className)) return -1
  const wanted = (classLevel?.(className)?.rank ?? className).toLowerCase()
  return classes.findIndex((c) => c.name.toLowerCase() === wanted)
}

/**
 * Where a class sits on the earned ladder: its rung, -1 for a below state,
 * the rung count for an above class, null when unlisted. List order holds
 * only for rungs; off-ladder classes can sit anywhere.
 */
export function ladderPosition(
  classes: TrackerUserClass[],
  className: string | null | undefined,
  classLevel?: ClassLevelParser
): number | null {
  const index = findClassIndex(classes, className, classLevel)
  if (index === -1) return null
  const cls = classes[index]
  const rungs = classes.filter((c) => !c.outsideLadder)
  if (cls.outsideLadder === "above") return rungs.length
  return findClassIndex(rungs, cls.name)
}

export function buildRankLadder(
  classes: TrackerUserClass[],
  currentClass: string | null | undefined,
  classLevel?: ClassLevelParser
): RankLadder | null {
  const rungs = classes
    .filter((c) => !c.outsideLadder)
    .map((c) => ({ name: c.name, requirements: c.requirements }))
  if (rungs.length === 0) return null

  const total = rungs.length
  const index = findClassIndex(classes, currentClass, classLevel)

  if (index === -1) {
    if (!currentClass) {
      return {
        rungs,
        currentIndex: -1,
        currentFraction: 1,
        appointedClass: null,
        shownClass: null,
        unknownClass: false,
        summary: `class not reported, rank 0 of ${total}`,
      }
    }
    if (isRedacted(currentClass)) {
      return {
        rungs,
        currentIndex: -1,
        currentFraction: 1,
        appointedClass: null,
        shownClass: currentClass,
        unknownClass: false,
        summary: `class redacted, rank 0 of ${total}`,
      }
    }
    return {
      rungs,
      currentIndex: -1,
      currentFraction: 1,
      appointedClass: null,
      shownClass: currentClass,
      unknownClass: true,
      summary: `${currentClass}, not on the registry ladder`,
    }
  }

  const current = classes[index]
  if (current.outsideLadder === "above") {
    return {
      rungs,
      currentIndex: total - 1,
      currentFraction: 1,
      appointedClass: current.name,
      shownClass: current.name,
      unknownClass: false,
      summary: `${current.name}, above the ${total}-rank ladder`,
    }
  }
  // A demotion or administrative state has no rung either, but nothing has
  // been earned, so it renders empty under its own name.
  if (current.outsideLadder === "below") {
    return {
      rungs,
      currentIndex: -1,
      currentFraction: 1,
      appointedClass: null,
      shownClass: current.name,
      unknownClass: false,
      summary: `${current.name}, rank 0 of ${total}`,
    }
  }
  const currentIndex = findClassIndex(rungs, current.name)
  // The level stays in the class shown, and sets how much of the rung is lit.
  const level = currentClass ? classLevel?.(currentClass) : null
  const shownClass = level ? (currentClass as string) : current.name
  return {
    rungs,
    currentIndex,
    currentFraction: level ? level.fraction : 1,
    appointedClass: null,
    shownClass,
    unknownClass: false,
    summary: `${shownClass}, rank ${currentIndex + 1} of ${total}`,
  }
}
