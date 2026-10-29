// src/components/TrackerHubStatus.tsx
//
// Functions: getRecentIncident, formatIncidentDate, formatDowntime, formatResponseTime,
//            TrackerHubStatus

"use client"

import clsx from "clsx"
import Image from "next/image"
import { useEffect, useState } from "react"
import { ChevronToggle } from "@/components/ui/ChevronToggle"
import { StatusDot } from "@/components/ui/StatusDot"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { formatTimeAgo } from "@/lib/formatters"

const TRACKERHUB_SUMMARY =
  "https://raw.githubusercontent.com/HDVinnie/TrackerHub/HEAD/history/summary.json"
const TRACKERHUB_HISTORY = "https://hdvinnie.github.io/TrackerHub/history"

interface TrackerHubEntry {
  slug: string
  status: "up" | "down"
  uptime: string
  uptimeDay: string
  uptimeWeek: string
  uptimeMonth: string
  uptimeYear?: string
  time: number
  timeDay: number
  timeWeek?: number
  timeMonth?: number
  timeYear?: number
  dailyMinutesDown?: Record<string, number>
}

interface TrackerHubStatusProps {
  trackerHubSlug: string
  statusPageUrl?: string
  defaultExpanded?: boolean
}

function getRecentIncident(
  dailyMinutesDown?: Record<string, number>
): { date: string; minutes: number } | null {
  if (!dailyMinutesDown) return null
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

  if (dailyMinutesDown[today] && dailyMinutesDown[today] > 0) {
    return { date: today, minutes: dailyMinutesDown[today] }
  }
  if (dailyMinutesDown[yesterday] && dailyMinutesDown[yesterday] > 0) {
    return { date: yesterday, minutes: dailyMinutesDown[yesterday] }
  }
  return null
}

function formatIncidentDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`)
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr === today) return "Today"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatDowntime(minutes: number): string {
  if (minutes >= 1440) return "Full day"
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${minutes}m`
}

function formatResponseTime(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return "—"
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`
}

const WINDOWS = ["24h", "7d", "30d", "1y"]

function TrackerHubStatus({
  trackerHubSlug,
  statusPageUrl,
  defaultExpanded = true,
}: TrackerHubStatusProps) {
  const [data, setData] = useState<TrackerHubEntry | null>(null)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const [expanded, setExpanded] = useLocalStorage(
    "tracker-tracker:hub-status-expanded",
    defaultExpanded
  )

  useEffect(() => {
    let cancelled = false
    async function fetchStatus() {
      try {
        const res = await fetch(TRACKERHUB_SUMMARY)
        if (!res.ok) return

        const entries: TrackerHubEntry[] = await res.json()
        const match = entries.find((e) => e.slug === trackerHubSlug)
        if (match) {
          if (!cancelled) setData(match)
          if (!cancelled) setFetchedAt(new Date())
        }
      } catch {
        // TrackerHub data is supplementary. Fail silently
      }
    }

    fetchStatus()
    return () => {
      cancelled = true
    }
  }, [trackerHubSlug])

  if (!data) return null

  const isUp = data.status === "up"
  const incident = getRecentIncident(data.dailyMinutesDown)
  const trackerHubUrl = `${TRACKERHUB_HISTORY}/${trackerHubSlug}`
  const rows: [string, string[]][] = [
    ["Uptime", [data.uptimeDay, data.uptimeWeek, data.uptimeMonth, data.uptimeYear ?? "—"]],
    [
      "Response",
      [data.timeDay, data.timeWeek, data.timeMonth, data.timeYear].map(formatResponseTime),
    ],
  ]

  return (
    <div className="nm-inset-sm bg-control-bg flex flex-col px-4 pt-3 pb-3.25 min-w-80 max-w-xl rounded-nm-md">
      {/* Header row. Always visible. Space Mono sits about a pixel low in its line
          box, so the row is raised to look centred in a collapsed card. */}
      <div className="flex items-center justify-between gap-6 w-full -translate-y-px">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-2 cursor-pointer"
        >
          <ChevronToggle expanded={expanded} className="text-muted" />
          <StatusDot tone={isUp ? "success" : "danger"} />
          <span
            className={clsx(
              "text-xs font-mono font-semibold tracking-wider uppercase",
              isUp ? "text-success" : "text-danger"
            )}
          >
            {isUp ? "Up" : "Down"}
          </span>
          {fetchedAt && (
            <span className="text-xs font-mono text-muted">
              · Checked {formatTimeAgo(fetchedAt)}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3">
          <a
            href={trackerHubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-accent hover:text-primary transition-colors duration-150"
          >
            TrackerHub →
          </a>
          {statusPageUrl && (
            <a
              href={statusPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-accent hover:text-primary transition-colors duration-150"
            >
              Status Page →
            </a>
          )}
        </div>
      </div>

      {/* Expandable details */}
      <div
        className={clsx(
          "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
          expanded ? "max-h-125 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="flex flex-col gap-2 mt-2">
          {/* Incident banner */}
          {incident && (
            <div
              className={clsx(
                "flex items-center gap-2 px-2.5 py-2 text-xs font-mono rounded-nm-sm",
                isUp ? "bg-warn-dim text-warn" : "bg-danger-dim text-danger"
              )}
            >
              <span className="shrink-0">⚠</span>
              <span>
                {formatIncidentDate(incident.date)}: {formatDowntime(incident.minutes)} downtime
              </span>
            </div>
          )}

          {/* Uptime and response time by window */}
          <div className="grid grid-cols-[auto_repeat(4,minmax(0,1fr))] gap-x-3 gap-y-0.5 text-xs font-mono tabular-nums">
            <span />
            {WINDOWS.map((span) => (
              <span key={span} className="text-muted text-right">
                {span}
              </span>
            ))}
            {rows.map(([label, values]) => [
              <span key={label} className="text-muted">
                {label}
              </span>,
              ...values.map((value, i) => (
                <span key={`${label}-${WINDOWS[i]}`} className="text-secondary text-right">
                  {value}
                </span>
              )),
            ])}
          </div>

          <div className="flex justify-end">
            <a
              href={trackerHubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted hover:text-tertiary transition-colors duration-150 shrink-0"
            >
              <Image
                src="/img/trackerHub_logo.svg"
                alt=""
                width={12}
                height={12}
                aria-hidden="true"
              />
              <span className="text-3xs font-mono">Powered by TrackerHub</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export { TrackerHubStatus }
