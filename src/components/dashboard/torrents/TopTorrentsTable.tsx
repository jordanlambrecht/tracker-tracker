// src/components/dashboard/torrents/TopTorrentsTable.tsx

"use client"

import { MarqueeText } from "@/components/ui/MarqueeText"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"
import { formatBytesFromNumber, formatDuration } from "@/lib/formatters"
import type { TorrentInfo } from "@/lib/torrent-utils"

interface TopTorrentsTableProps {
  torrents: TorrentInfo[]
  accentColor: string
}

export function TopTorrentsTable({
  torrents,
  accentColor: _accentColor,
}: TopTorrentsTableProps) {
  const columns: Column<TorrentInfo>[] = [
    {
      key: "rank",
      header: "#",
      width: 28,
      render: (_t, i) => <span className="text-[11px] font-mono text-muted">{i != null ? i + 1 : ""}</span>,
    },
    {
      key: "name",
      header: "Name",
      width: "40%",
      render: (t) => (
        <MarqueeText className="text-[11px] font-mono text-secondary" speed={30}>{t.name}</MarqueeText>
      ),
    },
    {
      key: "category",
      header: "Cat",
      width: 56,
      render: (t) => (
        <span className="text-[11px] font-mono text-muted truncate block" title={t.category}>{t.category || "\u2014"}</span>
      ),
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: 48,
      render: (t) => {
        const formatted = formatBytesFromNumber(t.size)
        const spaceIdx = formatted.indexOf(" ")
        const num = spaceIdx > -1 ? formatted.slice(0, spaceIdx) : formatted
        const unit = spaceIdx > -1 ? formatted.slice(spaceIdx + 1) : ""
        return (
          <span className="text-[11px] font-mono text-muted text-right leading-none">
            {num}<span className="block text-[9px] mt-px">{unit}</span>
          </span>
        )
      },
    },
    {
      key: "ratio",
      header: "Ratio",
      align: "right",
      width: 40,
      render: (t) => <span className="text-[11px] font-mono text-muted">{t.ratio.toFixed(2)}</span>,
    },
    {
      key: "seedTime",
      header: "Seed",
      align: "right",
      width: 48,
      render: (t) => <span className="text-[11px] font-mono text-muted">{formatDuration(t.seedingTime)}</span>,
    },
    {
      key: "swarm",
      header: "S/L",
      align: "right",
      width: 40,
      render: (t) => <span className="text-[11px] font-mono text-muted">{t.numComplete}/{t.numIncomplete}</span>,
    },
  ]

  return (
    <Table<TorrentInfo>
      columns={columns}
      data={torrents}
      keyExtractor={(t) => t.hash}
      emptyMessage="No torrents found"
      surface="inset"
      fixedLayout
      compact
      noHorizontalScroll
    />
  )
}
