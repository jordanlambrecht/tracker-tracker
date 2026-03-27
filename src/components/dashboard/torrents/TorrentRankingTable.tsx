// src/components/dashboard/torrents/TorrentRankingTable.tsx

"use client"

import { MarqueeText } from "@/components/ui/MarqueeText"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"
import { Tooltip } from "@/components/ui/Tooltip"
import { formatBytesNum, formatDuration } from "@/lib/formatters"
import type { TorrentInfo } from "@/lib/torrent-utils"

type TorrentTableVariant = "top-seeded" | "elder"

interface TorrentRankingTableProps {
  torrents: TorrentInfo[]
  variant: TorrentTableVariant
}

const seedTimeCol: Column<TorrentInfo> = {
  key: "seedTime",
  header: "Seed",
  align: "right",
  width: "8%",
  render: (t) => (
    <span className="torrent-cell">{formatDuration(t.seedingTime)}</span>
  ),
}

const seedTimeColLast: Column<TorrentInfo> = {
  key: "seedTime",
  header: "Seed",
  align: "right",
  width: "8%",
  render: (t) => (
    <span className="torrent-cell pr-2">{formatDuration(t.seedingTime)}</span>
  ),
}

const swarmCol: Column<TorrentInfo> = {
  key: "swarm",
  header: "S/L",
  align: "right",
  width: "7%",
  render: (t) => (
    <span className="torrent-cell pr-2">
      {t.numComplete}/{t.numIncomplete}
    </span>
  ),
}

const addedCol: Column<TorrentInfo> = {
  key: "added",
  header: "Added",
  align: "right",
  width: "9%",
  render: (t) => {
    const d = new Date(t.addedOn * 1000)
    return (
      <span className="torrent-cell">
        {d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
      </span>
    )
  },
}

const variantColumns: Record<TorrentTableVariant, Column<TorrentInfo>[]> = {
  "top-seeded": [seedTimeCol, swarmCol],
  elder: [addedCol, seedTimeColLast],
}

export function TorrentRankingTable({ torrents, variant }: TorrentRankingTableProps) {
  const sharedColumns: Column<TorrentInfo>[] = [
    {
      key: "rank",
      header: "#",
      width: "3%",
      render: (_t, i) => (
        <span className="torrent-cell pl-2">{i != null ? i + 1 : ""}</span>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (t) => (
        <MarqueeText className="text-2xs font-mono text-secondary" speed={30}>
          {t.name}
        </MarqueeText>
      ),
    },
    {
      key: "category",
      header: "Cat",
      width: "10%",
      render: (t) => (
        <Tooltip content={t.category}>
          <span className="torrent-cell truncate block">
            {t.category || "\u2014"}
          </span>
        </Tooltip>
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
          <span className="torrent-cell text-right leading-none">
            {num}
            <span className="block text-4xs mt-px">{unit}</span>
          </span>
        )
      },
    },
    {
      key: "ratio",
      header: "Ratio",
      align: "right",
      width: "8%",
      render: (t) => <span className="torrent-cell">{t.ratio.toFixed(2)}</span>,
    },
  ]

  const columns = [...sharedColumns, ...variantColumns[variant]]

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

export type { TorrentTableVariant }
