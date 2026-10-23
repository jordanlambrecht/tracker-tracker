// src/components/dashboard/ProwlarrOverview.tsx

"use client"

import { useQuery } from "@tanstack/react-query"
import { DataCell } from "@typography"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/Badge"
import { Notice } from "@/components/ui/Notice"
import { PulseDot } from "@/components/ui/PulseDot"
import { SectionToggle } from "@/components/ui/SectionToggle"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"
import { Tooltip } from "@/components/ui/Tooltip"
import { formatCount, formatPercent, formatTimeAgo } from "@/lib/formatters"
import {
  describeIndexerStatus,
  getIndexerStatus,
  type IndexerStatus,
  statsTotals,
} from "@/lib/prowlarr/status"
import { prowlarrQueryOptions } from "@/lib/query-options"
import { getHealthPulseDot, getTrackerHealth } from "@/lib/tracker-status"
import type { TrackerProwlarrIndexer, TrackerSummary } from "@/types/api"

interface Row {
  tracker: TrackerSummary
  indexer: TrackerProwlarrIndexer
}

// Failing rows sort first, then the states that leave the reading in doubt.
const STATUS_ORDER: Record<IndexerStatus, number> = {
  failing: 0,
  unreachable: 1,
  stale: 2,
  disabled: 3,
  ok: 4,
}

// Prowlarr health checks that duplicate the per-indexer failures listed below.
const INDEXER_FAILURE_CHECKS = new Set(["IndexerStatusCheck", "IndexerLongTermStatusCheck"])

function formatResponseTime(ms: number | undefined): string {
  if (ms === undefined || ms <= 0) return "—"
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`
}

function IndexerStatusBadge({ indexer }: { indexer: TrackerProwlarrIndexer }) {
  const status = getIndexerStatus(indexer)
  const since = indexer.initialFailure ?? indexer.mostRecentFailure
  const badge =
    status === "failing" ? (
      <Badge variant="warn">Failing{since ? ` since ${formatTimeAgo(since)}` : ""}</Badge>
    ) : status === "unreachable" ? (
      <Badge variant="danger">Prowlarr unreachable</Badge>
    ) : status === "stale" ? (
      <Badge variant="default">No recent data</Badge>
    ) : status === "disabled" ? (
      <Badge variant="default">Disabled</Badge>
    ) : (
      <Badge variant="success">OK</Badge>
    )
  return <Tooltip content={describeIndexerStatus(indexer)}>{badge}</Tooltip>
}

const columns: Column<Row>[] = [
  {
    key: "tracker",
    header: "Tracker",
    sortable: true,
    sortValue: (r) => r.tracker.name.toLowerCase(),
    render: (r) => {
      const health = getTrackerHealth(r.tracker)
      return (
        <div className="flex items-center gap-2.5">
          <PulseDot
            status={getHealthPulseDot(health)}
            size="sm"
            color={health === "healthy" ? r.tracker.color : undefined}
          />
          <span className="font-sans font-semibold text-primary whitespace-nowrap">
            {r.tracker.name}
          </span>
        </div>
      )
    },
  },
  {
    key: "indexer",
    header: "Indexer",
    render: (r) => (
      <DataCell className="whitespace-nowrap">
        {r.indexer.name}
        <span className="text-tertiary"> · {r.indexer.instanceName}</span>
      </DataCell>
    ),
  },
  {
    key: "queries",
    header: "Queries 24h",
    align: "right",
    sortable: true,
    sortValue: (r) => (r.indexer.stats24h ? statsTotals(r.indexer.stats24h).requests : -1),
    render: (r) => (
      <DataCell>
        {r.indexer.stats24h ? formatCount(statsTotals(r.indexer.stats24h).requests) : "—"}
      </DataCell>
    ),
  },
  {
    key: "grabs",
    header: "Grabs 24h",
    align: "right",
    sortable: true,
    sortValue: (r) => r.indexer.stats24h?.grabs ?? -1,
    render: (r) => <DataCell>{formatCount(r.indexer.stats24h?.grabs)}</DataCell>,
  },
  {
    key: "failures",
    header: "Failed 24h",
    align: "right",
    sortable: true,
    sortValue: (r) =>
      r.indexer.stats24h ? (statsTotals(r.indexer.stats24h).failureRate ?? -1) : -1,
    render: (r) => {
      const rate = r.indexer.stats24h ? statsTotals(r.indexer.stats24h).failureRate : null
      return <DataCell>{rate === null ? "—" : formatPercent(rate * 100)}</DataCell>
    },
  },
  {
    key: "response",
    header: "Avg Response",
    align: "right",
    sortable: true,
    sortValue: (r) => r.indexer.stats24h?.averageResponseTime ?? -1,
    render: (r) => (
      <DataCell>{formatResponseTime(r.indexer.stats24h?.averageResponseTime)}</DataCell>
    ),
  },
  {
    key: "status",
    header: "Status",
    align: "right",
    sortable: true,
    sortValue: (r) => STATUS_ORDER[getIndexerStatus(r.indexer)],
    render: (r) => <IndexerStatusBadge indexer={r.indexer} />,
  },
]

interface ProwlarrOverviewProps {
  trackers: TrackerSummary[]
  // Collapse state is owned by the parent's single useSectionCollapse, like LoginTimers.
  expanded: boolean
  onToggleExpanded: () => void
}

export function ProwlarrOverview({ trackers, expanded, onToggleExpanded }: ProwlarrOverviewProps) {
  const router = useRouter()
  const { data: instances = [] } = useQuery({
    ...prowlarrQueryOptions,
    refetchInterval: 5 * 60 * 1000,
  })
  const enabled = instances.filter((i) => i.enabled)
  if (enabled.length === 0) return null

  const rows: Row[] = trackers
    .filter((t) => t.isActive)
    .flatMap((tracker) =>
      (tracker.prowlarr?.indexers ?? []).map((indexer) => ({ tracker, indexer }))
    )
    .sort(
      (a, b) =>
        STATUS_ORDER[getIndexerStatus(a.indexer)] - STATUS_ORDER[getIndexerStatus(b.indexer)] ||
        a.tracker.name.localeCompare(b.tracker.name)
    )

  const problems = enabled.flatMap((instance) => {
    if (instance.lastError) {
      return [
        {
          key: `${instance.id}-error`,
          variant: "danger" as const,
          header: `${instance.name} unreachable${instance.errorSince ? ` since ${formatTimeAgo(instance.errorSince)}` : ""}`,
          message: instance.lastError,
        },
      ]
    }
    return instance.healthIssues
      .filter(
        (h) => (h.type === "error" || h.type === "warning") && !INDEXER_FAILURE_CHECKS.has(h.source)
      )
      .map((h) => ({
        key: `${instance.id}-${h.source}-${h.message}`,
        variant: h.type === "error" ? ("danger" as const) : ("warn" as const),
        header: instance.name,
        message: h.message,
      }))
  })

  const failing = rows.filter((r) => getIndexerStatus(r.indexer) === "failing").length

  return (
    <div className="flex flex-col gap-4">
      <SectionToggle
        label={failing > 0 ? `Prowlarr · ${failing} failing` : "Prowlarr"}
        expanded={expanded}
        onToggle={onToggleExpanded}
      />
      {expanded && (
        <>
          {problems.map((p) => (
            <Notice key={p.key} variant={p.variant} box header={p.header} message={p.message} />
          ))}
          <Table
            columns={columns}
            data={rows}
            keyExtractor={(r) => `${r.tracker.id}-${r.indexer.instanceId}-${r.indexer.indexerId}`}
            emptyMessage="No tracker matches a Prowlarr indexer. Pin one in a tracker's settings."
            surface="inset"
            onRowClick={(r) => router.push(`/trackers/${r.tracker.id}`)}
            rowStyle={(r) => ({ borderLeft: `3px solid ${r.tracker.color}` })}
          />
        </>
      )}
    </div>
  )
}
