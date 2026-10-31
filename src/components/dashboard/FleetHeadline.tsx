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
import {
  formatBytesFromString,
  formatCount,
  formatPercent,
  formatSignedChange,
  splitValueUnit,
} from "@/lib/formatters"
import type { GlanceDay, TodayAtAGlance } from "@/types/api"

interface FleetHeadlineProps {
  fleet: TodayAtAGlance["fleet"]
  day?: GlanceDay
}

function pctLabel(pct: number | null, versus: string): string | undefined {
  if (pct === null) return undefined
  return `${formatPercent(pct, { signed: true })} vs ${versus}`
}

export function FleetHeadline({ fleet, day = "today" }: FleetHeadlineProps) {
  const versus = day === "today" ? "yesterday" : "the day before"
  const uploadParts = splitValueUnit(formatBytesFromString(fleet.uploadDelta))
  const downloadParts = splitValueUnit(formatBytesFromString(fleet.downloadDelta))
  const bufferParts = splitValueUnit(formatBytesFromString(fleet.bufferDelta))

  // No upload yet today leaves nothing to measure the ratio change against
  const ratio = fleet.ratioChange === null ? null : formatSignedChange(fleet.ratioChange, 4)

  const seedbonusDisplay =
    fleet.seedbonusChange === null
      ? "0"
      : formatSignedChange(Math.trunc(fleet.seedbonusChange), 0, formatCount).text

  const uploadPct = computePctChange(fleet.uploadDelta, fleet.uploadDeltaYesterday)
  const downloadPct = computePctChange(fleet.downloadDelta, fleet.downloadDeltaYesterday)
  const bufferPct = computePctChange(fleet.bufferDelta, fleet.bufferDeltaYesterday)

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
        value={ratio?.text ?? "—"}
        trend={ratio?.direction}
        accentColor={
          ratio?.direction === "down"
            ? CHART_THEME.danger
            : ratio?.direction === "up"
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
