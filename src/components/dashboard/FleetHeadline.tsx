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
import type { GlanceDay, TodayAtAGlance } from "@/types/api"

interface FleetHeadlineProps {
  fleet: TodayAtAGlance["fleet"]
  day?: GlanceDay
}

/** "+" or "-" from the exact value; none for zero within floating-point error. */
function signOf(value: number): string {
  return value > Number.EPSILON ? "+" : value < -Number.EPSILON ? "-" : ""
}

function pctLabel(pct: number | null, versus: string): string | undefined {
  if (pct === null) return undefined
  const magnitude = signOf(pct) === "" ? 0 : Math.abs(pct)
  return `${signOf(pct)}${magnitude.toFixed(1)}% vs ${versus}`
}

export function FleetHeadline({ fleet, day = "today" }: FleetHeadlineProps) {
  const versus = day === "today" ? "yesterday" : "the day before"
  const uploadParts = splitValueUnit(formatBytesFromString(fleet.uploadDelta))
  const downloadParts = splitValueUnit(formatBytesFromString(fleet.downloadDelta))
  const bufferParts = splitValueUnit(formatBytesFromString(fleet.bufferDelta))

  // Zero within floating-point error has no sign; anything else keeps the sign
  // of the exact value, so a tiny gain reads "+0.0000" beside an up arrow.
  const ratioChange =
    fleet.ratioChange === null || Math.abs(fleet.ratioChange) <= Number.EPSILON
      ? 0
      : fleet.ratioChange
  const ratioDisplay = ratioChange > 0 ? `+${ratioChange.toFixed(4)}` : ratioChange.toFixed(4)

  const seedbonusDisplay =
    fleet.seedbonusChange === null
      ? "0"
      : signOf(fleet.seedbonusChange) + formatCount(Math.floor(Math.abs(fleet.seedbonusChange)))

  const uploadPct = computePctChange(fleet.uploadDelta, fleet.uploadDeltaYesterday)
  const downloadPct = computePctChange(fleet.downloadDelta, fleet.downloadDeltaYesterday)
  const bufferPct = computePctChange(fleet.bufferDelta, fleet.bufferDeltaYesterday)

  const ratioTrend =
    fleet.ratioChange === null
      ? undefined
      : ratioChange > 0
        ? ("up" as const)
        : ratioChange < 0
          ? ("down" as const)
          : ("flat" as const)

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatCard
        label="Upload gained"
        value={uploadParts.num}
        unit={uploadParts.unit}
        subValue={pctLabel(uploadPct, versus)}
        accentColor={CHART_THEME.upload}
        icon={<UploadArrowIcon width="16" height="16" />}
      />

      <StatCard
        label="Download gained"
        value={downloadParts.num}
        unit={downloadParts.unit}
        subValue={pctLabel(downloadPct, versus)}
        accentColor={CHART_THEME.download}
        icon={<DownloadArrowIcon width="16" height="16" />}
      />

      <StatCard
        label="Buffer change"
        value={bufferParts.num}
        unit={bufferParts.unit}
        subValue={pctLabel(bufferPct, versus)}
        accentColor={CHART_THEME.accent}
        icon={<ShieldIcon width="16" height="16" />}
      />

      <StatCard
        label="Ratio change"
        value={ratioDisplay}
        trend={ratioTrend}
        accentColor={
          ratioChange < 0
            ? CHART_THEME.danger
            : ratioChange > 0
              ? CHART_THEME.success
              : CHART_THEME.neutral
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
