// src/components/dashboard/FleetHeadline.tsx
"use client"

import { CHART_THEME } from "@/components/charts/lib/theme"
import {
  DownloadArrowIcon,
  RatioIcon,
  ShieldIcon,
  StarIcon,
  UploadArrowIcon,
} from "@/components/ui/Icons"
import { StatCard } from "@/components/ui/StatCard"
import { computePctChange } from "@/lib/data-transforms"
import { formatBytesFromString, formatCount, splitValueUnit } from "@/lib/formatters"
import type { TodayAtAGlance } from "@/types/api"

interface FleetHeadlineProps {
  fleet: TodayAtAGlance["fleet"]
}

function pctLabel(pct: number | null): string | undefined {
  if (pct === null) return undefined
  const rounded = Math.round(pct)
  return rounded >= 0 ? `+${rounded}% vs yesterday` : `${rounded}% vs yesterday`
}

export function FleetHeadline({ fleet }: FleetHeadlineProps) {
  const uploadParts = splitValueUnit(formatBytesFromString(fleet.uploadDelta))
  const downloadParts = splitValueUnit(formatBytesFromString(fleet.downloadDelta))
  const bufferParts = splitValueUnit(formatBytesFromString(fleet.bufferDelta))

  const ratioDisplay =
    fleet.ratioChange !== null
      ? fleet.ratioChange >= 0
        ? `+${fleet.ratioChange.toFixed(4)}`
        : fleet.ratioChange.toFixed(4)
      : "+0.0000"

  const seedbonusDisplay = (() => {
    if (fleet.seedbonusChange === null) return "+0"
    const floored = Math.floor(Math.abs(fleet.seedbonusChange))
    const sign = fleet.seedbonusChange >= 0 ? "+" : "-"
    return sign + formatCount(floored)
  })()

  const uploadPct = computePctChange(fleet.uploadDelta, fleet.uploadDeltaYesterday)
  const downloadPct = computePctChange(fleet.downloadDelta, fleet.downloadDeltaYesterday)
  const bufferPct = computePctChange(fleet.bufferDelta, fleet.bufferDeltaYesterday)

  const ratioTrend =
    fleet.ratioChange === null || fleet.ratioChange === 0
      ? undefined
      : fleet.ratioChange > 0
        ? ("up" as const)
        : ("down" as const)

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatCard
        label="Upload gained"
        value={uploadParts.num}
        unit={uploadParts.unit}
        subValue={pctLabel(uploadPct)}
        accentColor={CHART_THEME.upload}
        icon={<UploadArrowIcon width="16" height="16" />}
      />

      <StatCard
        label="Download gained"
        value={downloadParts.num}
        unit={downloadParts.unit}
        subValue={pctLabel(downloadPct)}
        accentColor={CHART_THEME.download}
        icon={<DownloadArrowIcon width="16" height="16" />}
      />

      <StatCard
        label="Buffer change"
        value={bufferParts.num}
        unit={bufferParts.unit}
        subValue={pctLabel(bufferPct)}
        accentColor={CHART_THEME.accent}
        icon={<ShieldIcon width="16" height="16" />}
      />

      <StatCard
        label="Ratio change"
        value={ratioDisplay}
        trend={ratioTrend}
        accentColor={
          fleet.ratioChange !== null && fleet.ratioChange < 0
            ? CHART_THEME.danger
            : CHART_THEME.success
        }
        icon={<RatioIcon width="16" height="16" />}
      />

      <StatCard
        label="Bonus gained"
        value={seedbonusDisplay}
        unit="pts"
        accentColor={CHART_THEME.violet}
        icon={<StarIcon width="16" height="16" />}
      />
    </div>
  )
}
