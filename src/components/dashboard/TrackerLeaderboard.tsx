// src/components/dashboard/TrackerLeaderboard.tsx
"use client"

import { DataCell } from "@typography"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/Badge"
import { PulseDot } from "@/components/ui/PulseDot"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"
import {
  formatAccountAge,
  formatBytesFromString,
  formatCount,
  formatRatioDisplay,
} from "@/lib/formatters"
import { computeBufferBytes } from "@/lib/helpers"
import {
  getHealthBadgeVariant,
  getHealthLabel,
  getHealthPulseDot,
  getTrackerHealth,
} from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"

function getBufferBytes(t: TrackerSummary): bigint {
  const s = t.latestStats
  if (!s?.uploadedBytes || !s?.downloadedBytes) return 0n
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
    sortValue: (t) => t.latestStats?.ratio ?? -1,
    render: (t) => <DataCell>{formatRatioDisplay(t.latestStats?.ratio)}</DataCell>,
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
    sortValue: (t) => Number(getBufferBytes(t)),
    render: (t) => (
      <DataCell>
        {t.latestStats?.uploadedBytes && t.latestStats?.downloadedBytes
          ? formatBytesFromString(getBufferBytes(t).toString())
          : "—"}
      </DataCell>
    ),
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
