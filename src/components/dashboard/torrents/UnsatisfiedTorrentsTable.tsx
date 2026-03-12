// src/components/dashboard/torrents/UnsatisfiedTorrentsTable.tsx

"use client"

import { CHART_THEME } from "@/components/charts/theme"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"
import { formatBytesFromNumber, formatDuration } from "@/lib/formatters"
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
  const pctColor = (p: number) => p < 50 ? CHART_THEME.danger : p < 80 ? CHART_THEME.warn : CHART_THEME.positive

  const columns: Column<TorrentInfo>[] = [
    {
      key: "name",
      header: "Name",
      render: (t) => {
        const pct = Math.min((t.seedingTime / requiredSeconds) * 100, 100)
        return (
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs font-mono text-secondary truncate" title={t.name}>{t.name}</span>
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
              <span className="text-[10px] font-mono shrink-0" style={{ color: pctColor(pct) }}>{pct.toFixed(0)}%</span>
            </div>
          </div>
        )
      },
    },
    {
      key: "category",
      header: "Category",
      width: 80,
      render: (t) => (
        <span className="text-xs font-mono text-muted truncate block" title={t.category}>{t.category || "\u2014"}</span>
      ),
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: 72,
      render: (t) => <span className="text-xs font-mono text-muted">{formatBytesFromNumber(t.size)}</span>,
    },
    {
      key: "seedTime",
      header: "Seed Time",
      align: "right",
      width: 72,
      render: (t) => {
        const pct = Math.min((t.seedingTime / requiredSeconds) * 100, 100)
        return (
          <span className="text-xs font-mono" style={{ color: pctColor(pct) }}>
            {formatDuration(t.seedingTime)}
          </span>
        )
      },
    },
    {
      key: "required",
      header: "Required",
      align: "right",
      width: 72,
      render: () => <span className="text-xs font-mono text-muted">{formatDuration(requiredSeconds)}</span>,
    },
    {
      key: "progress",
      header: "Progress",
      align: "right",
      width: 72,
      render: (t) => {
        const pct = Math.min((t.seedingTime / requiredSeconds) * 100, 100)
        return (
          <span className="text-xs font-mono" style={{ color: pctColor(pct) }}>
            {pct.toFixed(0)}%
          </span>
        )
      },
    },
  ]

  return (
    <Table<TorrentInfo>
      columns={columns}
      data={torrents.slice(0, 15)}
      keyExtractor={(t) => t.hash}
      emptyMessage="All torrents meet seed time requirements"
      surface="inset"
    />
  )
}
