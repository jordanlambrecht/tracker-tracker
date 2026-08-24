// src/components/dashboard/torrents/UnsatisfiedTorrentsTable.tsx
"use client"

import { CHART_THEME } from "@/components/charts/lib/theme"
import { MarqueeText } from "@/components/ui/MarqueeText"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"
import type { TorrentRaw } from "@/lib/fleet"
import { formatBytesNum, formatDuration, formatPercent, formatRatio } from "@/lib/formatters"
import {
  ratioProgress,
  type SatisfactionRequirement,
  satisfactionProgress,
  seedTimeProgress,
} from "@/lib/satisfaction"

interface UnsatisfiedTorrentsTableProps {
  torrents: TorrentRaw[]
  requirement: SatisfactionRequirement
  accentColor: string
}

export function UnsatisfiedTorrentsTable({
  torrents,
  requirement,
  accentColor,
}: UnsatisfiedTorrentsTableProps) {
  const pctColor = (p: number) =>
    p < 50 ? CHART_THEME.danger : p < 80 ? CHART_THEME.warn : CHART_THEME.positive

  const showSeedTime = requirement.requiredSeedSeconds !== null
  const showRatio = requirement.requiredRatio !== null
  const eitherOr = requirement.mode === "any" && showSeedTime && showRatio

  const columns: Column<TorrentRaw>[] = [
    {
      key: "name",
      header: "Name",
      render: (t) => {
        const pct = satisfactionProgress(t, requirement) * 100
        return (
          <div className="flex flex-col gap-2 min-w-0">
            <MarqueeText className="text-xs font-mono text-secondary">{t.name}</MarqueeText>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-base overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct.toFixed(1)}%`,
                    backgroundColor: pctColor(pct),
                  }}
                />
              </div>
              <span className="text-3xs font-mono shrink-0" style={{ color: pctColor(pct) }}>
                {formatPercent(pct, 0)}
              </span>
            </div>
          </div>
        )
      },
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: "12%",
      render: (t) => (
        <span className="text-xs font-mono text-muted whitespace-nowrap">
          {formatBytesNum(t.size)}
        </span>
      ),
    },
  ]

  if (showSeedTime) {
    columns.push({
      key: "seedTime",
      header: "Seed Time",
      align: "right",
      width: "12%",
      render: (t) => {
        const pct = seedTimeProgress(t.seedingTime, requirement) * 100
        return (
          <span className="text-xs font-mono whitespace-nowrap" style={{ color: pctColor(pct) }}>
            {formatDuration(t.seedingTime)}
          </span>
        )
      },
    })
  }

  if (showRatio) {
    columns.push({
      key: "ratio",
      header: "Ratio",
      align: "right",
      width: "10%",
      render: (t) => {
        const pct = ratioProgress(t.ratio, requirement) * 100
        return (
          <span className="text-xs font-mono whitespace-nowrap" style={{ color: pctColor(pct) }}>
            {formatRatio(t.ratio)}
          </span>
        )
      },
    })
  }

  columns.push({
    key: "remaining",
    header: "Remaining",
    align: "right",
    width: "14%",
    render: (t) => {
      // Under an either/or the honest answer is the nearer route, and saying
      // "6 days" at a 0.98 ratio would send someone to delete a torrent that is
      // an hour from clearing. Which route is nearer is shown, not just how far.
      const seedPct = seedTimeProgress(t.seedingTime, requirement)
      const ratioPct = ratioProgress(t.ratio, requirement)
      // Ratio is the answer when it is the only route, or the nearer one.
      if (!showSeedTime || (eitherOr && ratioPct > seedPct)) {
        // Infinity means nothing was downloaded, -1 is Transmission's "not
        // applicable". Neither counts as progress, so both owe the full amount.
        const measured = Number.isFinite(t.ratio) && t.ratio > 0 ? t.ratio : 0
        const owed = (requirement.requiredRatio ?? 0) - measured
        return (
          <span className="text-xs font-mono text-muted whitespace-nowrap">
            {formatRatio(Math.max(owed, 0))} ratio
          </span>
        )
      }

      const remaining = Math.max((requirement.requiredSeedSeconds ?? 0) - t.seedingTime, 0)
      return (
        <span className="text-xs font-mono text-muted whitespace-nowrap">
          {remaining > 0 ? formatDuration(remaining) : "Done"}
        </span>
      )
    },
  })

  const emptyMessage = eitherOr
    ? "All torrents meet the seed time or ratio requirement"
    : showRatio && !showSeedTime
      ? "All torrents meet ratio requirements"
      : "All torrents meet seed time requirements"

  return (
    <Table<TorrentRaw>
      columns={columns}
      data={torrents}
      keyExtractor={(t) => t.hash}
      emptyMessage={emptyMessage}
      surface="inset"
      trackerColor={accentColor}
      fixedLayout
      noHorizontalScroll
      maxHeight={torrents.length > 15 ? 720 : undefined}
      alwaysShowScrollbar={torrents.length > 15}
    />
  )
}
