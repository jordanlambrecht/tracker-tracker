// src/components/charts/FleetSpeedSparklines.tsx
"use client"

import { useQueries } from "@tanstack/react-query"
import { useRef } from "react"
import { Card } from "@/components/ui/Card"
import { Notice } from "@/components/ui/Notice"
import { Tooltip } from "@/components/ui/Tooltip"
import { formatSpeed } from "@/lib/formatters"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { CHART_THEME } from "./lib/theme"

// ── Constants ──

const COLOR_UPLOAD = CHART_THEME.upload
const COLOR_DOWNLOAD = CHART_THEME.download
const SPARKLINE_WIDTH = 80
const SPARKLINE_HEIGHT = 24
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
  isActive?: boolean
}

// ── Helpers ──

function buildPolylinePoints(values: number[], width: number, height: number): string {
  if (values.length < 2) return ""
  const max = values.reduce((m, v) => (v > m ? v : m), 1)
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

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
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

  const fillPoints = `${points} ${SPARKLINE_WIDTH},${SPARKLINE_HEIGHT} 0,${SPARKLINE_HEIGHT}`

  return (
    <svg
      width={SPARKLINE_WIDTH}
      height={SPARKLINE_HEIGHT}
      aria-hidden="true"
      className="overflow-visible"
    >
      <polygon points={fillPoints} fill={color} fillOpacity={0.12} />
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

function ClientSpeedCard({ name, state }: { name: string; state: ClientSpeedState }) {
  const uploadValues = state.history.map((e) => e.uploadSpeed)
  const downloadValues = state.history.map((e) => e.downloadSpeed)
  const currentUpload = state.latest?.uploadSpeed ?? 0
  const currentDownload = state.latest?.downloadSpeed ?? 0

  return (
    <Card className="flex flex-col gap-2 p-3">
      <Tooltip content={name}>
        <p className="text-xs font-mono truncate text-secondary">{name}</p>
      </Tooltip>

      {state.error ? (
        <Notice variant="warn" message="fetch error" />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-3xs font-mono" style={{ color: COLOR_UPLOAD }}>
                ↑
              </span>
              <MiniSparkline values={uploadValues} color={COLOR_UPLOAD} />
            </div>
            <span className="text-3xs font-mono tabular-nums" style={{ color: COLOR_UPLOAD }}>
              {formatSpeed(currentUpload)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-3xs font-mono" style={{ color: COLOR_DOWNLOAD }}>
                ↓
              </span>
              <MiniSparkline values={downloadValues} color={COLOR_DOWNLOAD} />
            </div>
            <span className="text-3xs font-mono tabular-nums" style={{ color: COLOR_DOWNLOAD }}>
              {formatSpeed(currentDownload)}
            </span>
          </div>
        </>
      )}
    </Card>
  )
}

// ── Accumulate history across refetches ──

function useAccumulatedSpeeds(
  clients: { id: number; name: string }[],
  isActive: boolean
): Record<number, ClientSpeedState> {
  const historyRef = useRef<Record<number, SpeedEntry[]>>({})

  const speedQueries = useQueries({
    queries: clients.map((client) => ({
      queryKey: ["client-speeds", client.id] as const,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const res = await fetch(`/api/clients/${client.id}/speeds`, { signal })
        if (!res.ok) throw new Error("fetch error")
        return res.json() as Promise<SpeedEntry[]>
      },
      refetchInterval: isActive ? 10_000 : false,
    })),
  })

  const result: Record<number, ClientSpeedState> = {}

  for (let i = 0; i < clients.length; i++) {
    const clientId = clients[i].id
    const query = speedQueries[i]

    if (query.error) {
      result[clientId] = {
        history: historyRef.current[clientId] ?? [],
        latest: null,
        error: true,
      }
      continue
    }

    const incoming = query.data
    if (incoming && incoming.length > 0) {
      const prev = historyRef.current[clientId] ?? []
      const all = [...prev, ...incoming]
      const seen = new Set<number>()
      const deduped = all.filter((e) => {
        if (seen.has(e.timestamp)) return false
        seen.add(e.timestamp)
        return true
      })
      deduped.sort((a, b) => a.timestamp - b.timestamp)
      const trimmed = deduped.slice(-MAX_HISTORY_POINTS)
      historyRef.current[clientId] = trimmed
    }

    const history = historyRef.current[clientId] ?? []
    result[clientId] = {
      history,
      latest: history.at(-1) ?? null,
      error: false,
    }
  }

  return result
}

// ── Main component ──

function FleetSpeedSparklines({ clients, isActive = true }: FleetSpeedSparklinesProps) {
  const speedMap = useAccumulatedSpeeds(clients, isActive)

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
