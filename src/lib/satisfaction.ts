// src/lib/satisfaction.ts
//
// Functions: resolveSatisfaction, seedTimeProgress, ratioProgress,
//            satisfactionProgress, isSatisfied, remainingSeedSeconds

import type { TrackerRules } from "@/data/tracker-registry"

/**
 * How a torrent's per-torrent requirements combine.
 *
 * - `any` — meeting ONE of them satisfies the torrent. TorrentLeech states it
 *   outright: "There are two ways for you to give back to the community" —
 *   seed to 1:1, or seed for your class's minimum time.
 * - `all` — every stated requirement must be met.
 *
 * Never assume `any` for a tracker that does not say so. Marking a torrent
 * satisfied at 1:1 on a seed-time-only tracker is how hit-and-runs are earned,
 * and it is the one direction this model must not fail in.
 */
export type SatisfactionMode = "any" | "all"

/** The resolved, per-torrent requirement for one tracker. */
export interface SatisfactionRequirement {
  /** null = seed time is not part of this tracker's rule. */
  requiredSeedSeconds: number | null
  /** null = per-torrent ratio is not part of this tracker's rule. */
  requiredRatio: number | null
  mode: SatisfactionMode
}

/**
 * Reads a registry entry's rules into a requirement, or null when the tracker
 * states no per-torrent requirement at all.
 *
 * **Ratio participates only when `satisfactionMode` is set.** `minimumRatio` has
 * always been in the registry, but as an ACCOUNT-level figure — it drives the
 * ratio-danger alert and the chart baseline. Reading it as a per-torrent
 * requirement wherever it happens to be non-zero would silently re-interpret all
 * 55 registry entries against rules nobody has re-read, and for a tracker whose
 * real rule is seed-time-only that lands in the unsafe direction.
 *
 * So an entry opts in by declaring its mode, and an entry that has not opted in
 * behaves exactly as it does today. That makes `satisfactionMode` a marker of
 * "these rules have been verified" as much as a combinator.
 */
export function resolveSatisfaction(rules?: TrackerRules): SatisfactionRequirement | null {
  const seedTimeHours = rules?.seedTimeHours ?? 0
  const requiredSeedSeconds = seedTimeHours > 0 ? seedTimeHours * 3600 : null

  const mode = rules?.satisfactionMode
  if (!mode) {
    // Unverified entry: seed time alone, ratio ignored. Today's behaviour.
    return requiredSeedSeconds === null ? null : { requiredSeedSeconds, requiredRatio: null, mode: "all" }
  }

  const minimumRatio = rules?.minimumRatio ?? 0
  const requiredRatio = minimumRatio > 0 ? minimumRatio : null

  // A declared mode over two absent thresholds is still no requirement.
  if (requiredSeedSeconds === null && requiredRatio === null) return null

  return { requiredSeedSeconds, requiredRatio, mode }
}

/** Fraction of the seed-time requirement met, 0..1. 1 when not required. */
export function seedTimeProgress(seedingTime: number, req: SatisfactionRequirement): number {
  if (req.requiredSeedSeconds === null) return 1
  // seeding_time is not in field-map's REQUIRED_NUMERIC, so a client that omits
  // it leaves undefined here and the division yields NaN. NaN loses every
  // comparison, so the torrent reads as unsatisfied but renders as a full green
  // bar: "NaN%" is invalid CSS and gets dropped, and NaN fails both thresholds
  // in the table's colour ramp. No progress is also the direction that
  // over-seeds, which is the one to be wrong in.
  if (!Number.isFinite(seedingTime) || seedingTime < 0) return 0
  return Math.min(seedingTime / req.requiredSeedSeconds, 1)
}

/** Fraction of the ratio requirement met, 0..1. 1 when not required. */
export function ratioProgress(ratio: number, req: SatisfactionRequirement): number {
  if (req.requiredRatio === null) return 1
  // qBT reports ratio -1 for a torrent that downloaded nothing, i.e. a pure
  // cross-seed. See the sentinel note in fleet-aggregation.ts, which excludes
  // the same value from ratio statistics. Whether that satisfies a 1:1 rule is
  // a hit-and-run judgement nobody has made, so it counts as no progress and
  // the torrent clears on seed time instead. Under `any` that is equivalent to
  // dropping the ratio route, since max(seed, 0) is seed.
  if (!Number.isFinite(ratio) || ratio < 0) return 0
  return Math.min(ratio / req.requiredRatio, 1)
}

/**
 * How close a torrent is to being satisfied, 0..1.
 *
 * Under `any` this is the BEST of the routes: an either/or means you are as
 * close as your nearest way out, and a torrent at 0.99 ratio is nearly done
 * even with no seed time on the clock. Under `all` it is the WORST, because
 * every requirement has to land and the laggard is what you are waiting on.
 */
export function satisfactionProgress(
  torrent: { seedingTime: number; ratio: number },
  req: SatisfactionRequirement
): number {
  // Only the routes this tracker states may count. The per-route helpers score
  // an absent route 1, which is right for `all` (it cannot hold the torrent
  // back) but wrong for `any`, where it would read as a route already met and
  // satisfy every torrent. `resolveSatisfaction` never returns a requirement
  // with no routes; a hand-built one is vacuously satisfied, as before.
  const routes: number[] = []
  if (req.requiredSeedSeconds !== null) routes.push(seedTimeProgress(torrent.seedingTime, req))
  if (req.requiredRatio !== null) routes.push(ratioProgress(torrent.ratio, req))
  if (routes.length === 0) return 1
  return req.mode === "any" ? Math.max(...routes) : Math.min(...routes)
}

export function isSatisfied(
  torrent: { seedingTime: number; ratio: number },
  req: SatisfactionRequirement
): boolean {
  return satisfactionProgress(torrent, req) >= 1
}

/**
 * Seconds of seeding still owed, or null when seed time is not a route to
 * satisfaction here (either the tracker does not require it, or the torrent has
 * already satisfied the rule some other way).
 */
export function remainingSeedSeconds(
  torrent: { seedingTime: number; ratio: number },
  req: SatisfactionRequirement
): number | null {
  if (req.requiredSeedSeconds === null) return null
  if (isSatisfied(torrent, req)) return null
  return Math.max(req.requiredSeedSeconds - torrent.seedingTime, 0)
}
