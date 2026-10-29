// src/lib/tracker-status.ts
//
// Functions: getPauseState, resolveRequiredRatio, getTrackerHealth, getHealthBadgeVariant, getHealthLabel, getHealthDescription, getHealthDot
//
// Single source of truth for tracker health status. Includes type, derivation
// logic, and all visual mappings (StatusDot tone and glow, Badge variant,
// labels, descriptions). Ratio bands are requirement-aware: each tracker is
// judged against its own required ratio, not a global cutoff.

import type { BadgeVariant } from "@/components/ui/Badge"
import type { StatusDotProps, StatusDotTone } from "@/components/ui/StatusDot"
import { registryEntryFor } from "@/data/tracker-registry"
import type { TrackerSummary } from "@/types/api"

// Ordered loosely by severity, ascending. "warning" and "no-seeds" are
// separate: a thin ratio and zero active seeds are unrelated and need different
// fixes.
type TrackerHealth =
  "healthy" | "warning" | "no-seeds" | "critical" | "error" | "paused" | "paused-user" | "offline"

interface HealthMeta {
  label: string
  description: string
  dot: { tone: StatusDotTone; glow: boolean }
  badge: BadgeVariant
}

const HEALTH_META: Record<TrackerHealth, HealthMeta> = {
  healthy: {
    label: "Healthy",
    description: "Ratio at least double the required ratio",
    dot: { tone: "accent", glow: true },
    badge: "accent",
  },
  warning: {
    // Named for what the model actually measures, which is ratio against the
    // tracker's requirement. It never sees the buffer, so neither label nor
    // description may claim one. The amber badge already signals watch.
    label: "Above Min",
    description: "Ratio above the required ratio, below double it",
    dot: { tone: "warn", glow: true },
    badge: "warn",
  },
  // Shares the danger/critical visuals with "critical", the way "paused"
  // already does: this table distinguishes states by label and description
  // rather than giving every id its own color.
  "no-seeds": {
    // Dot-only surfaces announce this label to screen readers, so it must not
    // read "Critical", which would describe the wrong problem.
    label: "No Seeds",
    description: "Zero active seeds, nothing is uploading",
    dot: { tone: "danger", glow: true },
    badge: "danger",
  },
  critical: {
    label: "Critical",
    description: "Ratio below the required ratio",
    dot: { tone: "danger", glow: true },
    badge: "danger",
  },
  paused: {
    label: "Paused",
    description: "Polling paused after consecutive failures",
    dot: { tone: "danger", glow: false },
    badge: "danger",
  },
  "paused-user": {
    label: "Paused by user",
    description: "Automated polling paused by user",
    dot: { tone: "warn", glow: false },
    badge: "warn",
  },
  error: {
    label: "Error",
    description: "Last poll returned an error",
    dot: { tone: "secondary", glow: false },
    badge: "danger",
  },
  offline: {
    label: "Offline",
    description: "No data available",
    dot: { tone: "muted", glow: false },
    badge: "default",
  },
}

type PauseState = { isPaused: false } | { isPaused: true; reason: "user" | "failure"; since: Date }

function getPauseState(tracker: {
  pausedAt?: Date | string | null
  userPausedAt?: Date | string | null
}): PauseState {
  const userPaused = tracker.userPausedAt ? new Date(tracker.userPausedAt) : null
  const autoPaused = tracker.pausedAt ? new Date(tracker.pausedAt) : null

  if (userPaused) return { isPaused: true, reason: "user", since: userPaused }
  if (autoPaused) return { isPaused: true, reason: "failure", since: autoPaused }
  return { isPaused: false }
}

// The ratio a tracker actually holds this account to. Live requiredRatio wins
// over the registry's minimumRatio because sliding-ratio sites (Gazelle) report
// the current figure per account, and 0 is a real value there, hence the
// explicit checks rather than `??` or `||`. Null means no requirement is on
// record anywhere, which is not the same as no requirement existing.
//
// Takes the row rather than its slug so a caller cannot hand it a base URL and
// get a silent null: the registry is reached by slug only.
function resolveRequiredRatio(
  liveRequiredRatio: number | null | undefined,
  tracker: { registrySlug: string | null }
): number | null {
  if (
    typeof liveRequiredRatio === "number" &&
    Number.isFinite(liveRequiredRatio) &&
    liveRequiredRatio >= 0
  ) {
    return liveRequiredRatio
  }
  const registryMinimum = registryEntryFor(tracker)?.rules?.minimumRatio
  if (
    typeof registryMinimum === "number" &&
    Number.isFinite(registryMinimum) &&
    registryMinimum >= 0
  ) {
    return registryMinimum
  }
  return null
}

function getTrackerHealth(tracker: TrackerSummary): TrackerHealth {
  const pause = getPauseState(tracker)
  if (pause.isPaused) return pause.reason === "failure" ? "paused" : "paused-user"
  if (tracker.lastError) return "error"
  if (!tracker.latestStats) return "offline"
  const { ratio, seedingCount, ratioIsInfinite } = tracker.latestStats
  // An infinite ratio arrives as `ratio: null` because JSON can't carry
  // Infinity. Only treat null as "no data" when the account isn't in that state.
  // Otherwise a perfectly healthy zero-download tracker reads Offline.
  if (ratio === null && !ratioIsInfinite) return "offline"

  // Warned by tracker is always critical. Potential ban risk.
  if (tracker.latestStats?.warned === true) return "critical"

  let status: TrackerHealth
  if (ratioIsInfinite) {
    // Uploads with zero downloads is the best possible standing.
    status = "healthy"
  } else {
    // Unknown requirement falls back to the historical bands, which are the
    // 2x formula at an assumed minimum of 1.0. A known requirement of 0
    // (Phoenix fully seeding) means nothing is demanded, so no ratio can be
    // unhealthy; an amber band above a zero requirement would claim risk that
    // does not exist.
    const requirement = resolveRequiredRatio(tracker.latestStats.requiredRatio, tracker)
    const minimum = requirement ?? 1
    const value = ratio ?? 0
    if (minimum === 0 || value >= 2 * minimum) status = "healthy"
    else if (value >= minimum) status = "warning"
    else status = "critical"
  }

  // Zero active seeds is its own condition, not a ratio band. It outranks
  // healthy and warning because an account uploading nothing cannot improve its
  // ratio. It does not override critical: a low ratio or a tracker warning
  // carries account risk this label would hide.
  //
  // A null seedingCount means the adapter does not report the field (BTN), so
  // the strict === 0 check leaves those trackers on their ratio status.
  if (seedingCount === 0 && (status === "healthy" || status === "warning")) status = "no-seeds"

  return status
}

function getHealthBadgeVariant(status: TrackerHealth): BadgeVariant {
  return HEALTH_META[status].badge
}

function getHealthLabel(status: TrackerHealth): string {
  return HEALTH_META[status].label
}

// Requirement values come from registry literals and adapter figures, so plain
// interpolation is enough; the trailing-zero pad only keeps whole numbers
// reading as ratios ("1.0", not "1").
function formatRequirement(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value)
}

// With a tracker, the ratio-band descriptions carry that tracker's actual
// numbers and say when the bands are assumed. Without one, the static wording
// applies. The warned check comes first: a warned account is "critical"
// whatever its ratio, and a band description would explain the wrong thing.
function getHealthDescription(status: TrackerHealth, tracker?: TrackerSummary): string {
  if (!tracker || (status !== "healthy" && status !== "warning" && status !== "critical")) {
    return HEALTH_META[status].description
  }
  if (status === "critical" && tracker.latestStats?.warned === true) {
    return "Warned by the tracker"
  }
  const requirement = resolveRequiredRatio(tracker.latestStats?.requiredRatio, tracker)
  if (requirement === 0) return "No ratio requirement on this tracker"
  const minimum = formatRequirement(requirement ?? 1)
  const healthyLine = formatRequirement((requirement ?? 1) * 2)
  if (requirement === null) {
    if (status === "healthy") return `Ratio ${healthyLine} or higher (no requirement on record)`
    if (status === "warning")
      return `Ratio between ${minimum} and ${healthyLine} (no requirement on record)`
    return `Ratio below ${minimum} (no requirement on record)`
  }
  if (status === "healthy") return `Ratio ${healthyLine} or higher (2x the ${minimum} requirement)`
  if (status === "warning") return `Ratio between ${minimum} and ${healthyLine}`
  return `Ratio below the ${minimum} requirement`
}

function getHealthDot(status: TrackerHealth): Pick<StatusDotProps, "tone" | "glow" | "label"> {
  return { ...HEALTH_META[status].dot, label: HEALTH_META[status].label }
}

export type { PauseState, TrackerHealth }
export {
  getHealthBadgeVariant,
  getHealthDescription,
  getHealthDot,
  getHealthLabel,
  getPauseState,
  getTrackerHealth,
  resolveRequiredRatio,
}
