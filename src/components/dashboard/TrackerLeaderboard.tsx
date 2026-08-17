// src/components/dashboard/TrackerLeaderboard.tsx
"use client"

import { DataCell } from "@typography"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/Badge"
import { PulseDot } from "@/components/ui/PulseDot"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"
import { computeBufferBytes } from "@/lib/data-transforms"
import {
  formatAccountAge,
  formatBytesFromString,
  formatCount,
  formatRatioDisplay,
} from "@/lib/formatters"
import {
  getHealthBadgeVariant,
  getHealthLabel,
  getHealthPulseDot,
  getTrackerHealth,
} from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"

/**
 * Prefer the stored buffer over recomputing it. A tracker's own buffer is not
 * always `uploaded - downloaded` — freeleech, bonus spending and per-site
 * accounting all break that identity — so deriving it here made the leaderboard
 * disagree with the detail page for every tracker that reports its own (Hawke,
 * enriched Gazelle). Falls back to the derived value only when nothing is
 * stored, which is what the adapters compute anyway.
 */
function getBufferBytes(t: TrackerSummary): bigint | null {
  const s = t.latestStats
  if (s?.bufferBytes) return BigInt(s.bufferBytes)
  if (!s?.uploadedBytes || !s?.downloadedBytes) return null
  return computeBufferBytes(BigInt(s.uploadedBytes), BigInt(s.downloadedBytes))
}

const columns: Column<TrackerSummary>[] = [
  {
    key: "name",
    header: "Tracker",
    sortable: true,
    sortValue: (t) => t.name.toLowerCase(),
    render: (t) => {
      const health = getTrackerHealth(t)
      return (
        <div className="flex items-center gap-2.5">
          <PulseDot
            status={getHealthPulseDot(health)}
            size="sm"
            color={health === "healthy" ? t.color : undefined}
          />
          <span className="font-sans font-semibold text-primary whitespace-nowrap">{t.name}</span>
        </div>
      )
    },
  },
  {
    key: "ratio",
    header: "Ratio",
    align: "right",
    sortable: true,
    // An infinite ratio (uploaded > 0, downloaded === 0 — the best possible
    // standing) crosses the wire as `ratio: null` plus this flag, since JSON
    // can't carry Infinity. Reading `ratio` alone would sort it dead last,
    // tied with trackers that have no data at all — matches the eaaa483
    // sidebar fix and tracker-status, which already treats this as healthiest.
    sortValue: (t) =>
      t.latestStats?.ratioIsInfinite ? Number.POSITIVE_INFINITY : (t.latestStats?.ratio ?? -1),
    render: (t) => (
      <DataCell>
        {formatRatioDisplay(
          t.latestStats?.ratioIsInfinite ? Number.POSITIVE_INFINITY : t.latestStats?.ratio
        )}
      </DataCell>
    ),
  },
  {
    key: "uploaded",
    header: "Uploaded",
    align: "right",
    sortable: true,
    sortValue: (t) =>
      t.latestStats?.uploadedBytes ? Number(BigInt(t.latestStats.uploadedBytes)) : -1,
    render: (t) => <DataCell>{formatBytesFromString(t.latestStats?.uploadedBytes)}</DataCell>,
  },
  {
    key: "downloaded",
    header: "Downloaded",
    align: "right",
    sortable: true,
    sortValue: (t) =>
      t.latestStats?.downloadedBytes ? Number(BigInt(t.latestStats.downloadedBytes)) : -1,
    render: (t) => <DataCell>{formatBytesFromString(t.latestStats?.downloadedBytes)}</DataCell>,
  },
  {
    key: "buffer",
    header: "Buffer",
    align: "right",
    sortable: true,
    // Unmeasured sorts last rather than as 0: with signed buffers a 0 would sit
    // above every account in deficit, ranking "no data" as healthier than a
    // real -1 TiB.
    sortValue: (t) => {
      const buffer = getBufferBytes(t)
      return buffer === null ? Number.NEGATIVE_INFINITY : Number(buffer)
    },
    render: (t) => {
      const buffer = getBufferBytes(t)
      return <DataCell>{buffer === null ? "—" : formatBytesFromString(buffer.toString())}</DataCell>
    },
  },
  {
    key: "seeding",
    header: "Seeding",
    align: "right",
    sortable: true,
    sortValue: (t) => t.latestStats?.seedingCount ?? -1,
    render: (t) => <DataCell>{formatCount(t.latestStats?.seedingCount)}</DataCell>,
  },
  {
    key: "age",
    header: "Account Age",
    align: "right",
    sortable: true,
    sortValue: (t) => (t.joinedAt ? new Date(t.joinedAt).getTime() : Infinity),
    render: (t) => (
      <DataCell className="whitespace-nowrap">{formatAccountAge(t.joinedAt) ?? "—"}</DataCell>
    ),
  },
  {
    key: "status",
    header: "Status",
    align: "right",
    render: (t) => {
      const health = getTrackerHealth(t)
      return <Badge variant={getHealthBadgeVariant(health)}>{getHealthLabel(health)}</Badge>
    },
  },
]

function TrackerLeaderboard({ trackers }: { trackers: TrackerSummary[] }) {
  const router = useRouter()

  return (
    <Table<TrackerSummary>
      columns={columns}
      data={trackers}
      keyExtractor={(t) => t.id}
      surface="inset"
      defaultSortKey="ratio"
      defaultSortDirection="desc"
      onRowClick={(t) => router.push(`/trackers/${t.id}`)}
      rowStyle={(t) => ({ borderLeft: `3px solid ${t.color}` })}
    />
  )
}

export { TrackerLeaderboard }
