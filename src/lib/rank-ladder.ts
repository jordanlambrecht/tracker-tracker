// src/lib/rank-ladder.ts
//
// Functions: findClassIndex, buildRankLadder, buildRankForest, ladderPosition
// Constants: OUTSIDE_LADDER_NOTE

import type { TrackerRankPath, TrackerUserClass } from "@/data/tracker-registry"
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

/** One branch of a ladder that splits after a shared prefix. */
export interface RankPathLadder {
  id: string
  label: string
  description?: string
  /** Earned classes on this branch, lowest first. */
  rungs: RankRung[]
  /** Position in `rungs`, or -1 when the member is not on this branch. */
  currentIndex: number
}

/**
 * A rank ladder with a shared prefix and one or more branches. The member
 * starts in `shared`, then continues on exactly one of `paths`.
 */
export interface RankForest {
  shared: RankRung[]
  /** Position in `shared`, or -1 when nothing is lit. */
  sharedCurrentIndex: number
  paths: RankPathLadder[]
  /** Branch the member is on, or null while still in the shared prefix. */
  activePathId: string | null
  appointedClass: string | null
  shownClass: string | null
  unknownClass: boolean
  summary: string
}

/**
 * Trackers report the class name as free text and registry names are the
 * canonical casing, so the match is case-insensitive. A redacted name is a
 * privacy mask, not a class, and never matches.
 */
export function findClassIndex(
  classes: TrackerUserClass[],
  className: string | null | undefined
): number {
  if (!className || isRedacted(className)) return -1
  const wanted = className.toLowerCase()
  return classes.findIndex((c) => c.name.toLowerCase() === wanted)
}

/**
 * Where a class sits on the earned ladder: its rung, -1 for a below state,
 * the rung count for an above class, null when unlisted. List order holds
 * only for rungs; off-ladder classes can sit anywhere.
 */
export function ladderPosition(
  classes: TrackerUserClass[],
  className: string | null | undefined
): number | null {
  const index = findClassIndex(classes, className)
  if (index === -1) return null
  const cls = classes[index]
  const rungs = classes.filter((c) => !c.outsideLadder)
  if (cls.outsideLadder === "above") return rungs.length
  return findClassIndex(rungs, cls.name)
}

export function buildRankLadder(
  classes: TrackerUserClass[],
  currentClass: string | null | undefined
): RankLadder | null {
  const rungs = classes
    .filter((c) => !c.outsideLadder)
    .map((c) => ({ name: c.name, requirements: c.requirements }))
  if (rungs.length === 0) return null

  const total = rungs.length
  const index = findClassIndex(classes, currentClass)

  if (index === -1) {
    if (!currentClass) {
      return {
        rungs,
        currentIndex: -1,
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
        appointedClass: null,
        shownClass: currentClass,
        unknownClass: false,
        summary: `class redacted, rank 0 of ${total}`,
      }
    }
    return {
      rungs,
      currentIndex: -1,
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
      appointedClass: null,
      shownClass: current.name,
      unknownClass: false,
      summary: `${current.name}, rank 0 of ${total}`,
    }
  }
  const currentIndex = findClassIndex(rungs, current.name)
  return {
    rungs,
    currentIndex,
    appointedClass: null,
    shownClass: current.name,
    unknownClass: false,
    summary: `${current.name}, rank ${currentIndex + 1} of ${total}`,
  }
}

function rungIndex(rungs: RankRung[], name: string): number {
  const wanted = name.toLowerCase()
  return rungs.findIndex((rung) => rung.name.toLowerCase() === wanted)
}

/**
 * Build the shared prefix plus one branch per declared path. A member in the
 * prefix has no active path; a member in a branch has completed the prefix.
 * Returns null for linear entries, which keep using buildRankLadder.
 */
export function buildRankForest(
  classes: TrackerUserClass[],
  paths: TrackerRankPath[],
  currentClass: string | null | undefined
): RankForest | null {
  if (paths.length === 0) return null

  const shared = classes
    .filter((c) => !c.outsideLadder && !c.path)
    .map((c) => ({ name: c.name, requirements: c.requirements }))
  const branches: RankPathLadder[] = paths.map((path) => ({
    id: path.id,
    label: path.label,
    description: path.description,
    rungs: classes
      .filter((c) => !c.outsideLadder && c.path === path.id)
      .map((c) => ({ name: c.name, requirements: c.requirements })),
    currentIndex: -1,
  }))

  if (shared.length === 0 || branches.every((branch) => branch.rungs.length === 0)) return null

  const totalShared = shared.length
  const index = findClassIndex(classes, currentClass)
  const base: RankForest = {
    shared,
    sharedCurrentIndex: -1,
    paths: branches,
    activePathId: null,
    appointedClass: null,
    shownClass: null,
    unknownClass: false,
    summary: "",
  }

  if (index === -1) {
    if (!currentClass) {
      return {
        ...base,
        summary: `class not reported, rank 0 of ${totalShared}`,
      }
    }
    if (isRedacted(currentClass)) {
      return {
        ...base,
        shownClass: currentClass,
        summary: `class redacted, rank 0 of ${totalShared}`,
      }
    }
    return {
      ...base,
      shownClass: currentClass,
      unknownClass: true,
      summary: `${currentClass}, not on the registry ladder`,
    }
  }

  const current = classes[index]
  if (current.outsideLadder === "above") {
    for (const branch of branches) branch.currentIndex = branch.rungs.length - 1
    return {
      ...base,
      sharedCurrentIndex: totalShared - 1,
      appointedClass: current.name,
      shownClass: current.name,
      summary: `${current.name}, above the ${totalShared}-rank shared ladder`,
    }
  }
  if (current.outsideLadder === "below") {
    return {
      ...base,
      shownClass: current.name,
      summary: `${current.name}, rank 0 of ${totalShared}`,
    }
  }

  if (current.path) {
    const branch = branches.find((candidate) => candidate.id === current.path)
    if (!branch) {
      return {
        ...base,
        shownClass: current.name,
        unknownClass: true,
        summary: `${current.name}, path "${current.path}" is not declared`,
      }
    }
    branch.currentIndex = rungIndex(branch.rungs, current.name)
    return {
      ...base,
      sharedCurrentIndex: totalShared - 1,
      activePathId: branch.id,
      shownClass: current.name,
      summary: `${current.name}, ${branch.label} rank ${branch.currentIndex + 1} of ${branch.rungs.length}`,
    }
  }

  const sharedIndex = rungIndex(shared, current.name)
  return {
    ...base,
    sharedCurrentIndex: sharedIndex,
    shownClass: current.name,
    summary: `${current.name}, shared rank ${sharedIndex + 1} of ${totalShared}, ${branches.length} paths onward`,
  }
}
