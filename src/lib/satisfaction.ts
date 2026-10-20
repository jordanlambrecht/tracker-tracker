// src/lib/satisfaction.ts
//
// Functions: resolveSatisfaction, seedTimeProgress, ratioProgress,
//            satisfactionProgress, isSatisfied, remainingSeedSeconds

import type { TrackerRules } from "@/data/tracker-registry"

/**
 * How a torrent's per-torrent requirements combine.
 *
 * - `any`: meeting one of them satisfies the torrent, as TorrentLeech states.
 * - `all`: every stated requirement must be met.
 *
 * Never assume `any` for a tracker that does not say so: marking a torrent
 * satisfied at 1:1 on a seed-time-only tracker earns a hit-and-run.
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
 * Ratio counts only when `satisfactionMode` is set. `minimumRatio` is an
 * account-level figure for the ratio-danger alert and the chart baseline, and
 * reading it per torrent on a seed-time-only tracker would mark torrents
 * satisfied too early. Declaring a mode also marks the entry's rules as
 * verified.
 */
export function resolveSatisfaction(rules?: TrackerRules): SatisfactionRequirement | null {
  const seedTimeHours = rules?.seedTimeHours ?? 0
  const requiredSeedSeconds = seedTimeHours > 0 ? seedTimeHours * 3600 : null

  const mode = rules?.satisfactionMode
  if (!mode) {
    // Unverified entry: seed time alone, ratio ignored.
    return requiredSeedSeconds === null
      ? null
      : { requiredSeedSeconds, requiredRatio: null, mode: "all" }
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
  // A NaN here would read as unsatisfied yet render as a full green bar, since
  // "NaN%" is invalid CSS and NaN fails both colour thresholds. The mappers
  // coerce fresh data, but cached payloads predate that. Zero over-seeds.
  if (!Number.isFinite(seedingTime) || seedingTime < 0) return 0
  return Math.min(seedingTime / req.requiredSeedSeconds, 1)
}

/** Fraction of the ratio requirement met, 0..1. 1 when not required. */
export function ratioProgress(ratio: number, req: SatisfactionRequirement): number {
  if (req.requiredRatio === null) return 1
  // qBittorrent reports ratio -1 for a torrent that downloaded nothing (a pure
  // cross-seed, see fleet-aggregation.ts). It counts as no progress, so the
  // torrent clears on seed time instead.
  if (!Number.isFinite(ratio) || ratio < 0) return 0
  return Math.min(ratio / req.requiredRatio, 1)
}

/**
 * How close a torrent is to being satisfied, 0..1.
 *
 * Under `any` this is the best of the routes: an either/or means you are as
 * close as your nearest way out, and a torrent at 0.99 ratio is nearly done
 * even with no seed time on the clock. Under `all` it is the worst, because
 * every requirement has to land and the laggard is what you are waiting on.
 */
export function satisfactionProgress(
  torrent: { seedingTime: number; ratio: number },
  req: SatisfactionRequirement
): number {
  // Only the routes this tracker states may count. The per-route helpers score
  // an absent route 1, which is right for `all` but would satisfy every torrent
  // under `any`. A requirement with no routes is vacuously satisfied.
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
  // An unreadable seed time counts as nothing served, so the full amount is
  // owed, matching the seedTimeProgress guard. A raw NaN would render an
  // unsatisfied torrent as "Done".
  const served =
    Number.isFinite(torrent.seedingTime) && torrent.seedingTime > 0 ? torrent.seedingTime : 0
  return Math.max(req.requiredSeedSeconds - served, 0)
}
