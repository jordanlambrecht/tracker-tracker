// src/components/dashboard/torrents/ActiveTransfersTable.tsx
"use client"

import { MarqueeText } from "@/components/ui/MarqueeText"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"
import {
  formatBytesNum,
  formatPercent,
  formatRatio,
  formatSpeed,
  splitValueUnit,
} from "@/lib/formatters"
import type { TorrentInfo } from "@/lib/torrent-utils"

interface ActiveTransfersTableProps {
  torrents: TorrentInfo[]
  mode: "downloading" | "uploading"
  accentColor: string
  showClientName: boolean
}

export function ActiveTransfersTable({
  torrents,
  mode,
  accentColor,
  showClientName,
}: ActiveTransfersTableProps) {
  if (torrents.length === 0) {
    return (
      <Table<TorrentInfo>
        columns={[]}
        data={[]}
        keyExtractor={(t) => t.hash}
        emptyMessage={`No active ${mode === "downloading" ? "downloads" : "uploads"}`}
        surface="inset"
        trackerColor={accentColor}
      />
    )
  }

  const isDownload = mode === "downloading"

  const columns: Column<TorrentInfo>[] = [
    {
      key: "name",
      header: "Name",
      width: "40%",
      render: (t) => (
        <div className="flex flex-col gap-1 min-w-0">
          <MarqueeText className="text-xs font-mono text-secondary">{t.name}</MarqueeText>
          {showClientName && t.clientName && (
            <span className="text-3xs font-sans text-muted truncate">{t.clientName}</span>
          )}
          {isDownload && (
            <div className="w-full h-1 rounded-full bg-base overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(t.progress * 100).toFixed(1)}%`,
                  backgroundColor: accentColor,
                }}
              />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: 48,
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
      key: "progress",
      header: isDownload ? "Prog" : "Ratio",
      align: "right",
      width: 36,
      render: (t) => (
        <span className="torrent-cell">
          {isDownload ? formatPercent(t.progress * 100, 0) : formatRatio(t.ratio)}
        </span>
      ),
    },
    {
      key: "speed",
      header: "Speed",
      align: "right",
      width: 48,
      render: (t) => {
        const raw = isDownload ? t.dlspeed : t.upspeed
        const { num, unit: baseUnit } = splitValueUnit(formatSpeed(raw))
        const unit = baseUnit || "B/s"
        return (
          <span
            className="text-2xs font-mono text-right leading-none"
            style={{ color: accentColor }}
          >
            {num}
            <span className="block text-4xs text-muted mt-px">{unit}</span>
          </span>
        )
      },
    },
    {
      key: "activity",
      header: "Last",
      align: "right",
      width: 36,
      render: (t) => {
        if (t.lastActivity <= 0) return <span className="torrent-cell">—</span>
        const diff = Math.floor(Date.now() / 1000 - t.lastActivity)
        const val =
          diff < 60
            ? `${diff}s`
            : diff < 3600
              ? `${Math.floor(diff / 60)}m`
              : diff < 86400
                ? `${Math.floor(diff / 3600)}h`
                : `${Math.floor(diff / 86400)}d`
        return <span className="torrent-cell">{val}</span>
      },
    },
  ]

  return (
    <Table<TorrentInfo>
      columns={columns}
      data={torrents}
      keyExtractor={(t) => t.hash}
      surface="inset"
      trackerColor={accentColor}
      fixedLayout
      compact
      noHorizontalScroll
      maxHeight={400}
      animated
    />
  )
}
