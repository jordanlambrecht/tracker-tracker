"use client"

// src/components/layout/Sidebar.tsx
//
// Functions: getPulseDotStatus, Sidebar

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"
import type { PulseDotStatus } from "@/components/ui/PulseDot"
import { PulseDot } from "@/components/ui/PulseDot"
import { formatRatio } from "@/lib/formatters"
import type { TrackerSummary } from "@/types/api"

function getPulseDotStatus(tracker: TrackerSummary): PulseDotStatus {
  if (tracker.lastError) return "error"
  if (!tracker.latestStats) return "offline"
  const { ratio } = tracker.latestStats
  if (ratio === null) return "offline"
  if (ratio >= 2) return "healthy"
  if (ratio >= 1) return "warning"
  return "critical"
}

function Sidebar() {
  const [trackers, setTrackers] = useState<TrackerSummary[]>([])
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function fetchTrackers() {
      try {
        const res = await fetch("/api/trackers")
        if (!res.ok) return
        const data: TrackerSummary[] = await res.json()
        if (!cancelled) {
          setTrackers(data)
        }
      } catch {
        // silently ignore fetch errors; we'll retry on the next interval
      }
    }

    fetchTrackers()
    const interval = setInterval(fetchTrackers, 60_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <aside className="w-64 h-screen flex flex-col bg-base border-r border-border flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border flex-shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-tertiary">
          Tracker Tracker
        </span>
      </div>

      {/* Tracker list */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Trackers">
        {trackers.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted">No trackers added yet.</p>
        ) : (
          trackers.map((tracker) => {
            const isActive = pathname === `/trackers/${tracker.id}`
            const status = getPulseDotStatus(tracker)
            const ratio = tracker.latestStats?.ratio ?? null

            return (
              <button
                key={tracker.id}
                type="button"
                onClick={() => router.push(`/trackers/${tracker.id}`)}
                className={[
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left",
                  "transition-colors duration-100 cursor-pointer",
                  isActive
                    ? "bg-accent-dim border-r-2 border-accent text-primary"
                    : "hover:bg-raised text-secondary hover:text-primary",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                <PulseDot status={status} size="sm" />
                <span className="flex-1 truncate text-sm">{tracker.name}</span>
                <span className="font-mono text-xs tabular-nums text-tertiary flex-shrink-0">
                  {formatRatio(ratio)}
                </span>
              </button>
            )
          })
        )}
      </nav>

      {/* Add Tracker button */}
      <div className="px-4 py-4 border-t border-border flex-shrink-0">
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => router.push("/trackers/new")}
        >
          + Add Tracker
        </Button>
      </div>
    </aside>
  )
}

export { Sidebar }
