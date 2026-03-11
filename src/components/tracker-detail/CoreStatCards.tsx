// src/components/tracker-detail/CoreStatCards.tsx
//
// Functions: CoreStatCards

import type { ReactNode } from "react"
import {
  DownloadArrowIcon,
  LeechingIcon,
  RatioIcon,
  SeedingIcon,
  ShieldIcon,
  StarIcon,
  TriangleWarningIcon,
  UploadArrowIcon,
} from "@/components/ui/Icons"
import { StatCard } from "@/components/ui/StatCard"
import { formatBytesFromString, formatRatio } from "@/lib/formatters"
import type { GGnPlatformMeta, Snapshot, TrackerLatestStats } from "@/types/api"

interface CoreStatCardsProps {
  stats: TrackerLatestStats | null
  latestSnapshot: Snapshot | null
  platformType: string
  ggMeta: GGnPlatformMeta | null
  accentColor: string
}

interface StatDescriptor {
  key: string
  label: string
  icon: ReactNode
  value: string
  unit?: string
  subtitle?: string
  trend?: "up" | "flat" | "down"
}

export function CoreStatCards({ stats, latestSnapshot, platformType, ggMeta, accentColor }: CoreStatCardsProps) {
  const [upVal, upUnit] = formatBytesFromString(stats?.uploadedBytes ?? null).split(" ")
  const [dlVal, dlUnit] = formatBytesFromString(stats?.downloadedBytes ?? null).split(" ")
  const [bufVal, bufUnit] = formatBytesFromString(latestSnapshot?.bufferBytes ?? null).split(" ")

  const row1: StatDescriptor[] = [
    { key: "uploaded", label: "Uploaded", icon: <UploadArrowIcon width="16" height="16" />, value: upVal, unit: upUnit },
    { key: "downloaded", label: "Downloaded", icon: <DownloadArrowIcon width="16" height="16" />, value: dlVal, unit: dlUnit },
    {
      key: "ratio",
      label: "Ratio",
      icon: <RatioIcon width="16" height="16" />,
      value: formatRatio(stats?.ratio),
      unit: stats?.ratio != null ? "x" : undefined,
      trend: stats?.ratio == null ? undefined : stats.ratio >= 2 ? "up" : stats.ratio >= 1 ? "flat" : "down",
    },
    { key: "buffer", label: "Buffer", icon: <ShieldIcon width="16" height="16" />, value: bufVal, unit: bufUnit },
  ]

  const seedbonusValue =
    latestSnapshot?.seedbonus != null
      ? Math.floor(latestSnapshot.seedbonus).toLocaleString("en-US")
      : "—"

  const row2: StatDescriptor[] = [
    { key: "seeding", label: "Seeding", icon: <SeedingIcon width="16" height="16" />, value: stats?.seedingCount != null ? stats.seedingCount.toLocaleString() : "—" },
    { key: "leeching", label: "Leeching", icon: <LeechingIcon width="16" height="16" />, value: stats?.leechingCount != null ? stats.leechingCount.toLocaleString() : "—" },
    platformType === "ggn"
      ? { key: "gold", label: "Gold", icon: <StarIcon width="16" height="16" />, value: seedbonusValue, unit: "Gold", subtitle: ggMeta?.hourlyGold != null ? `+${ggMeta.hourlyGold}/hr` : undefined }
      : { key: "seedbonus", label: "Seedbonus", icon: <StarIcon width="16" height="16" />, value: seedbonusValue, unit: seedbonusValue !== "—" ? "BON" : undefined },
    { key: "hnr", label: "Hit & Runs", icon: <TriangleWarningIcon width="16" height="16" />, value: latestSnapshot?.hitAndRuns != null ? String(latestSnapshot.hitAndRuns) : "—" },
  ]

  const renderRow = (descriptors: StatDescriptor[]) => (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
      {descriptors.map((d) => (
        <StatCard
          key={d.key}
          label={d.label}
          value={d.value}
          accentColor={accentColor}
          icon={d.icon}
          unit={d.unit}
          subtitle={d.subtitle}
          trend={d.trend}
        />
      ))}
    </div>
  )

  return (
    <>
      {renderRow(row1)}
      {renderRow(row2)}
    </>
  )
}
