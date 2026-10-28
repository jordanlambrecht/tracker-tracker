// src/components/tracker-detail/CoreStatCards.tsx

import type { ReactNode } from "react"
import {
  DownloadArrowIcon,
  LeechingIcon,
  RatioIcon,
  RequiredRatioIcon,
  SeedingIcon,
  ShieldIcon,
  TriangleWarningIcon,
  UploadArrowIcon,
} from "@/components/ui/Icons"
import type { AlertLevel, TrendDirection } from "@/components/ui/StatCard"
import {
  formatBytesFromString,
  formatCount,
  formatRatio,
  formatRatioDisplay,
} from "@/lib/formatters"
import type { Snapshot, TrackerLatestStats } from "@/types/api"

export interface StatDescriptor {
  key: string
  label: string
  icon: ReactNode
  value: string
  unit?: string
  subtitle?: string
  trend?: TrendDirection
  tooltip?: string
  alert?: AlertLevel
  alertReason?: string
}

export function buildCoreStatDescriptors(
  stats: TrackerLatestStats | null,
  latestSnapshot: Snapshot | null,
  minimumRatio?: number,
  ratioTrend?: TrendDirection
): StatDescriptor[] {
  const [upVal, upUnit] = formatBytesFromString(stats?.uploadedBytes ?? null).split(" ")
  const [dlVal, dlUnit] = formatBytesFromString(stats?.downloadedBytes ?? null).split(" ")
  const [bufVal, bufUnit] = formatBytesFromString(latestSnapshot?.bufferBytes ?? null).split(" ")

  // An infinite ratio (uploaded > 0, downloaded === 0) is the best possible
  // standing. It crosses the wire as `ratio: null` plus this flag, since JSON
  // can't carry Infinity. Only the descriptor below needs the resolved
  // value; `ratioBelowRequired` is left reading `stats?.ratio` directly
  // since Infinity can never be below a required ratio either way.
  const ratio = stats?.ratioIsInfinite ? Number.POSITIVE_INFINITY : stats?.ratio

  const rawRequiredRatio = latestSnapshot?.requiredRatio ?? minimumRatio ?? null
  const effectiveRequiredRatio =
    rawRequiredRatio != null && rawRequiredRatio > 0 ? rawRequiredRatio : null
  const ratioBelowRequired =
    stats?.ratio != null && effectiveRequiredRatio != null && stats.ratio < effectiveRequiredRatio
  const ratioAlertReason =
    ratioBelowRequired && effectiveRequiredRatio != null
      ? `Below required ratio (${formatRatioDisplay(effectiveRequiredRatio)})`
      : undefined
  const bufferNegative = latestSnapshot?.bufferBytes?.startsWith("-")

  return [
    {
      key: "uploaded",
      label: "Uploaded",
      icon: <UploadArrowIcon width="16" height="16" />,
      value: upVal,
      unit: upUnit,
    },
    {
      key: "downloaded",
      label: "Downloaded",
      icon: <DownloadArrowIcon width="16" height="16" />,
      value: dlVal,
      unit: dlUnit,
    },
    {
      key: "ratio",
      label: "Ratio",
      icon: <RatioIcon width="16" height="16" />,
      value: formatRatio(ratio),
      unit: ratio != null ? "x" : undefined,
      trend: ratio == null ? undefined : ratioTrend,
      alert: ratioBelowRequired ? "danger" : undefined,
      alertReason: ratioAlertReason,
    },
    {
      key: "buffer",
      label: "Buffer",
      icon: <ShieldIcon width="16" height="16" />,
      value: bufVal,
      unit: bufUnit,
      alert: bufferNegative ? "danger" : undefined,
      alertReason: bufferNegative ? "Negative buffer" : undefined,
    },
    {
      key: "seeding",
      label: "Seeding",
      icon: <SeedingIcon width="16" height="16" />,
      value: formatCount(stats?.seedingCount),
    },
    {
      key: "leeching",
      label: "Leeching",
      icon: <LeechingIcon width="16" height="16" />,
      value: formatCount(stats?.leechingCount),
    },
    {
      key: "hnr",
      label: "Hit & Runs",
      icon: <TriangleWarningIcon width="16" height="16" />,
      // Adapters that cannot read hit & runs store null, and null must not
      // read as a clean "0".
      value: latestSnapshot?.hitAndRuns != null ? formatCount(latestSnapshot.hitAndRuns) : "—",
    },
    {
      key: "req-ratio",
      label: "Req. Ratio",
      icon: <RequiredRatioIcon width="16" height="16" />,
      value: effectiveRequiredRatio != null ? formatRatio(effectiveRequiredRatio) : "—",
      unit: effectiveRequiredRatio != null ? "x" : undefined,
      tooltip: "The minimum ratio you must maintain",
    },
  ]
}
