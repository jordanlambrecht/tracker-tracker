// src/components/TrackerHubStatus.tsx
//
// Functions: getRecentIncident, formatIncidentDate, formatDowntime, TrackerHubStatus

"use client"

import clsx from "clsx"
import Image from "next/image"
import { useEffect, useState } from "react"
import { ChevronToggle } from "@/components/ui/ChevronToggle"
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
  time: number
  timeDay: number
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
        // TrackerHub data is supplementary — fail silently
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

  return (
    <div className="nm-inset-sm bg-control-bg flex flex-col px-4 py-3.5 min-w-[320px] max-w-xl rounded-nm-md">
      {/* Header row — always visible */}
      <div className="flex items-center justify-between gap-6 w-full">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-2 cursor-pointer"
        >
          <ChevronToggle expanded={expanded} className="text-muted" />
          <span
            className={clsx(
              "inline-block w-2 h-2 rounded-full shrink-0",
              isUp ? "bg-success animate-pulse-glow text-success" : "bg-danger text-danger"
            )}
          />
          <span
            className={clsx(
              "text-sm font-mono font-semibold tracking-wider uppercase",
              isUp ? "text-success" : "text-danger"
            )}
          >
            {isUp ? "Up" : "Down"}
          </span>
          {fetchedAt && (
            <span className="text-xs font-mono text-muted ml-1">
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
          expanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="flex flex-col gap-2.5 mt-2.5">
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

          {/* Stats + attribution */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs font-mono text-tertiary">
              <span>
                Uptime <span className="text-secondary">{data.uptimeMonth}</span>
                <span className="text-muted ml-0.5">30d</span>
              </span>
              <span className="text-border-emphasis">·</span>
              <span>
                Resp <span className="text-secondary">{data.timeDay}ms</span>
                <span className="text-muted ml-0.5">24h</span>
              </span>
            </div>

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
