// src/components/charts/FleetSpeedSparklines.tsx
//
// Pure SVG sparkline cards for per-client upload + download speed history.
//
// Functions: buildPolylinePoints, MiniSparkline, ClientSpeedCard, FleetSpeedSparklines

"use client"

import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Tooltip } from "@/components/ui/Tooltip"
import { formatBytesNum } from "@/lib/formatters"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME } from "./theme"

// ── Constants ──

const COLOR_UPLOAD = CHART_THEME.accent
const COLOR_DOWNLOAD = CHART_THEME.warn
const SPARKLINE_WIDTH = 80
const SPARKLINE_HEIGHT = 24
const POLL_INTERVAL_MS = 10_000
const MAX_HISTORY_POINTS = 60

// ── Types ──

interface SpeedEntry {
  timestamp: number
  uploadSpeed: number
  downloadSpeed: number
}

interface ClientSpeedState {
  history: SpeedEntry[]
  latest: SpeedEntry | null
  error: boolean
}

interface FleetSpeedSparklinesProps {
  clients: { id: number; name: string }[]
}

// ── Helpers ──

/**
 * Converts an array of numeric values into SVG polyline `points` attribute string.
 * Maps values onto a viewBox of `width` × `height`, with y-axis inverted (SVG top=0).
 * Returns empty string when fewer than 2 points exist.
 */
function buildPolylinePoints(
  values: number[],
  width: number,
  height: number
): string {
  if (values.length < 2) return ""
  const max = Math.max(...values, 1)
  const step = width / (values.length - 1)
  return values
    .map((v, i) => {
      const x = i * step
      const y = height - (v / max) * height
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")
}

// ── Sub-components ──

interface MiniSparklineProps {
  values: number[]
  color: string
}

/**
 * Pure SVG sparkline — no ECharts.
 * Renders an 80×24 polyline with a translucent fill beneath the line.
 */
function MiniSparkline({ values, color }: MiniSparklineProps) {
  const points = buildPolylinePoints(values, SPARKLINE_WIDTH, SPARKLINE_HEIGHT)

  if (!points) {
    return (
      <svg
        width={SPARKLINE_WIDTH}
        height={SPARKLINE_HEIGHT}
        aria-hidden="true"
        className="opacity-20"
      >
        <line
          x1="0"
          y1={SPARKLINE_HEIGHT / 2}
          x2={SPARKLINE_WIDTH}
          y2={SPARKLINE_HEIGHT / 2}
          stroke={color}
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      </svg>
    )
  }

  // Build a closed fill path: polyline + descend to bottom-right + bottom-left
  const firstX = 0
  const lastX = SPARKLINE_WIDTH
  const fillPoints = `${points} ${lastX},${SPARKLINE_HEIGHT} ${firstX},${SPARKLINE_HEIGHT}`

  return (
    <svg
      width={SPARKLINE_WIDTH}
      height={SPARKLINE_HEIGHT}
      aria-hidden="true"
      className="overflow-visible"
    >
      <polygon
        points={fillPoints}
        fill={color}
        fillOpacity={0.12}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

interface ClientSpeedCardProps {
  name: string
  state: ClientSpeedState
}

/**
 * Single client card showing name, upload+download sparklines, and current speeds.
 */
function ClientSpeedCard({ name, state }: ClientSpeedCardProps) {
  const uploadValues = state.history.map((e) => e.uploadSpeed)
  const downloadValues = state.history.map((e) => e.downloadSpeed)
  const currentUpload = state.latest?.uploadSpeed ?? 0
  const currentDownload = state.latest?.downloadSpeed ?? 0

  return (
    <Card className="flex flex-col gap-2 p-3">
      <Tooltip content={name}>
        <p
          className="text-xs font-mono truncate text-secondary"
        >
          {name}
        </p>
      </Tooltip>

      {state.error ? (
        <p className="text-xs font-mono text-warn">
          fetch error
        </p>
      ) : (
        <>
          {/* Upload row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono" style={{ color: COLOR_UPLOAD }}>
                ↑
              </span>
              <MiniSparkline values={uploadValues} color={COLOR_UPLOAD} />
            </div>
            <span
              className="text-[10px] font-mono tabular-nums"
              style={{ color: COLOR_UPLOAD }}
            >
              {formatBytesNum(currentUpload)}/s
            </span>
          </div>

          {/* Download row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono" style={{ color: COLOR_DOWNLOAD }}>
                ↓
              </span>
              <MiniSparkline values={downloadValues} color={COLOR_DOWNLOAD} />
            </div>
            <span
              className="text-[10px] font-mono tabular-nums"
              style={{ color: COLOR_DOWNLOAD }}
            >
              {formatBytesNum(currentDownload)}/s
            </span>
          </div>
        </>
      )}
    </Card>
  )
}

// ── Main component ──

/**
 * Grid of per-client speed sparkline cards.
 * Each card polls /api/clients/{id}/speeds every 10 seconds.
 */
function FleetSpeedSparklines({ clients }: FleetSpeedSparklinesProps) {
  const [speedMap, setSpeedMap] = useState<Record<number, ClientSpeedState>>({})
  const intervalsRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map())

  useEffect(() => {
    if (clients.length === 0) return

    // Initialize state for all clients
    setSpeedMap((prev) => {
      const next: Record<number, ClientSpeedState> = { ...prev }
      for (const client of clients) {
        if (!next[client.id]) {
          next[client.id] = { history: [], latest: null, error: false }
        }
      }
      return next
    })

    async function fetchSpeeds(clientId: number): Promise<void> {
      try {
        const res = await fetch(`/api/clients/${clientId}/speeds`)
        if (!res.ok) {
          setSpeedMap((prev) => ({
            ...prev,
            [clientId]: { ...prev[clientId], error: true },
          }))
          return
        }
        const entries: SpeedEntry[] = await res.json()
        if (!Array.isArray(entries) || entries.length === 0) return

        setSpeedMap((prev) => {
          const existing = prev[clientId] ?? { history: [], latest: null, error: false }
          // Append new entries, deduplicate by timestamp, keep most recent MAX_HISTORY_POINTS
          const allEntries = [...existing.history, ...entries]
          const seen = new Set<number>()
          const deduped = allEntries.filter((e) => {
            if (seen.has(e.timestamp)) return false
            seen.add(e.timestamp)
            return true
          })
          deduped.sort((a, b) => a.timestamp - b.timestamp)
          const trimmed = deduped.slice(-MAX_HISTORY_POINTS)
          return {
            ...prev,
            [clientId]: {
              history: trimmed,
              latest: trimmed[trimmed.length - 1] ?? null,
              error: false,
            },
          }
        })
      } catch {
        setSpeedMap((prev) => ({
          ...prev,
          [clientId]: { ...(prev[clientId] ?? { history: [], latest: null }), error: true },
        }))
      }
    }

    // Initial fetch + polling per client
    const intervals = intervalsRef.current
    for (const client of clients) {
      fetchSpeeds(client.id)
      const handle = setInterval(() => fetchSpeeds(client.id), POLL_INTERVAL_MS)
      intervals.set(client.id, handle)
    }

    return () => {
      for (const handle of intervals.values()) {
        clearInterval(handle)
      }
      intervals.clear()
    }
  }, [clients])

  if (clients.length === 0) {
    return <ChartEmptyState height={120} message="No download clients configured." />
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      {clients.map((client) => (
        <ClientSpeedCard
          key={client.id}
          name={client.name}
          state={speedMap[client.id] ?? { history: [], latest: null, error: false }}
        />
      ))}
    </div>
  )
}

export type { FleetSpeedSparklinesProps, SpeedEntry }
export { FleetSpeedSparklines }
