// src/components/dashboard/torrents/UnsatisfiedTorrentsTable.tsx

"use client"

import { CHART_THEME } from "@/components/charts/lib/theme"
import { MarqueeText } from "@/components/ui/MarqueeText"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"
import { formatBytesNum, formatDuration } from "@/lib/formatters"
import type { TorrentInfo } from "@/lib/torrent-utils"

interface UnsatisfiedTorrentsTableProps {
  torrents: TorrentInfo[]
  requiredSeconds: number
  accentColor: string
}

export function UnsatisfiedTorrentsTable({
  torrents,
  requiredSeconds,
  accentColor: _accentColor,
}: UnsatisfiedTorrentsTableProps) {
  const pctColor = (p: number) =>
    p < 50 ? CHART_THEME.danger : p < 80 ? CHART_THEME.warn : CHART_THEME.positive

  const columns: Column<TorrentInfo>[] = [
    {
      key: "name",
      header: "Name",
      render: (t) => {
        const pct = Math.min((t.seedingTime / requiredSeconds) * 100, 100)
        return (
          <div className="flex flex-col gap-1.5 min-w-0">
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
                {pct.toFixed(0)}%
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
    {
      key: "seedTime",
      header: "Seed Time",
      align: "right",
      width: "12%",
      render: (t) => {
        const pct = Math.min((t.seedingTime / requiredSeconds) * 100, 100)
        return (
          <span className="text-xs font-mono whitespace-nowrap" style={{ color: pctColor(pct) }}>
            {formatDuration(t.seedingTime)}
          </span>
        )
      },
    },
    {
      key: "remaining",
      header: "Remaining",
      align: "right",
      width: "12%",
      render: (t) => {
        const remaining = Math.max(requiredSeconds - t.seedingTime, 0)
        return (
          <span className="text-xs font-mono text-muted whitespace-nowrap">
            {remaining > 0 ? formatDuration(remaining) : "Done"}
          </span>
        )
      },
    },
  ]

  return (
    <Table<TorrentInfo>
      columns={columns}
      data={torrents}
      keyExtractor={(t) => t.hash}
      emptyMessage="All torrents meet seed time requirements"
      surface="inset"
      fixedLayout
      noHorizontalScroll
      maxHeight={torrents.length > 15 ? 720 : undefined}
      alwaysShowScrollbar={torrents.length > 15}
    />
  )
}
