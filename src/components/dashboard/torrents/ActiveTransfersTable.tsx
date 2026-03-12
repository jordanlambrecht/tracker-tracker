// src/components/dashboard/torrents/ActiveTransfersTable.tsx

"use client"

import { MarqueeText } from "@/components/ui/MarqueeText"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"
import { formatBytesFromNumber } from "@/lib/formatters"
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
      <div
        className="nm-inset-sm bg-control-bg flex flex-1 items-center justify-center rounded-nm-md min-h-[72px]"
      >
        <p className="text-xs text-muted font-mono">No active {mode === "downloading" ? "downloads" : "uploads"}</p>
      </div>
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
            <span className="text-[10px] font-sans text-muted truncate">{t.clientName}</span>
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
      key: "progress",
      header: isDownload ? "Prog" : "Ratio",
      align: "right",
      width: 36,
      render: (t) => (
        <span className="text-[11px] font-mono text-muted">
          {isDownload ? `${(t.progress * 100).toFixed(0)}%` : t.ratio.toFixed(2)}
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
        const formatted = formatBytesFromNumber(raw)
        const spaceIdx = formatted.indexOf(" ")
        const num = spaceIdx > -1 ? formatted.slice(0, spaceIdx) : formatted
        const unit = spaceIdx > -1 ? `${formatted.slice(spaceIdx + 1)}/s` : "/s"
        return (
          <span className="text-[11px] font-mono text-right leading-none" style={{ color: accentColor }}>
            {num}<span className="block text-[9px] text-muted mt-px">{unit}</span>
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
        if (t.lastActivity <= 0) return <span className="text-[11px] font-mono text-muted">—</span>
        const diff = Math.floor(Date.now() / 1000 - t.lastActivity)
        const val = diff < 60 ? `${diff}s` : diff < 3600 ? `${Math.floor(diff / 60)}m` : diff < 86400 ? `${Math.floor(diff / 3600)}h` : `${Math.floor(diff / 86400)}d`
        return <span className="text-[11px] font-mono text-muted">{val}</span>
      },
    },
  ]

  return (
    <Table<TorrentInfo>
      columns={columns}
      data={torrents}
      keyExtractor={(t) => t.hash}
      surface="inset"
      fixedLayout
      compact
      noHorizontalScroll
      maxHeight={400}
      animated
    />
  )
}
