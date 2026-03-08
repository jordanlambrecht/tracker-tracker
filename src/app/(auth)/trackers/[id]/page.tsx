"use client"

// src/app/(auth)/trackers/[id]/page.tsx
//
// Functions: formatHours, TrackerDetailPage

import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { UploadDownloadChart } from "@/components/charts/UploadDownloadChart"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { StatCard } from "@/components/ui/StatCard"
import { formatBytesFromString, formatRatio } from "@/lib/formatters"
import type { Snapshot, TrackerSummary } from "@/types/api"

type DayRange = 7 | 30 | 90 | 365

const DAY_RANGES: DayRange[] = [7, 30, 90, 365]

function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
}

export default function TrackerDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [tracker, setTracker] = useState<TrackerSummary | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [days, setDays] = useState<DayRange>(30)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [pollError, setPollError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [trackersRes, snapshotsRes] = await Promise.all([
        fetch("/api/trackers"),
        fetch(`/api/trackers/${id}/snapshots?days=${days}`),
      ])

      if (trackersRes.ok) {
        const allTrackers: TrackerSummary[] = await trackersRes.json()
        const found = allTrackers.find((t) => t.id === Number(id))
        setTracker(found ?? null)
      }

      if (snapshotsRes.ok) {
        const data: Snapshot[] = await snapshotsRes.json()
        setSnapshots(data)
      }
    } catch {
      // silently ignore fetch errors; stale data stays visible
    } finally {
      setLoading(false)
    }
  }, [id, days])

  useEffect(() => {
    setLoading(true)
    loadData()
  }, [loadData])

  async function handlePollNow() {
    setPolling(true)
    setPollError(null)
    try {
      const res = await fetch(`/api/trackers/${id}/poll`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Poll failed" }))
        setPollError((body as { error?: string }).error ?? "Poll failed")
      } else {
        await loadData()
      }
    } catch {
      setPollError("Network error during poll")
    } finally {
      setPolling(false)
    }
  }

  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const stats = tracker?.latestStats ?? null

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-secondary text-sm font-mono">Loading...</p>
      </div>
    )
  }

  if (!tracker) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-danger text-sm font-mono">Tracker not found.</p>
      </div>
    )
  }

  const lastPolledLabel = tracker.lastPolledAt
    ? new Date(tracker.lastPolledAt).toLocaleString()
    : "Never"

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            {tracker.color && (
              <span
                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: tracker.color }}
                aria-hidden="true"
              />
            )}
            <h1 className="text-xl font-semibold text-primary">{tracker.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {stats?.username && (
              <Badge variant="default">{stats.username}</Badge>
            )}
            {stats?.group && (
              <Badge variant="accent">{stats.group}</Badge>
            )}
            <Badge variant="default">{tracker.platformType}</Badge>
            {!tracker.isActive && (
              <Badge variant="warn">Inactive</Badge>
            )}
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handlePollNow}
          disabled={polling}
          className="flex-shrink-0"
        >
          {polling ? "Polling..." : "Poll Now"}
        </Button>
      </div>

      {/* Poll error banner */}
      {pollError && (
        <Card glow glowColor="danger" className="border-danger">
          <p className="text-danger text-sm font-mono">Poll error: {pollError}</p>
        </Card>
      )}

      {/* Tracker error banner */}
      {tracker.lastError && (
        <Card glow glowColor="danger" className="border-danger">
          <p className="text-xs font-sans font-medium text-danger uppercase tracking-wider mb-1">
            Last Error
          </p>
          <p className="text-danger text-sm font-mono">{tracker.lastError}</p>
        </Card>
      )}

      {/* Stat cards row 1: Uploaded, Downloaded, Ratio, Buffer */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Uploaded"
          value={formatBytesFromString(stats?.uploadedBytes ?? null)}
        />
        <StatCard
          label="Downloaded"
          value={formatBytesFromString(stats?.downloadedBytes ?? null)}
        />
        <StatCard
          label="Ratio"
          value={formatRatio(stats?.ratio)}
          trend={
            stats?.ratio === null || stats?.ratio === undefined
              ? undefined
              : stats.ratio >= 2
                ? "up"
                : stats.ratio >= 1
                  ? "flat"
                  : "down"
          }
        />
        <StatCard
          label="Buffer"
          value={formatBytesFromString(latestSnapshot?.bufferBytes ?? null)}
        />
      </div>

      {/* Stat cards row 2: Seeding, Leeching, Seedbonus, Hit & Runs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Seeding"
          value={stats?.seedingCount ?? "—"}
        />
        <StatCard
          label="Leeching"
          value={stats?.leechingCount ?? "—"}
        />
        <StatCard
          label="Seedbonus"
          value={
            latestSnapshot?.seedbonus !== null && latestSnapshot?.seedbonus !== undefined
              ? latestSnapshot.seedbonus.toFixed(1)
              : "—"
          }
        />
        <StatCard
          label="Hit & Runs"
          value={
            latestSnapshot?.hitAndRuns !== null && latestSnapshot?.hitAndRuns !== undefined
              ? latestSnapshot.hitAndRuns
              : "—"
          }
        />
      </div>

      {/* Chart section */}
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider">
            Upload / Download History
          </h2>
          <div className="flex items-center gap-1">
            {DAY_RANGES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={[
                  "px-2.5 py-1 text-xs font-mono rounded transition-colors duration-100 cursor-pointer",
                  days === d
                    ? "bg-accent-dim text-accent border border-accent"
                    : "text-tertiary border border-transparent hover:text-secondary hover:border-border",
                ].join(" ")}
              >
                {d === 365 ? "365d" : `${d}d`}
              </button>
            ))}
          </div>
        </div>
        <UploadDownloadChart snapshots={snapshots} />
      </Card>

      {/* Footer */}
      <p className="text-xs text-tertiary font-mono">
        Last polled: {lastPolledLabel} · Polling every {formatHours(tracker.pollIntervalMinutes)}
      </p>
    </div>
  )
}
