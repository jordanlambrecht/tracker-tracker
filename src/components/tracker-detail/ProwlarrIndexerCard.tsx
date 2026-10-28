// src/components/tracker-detail/ProwlarrIndexerCard.tsx
"use client"

import clsx from "clsx"
import { ChevronToggle } from "@/components/ui/ChevronToggle"
import { Tooltip } from "@/components/ui/Tooltip"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { formatCount, formatDateTime, formatPercent, formatSpanInWords } from "@/lib/formatters"
import {
  describeIndexerStatus,
  getIndexerStatus,
  type IndexerStatus,
  prowlarrIndexersUrl,
  statsTotals,
} from "@/lib/prowlarr/status"
import type { ProwlarrIndexerStats, TrackerProwlarrIndexer } from "@/types/api"

const STATUS_STYLE: Record<IndexerStatus, { label: string; dot: string; text: string }> = {
  // Live states glow like the sidebar's PulseDot; the glow takes the text colour.
  ok: { label: "OK", dot: "bg-success text-success animate-pulse-glow", text: "text-success" },
  failing: { label: "Failing", dot: "bg-warn text-warn animate-pulse-glow", text: "text-warn" },
  "prowlarr-error": {
    label: "Prowlarr error",
    dot: "bg-danger text-danger animate-pulse-glow",
    text: "text-danger",
  },
  stale: { label: "No recent data", dot: "bg-muted", text: "text-muted" },
  disabled: { label: "Disabled", dot: "bg-muted", text: "text-muted" },
}

function formatResponseTime(ms: number): string {
  if (ms <= 0) return "—"
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`
}

function statsCells(stats: ProwlarrIndexerStats | null): string[] {
  if (!stats) return ["—", "—", "—", "—"]
  const { queries, failureRate } = statsTotals(stats)
  return [
    formatCount(queries),
    formatCount(stats.grabs),
    failureRate === null ? "—" : formatPercent(failureRate * 100),
    formatResponseTime(stats.averageResponseTime),
  ]
}

const STATS_HEADERS = ["Queries", "Grabs", "Failed", "Avg response"]

/**
 * Prowlarr's counters for the indexer. Queries include RSS and auth requests.
 * A window not read for a while is left out by the server, with its age.
 */
function IndexerStats({ indexer }: { indexer: TrackerProwlarrIndexer }) {
  const staleLine = indexer.statsStaleSince && (
    <p className="text-xs font-mono text-muted">
      {"Stats not updated since "}
      <HoverDate iso={indexer.statsStaleSince} />
    </p>
  )
  if (!indexer.stats24h && !indexer.stats7d) return staleLine || null
  const rows: [string, ProwlarrIndexerStats | null][] = [
    ["24h", indexer.stats24h],
    ["7d", indexer.stats7d],
  ]
  return (
    <>
      <div className="grid grid-cols-[auto_repeat(4,minmax(0,1fr))] gap-x-3 gap-y-0.5 text-xs font-mono tabular-nums">
        <span />
        {STATS_HEADERS.map((header) => (
          <span key={header} className="text-muted text-right truncate">
            {header}
          </span>
        ))}
        {rows.map(([label, stats]) => [
          <span key={label} className="text-muted">
            {label}
          </span>,
          ...statsCells(stats).map((value, i) => (
            <span key={`${label}-${STATS_HEADERS[i]}`} className="text-secondary text-right">
              {value}
            </span>
          )),
        ])}
      </div>
      {staleLine}
    </>
  )
}

// Rendered only while the tooltip is open, so the clock is read then and not
// during a render the server also makes.
function SpanFromNow({ iso }: { iso: string }) {
  return <>{formatSpanInWords(Date.now() - Date.parse(iso))}</>
}

function HoverDate({ iso }: { iso: string }) {
  return <Tooltip content={<SpanFromNow iso={iso} />}>{formatDateTime(iso)}</Tooltip>
}

/** describeIndexerStatus with each date showing its distance from now on hover. */
function StatusDetail({ indexer }: { indexer: TrackerProwlarrIndexer }) {
  const status = getIndexerStatus(indexer)
  if (status === "failing") {
    const since = indexer.initialFailure ?? indexer.mostRecentFailure
    return (
      <>
        Failing in Prowlarr
        {since && (
          <>
            {" since "}
            <HoverDate iso={since} />
          </>
        )}
        {indexer.disabledTill && (
          <>
            {", retrying at "}
            <HoverDate iso={indexer.disabledTill} />
          </>
        )}
      </>
    )
  }
  if (status === "stale") {
    return (
      <>
        {"No recent reading from Prowlarr (last "}
        <HoverDate iso={indexer.checkedAt} />)
      </>
    )
  }
  return <>{describeIndexerStatus(indexer)}</>
}

// Laid out like the TrackerHub card: a header that collapses the details below it.
function IndexerCard({
  indexer,
  expanded,
  onToggle,
}: {
  indexer: TrackerProwlarrIndexer
  expanded: boolean
  onToggle: () => void
}) {
  const status = getIndexerStatus(indexer)
  const style = STATUS_STYLE[status]
  const hasStats =
    indexer.stats24h !== null || indexer.stats7d !== null || indexer.statsStaleSince !== null
  return (
    <div className="nm-inset-sm bg-control-bg flex flex-col px-4 pt-3 pb-3.25 min-w-80 max-w-xl rounded-nm-md">
      {/* Space Mono sits about a pixel low in its line box, so the header row is
          raised to look centred in a collapsed card. */}
      <div className="flex items-center justify-between gap-6 w-full -translate-y-px">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 cursor-pointer min-w-0"
        >
          <ChevronToggle expanded={expanded} className="text-muted" />
          <span className={clsx("inline-block w-2 h-2 rounded-full shrink-0", style.dot)} />
          <span
            className={clsx("text-xs font-mono font-semibold tracking-wider uppercase", style.text)}
          >
            {style.label}
          </span>
          <span className="text-xs font-mono text-muted truncate">· {indexer.name}</span>
        </button>
        <a
          href={prowlarrIndexersUrl(indexer)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-accent hover:text-primary transition-colors duration-150 shrink-0"
        >
          {indexer.instanceName} →
        </a>
      </div>

      {(status !== "ok" || hasStats) && (
        <div
          className={clsx(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
            expanded ? "max-h-125 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="flex flex-col gap-2 mt-2">
            {status !== "ok" && (
              <p className="text-xs font-mono text-muted">
                <StatusDetail indexer={indexer} />
              </p>
            )}
            <IndexerStats indexer={indexer} />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The status and stats of the tracker's matched Prowlarr indexers, one card
 * each. It never changes the tracker's health.
 */
export function ProwlarrIndexerCard({ indexers }: { indexers: TrackerProwlarrIndexer[] }) {
  const [expanded, setExpanded] = useLocalStorage("tracker-tracker:prowlarr-expanded", true)
  if (indexers.length === 0) return null
  return (
    <>
      {indexers.map((indexer) => (
        <IndexerCard
          key={`${indexer.instanceId}-${indexer.indexerId}`}
          indexer={indexer}
          expanded={expanded}
          onToggle={() => setExpanded((prev) => !prev)}
        />
      ))}
    </>
  )
}
