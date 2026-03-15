// src/components/tracker-detail/CoreStatCards.tsx
//
// Functions: buildCoreStatDescriptors

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
import type { AlertLevel } from "@/components/ui/StatCard"
import { formatBytesFromString, formatRatio } from "@/lib/formatters"
import type { Snapshot, TrackerLatestStats } from "@/types/api"

export interface StatDescriptor {
  key: string
  label: string
  icon: ReactNode
  value: string
  unit?: string
  subtitle?: string
  trend?: "up" | "flat" | "down"
  tooltip?: string
  alert?: AlertLevel
  alertReason?: string
}

export function buildCoreStatDescriptors(
  stats: TrackerLatestStats | null,
  latestSnapshot: Snapshot | null,
  minimumRatio?: number,
): StatDescriptor[] {
  const [upVal, upUnit] = formatBytesFromString(stats?.uploadedBytes ?? null).split(" ")
  const [dlVal, dlUnit] = formatBytesFromString(stats?.downloadedBytes ?? null).split(" ")
  const [bufVal, bufUnit] = formatBytesFromString(latestSnapshot?.bufferBytes ?? null).split(" ")

  const rawRequiredRatio = latestSnapshot?.requiredRatio ?? minimumRatio ?? null
  const effectiveRequiredRatio = rawRequiredRatio != null && rawRequiredRatio > 0 ? rawRequiredRatio : null
  const ratioBelowRequired = stats?.ratio != null && effectiveRequiredRatio != null && stats.ratio < effectiveRequiredRatio
  const ratioAlertReason = ratioBelowRequired && effectiveRequiredRatio != null ? `Below required ratio (${formatRatio(effectiveRequiredRatio)}x)` : undefined
  const bufferNegative = latestSnapshot?.bufferBytes?.startsWith("-")

  return [
    { key: "uploaded", label: "Uploaded", icon: <UploadArrowIcon width="16" height="16" />, value: upVal, unit: upUnit },
    { key: "downloaded", label: "Downloaded", icon: <DownloadArrowIcon width="16" height="16" />, value: dlVal, unit: dlUnit },
    {
      key: "ratio",
      label: "Ratio",
      icon: <RatioIcon width="16" height="16" />,
      value: formatRatio(stats?.ratio),
      unit: stats?.ratio != null ? "x" : undefined,
      trend: stats?.ratio == null ? undefined : stats.ratio >= 2 ? "up" : stats.ratio >= 1 ? "flat" : "down",
      alert: ratioBelowRequired ? "danger" : undefined,
      alertReason: ratioAlertReason,
    },
    { key: "buffer", label: "Buffer", icon: <ShieldIcon width="16" height="16" />, value: bufVal, unit: bufUnit, alert: bufferNegative ? "danger" : undefined, alertReason: bufferNegative ? "Negative buffer" : undefined },
    { key: "seeding", label: "Seeding", icon: <SeedingIcon width="16" height="16" />, value: stats?.seedingCount != null ? stats.seedingCount.toLocaleString() : "—" },
    { key: "leeching", label: "Leeching", icon: <LeechingIcon width="16" height="16" />, value: stats?.leechingCount != null ? stats.leechingCount.toLocaleString() : "—" },
    { key: "hnr", label: "Hit & Runs", icon: <TriangleWarningIcon width="16" height="16" />, value: latestSnapshot?.hitAndRuns != null ? String(latestSnapshot.hitAndRuns) : "—" },
    { key: "req-ratio", label: "Req. Ratio", icon: <RequiredRatioIcon width="16" height="16" />, value: effectiveRequiredRatio != null ? formatRatio(effectiveRequiredRatio) : "—", unit: effectiveRequiredRatio != null ? "x" : undefined, tooltip: "The minimum ratio you must maintain" },
  ]
}

