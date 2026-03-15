// src/components/dashboard/torrents/ElderTorrentsTable.tsx

"use client"

import { MarqueeText } from "@/components/ui/MarqueeText"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"
import { Tooltip } from "@/components/ui/Tooltip"
import { formatBytesNum, formatDuration } from "@/lib/formatters"
import type { TorrentInfo } from "@/lib/torrent-utils"

interface ElderTorrentsTableProps {
  torrents: TorrentInfo[]
  accentColor: string
}

export function ElderTorrentsTable({
  torrents,
  accentColor: _accentColor,
}: ElderTorrentsTableProps) {
  const columns: Column<TorrentInfo>[] = [
    {
      key: "rank",
      header: "#",
      width: "3%",
      render: (_t, i) => <span className="text-[11px] font-mono text-muted pl-2">{i != null ? i + 1 : ""}</span>,
    },
    {
      key: "name",
      header: "Name",
      render: (t) => (
        <MarqueeText className="text-[11px] font-mono text-secondary" speed={30}>{t.name}</MarqueeText>
      ),
    },
    {
      key: "category",
      header: "Cat",
      width: "10%",
      render: (t) => (
        <Tooltip content={t.category}><span className="text-[11px] font-mono text-muted truncate block">{t.category || "\u2014"}</span></Tooltip>
      ),
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: "8%",
      render: (t) => {
        const formatted = formatBytesNum(t.size)
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
      width: "8%",
      render: (t) => <span className="text-[11px] font-mono text-muted">{t.ratio.toFixed(2)}</span>,
    },
    {
      key: "added",
      header: "Added",
      align: "right",
      width: "9%",
      render: (t) => {
        const d = new Date(t.addedOn * 1000)
        return <span className="text-[11px] font-mono text-muted">{d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })}</span>
      },
    },
    {
      key: "seedTime",
      header: "Seed",
      align: "right",
      width: "8%",
      render: (t) => <span className="text-[11px] font-mono text-muted pr-2">{formatDuration(t.seedingTime)}</span>,
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
