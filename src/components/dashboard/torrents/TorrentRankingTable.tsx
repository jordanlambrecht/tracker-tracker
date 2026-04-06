// src/components/dashboard/torrents/TorrentRankingTable.tsx
"use client"

import { MarqueeText } from "@/components/ui/MarqueeText"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"
import { Tooltip } from "@/components/ui/Tooltip"
import type { TorrentRaw } from "@/lib/fleet"
import { formatBytesNum, formatDuration, formatRatio, splitValueUnit } from "@/lib/formatters"

type TorrentTableVariant = "top-seeded" | "elder"

interface TorrentRankingTableProps {
  torrents: TorrentRaw[]
  variant: TorrentTableVariant
  trackerColor?: string
}

const seedTimeCol: Column<TorrentRaw> = {
  key: "seedTime",
  header: "Seed",
  align: "right",
  width: "8%",
  render: (t) => <span className="torrent-cell">{formatDuration(t.seedingTime)}</span>,
}

const seedTimeColLast: Column<TorrentRaw> = {
  key: "seedTime",
  header: "Seed",
  align: "right",
  width: "8%",
  render: (t) => <span className="torrent-cell pr-2">{formatDuration(t.seedingTime)}</span>,
}

const swarmCol: Column<TorrentRaw> = {
  key: "swarm",
  header: "S/L",
  align: "right",
  width: "7%",
  render: (t) => (
    <span className="torrent-cell pr-2">
      {t.swarmSeeders}/{t.swarmLeechers}
    </span>
  ),
}

const addedCol: Column<TorrentRaw> = {
  key: "added",
  header: "Added",
  align: "right",
  width: "9%",
  render: (t) => {
    const d = new Date(t.addedAt * 1000)
    return (
      <span className="torrent-cell">
        {d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
      </span>
    )
  },
}

const variantColumns: Record<TorrentTableVariant, Column<TorrentRaw>[]> = {
  "top-seeded": [seedTimeCol, swarmCol],
  elder: [addedCol, seedTimeColLast],
}

export function TorrentRankingTable({ torrents, variant, trackerColor }: TorrentRankingTableProps) {
  const sharedColumns: Column<TorrentRaw>[] = [
    {
      key: "rank",
      header: "#",
      width: "3%",
      render: (_t, i) => <span className="torrent-cell pl-2">{i != null ? i + 1 : ""}</span>,
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
          <span className="torrent-cell truncate block">{t.category || "\u2014"}</span>
        </Tooltip>
      ),
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: "8%",
      render: (t) => {
        const { num, unit } = splitValueUnit(formatBytesNum(t.size))
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
      render: (t) => <span className="torrent-cell">{formatRatio(t.ratio)}</span>,
    },
  ]

  const columns = [...sharedColumns, ...variantColumns[variant]]

  return (
    <Table<TorrentRaw>
      columns={columns}
      data={torrents}
      keyExtractor={(t) => t.hash}
      emptyMessage="No torrents found"
      surface="inset"
      trackerColor={trackerColor}
      fixedLayout
      compact
      noHorizontalScroll
    />
  )
}

export type { TorrentTableVariant }
