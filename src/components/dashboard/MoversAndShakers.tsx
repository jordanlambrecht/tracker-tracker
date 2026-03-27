// src/components/dashboard/MoversAndShakers.tsx

"use client"

import type { ReactNode } from "react"
import { MarqueeText } from "@/components/ui/MarqueeText"
import { Tooltip } from "@/components/ui/Tooltip"
import { formatBytesFromString } from "@/lib/formatters"
import type { TodayAtAGlance } from "@/types/api"

interface MoversAndShakersProps {
  movers: TodayAtAGlance["movers"]
}

interface TorrentRankListEntry {
  hash: string
  name: string
  qbtTag: string | null
  trackerColor: string | null
  clientName: string | null
  bytes: string
}

function buildTooltip(entry: TorrentRankListEntry): ReactNode {
  const lines: string[] = []
  if (entry.qbtTag) lines.push(`Tracker: ${entry.qbtTag}`)
  if (entry.clientName) lines.push(`Client: ${entry.clientName}`)
  if (entry.qbtTag?.toLowerCase().includes("cross-seed")) lines.push("Cross-seeded")
  if (lines.length === 0) return "Unknown tracker"
  return (
    <div className="flex flex-col gap-0.5">
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  )
}

function TorrentRankList({ label, entries }: { label: string; entries: TorrentRankListEntry[] }) {
  return (
    <div className="nm-inset-sm rounded-nm-md p-4 overflow-hidden">
      <p className="text-xs font-sans font-medium text-secondary uppercase tracking-wider mb-3">
        {label}
      </p>
      {entries.length === 0 ? (
        <p className="text-xs text-muted">No activity</p>
      ) : (
        <ul>
          {entries.map((entry, index) => (
            <Tooltip key={entry.hash} content={buildTooltip(entry)}>
              <li
                className={`grid grid-cols-[1fr_auto] items-center gap-3 py-1.5 ${index < entries.length - 1 ? "border-b border-border" : ""}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: entry.trackerColor ?? "var(--color-accent)" }}
                  />
                  <MarqueeText className="text-xs font-mono text-primary">{entry.name}</MarqueeText>
                </div>
                <span className="tabular-cell whitespace-nowrap">
                  {formatBytesFromString(entry.bytes)}
                </span>
              </li>
            </Tooltip>
          ))}
        </ul>
      )}
    </div>
  )
}

export function MoversAndShakers({ movers }: MoversAndShakersProps) {
  const { topUploaders, topDownloaders } = movers

  if (topUploaders.length === 0 && topDownloaders.length === 0) {
    return (
      <p className="text-xs font-mono text-muted p-4 text-center">
        Connect a download client to see torrent activity
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <TorrentRankList
        label="Top Uploaders"
        entries={topUploaders.map((e) => ({ ...e, bytes: e.uploadedToday }))}
      />
      <TorrentRankList
        label="Top Downloaders"
        entries={topDownloaders.map((e) => ({ ...e, bytes: e.downloadedToday }))}
      />
    </div>
  )
}
